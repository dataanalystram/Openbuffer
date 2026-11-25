/* HuhbyteAI landing page: the queue demo, the savings receipt, tabs, the For humans / For agents switch and the waitlist form.
   Plain JavaScript, no dependencies. Everything dynamic text goes through esc() or textContent. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const IMG = '/welcome/img/';
  const pad = (n) => String(n).padStart(3, '0');
  const list = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  const days = () => {
    const n = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return [1, 2, 3, 4, 5].map((i) => { const d = new Date(); d.setDate(d.getDate() + i); return n[d.getDay()] + ' ' + d.getDate(); });
  };
  const keepFocus = (fn) => {
    const a = document.activeElement, k = a && a.dataset && a.dataset.key;
    fn();
    if (k) { const el = document.querySelector('[data-key="' + k + '"]'); if (el) el.focus({ preventScroll: true }); }
  };
  const tabs = (box, items, initial, pick) => {
    const el = $(box);
    let cur = initial;
    const paint = () => {
      el.innerHTML = items.map((t) => `<button class="tab" type="button" role="tab" aria-selected="${t.id === cur}" data-id="${t.id}">${esc(t.name)}</button>`).join('');
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-id]');
      if (!b) return;
      cur = b.dataset.id; paint(); pick(items.find((t) => t.id === cur));
    });
    paint(); pick(items.find((t) => t.id === cur));
  };

  /* ------------------------------------------------------------------ the queue */
  const CH = [
    { id: 'ig', name: 'Instagram', takes: ['video', 'carousel'] },
    { id: 'yt', name: 'YouTube', takes: ['video'] },
    { id: 'tt', name: 'TikTok', takes: ['video', 'carousel'] },
    { id: 'x', name: 'X', takes: ['video', 'carousel', 'text'] },
    { id: 'li', name: 'LinkedIn', takes: ['video', 'carousel', 'text'] },
  ];
  const POSTS = [
    { id: 'moon', title: 'Moon jar', type: 'video', kind: 'Vertical video', img: 'post-moon.webp' },
    { id: 'three', title: 'Three vases', type: 'carousel', kind: 'Three photos', img: 'post-vases.webp' },
    { id: 'kiln', title: 'Kiln opening', type: 'video', kind: 'Vertical video', img: 'post-kiln.webp' },
    { id: 'hire', title: 'We are hiring', type: 'text', kind: 'Text only', img: '' },
    { id: 'own', title: 'Write your own', type: 'text', kind: 'Type it here', img: '' },
  ];
  const TIMES = ['09:30', '18:30'];
  const q = { post: 'moon', own: '', sel: { ig: 1, yt: 1, tt: 1, x: 0, li: 1 } };
  const fresh = () => {
    const t = (no, post, title, ch, day, slot) => ({ no, post, title, ch, day, slot, isNew: false });
    Object.assign(q, {
      next: 45, flip: 0, anim: 'init',
      msg: 'Four posts are waiting. Take a number, or click an open slot.',
      tickets: [t(41, 'mugs', 'Winter mugs', 'ig', 0, 0), t(41, 'mugs', 'Winter mugs', 'x', 0, 0),
        t(42, 'glaze', 'Glaze pour', 'ig', 0, 1), t(42, 'glaze', 'Glaze pour', 'yt', 0, 0), t(42, 'glaze', 'Glaze pour', 'tt', 0, 0),
        t(43, 'ship', 'Shipping dates', 'x', 0, 1), t(43, 'ship', 'Shipping dates', 'li', 0, 0),
        t(44, 'tools', 'Trimming tools', 'ig', 1, 0), t(44, 'tools', 'Trimming tools', 'tt', 0, 1)],
    });
  };
  const postObj = () => {
    if (q.post === 'own') { const t = q.own.trim(); return { id: 'own:' + t.toLowerCase(), title: t || 'Your post', type: 'text', empty: !t }; }
    return POSTS.find((x) => x.id === q.post);
  };
  const firstFree = (tickets, ch) => {
    for (let i = 0; i < 10; i++) { const d = Math.floor(i / 2), s = i % 2; if (!tickets.some((t) => t.ch === ch && t.day === d && t.slot === s)) return [d, s]; }
    return null;
  };
  const clean = () => q.tickets.map((t) => Object.assign({}, t, { isNew: false }));
  const qTake = () => {
    const p = postObj(), dl = days();
    if (p.empty) { q.msg = 'Type your post first.'; return qRender(); }
    const chans = CH.filter((c) => q.sel[c.id] && c.takes.includes(p.type));
    if (!chans.length) { q.msg = 'Pick at least one channel that can take this post.'; return qRender(); }
    const tickets = clean(), placed = [], dup = [], full = [];
    chans.forEach((c) => {
      if (tickets.some((t) => t.ch === c.id && t.post === p.id)) { dup.push(c.name); return; }
      const f = firstFree(tickets, c.id);
      if (!f) { full.push(c.name); return; }
      tickets.push({ no: q.next, post: p.id, title: p.title, ch: c.id, day: f[0], slot: f[1], isNew: true });
      placed.push(c.name + ' ' + dl[f[0]] + ' at ' + TIMES[f[1]]);
    });
    const parts = ['No. ' + pad(q.next) + (placed.length ? ' is in line: ' + list(placed) + '.' : ' was turned away.')];
    if (dup.length) parts.push(p.title + ' is already in line for ' + list(dup) + '. The same post never goes to a channel twice.');
    if (full.length) parts.push(list(full) + ' is full for these five days.');
    Object.assign(q, { tickets, msg: parts.join(' '), next: q.next + 1, flip: 1 - q.flip, anim: 'none' });
    qRender();
  };
  const qPut = (ch, day, slot) => {
    const p = postObj(), c = CH.find((x) => x.id === ch), dl = days();
    if (p.empty) { q.msg = 'Type your post first.'; return qRender(); }
    if (!c.takes.includes(p.type)) { q.msg = c.name + ' cannot take ' + p.title + '. It needs ' + (p.type === 'text' ? 'a photo or video.' : 'a video.'); return qRender(); }
    if (q.tickets.some((t) => t.ch === ch && t.post === p.id)) { q.msg = p.title + ' is already in line for ' + c.name + '. The same post never goes to a channel twice.'; return qRender(); }
    const tickets = clean();
    tickets.push({ no: q.next, post: p.id, title: p.title, ch, day, slot, isNew: true });
    Object.assign(q, { tickets, msg: 'No. ' + pad(q.next) + ' is in line: ' + c.name + ' ' + dl[day] + ' at ' + TIMES[slot] + '.', next: q.next + 1, flip: 1 - q.flip, anim: 'none' });
    qRender();
  };
  const qPull = (ch, day, slot) => {
    const c = CH.find((x) => x.id === ch), t = q.tickets.find((x) => x.ch === ch && x.day === day && x.slot === slot);
    if (!t) return;
    q.tickets = q.tickets.filter((x) => x !== t).map((x) => Object.assign({}, x, { isNew: false }));
    q.msg = 'Pulled ' + t.title + ' out of ' + c.name + ' ' + days()[day] + ' at ' + TIMES[slot] + '. The slot is open again.';
    q.anim = 'none'; qRender();
  };
  const qShuffle = () => {
    const tickets = clean();
    CH.forEach((c) => {
      const mine = tickets.filter((t) => t.ch === c.id), pos = mine.map((t) => [t.day, t.slot]);
      for (let i = pos.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)), k = pos[i]; pos[i] = pos[j]; pos[j] = k; }
      mine.forEach((t, i) => { t.day = pos[i][0]; t.slot = pos[i][1]; });
    });
    Object.assign(q, { tickets, msg: 'Shuffled. Each channel keeps its posts in new slots.', anim: 'shuffle' });
    qRender();
  };
  function qRender() {
    keepFocus(() => {
      const p = postObj(), dl = days();
      $('#q-posts').innerHTML = POSTS.map((x) => {
        const thumb = x.img ? `<img src="${IMG}${x.img}" alt="" style="width:44px;height:46px;object-fit:cover;border-radius:2px;display:block">`
          : '<span aria-hidden="true" style="width:44px;height:46px;border-radius:2px;background:var(--ink);color:#fff;display:grid;place-items:center;font-weight:800;font-size:20px">Aa</span>';
        return `<button class="pick" type="button" aria-pressed="${x.id === q.post}" data-id="${x.id}" data-key="p-${x.id}">${thumb}<span style="display:flex;flex-direction:column;line-height:1.2"><span style="font-weight:700">${esc(x.title)}</span><span style="font-size:15px;color:var(--ink2)">${esc(x.kind)}</span></span></button>`;
      }).join('');
      $('#q-ownwrap').hidden = q.post !== 'own';
      $('#q-chans').innerHTML = CH.map((c) => {
        const off = !c.takes.includes(p.type);
        return `<button class="chip" type="button" aria-pressed="${!off && !!q.sel[c.id]}" ${off ? 'disabled' : ''} title="${off ? esc(c.name) + " can't take this kind of post" : ''}" data-id="${c.id}" data-key="c-${c.id}">${esc(c.name)}</button>`;
      }).join('');
      const skip = CH.filter((c) => !c.takes.includes(p.type)).map((c) => c.name);
      $('#q-skip').textContent = skip.length ? list(skip) + (skip.length > 1 ? ' need' : ' needs') + (p.type === 'text' ? ' a photo or video, so this post skips them.' : ' a video, so this post skips it.') : 'All five can take a video.';
      $('#q-no').textContent = pad(q.next);
      $('#q-tick').className = 'tick feed' + q.flip;
      $('#q-take').setAttribute('aria-label', 'Take a number. Put ' + p.title + ' in line as number ' + pad(q.next));
      $('#q-msg').textContent = q.msg;
      const cell = (c, d, s) => {
        const t = q.tickets.find((x) => x.ch === c.id && x.day === d && x.slot === s), at = dl[d] + ' at ' + TIMES[s];
        const key = `s-${c.id}-${d}-${s}`, at2 = `data-ch="${c.id}" data-day="${d}" data-slot="${s}" data-key="${key}"`;
        if (t) {
          const a = q.anim === 'init' ? ' a" style="animation-delay:' + ((t.no - 41) * 0.14 + 0.2) + 's' : q.anim === 'shuffle' && !t.isNew ? ' a" style="animation-delay:' + (d * 0.06 + s * 0.03) + 's' : '" style="';
          return `<button type="button" class="slot ${t.isNew ? 'new' : 'in'}${a}" title="Pull out" aria-label="${esc('Pull ' + t.title + ' out of ' + c.name + ', ' + at)}" ${at2}><b>${pad(t.no)}</b><span>${esc(t.title)}</span></button>`;
        }
        return `<button type="button" class="slot open" title="Put the post here" aria-label="${esc('Put the selected post in ' + c.name + ', ' + at)}" ${at2}><span>${TIMES[s]}</span></button>`;
      };
      $('#q-grid').innerHTML = '<div style="border-top:1px solid var(--line)"></div>'
        + dl.map((d) => `<div style="border-top:1px solid var(--line);border-left:1px solid var(--line);padding:9px 10px;font-weight:700;font-size:16px">${esc(d)}</div>`).join('')
        + CH.map((c) => `<div style="border-top:1px solid var(--line);padding:10px 8px 10px clamp(12px,1.4vw,20px);display:flex;align-items:center;font-weight:700;font-size:16px">${esc(c.name)}</div>`
          + [0, 1, 2, 3, 4].map((d) => `<div class="gcell">${cell(c, d, 0)}${cell(c, d, 1)}</div>`).join('')).join('');
    });
  }
  $('#q-posts').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) { q.post = b.dataset.id; q.anim = 'none'; qRender(); } });
  $('#q-chans').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b && !b.disabled) { q.sel[b.dataset.id] = q.sel[b.dataset.id] ? 0 : 1; q.anim = 'none'; qRender(); } });
  $('#q-take').addEventListener('click', qTake);
  $('#q-shuffle').addEventListener('click', qShuffle);
  $('#q-reset').addEventListener('click', () => { fresh(); qRender(); });
  $('#q-own').addEventListener('input', (e) => { q.own = e.target.value; });
  $('#q-grid').addEventListener('click', (e) => {
    const b = e.target.closest('.slot');
    if (!b) return;
    const [ch, day, slot] = [b.dataset.ch, +b.dataset.day, +b.dataset.slot];
    if (b.classList.contains('open')) qPut(ch, day, slot); else qPull(ch, day, slot);
  });
  fresh(); qRender();

  /* ------------------------------------------------------------------ the receipt */
  const TOOLS = [
    { id: 'buffer', g: 'sched', name: 'Buffer', plan: 'Essentials', note: '5 channels', price: 25 },
    { id: 'later', g: 'sched', name: 'Later', plan: 'Growth', note: '2 users, inbox', price: 37.5 },
    { id: 'sbee', g: 'sched', name: 'SocialBee', plan: 'Bootstrap', note: '5 profiles', price: 29 },
    { id: 'hoot', g: 'sched', name: 'Hootsuite', plan: 'Standard', note: 'per user, 10 accounts', price: 99 },
    { id: 'sprout', g: 'sched', name: 'Sprout Social', plan: 'Standard', note: 'per seat, 5 profiles', price: 199 },
    { id: 'ltree', g: 'bio', name: 'Linktree', plan: 'Pro', note: 'no branding, mailing list', price: 12 },
    { id: 'mchat', g: 'auto', name: 'ManyChat', plan: 'Pro', note: '2,500 contacts', price: 29, soon: true },
    { id: 'cfuel', g: 'auto', name: 'Chatfuel', plan: 'Business S', note: 'comment auto-replies', price: 18, soon: true },
    { id: 'desc', g: 'video', name: 'Descript', plan: 'Creator', note: 'video editing', price: 24, soon: true },
    { id: 'opus', g: 'video', name: 'OpusClip', plan: 'Starter', note: 'AI clips', price: 15, soon: true },
    { id: 'hey', g: 'video', name: 'HeyGen', plan: 'Creator', note: 'AI video', price: 29, soon: true },
  ];
  const GROUPS = [['sched', 'Scheduling and inbox', false], ['bio', 'Link in bio', false], ['auto', 'Comment and DM automation', true], ['video', 'Video', true]];
  const PRESETS = [
    { id: 'creator', name: 'Solo creator', ids: ['buffer', 'ltree', 'mchat', 'desc', 'hey'] },
    { id: 'brand', name: 'Small brand', ids: ['hoot', 'ltree', 'mchat', 'desc', 'opus', 'hey'] },
    { id: 'team', name: 'Team', ids: ['sprout', 'ltree', 'mchat', 'desc', 'opus', 'hey'] },
  ];
  const usd2 = (n) => '$' + n.toFixed(2), usd0 = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const r = { sel: {}, preset: 'creator', bump: 0 };
  const setPreset = (p) => { r.sel = {}; p.ids.forEach((i) => { r.sel[i] = 1; }); r.preset = p.id; };
  setPreset(PRESETS[0]);
  const line = (t) => `<div class="rrow"><span>${esc(t.name + ' ' + t.plan)}</span><b>${usd2(t.price)}</b><small>${esc(t.note)}</small></div>`;
  function rRender() {
    $('#r-presets').innerHTML = '<span style="font-weight:700;margin-right:6px">Start from</span>'
      + PRESETS.map((p) => `<button class="chip" type="button" aria-pressed="${r.preset === p.id}" data-preset="${p.id}">${esc(p.name)}</button>`).join('');
    $$('#r-groups .trow').forEach((b) => b.setAttribute('aria-pressed', String(!!r.sel[b.dataset.tool])));
    const on = TOOLS.filter((t) => r.sel[t.id]), today = on.filter((t) => !t.soon), soon = on.filter((t) => t.soon);
    const sum = (a) => a.reduce((n, t) => n + t.price, 0), mt = sum(today), ma = mt + sum(soon);
    $('#r-bill').textContent = on.length + (on.length === 1 ? ' tool' : ' tools');
    $('#r-today').hidden = !today.length; $('#r-today-lines').innerHTML = today.map(line).join('');
    $('#r-soon').hidden = !soon.length; $('#r-soon-lines').innerHTML = soon.map(line).join('');
    $('#r-none').hidden = on.length > 0;
    $('#r-total').textContent = usd2(ma);
    $('#r-yr-today').textContent = usd0(mt * 12); $('#r-mo-today').textContent = usd0(mt);
    $('#r-all').hidden = !soon.length; $('#r-yr-all').textContent = usd0(ma * 12); $('#r-mo-all').textContent = usd0(ma);
    $('#r-pop').className = 'pop' + (r.bump % 2);
  }
  $('#r-groups').innerHTML = GROUPS.map(([g, title, soon]) => `<div style="margin-bottom:24px"><h3 class="pgt">${esc(title)}${soon ? '<span class="tag">Soon in HuhbyteAI</span>' : ''}</h3>`
    + TOOLS.filter((t) => t.g === g).map((t) => `<button class="trow" type="button" aria-pressed="false" data-tool="${t.id}"><span class="box" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"></path></svg></span><span style="display:flex;flex-direction:column;line-height:1.2;min-width:0"><span style="font-weight:700">${esc(t.name + ' ' + t.plan)}</span><span style="font-size:15px;color:var(--ink2)">${esc(t.note)}</span></span><span style="font-family:var(--mono);font-weight:600;white-space:nowrap">${usd2(t.price)}</span></button>`).join('') + '</div>').join('');
  $('#r-groups').addEventListener('click', (e) => { const b = e.target.closest('[data-tool]'); if (b) { r.sel[b.dataset.tool] = r.sel[b.dataset.tool] ? 0 : 1; r.preset = ''; r.bump++; rRender(); } });
  $('#r-presets').addEventListener('click', (e) => { const b = e.target.closest('[data-preset]'); if (b) { setPreset(PRESETS.find((p) => p.id === b.dataset.preset)); r.bump++; rRender(); } });
  rRender();

  /* ------------------------------------------------------------------ tabs */
  tabs('#way-tabs', [
    { id: 'mcp', name: 'MCP', code: '// tool: schedule_post\n{\n  "channel_ids": ["ch_instagram"],\n  "caption": "Moon jar no. 12",\n  "media_ids": ["md_moonjar"],\n  "when": "custom",\n  "scheduled_at": "2026-11-27T19:00"\n}' },
    { id: 'cli', name: 'Terminal', code: '$ huhqueue schedule \\\n    --channel instagram:fernhill.studio \\\n    --caption "Moon jar no. 12" \\\n    --media moon-jar.mp4 \\\n    --at 2026-11-27T19:00' },
    { id: 'rest', name: 'REST', code: 'POST /api/actions/post.schedule:run\nAuthorization: Bearer hq_…\n\n{ "input": {\n    "channel_ids": ["ch_instagram"],\n    "caption": "Moon jar no. 12",\n    "media_ids": ["md_moonjar"],\n    "when": "custom",\n    "scheduled_at": "2026-11-27T19:00" } }' },
    { id: 'cmdk', name: 'Cmd K', code: 'schedule the moon jar reel\nfor Friday 7pm on Instagram' },
  ], 'mcp', (t) => { $('#way-code').textContent = t.code; });
  tabs('#screen-tabs', [
    { id: 'compose', name: 'Compose', src: 'shot-compose.webp', alt: 'HuhbyteAI composer editing an Instagram post with the capybara mascot and a live preview beside it' },
    { id: 'queue', name: 'Queue', src: 'shot-queue.webp', alt: 'HuhbyteAI queue listing scheduled posts across channels' },
    { id: 'calendar', name: 'Calendar', src: 'shot-calendar.webp', alt: 'HuhbyteAI week calendar with scheduled posts and open posting times' },
    { id: 'inbox', name: 'Inbox', src: 'shot-inbox.webp', alt: 'HuhbyteAI comment inbox with unanswered comments and reply boxes' },
    { id: 'insights', name: 'Insights', src: 'shot-insights.webp', alt: 'HuhbyteAI insights with views per day, followers by channel and top posts' },
  ], 'compose', (t) => { const i = $('#screen-img'); i.src = IMG + t.src; i.alt = t.alt; });
  const INST = [
    { id: 'docker', name: 'Docker', code: 'git clone https://github.com/dataanalystram/Openbuffer\ncd Openbuffer\ndocker compose up -d' },
    { id: 'py', name: 'Python 3.10+', code: 'git clone https://github.com/dataanalystram/Openbuffer\ncd Openbuffer\npython -m venv .venv && . .venv/bin/activate\npip install -r requirements.txt\npython -m huhqueue serve' },
  ];
  let inst = INST[0];
  tabs('#inst-tabs', INST, 'docker', (t) => { inst = t; $('#inst-code').textContent = t.code; $('#inst-copy').textContent = 'Copy commands'; });
  const selectText = (el) => { try { const rg = document.createRange(); rg.selectNodeContents(el); const g = window.getSelection(); g.removeAllRanges(); g.addRange(rg); return true; } catch (e) { return false; } };
  const copy = (text, el, btn, done, sel) => {
    const pick = () => { selectText(el); btn.textContent = sel; };
    try { navigator.clipboard.writeText(text).then(() => { btn.textContent = done; }, pick); } catch (e) { pick(); }
  };
  $('#inst-copy').addEventListener('click', () => copy(inst.code, $('#inst-code'), $('#inst-copy'), 'Copied', 'Selected, press Copy'));

  /* ------------------------------------------------------------------ human / agent view */
  const setMode = (m) => {
    $('#human').hidden = m !== 'human'; $('#agent').hidden = m !== 'agent';
    $$('.mbtn[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    $('#agent-copy').textContent = 'Copy all';
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (b) setMode(b.dataset.mode);
    if (e.target.closest('[data-agent-link]')) { e.preventDefault(); setMode('agent'); }
  });
  $('#agent-copy').addEventListener('click', () => copy($('#agent-pre').textContent, $('#agent-pre'), $('#agent-copy'), 'Copied', 'Selected, press Copy'));

  /* ------------------------------------------------------------------ Studio vote + waitlist */
  const wlStudio = $('#wl-studio'), wlCloud = $('#wl-cloud');
  const vote = (v) => {
    $('#vote-yes').setAttribute('aria-pressed', String(v === 'yes')); $('#vote-no').setAttribute('aria-pressed', String(v === 'no'));
    $('#vote-msg-text').textContent = v === 'yes' ? 'Noted, thank you.' : v === 'no' ? 'Noted. Hosted it is.' : 'Tell me which you would use.';
    $('#vote-link').hidden = v !== 'yes';
    if (v === 'yes') wlStudio.checked = true; else if (v === 'no') wlStudio.checked = false;
  };
  $('#vote-yes').addEventListener('click', () => vote('yes'));
  $('#vote-no').addEventListener('click', () => vote('no'));
  wlStudio.addEventListener('change', () => { if (wlStudio.checked) vote('yes'); });

  const form = $('#wl-form'), err = $('#wl-err');
  const done = () => { form.hidden = true; $('#wl-done').hidden = false; };
  if (/[?&]joined=ok\b/.test(location.search)) done();
  const MSG = { invalid_email: 'Add a valid email address.', pick_a_list: 'Pick at least one list.', limited: 'Too many tries. Wait a minute and try again.',
    bot: 'We could not check that you are a person. Wait for the check above the button, then try again.', bad_domain: 'That address cannot receive email. Use one we can write to.' };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#wl-email').value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = MSG.invalid_email; return; }
    if (!wlCloud.checked && !wlStudio.checked) { err.textContent = MSG.pick_a_list; return; }
    err.textContent = '';
    const btn = $('#wl-send'); btn.disabled = true;
    try {
      const res = await fetch('/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, cloud: wlCloud.checked, studio: wlStudio.checked, note: $('#wl-note').value, website: $('#wl-website').value,
          referrer: document.referrer, turnstile: new FormData(form).get('cf-turnstile-response') || '' }) });
      const body = await res.json().catch(() => ({}));
      if (res.ok) done(); else { err.textContent = MSG[body.status] || 'Something went wrong. Please try again.'; window.turnstile?.reset('#wl-turnstile'); }
    } catch (x) { err.textContent = 'Could not reach the server. Please try again.'; window.turnstile?.reset('#wl-turnstile'); }
    btn.disabled = false;
  });
  $$('#wl-form input[type=checkbox], #wl-email').forEach((el) => el.addEventListener('input', () => { err.textContent = ''; }));
})();
