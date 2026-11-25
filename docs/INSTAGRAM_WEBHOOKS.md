# Instagram webhooks

Endpoint: `https://<your-url>/webhooks/instagram` (also on the edge app; same code path).
Code: `huhqueue/services/meta_webhooks.py`, routes in `huhqueue/api/app.py` (`add_edge_routes`), tests in
`tests/test_instagram_webhooks.py`. Meta docs: developers.facebook.com/docs/instagram-platform/webhooks

## Behaviour

| Request | Response |
|---|---|
| `GET` with `hub.mode=subscribe`, `hub.verify_token` = `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, `hub.challenge=X` | `200 text/plain`, body exactly `X` |
| `GET` with any of the three parameters missing, or `hub.mode` not `subscribe` | `400 text/plain` |
| `GET` with a wrong token, or no token configured on the server | `403 text/plain` (`Forbidden`) |
| `POST` without `X-Hub-Signature-256`, or not `sha256=` HMAC-SHA256 of the raw body with the Instagram app secret | `403 text/plain` (`Bad signature`) |
| `POST` correctly signed | `200 text/plain` (`EVENT_RECEIVED`) at once; processing runs after the response |

Processing: `comments`, `live_comments` and `mentions` changes sync comments for the active Instagram channel whose
account id matches `entry[].id`. Other fields are acknowledged and ignored. Idempotency: an identical payload seen in
the last 24 h is acknowledged but not processed again (in-memory per process; the sync is also an upsert, so a repeat
after a restart is harmless). Token comparison and signature checks use constant-time comparison.

Logs (logger `huhqueue.webhooks.instagram`, one JSON object per line): event, result, byte count, a 12-character body
hash, field names, matched channel ids and counts. Never the verify token, app secret, access tokens, signature or
comment text (a test asserts this).

## Configuration

| Where | Setting |
|---|---|
| Server env (`.env`) | `INSTAGRAM_WEBHOOK_VERIFY_TOKEN=<long random string>` (`python -c "import secrets; print(secrets.token_hex(32))"`) |
| App secret | `INSTAGRAM_APP_SECRET`, or Settings › App keys › Instagram (the saved value wins) |
| A proxy or login in front of HuhQueue | must let `/webhooks` through without a login or bot challenge, because Meta's servers call it |
| Meta app | Instagram › API setup with Instagram login › 3. Configure webhooks: callback URL above, verify token = the env value, **Verify and save**, subscribe to `comments` and `mentions`; step 2: **Webhook Subscription** on for the account |

Nothing secret is committed: the env value lives only on the server.

Unit tests: `python -m pytest tests/test_instagram_webhooks.py`
