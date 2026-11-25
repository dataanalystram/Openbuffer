"""Landing-page waitlist: a public signup (HuhbyteAI in the cloud, HuhQueue Studio as open source) and an owner-only
list / delete. One row per email; signing up again adds lists and replaces the note instead of making a duplicate.

Emails and notes are encrypted at rest with the install's key (HUHQ_SECRET_KEY or data/secret.key) and never logged; a keyed
hash of the address finds an existing row. IP addresses are only held in memory for the rate limit."""
from __future__ import annotations

import csv
import hashlib
import hmac
import io
import re

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..models import WaitlistEntry, utcnow
from ..security import RateLimiter

EMAIL = re.compile(r"[^@\s<>()\[\],;:\"\\\x00-\x1f]{1,64}@[^@\s<>()\[\],;:\"\\\x00-\x1f]+\.[^@\s<>()\[\],;:\"\\\x00-\x1f.]{2,}")
MAX_EMAIL, MAX_NOTE = 254, 1000
PER_MIN = 6                      # signups per minute per IP
TOTAL_PER_MIN = 60               # and for everyone together, because X-Forwarded-For can be spoofed
_limiter = RateLimiter()


class WaitlistError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def _bool(v) -> bool:
    return v is True or str(v).strip().lower() in ("1", "true", "on", "yes")


def _iso(d) -> str:
    return d.isoformat() + "Z" if d else ""


def _hash(core, email: str) -> str:
    return hmac.new(core.cipher.key, b"waitlist:" + email.encode(), hashlib.sha256).hexdigest()


def _dict(core, x: WaitlistEntry) -> dict:
    return {"id": x.id, "email": core.cipher.decrypt(x.email_enc) or "", "cloud": x.cloud, "studio": x.studio,
            "note": core.cipher.decrypt(x.note_enc) or "", "referrer": x.referrer,
            "created_at": _iso(x.created_at), "updated_at": _iso(x.updated_at)}


def subscribe(core, form: dict, ip: str = "", referrer: str = "") -> str:
    """Public signup. Returns ok | spam | limited | invalid_email | pick_a_list."""
    if str(form.get("website") or "").strip():            # honeypot field, hidden from people
        return "spam"
    if not (_limiter.allow("*", TOTAL_PER_MIN) and _limiter.allow(ip[:64] or "?", PER_MIN)):
        return "limited"
    email = str(form.get("email") or "").strip().lower()
    if len(email) > MAX_EMAIL or not EMAIL.fullmatch(email):
        return "invalid_email"
    cloud, studio, hosted = _bool(form.get("cloud")), _bool(form.get("studio")), _bool(form.get("studio_hosted"))
    if not (cloud or studio or hosted):
        return "pick_a_list"
    note = str(form.get("note") or "").strip()[:MAX_NOTE]
    if hosted:   # this install keeps two lists, so "Studio hosted" is recorded as a line in the note
        note = ("Wants Studio hosted. " + note).strip()[:MAX_NOTE]
    key = _hash(core, email)
    try:
        with core.db.session() as s:
            row = s.scalar(select(WaitlistEntry).where(WaitlistEntry.email_hash == key))
            if row:
                row.cloud, row.studio = row.cloud or cloud, row.studio or studio
                if note:
                    row.note_enc = core.cipher.encrypt(note)
                row.updated_at = utcnow()
            else:
                s.add(WaitlistEntry(email_hash=key, email_enc=core.cipher.encrypt(email), cloud=cloud, studio=studio,
                                    note_enc=core.cipher.encrypt(note), referrer=re.split(r"[?#]", referrer or "")[0][:300]))
    except IntegrityError:       # the same address twice at the same moment: the other request saved it
        pass
    return "ok"


def _cell(v: str) -> str:
    """Stop spreadsheet formulas: a cell starting with = + - @ gets a leading apostrophe."""
    return "'" + v if v[:1] in ("=", "+", "-", "@", "\t", "\r") else v


def list_entries(core, fmt: str = "json"):
    with core.db.session() as s:
        rows = [_dict(core, x) for x in s.scalars(select(WaitlistEntry).order_by(WaitlistEntry.created_at.desc()))]
    if fmt == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["email", "cloud", "studio", "note", "signed_up_at"])
        for r in rows:
            w.writerow([_cell(r["email"]), "yes" if r["cloud"] else "", "yes" if r["studio"] else "", _cell(r["note"]), r["created_at"]])
        return buf.getvalue()
    return {"count": len(rows), "cloud": sum(r["cloud"] for r in rows), "studio": sum(r["studio"] for r in rows), "items": rows}


def delete_entry(core, wid: str) -> dict:
    with core.db.session() as s:
        x = s.get(WaitlistEntry, wid)
        if not x:
            raise WaitlistError("Waitlist entry not found", 404)
        s.delete(x)
    return {"deleted": wid}
