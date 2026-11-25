"""Landing page + waitlist.

Public (no login, on the UI app and the edge app, only when HUHQ_LANDING=1): GET /welcome (the HuhbyteAI landing page and its
assets), GET /welcome.md (the same page as Markdown for agents) and POST /waitlist (JSON, or a plain HTML form as a no-JS fallback).
Owner-only: GET /api/waitlist (json or format=csv) and DELETE /api/waitlist/{id}, both in the action registry at the bottom.
"""
from __future__ import annotations

import json
from html import escape
from pathlib import Path
from urllib.parse import parse_qsl

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response

from ..actions import S, Action
from ..actions import register as _register
from ..services import waitlist as wl

LANDING = Path(__file__).resolve().parent.parent / "static" / "landing"
NO_CACHE = {"Cache-Control": "no-cache"}
PRIVATE = {"Cache-Control": "no-store"}
MAX_BODY = 8 * 1024              # a signup is an email and a 1000-character note
HTTP = {"ok": 200, "spam": 200, "limited": 429, "invalid_email": 422, "pick_a_list": 422}


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "")


def privacy_html(contact: str) -> str:
    how = (f'email <a href="mailto:{escape(contact)}">{escape(contact)}</a>' if contact else "reply to any message from us")
    return ("<h2>Waitlist</h2><p>If you join the waitlist we store your email, the lists you picked, your optional note, the page you "
            "came from and the date. Your email and note are encrypted, only the owner and admins of this site can read them, and they are "
            "used only to write to you about what you signed up for. They are never sold or shared. Your IP address is not stored. "
            f"To have your signup deleted, {how}.</p>")


def add_public_waitlist_routes(app: FastAPI, core) -> None:
    def _on() -> None:
        if not core.settings.landing:
            raise HTTPException(404)

    @app.get("/welcome", include_in_schema=False)
    def welcome():
        _on()
        return FileResponse(LANDING / "index.html", headers=NO_CACHE)

    @app.get("/welcome.md", include_in_schema=False)
    def welcome_md():
        _on()
        return FileResponse(LANDING / "agent.md", media_type="text/markdown; charset=utf-8", headers=NO_CACHE)

    @app.get("/welcome/{name:path}", include_in_schema=False)
    def welcome_asset(name: str):
        _on()
        f = (LANDING / name).resolve()
        if LANDING.resolve() not in f.parents or not f.is_file():
            raise HTTPException(404)
        return FileResponse(f, headers={"Cache-Control": "public, max-age=3600"})

    @app.post("/waitlist", include_in_schema=False)
    async def waitlist_join(request: Request):
        _on()
        is_json = "json" in request.headers.get("content-type", "")
        raw = b""
        async for chunk in request.stream():
            raw += chunk
            if len(raw) > MAX_BODY:
                raise HTTPException(413)
        try:
            form = json.loads(raw) if is_json else dict(parse_qsl(raw.decode()))
        except ValueError:
            form = {}
        form = form if isinstance(form, dict) else {}
        status = wl.subscribe(core, form, _client_ip(request), request.headers.get("referer", ""))
        if is_json:
            return JSONResponse({"status": "ok" if status == "spam" else status}, status_code=HTTP[status])
        return RedirectResponse(f"/welcome?joined={'ok' if status == 'spam' else status}#waitlist", status_code=303)


def add_waitlist_routes(app: FastAPI, core) -> None:
    @app.get("/api/waitlist", tags=["waitlist"])
    def waitlist_list(format: str = "json"):  # noqa: A002
        if format == "csv":
            return Response(wl.list_entries(core, "csv"), media_type="text/csv",
                            headers={**PRIVATE, "Content-Disposition": 'attachment; filename="waitlist.csv"'})
        return JSONResponse(wl.list_entries(core), headers=PRIVATE)

    @app.delete("/api/waitlist/{wid}", tags=["waitlist"])
    def waitlist_delete(wid: str):
        try:
            return wl.delete_entry(core, wid)
        except wl.WaitlistError as e:
            raise HTTPException(e.status, e.message)


for _a in (
    Action("waitlist.list", "Landing-page waitlist signups: who wants HuhbyteAI in the cloud or Studio as open source (json, or format=csv)",
           "GET", "/api/waitlist", {"format": {"type": "string", "enum": ["json", "csv"]}}, (), "admin", "safe",
           examples=("who is on the waitlist?",), group="waitlist", ui="API only (huhqueue run waitlist.list)"),
    Action("waitlist.delete", "Remove one waitlist signup", "DELETE", "/api/waitlist/{id}", {"id": S}, ("id",), "admin", "destructive",
           group="waitlist", ui="API only (huhqueue run waitlist.delete id=...)"),
):
    _register(_a)
