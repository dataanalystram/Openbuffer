# Landing page and waitlist

The public HuhbyteAI site: a single static page at `/welcome` with a waitlist for **HuhbyteAI in the cloud** and
**HuhQueue Studio as open source**. It is meant for the one install that hosts the public site, so it is **off by
default**. On your own install `/welcome` and `POST /waitlist` answer 404 and nothing is collected.

```bash
HUHQ_LANDING=1 python -m huhqueue serve      # then open http://localhost:8787/welcome
```

On the hosted instance set `HUHQ_LANDING=1` in its environment. The page is served by the UI app and by the edge app
(`HUHQ_PUBLIC_PORT`), so you can tunnel only the edge port and still have the public site.

## What is where

| Path | What |
|---|---|
| `huhqueue/static/landing/index.html` | the page (no build step, no framework) |
| `huhqueue/static/landing/landing.css`, `landing.js` | styles and the interactive parts: queue demo, savings receipt, tabs, For humans / For agents, waitlist form |
| `huhqueue/static/landing/img/` | screenshots and mascot sprite strips |
| `huhqueue/static/landing/agent.md` | the whole page as Markdown, served at `/welcome.md` and shown in the "For agents" view |
| `huhqueue/api/waitlist_api.py` | `/welcome`, `/welcome.md`, `/welcome/<asset>`, `POST /waitlist`, and the owner-only API |
| `huhqueue/services/waitlist.py` | signup rules (email check, one row per email, honeypot, 6 signups a minute per IP and 60 in total, encryption) |
| `tests/test_waitlist.py` | off by default, assets, dedupe, rate limit, CSV safety, registry |

The page loads its fonts (Sofia Sans, Sofia Sans Extra Condensed, Spline Sans Mono) from Google Fonts. Self-host them
from `static/landing/` if you want the page to make no third-party requests.

## Where the waitlist is

| What | Where |
|---|---|
| The form people fill in | `/welcome#waitlist` |
| Where the form posts | `POST /waitlist` (on the same server, no third-party form service) |
| Where signups are stored | table `waitlist_entries` in `$HUHQ_DATA_DIR/huhqueue.db` (default `./data/huhqueue.db`) |
| Who can read them | the owner and admins of that install, nobody else |

### Reading the signups

- **Browser:** sign in to HuhQueue as owner or admin, then open `/api/waitlist` or `/api/waitlist?format=csv` (downloads a
  spreadsheet).
- **Terminal** (needs `HUHQ_URL` and an `HUHQ_API_TOKEN` with the `admin` scope):

```bash
huhqueue run waitlist.list
curl -H "Authorization: Bearer $HUHQ_API_TOKEN" "$HUHQ_URL/api/waitlist?format=csv" -o waitlist.csv
huhqueue run waitlist.delete id=wl_...        # removal request
```

They are registry actions, so an agent with an `admin` token can call them over MCP too. Don't give agents that scope
unless you want them to see these addresses.

### How personal data is protected

- Email and note are encrypted in the database with the install's key (`HUHQ_SECRET_KEY`, or the generated
  `data/secret.key`). A keyed hash of the address finds duplicates. Keep that key safe and back it up separately from the
  database: without it the signups can't be read.
- Stored: email, the lists picked, optional note, date, and the referring page without its query string. No IP address,
  no cookies, no user agent. Nothing from a signup is written to logs or to the audit log.
- Owner and admin only, for reads as well as deletes: editors, contributors, clients, viewers and tokens without `admin`
  get 403. The public edge app has no endpoint that reads signups.
- Input: 8 KB body limit, strict email check, lower-cased, one row per email (signing up again adds the other list and
  replaces the note), hidden honeypot field, 6 signups a minute per IP and 60 a minute in total.
- CSV cells that start with `=`, `+`, `-` or `@` get a leading apostrophe so a spreadsheet never runs them as formulas.
- The form carries a consent line and links to `/privacy`, which explains the above when `HUHQ_LANDING=1`. Set
  `HUHQ_CONTACT_EMAIL` so that page tells people where to ask for deletion.

Serve it over https (`HUHQ_COOKIE_SECURE=1`) and set `HUHQ_ADMIN_PASSWORD` before the server is reachable.

## Editing the page

- Prices in the receipt are the `TOOLS` array at the top of the receipt block in `landing.js` (USD per month, checked
  25 Nov 2026). Change the date in `index.html` when you refresh them.
- Plans marked `soon: true` are shown as "Soon in HuhbyteAI" and counted separately from what is replaced today.
- The feature marquee is plain HTML in the `#inside` section.
- The Studio demo is pure CSS (`.take`, `.tvid`, `.seg`, `.tf`): original artwork, no third-party footage.
- Scroll effects use CSS scroll-driven animation (`animation-timeline: view()`); browsers without it show the final state.
