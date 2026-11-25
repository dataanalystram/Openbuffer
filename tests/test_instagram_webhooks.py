"""Instagram webhooks: Meta's verify-token handshake and signed events that trigger an instant comment sync."""
import hashlib
import hmac
import json
import logging

import pytest
from fastapi.testclient import TestClient

from huhqueue.services import community, meta_webhooks

from .test_meta_compliance import connect_ig

TOKEN = "verify-me-123"
URL = "/webhooks/instagram"


@pytest.fixture(autouse=True)
def _fresh_dedupe():
    meta_webhooks._seen.clear()


def _sig(raw: bytes, secret: str = "ig-secret") -> str:
    return "sha256=" + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()


def _event(ig_id: str, field: str = "comments", cid: str = "c1") -> bytes:
    return json.dumps({"object": "instagram", "entry": [{"id": ig_id, "time": 1, "changes": [
        {"field": field, "value": {"id": cid, "text": "nice"}}]}]}).encode()


def _q(**over):
    return {"hub.mode": "subscribe", "hub.verify_token": TOKEN, "hub.challenge": "1158201444", **over}


def test_verify_handshake(core, edge, monkeypatch):
    assert edge.get(URL, params=_q()).status_code == 403            # no token configured on the server
    monkeypatch.setattr(core.settings, "instagram_webhook_verify_token", TOKEN)
    r = edge.get(URL, params=_q())
    assert r.status_code == 200 and r.text == "1158201444"
    assert r.headers["content-type"].startswith("text/plain")
    assert edge.get(URL, params=_q(**{"hub.verify_token": "wrong"})).status_code == 403
    assert edge.get(URL, params=_q(**{"hub.mode": "unsubscribe"})).status_code == 400
    for missing in ("hub.mode", "hub.verify_token", "hub.challenge"):
        p = _q(); p.pop(missing)
        assert edge.get(URL, params=p).status_code == 400
    assert edge.get(URL).status_code == 400


def test_signed_comment_event_syncs_the_channel_once(api, core, edge, monkeypatch):
    ch = connect_ig(api)
    synced = []
    monkeypatch.setattr(community, "sync_channel", lambda _core, cid: synced.append(cid) or 0)

    raw = _event("1789")
    assert edge.post(URL, content=raw, headers={"X-Hub-Signature-256": _sig(raw, "nope")}).status_code == 403
    assert edge.post(URL, content=raw, headers={"X-Hub-Signature-256": "sha1=abc"}).status_code == 403
    assert edge.post(URL, content=raw).status_code == 403
    assert synced == []

    r = edge.post(URL, content=raw, headers={"X-Hub-Signature-256": _sig(raw)})
    assert r.status_code == 200 and r.text == "EVENT_RECEIVED" and synced == [ch["id"]]
    # Meta retries the same delivery: acknowledged again, processed once
    assert edge.post(URL, content=raw, headers={"X-Hub-Signature-256": _sig(raw)}).status_code == 200
    assert synced == [ch["id"]]
    # a different event for the same account is new work
    raw2 = _event("1789", "mentions", "c2")
    assert edge.post(URL, content=raw2, headers={"X-Hub-Signature-256": _sig(raw2)}).status_code == 200
    assert synced == [ch["id"], ch["id"]]

    for raw in (_event("1789", "messages"), _event("999"), b"not json"):   # ignored, still acknowledged
        assert edge.post(URL, content=raw, headers={"X-Hub-Signature-256": _sig(raw)}).status_code == 200
    assert synced == [ch["id"], ch["id"]]


def test_logs_never_contain_secrets(api, core, edge, monkeypatch, caplog):
    connect_ig(api)
    monkeypatch.setattr(core.settings, "instagram_webhook_verify_token", TOKEN)
    monkeypatch.setattr(community, "sync_channel", lambda *_: 0)
    caplog.set_level(logging.INFO, logger="huhqueue.webhooks.instagram")
    edge.get(URL, params=_q())
    edge.get(URL, params=_q(**{"hub.verify_token": "wrong-guess"}))
    raw = _event("1789")
    edge.post(URL, content=raw, headers={"X-Hub-Signature-256": _sig(raw)})
    edge.post(URL, content=raw, headers={"X-Hub-Signature-256": _sig(raw, "nope")})
    lines = [r.getMessage() for r in caplog.records if r.name == "huhqueue.webhooks.instagram"]
    results = [json.loads(m)["result"] for m in lines]
    assert {"ok", "token_mismatch", "accepted", "bad_signature"} <= set(results)
    text = caplog.text
    for secret in (TOKEN, "wrong-guess", "ig-secret", "IGTOKEN", "nice", _sig(raw)[7:]):
        assert secret not in text


def test_webhook_is_public_on_the_ui_app_too(app, core, monkeypatch):
    client = TestClient(app)   # not logged in
    monkeypatch.setattr(core.settings, "instagram_webhook_verify_token", TOKEN)
    r = client.get(URL, params=_q(**{"hub.challenge": "7"}))
    assert r.status_code == 200 and r.text == "7"
