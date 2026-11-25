"""Landing page (/welcome) and its waitlist: off by default, public signup, owner-only list / CSV / delete."""
import csv
import io

import pytest
from fastapi.testclient import TestClient

from huhqueue import actions as reg
from huhqueue.services import waitlist as wl

from .test_teams import member


@pytest.fixture(autouse=True)
def fresh_rate_limit():
    wl._limiter.hits.clear()


def _join(c, **kw):
    return c.post("/waitlist", json={"email": "Ada@Example.com", "cloud": True, **kw})


def test_landing_and_waitlist_are_off_by_default(app, edge):
    for c in (TestClient(app), edge):
        assert c.get("/welcome").status_code == 404
        assert c.get("/welcome.md").status_code == 404
        assert c.get("/welcome/landing.css").status_code == 404
        assert _join(c).status_code == 404


def test_landing_page_and_assets_when_enabled(app, edge, core):
    core.settings.landing = True
    for c in (TestClient(app), edge):                       # the UI app and the public edge app both serve it
        page = c.get("/welcome")
        assert page.status_code == 200 and "<span>everywhere.</span>" in page.text and 'id="wl-form"' in page.text
        assert "huhqueue-studio" not in page.text           # no links to Studio
        assert c.get("/welcome/landing.css").status_code == 200
        assert c.get("/welcome/landing.js").status_code == 200
        assert c.get("/welcome/img/dance.webp").headers["content-type"] == "image/webp"
        assert "# HuhbyteAI" in c.get("/welcome.md").text
        assert c.get("/welcome/%2e%2e/landing.py").status_code == 404


def test_signup_validates_dedupes_and_merges(app, core):
    core.settings.landing = True
    c = TestClient(app)
    assert c.post("/waitlist", json={"email": "nope", "cloud": True}).json() == {"status": "invalid_email"}
    assert c.post("/waitlist", json={"email": "a@b.co"}).status_code == 422            # no list picked
    assert _join(c, note="hello").json() == {"status": "ok"}
    assert c.post("/waitlist", json={"email": "ada@example.com", "studio": True}).status_code == 200   # same person, second list
    rows = wl.list_entries(core)
    assert rows["count"] == 1 and rows["cloud"] == 1 and rows["studio"] == 1
    row = rows["items"][0]
    assert row["email"] == "ada@example.com" and row["cloud"] and row["studio"] and row["note"] == "hello"


def test_honeypot_and_rate_limit(app, core, monkeypatch):
    core.settings.landing = True
    c = TestClient(app)
    assert _join(c, website="http://spam").status_code == 200 and wl.list_entries(core)["count"] == 0   # looks fine, stores nothing
    monkeypatch.setattr(wl, "PER_MIN", 3)
    wl._limiter.hits.clear()
    codes = [c.post("/waitlist", json={"email": f"p{i}@example.com", "cloud": True}).status_code for i in range(5)]
    assert codes[:3] == [200, 200, 200] and codes[3:] == [429, 429]


def test_form_fallback_redirects(app, core):
    core.settings.landing = True
    r = TestClient(app).post("/waitlist", data={"email": "form@example.com", "studio": "on"}, follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"] == "/welcome?joined=ok#waitlist"
    assert wl.list_entries(core)["items"][0]["studio"] is True


def test_list_csv_and_delete_need_login_and_are_registry_actions(app, api, core):
    core.settings.landing = True
    anon = TestClient(app)
    assert anon.get("/api/waitlist").status_code == 401
    anon.post("/waitlist", json={"email": "=cmd@example.com", "cloud": True, "note": "+1 hi"})
    data = api.get("/api/waitlist").json()
    assert data["count"] == 1
    rows = list(csv.reader(io.StringIO(api.get("/api/waitlist?format=csv").text)))
    assert rows[0][:2] == ["email", "cloud"] and rows[1][0].startswith("'=") and rows[1][3].startswith("'+")   # no spreadsheet formulas
    assert api.delete(f"/api/waitlist/{data['items'][0]['id']}").json()["deleted"]
    assert api.get("/api/waitlist").json()["count"] == 0
    assert api.delete("/api/waitlist/wl_missing").status_code == 404
    a = reg.get("waitlist.list")
    assert a and a.scope == "admin" and reg.get("waitlist.delete").risk == "destructive"


def test_signups_are_encrypted_and_never_logged(app, api, core, caplog):
    core.settings.landing = True
    caplog.set_level("DEBUG")
    assert TestClient(app).post("/waitlist", json={"email": "Secret.Person@Example.com", "cloud": True, "note": "my private note"},
                                headers={"Referer": "https://x.test/p?email=leak@x.test#frag"}).status_code == 200
    raw = b"".join(f.read_bytes() for f in core.settings.data_dir.glob("huhqueue.db*"))
    assert b"secret.person" not in raw.lower() and b"my private note" not in raw and b"leak@x.test" not in raw
    assert "secret.person" not in caplog.text.lower() and "my private note" not in caplog.text
    row = api.get("/api/waitlist").json()["items"][0]           # the owner still reads it in clear
    assert row["email"] == "secret.person@example.com" and row["note"] == "my private note" and row["referrer"] == "https://x.test/p"
    wid = row["id"]
    api.delete(f"/api/waitlist/{wid}")
    assert "secret.person" not in api.get("/api/audit").text.lower()


def test_bad_input_is_refused(app, core):
    core.settings.landing = True
    c = TestClient(app)
    for email in ("a@b", "a b@c.co", "<x>@c.co", "a@c.co,b@c.co", "a@c.co\nBcc: z@c.co", "x" * 300 + "@c.co", {"a": 1}, None):
        wl._limiter.hits.clear()
        assert c.post("/waitlist", json={"email": email, "cloud": True}).status_code == 422, email
    assert c.post("/waitlist", content=b"{not json", headers={"Content-Type": "application/json"}).status_code == 422
    assert c.post("/waitlist", json={"email": "a@c.co", "cloud": True, "note": "x" * 9000}).status_code == 413   # body cap
    wl._limiter.hits.clear()
    assert wl.list_entries(core)["count"] == 0


def test_spoofed_ips_hit_the_total_cap(app, core, monkeypatch):
    core.settings.landing = True
    monkeypatch.setattr(wl, "TOTAL_PER_MIN", 3)
    c = TestClient(app)
    codes = [c.post("/waitlist", json={"email": f"p{i}@example.com", "cloud": True}, headers={"X-Forwarded-For": f"9.9.9.{i}"}).status_code
             for i in range(5)]
    assert codes == [200, 200, 200, 429, 429]


def test_only_owners_and_admins_read_it(app, api, core, edge):
    core.settings.landing = True
    assert edge.get("/api/waitlist").status_code == 404                                  # not on the public app at all
    for role in ("viewer", "client", "contributor", "editor"):
        m = member(app, api, role)
        assert m.get("/api/waitlist").status_code == 403 and m.get("/api/waitlist?format=csv").status_code == 403
        assert m.post("/api/actions/waitlist.list:run", {"params": {}}).status_code == 403
    assert member(app, api, "admin").get("/api/waitlist").status_code == 200
    for scopes, want in ((["read", "write"], 403), (["admin"], 200)):
        tok = api.post("/api/tokens", {"name": "t", "scopes": scopes}).json()["token"]
        r = TestClient(app).get("/api/waitlist", headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == want
    assert r.headers["cache-control"] == "no-store"


def test_privacy_page_covers_the_waitlist_only_when_on(edge, core):
    assert "waitlist" not in edge.get("/privacy").text.lower()
    core.settings.landing, core.settings.contact_email = True, "hi@example.com"
    assert "waitlist" in edge.get("/privacy").text.lower() and "hi@example.com" in edge.get("/privacy").text
    assert 'href="/privacy"' in edge.get("/welcome").text
