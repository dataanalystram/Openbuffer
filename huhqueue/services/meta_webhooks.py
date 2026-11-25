"""Instagram webhooks (Meta app -> Instagram -> API setup with Instagram login -> 3. Configure webhooks).

* ``GET /webhooks/instagram`` answers Meta's subscription check: ``hub.mode=subscribe`` and ``hub.verify_token`` equal
  to ``INSTAGRAM_WEBHOOK_VERIFY_TOKEN`` -> 200 ``text/plain`` with the exact ``hub.challenge``. Missing or invalid
  parameters -> 400, wrong token (or none configured) -> 403.
* ``POST /webhooks/instagram`` receives events. The body is trusted only when ``X-Hub-Signature-256`` is the
  HMAC-SHA256 of the raw body with the Instagram app secret (else 403). Valid events are acknowledged at once and
  processed after the response: ``comments`` / ``live_comments`` / ``mentions`` trigger a comment sync for the
  matching channel. Meta retries deliveries, so a payload seen in the last 24 h is acknowledged but not processed
  again (the sync itself is also an upsert, so a repeat is harmless).

Logs carry only counts, field names, channel ids and a short body hash: never tokens, secrets or comment text.
Docs: developers.facebook.com/docs/instagram-platform/webhooks
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import threading
import time

from sqlalchemy import select

from ..models import Channel
from . import community

log = logging.getLogger("huhqueue.webhooks.instagram")
log.setLevel(logging.INFO)
if not log.handlers:   # the server configures no root handler (Python's fallback prints WARNING+ only)
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    log.addHandler(_h)
SYNC_FIELDS = {"comments", "live_comments", "mentions"}
DEDUPE_TTL = 24 * 3600
DEDUPE_MAX = 10_000

# ponytail: in-memory, per process; a restart forgets recent deliveries (only costs one extra idempotent sync).
_seen: dict[str, float] = {}
_seen_lock = threading.Lock()


def log_event(level: int, **fields) -> None:
    """One JSON object per line, so the logs are greppable and machine-readable."""
    log.log(level, json.dumps(fields, sort_keys=True, default=str))


def verify(core, mode: str | None, token: str | None, challenge: str | None) -> tuple[int, str]:
    """(status, plain-text body) for Meta's GET verification request."""
    if not mode or not token or not challenge:
        log_event(logging.WARNING, event="ig_webhook_verify", result="missing_params")
        return 400, "Missing hub.mode, hub.verify_token or hub.challenge"
    if mode != "subscribe":
        log_event(logging.WARNING, event="ig_webhook_verify", result="bad_mode")
        return 400, "hub.mode must be subscribe"
    expected = core.settings.instagram_webhook_verify_token
    if not expected:
        log_event(logging.WARNING, event="ig_webhook_verify", result="not_configured")
        return 403, "Forbidden"
    if not hmac.compare_digest(token.encode(), expected.encode()):
        log_event(logging.WARNING, event="ig_webhook_verify", result="token_mismatch")
        return 403, "Forbidden"
    log_event(logging.INFO, event="ig_webhook_verify", result="ok")
    return 200, challenge


def signature_ok(core, raw: bytes, header: str | None) -> bool:
    secret = core.settings.instagram_app_secret
    if not secret or not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(header[7:].strip().lower(), expected)


def first_delivery(raw: bytes) -> tuple[bool, str]:
    """(is this the first time we see this exact payload in DEDUPE_TTL, short body hash for logs)."""
    digest = hashlib.sha256(raw).hexdigest()
    now = time.time()
    with _seen_lock:
        if len(_seen) > DEDUPE_MAX:
            for k in [k for k, t in _seen.items() if now - t > DEDUPE_TTL] or list(_seen)[: len(_seen) // 2]:
                _seen.pop(k, None)
        t = _seen.get(digest)
        if t is not None and now - t < DEDUPE_TTL:
            return False, digest[:12]
        _seen[digest] = now
    return True, digest[:12]


def parse(raw: bytes) -> tuple[set[str], set[str]]:
    """(IG account ids with comment/mention changes, every field name seen)."""
    try:
        body = json.loads(raw or b"{}")
    except ValueError:
        return set(), set()
    if not isinstance(body, dict) or body.get("object") != "instagram":
        return set(), set()
    ids, fields = set(), set()
    for e in body.get("entry") or []:
        if not isinstance(e, dict):
            continue
        names = {c.get("field") for c in e.get("changes") or [] if isinstance(c, dict)} - {None}
        fields |= {str(n) for n in names}
        if names & SYNC_FIELDS:
            ids.add(str(e.get("id")))
    return ids, fields


def channels_for(core, ig_ids: set[str]) -> list[str]:
    if not ig_ids:
        return []
    with core.db.session() as s:
        rows = s.scalars(select(Channel).where(Channel.provider == "instagram", Channel.status == "active")).all()
        return [c.id for c in rows if ig_ids & {str(c.external_id), str((c.meta or {}).get("user_id") or "")}]


def process(core, raw: bytes, body_hash: str) -> None:
    """Runs after the 200 has been sent."""
    ig_ids, fields = parse(raw)
    cids = channels_for(core, ig_ids)
    synced = 0
    for cid in cids:
        try:
            synced += community.sync_channel(core, cid) or 0
        except Exception:   # never let one channel stop the rest; details are in the event log
            log_event(logging.ERROR, event="ig_webhook_process", result="sync_failed", channel_id=cid, body_hash=body_hash)
    log_event(logging.INFO, event="ig_webhook_process", result="ok", body_hash=body_hash, fields=sorted(fields),
         accounts=len(ig_ids), channels=cids, comments_synced=synced)
