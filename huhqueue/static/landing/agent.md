# HuhbyteAI
Free, open source, self-hosted social media scheduler, link in bio and inbox. Every button is also an API, an MCP tool and a terminal command, so any agent can run all of it. MIT licensed. No paid tier.
Networks: Instagram, YouTube, TikTok, X, LinkedIn.
Code: https://github.com/dataanalystram/Openbuffer
Run it: docker compose up -d   or   python -m huhqueue serve   (then open localhost:8787, add your own developer keys per network)

## Headless
- 204 MCP tools and 236 API actions, all generated from one action registry.
- Ways in: MCP (tool schedule_post), terminal (huhqueue schedule --channel instagram:handle --caption "..." --media file.mp4 --at 2026-11-27T19:00), REST (POST /api/actions/post.schedule:run), Cmd K command bar in the app.
- Public actions first return status needs_confirmation with a preview and a single-use confirm_token (valid 10 minutes). A human approves first.
- Keys are scoped (read, write, publish, comments, admin) with tool allow-lists, daily caps and expiry.
- Kill switch: huhqueue agents pause. Agent calls then get HTTP 423 until resumed.
- Agent docs served by the app: /llms.txt, /llms-full.txt, /agents, /openapi.json.

## Everything in the box
Publish: live previews, Instagram posts / Reels / Stories / carousels, YouTube Shorts and videos, TikTok video and photo posts, X posts and threads, LinkedIn text / images / PDFs / video, first comment, posting slots and queue, drag to reorder / shuffle / prioritise, calendar by week and month, drafts and ideas board, bulk upload up to 500 posts, Buffer CSV import, RSS auto-post, evergreen recycling, follow end card on videos, duplicate guard, retries and missed-post recovery.
Create: image editor, AI writer (your own model), AI alt text, AI post ideas, hashtag groups and suggestions, templates, media library with folders, Unsplash search.
Community: comment inbox, mentions, saved replies, AI reply suggestions, comment themes, assign and flag, turn a comment into a post, bulk reply.
Insights: custom date ranges, compare with previous period, best times to post, audience and demographics, story numbers saved before they expire, Reels and hashtag stats, CSV export, branded PDF reports by email.
Team: six roles, access per channel, approvals, post notes and @mentions, invites, two-factor sign-in, audit log, notifications.
Link in bio: 16 themes, email sign-ups, QR codes, your own domain, scheduled links, click analytics, social icons and embeds, import and export.
Growth: short links, UTM builder, campaigns, channel groups, saved views, webhooks for Zapier / Make / n8n.
Agents: MCP server, REST API with OpenAPI, terminal commands, Cmd K command bar, scoped keys, approval first, daily caps, kill switch, llms.txt.

## Savings (USD per month, checked 25 Nov 2026, yearly billing where offered)
Replaced by HuhbyteAI today:
- Buffer Essentials, 5 channels: $25
- Later Growth: $37.50
- SocialBee Bootstrap: $29
- Hootsuite Standard, per user: $99
- Sprout Social Standard, per seat: $199
- Linktree Pro: $12
Coming soon in HuhbyteAI (free and open source):
- ManyChat Pro: $29
- Chatfuel Business S: $18
- Descript Creator: $24
- OpusClip Starter: $15
- HeyGen Creator: $29
HuhbyteAI: $0.
Examples: Solo creator (Buffer, Linktree, ManyChat, Descript, HeyGen) = $119 a month; $444 a year saved today, $1,428 a year when the all-in-one ships. Team (Sprout, Linktree, ManyChat, Descript, OpusClip, HeyGen) = $308 a month; $2,532 a year today, $3,696 a year with everything.
You host HuhbyteAI yourself, so your server is your own cost.

## HuhQueue Studio (second product)
Paste one link. Approve one week. An agent researches the story, renders it in your brand, learns your corrections, and plans it in Buffer once you approve. Runs as a hosted app today. Built on the Buffer API, not made or endorsed by Buffer. Open question: should Studio be open source? Answer on the human page or join the waitlist.

## Waitlist
Two lists: HuhbyteAI in the cloud (hosted for you), and HuhQueue Studio as open source (self-hosted).
Next, free and open source: generate videos (soon), edit videos (soon), schedule them (ready), auto-reply to comments and DMs (soon), the kind of automation ManyChat and Chatfuel do, in the same app.
Note from the maker: I love every social app I use. Each one does its job well. But with this many tools and subscriptions, I ended up with no money. So I'm putting them in one app and making it free.
We are twins. LinkedIn (maker): https://www.linkedin.com/in/ramprasad26/  LinkedIn (twin and cofounder): https://www.linkedin.com/in/laxmanprasadsomaraju/

## Our story
We are twins, new to social media. We started the huhbyte.ai Instagram channel, a faceless channel (https://www.instagram.com/huhbyte.ai/). We had never edited videos and editing was the hard part, so we built HuhQueue Studio to automate video editing. HuhbyteAI is our open source Buffer alternative, so nobody has to pay to schedule. We still have no followers, maybe we are doing it wrong, so we let an agent handle it. If you like it: follow https://www.instagram.com/huhbyte.ai/, star https://github.com/dataanalystram/Openbuffer on GitHub, and tell us what you like. Welcome to the HuhByte family. Love you all.
