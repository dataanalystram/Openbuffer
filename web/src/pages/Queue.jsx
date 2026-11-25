import { Reorder } from 'motion/react'
import { CalendarDays, Grid3x3, ListOrdered, PenSquare, Settings2, Inbox, List, ShieldCheck, Send, AlertCircle, FileText, Hand } from 'lucide-react'
import { useEffect, useState } from 'react'
import { get, post } from '../api'
import { go, setQuery, useRoute } from '../router'
import { useStore } from '../store'
import { Badge, Button, Empty, SkeletonList, Tabs, useToast } from '../ui'
import PostCard from '../components/PostCard'
import BulkBar from '../components/BulkBar'
import FilterBar, { useFilters, zoned } from '../components/FilterBar'
import BulkUpload from '../components/BulkUpload'
import ChannelHeader from './ChannelHeader'
import { GRID_NETWORKS, PlannedGrid, PublishHeader, SlotChip } from './ChannelPublish'

const TABS = [
  ['queue', 'Queue', 'scheduled,sending,processing'],
  ['drafts', 'Drafts', 'draft'],
  ['approvals', 'Approvals', 'pending_approval'],
  ['action', 'Your turn', 'needs_action'],
  ['sent', 'Sent', 'sent'],
  ['failed', 'Failed', 'failed'],
]

export default function Queue() {
  const { channels } = useStore()
  const { parts, query } = useRoute()
  const toast = useToast()
  const cid = parts[1]
  const [fetched, setFetched] = useState(null)   // a channel the store hasn't loaded yet (just connected, or via the API)
  const ch = channels.find((c) => c.id === cid) || (fetched?.id === cid ? fetched : undefined)
  useEffect(() => { if (cid && !channels.some((c) => c.id === cid)) get(`/api/channels/${cid}`).then(setFetched).catch(() => {}) }, [cid, channels])
  const tab = query.tab || 'queue'
  const [rows, setRows] = useState(null)
  const [counts, setCounts] = useState({})
  const [picked, setPicked] = useState([])
  const [sum, setSum] = useState(null)   // one channel: goal, timezone and open slots (GET /api/channels/{id}/publish-summary)
  const hasGrid = !!ch && GRID_NETWORKS.includes(ch.provider)
  const view = query.view === 'grid' && hasGrid ? 'grid' : 'list'
  const status = TABS.find((x) => x[0] === tab)[2]
  const fields = ['ch', 'type', 'tag', 'campaign', 'q', 'tz']   // status comes from the tabs
  const fl = useFilters({ fields })
  const filterKey = fields.map((k) => fl.f[k]).join('|')

  const load = async () => {
    const params = fl.params({ status })
    if (cid) params.set('channel_id', cid)
    setRows(await get('/api/posts?' + params))
    const cp = fl.params(); cp.delete('status'); if (cid) cp.set('channel_id', cid)
    const all = await get('/api/posts?' + cp)
    const c = {}
    for (const [k, , st] of TABS) c[k] = all.filter((t) => st.split(',').includes(t.status)).length
    setCounts(c)
    if (cid) get(`/api/channels/${cid}/publish-summary?days=14`).then(setSum).catch(() => setSum(null))
  }
  useEffect(() => { setPicked([]); setSum(null); load() }, [cid, tab, filterKey])
  // a deep link to one post (#/queue?post=…, e.g. from a notification) opens the tab that post is in
  useEffect(() => {
    if (!query.post || query.tab) return
    get(`/api/targets/${query.post}`).then((t) => { const hit = TABS.find(([, , st]) => st.split(',').includes(t.status)); if (hit && hit[0] !== 'queue') setQuery({ tab: hit[0] }) }).catch(() => {})
  }, [query.post])
  useEffect(() => { const f = () => load(); window.addEventListener('huhq:posts-changed', f); return () => window.removeEventListener('huhq:posts-changed', f) })
  useEffect(() => { if (tab !== 'queue') return; const i = setInterval(load, 8000); return () => clearInterval(i) }, [tab, cid])

  async function reorder(next) {
    setRows(next)
    if (!cid) return
    const queued = next.filter((t) => t.schedule_mode === 'queue' && t.status === 'scheduled')
    try { setRows(await post(`/api/queue/${cid}/order`, { ids: queued.map((t) => t.id) })); toast('Queue reordered') } catch (e) { toast(e.message, 'err'); load() }
  }
  const canDrag = tab === 'queue' && !!cid && !fl.active
  const slots = tab === 'queue' && cid && ch && !fl.active ? (sum?.open_slots || []) : []
  const slotDays = []
  for (const sl of slots) {
    const k = (sl.local || '').slice(0, 10)
    if (!slotDays.length || slotDays[slotDays.length - 1].k !== k) slotDays.push({ k, items: [] })
    slotDays[slotDays.length - 1].items.push(sl)
  }

  const actions = <>
    <div className="inline-flex rounded-xl border border-lav-200 bg-surface p-1" role="group" aria-label="View">
      {view === 'list' ? <span className="flex items-center gap-1.5 rounded-lg bg-lav-100 px-3 py-1.5 text-[13px] font-medium" aria-current="true" data-testid="queue-view-list"><List className="size-3.5" />List</span>
        : <button onClick={() => setQuery({ view: '' })} data-testid="queue-view-list" className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-muted hover:text-ink"><List className="size-3.5" />List</button>}
      <button onClick={() => go('/calendar', cid ? { ch: cid } : {})} data-testid="queue-calendar" className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-muted hover:text-ink"><CalendarDays className="size-3.5" />Calendar</button>
      {hasGrid && (view === 'grid' ? <span className="flex items-center gap-1.5 rounded-lg bg-lav-100 px-3 py-1.5 text-[13px] font-medium" aria-current="true" data-testid="queue-view-grid"><Grid3x3 className="size-3.5" />Grid</span>
        : <button onClick={() => setQuery({ view: 'grid' })} data-testid="queue-view-grid" className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-muted hover:text-ink"><Grid3x3 className="size-3.5" />Grid</button>)}
    </div>
    {ch && <Button variant="outline" onClick={() => go(`/channel/${cid}`, { tab: 'schedule' })} data-testid="queue-posting-schedule"><Settings2 className="size-4" />Posting schedule</Button>}
    {ch && <BulkUpload ch={ch} onDone={() => { window.dispatchEvent(new Event('huhq:posts-changed')); load() }} />}
    <Button variant="primary" onClick={() => go(parts.length ? '/' + parts.join('/') : '/queue', { ...query, compose: 'new', channels: cid || '' })} data-testid="queue-new"><PenSquare className="size-4" />New post</Button>
  </>

  return (
    <div className="space-y-5" data-testid="page-queue">
      {ch ? <ChannelHeader ch={ch} section="publish">
        {actions}
      </ChannelHeader> : (
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid size-12 place-items-center rounded-2xl bg-lav-200 text-lav-700"><ListOrdered className="size-6" /></div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">All channels</h1>
          <p className="text-sm text-muted">Every post across every channel</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>)}

      {ch && <PublishHeader ch={ch} sum={sum} />}
      {view === 'grid' ? <PlannedGrid ch={ch} /> : <>
      <FilterBar fl={fl} fields={fields} page="publish" lockChannel={!!cid} />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs testid="queue-tabs" value={tab} onChange={(v) => setQuery({ tab: v })} items={TABS.map(([v, l]) => [v, l, counts[v]])} />
        {cid && <a href="#/queue" className="ml-auto text-[13px] font-medium text-lav-700 hover:underline" data-testid="queue-filter-all">All channels</a>}
      </div>

      {picked.length > 0 && <BulkBar picked={picked} rows={rows || []} tab={tab} onPick={setPicked} onDone={() => { setPicked([]); load() }} />}

      {canDrag && rows?.length > 1 && <p className="text-xs text-muted">Drag posts to reorder - they keep the slot times, in the new order.</p>}
      {rows === null ? <SkeletonList rows={3} testid="queue-loading" /> : rows.length === 0 && !slots.length ? (
        <Empty icon={{ queue: Inbox, drafts: FileText, approvals: ShieldCheck, action: Hand, sent: Send, failed: AlertCircle }[tab] || Inbox} title={{ queue: 'Your queue is empty', drafts: 'No drafts', approvals: 'Nothing waiting for approval', action: 'Nothing for you to finish', sent: 'Nothing sent yet', failed: 'No failed posts' }[tab]}
          action={tab === 'queue' && <Button data-testid="queue-create-post" variant="primary" onClick={() => setQuery({ compose: 'new', channels: cid || '' })}>Create post</Button>}>
          {{ queue: 'Line up a few posts and HuhQueue drops each one into the channel’s next posting slot.',
            drafts: 'Save anything half-finished here. Drafts never go out until you queue them.',
            approvals: 'Posts from contributors and agent tokens wait here. Approve, or reject with a note saying what to change.',
            action: '“Notify me” posts and TikTok inbox uploads appear here when it is time to finish them in the app.',
            sent: 'Published posts show up here with their live numbers.', failed: 'Nothing failed. Errors would show here with a one-click retry.' }[tab]}
        </Empty>
      ) : canDrag ? (
        <Reorder.Group axis="y" values={rows} onReorder={setRows} className="space-y-3" data-testid="queue-list">
          {rows.map((t) => (
            <Reorder.Item key={t.id} value={t} onDragEnd={() => reorder(rows)}>
              <PostCard t={t} tz={fl.tz} onChange={load} draggable highlight={query.post === t.id} selected={picked.includes(t.id)} onSelect={(on) => setPicked(on ? [...picked, t.id] : picked.filter((x) => x !== t.id))} />
            </Reorder.Item>
          ))}
        </Reorder.Group>
      ) : (
        <div className="space-y-3" data-testid="queue-list">
          {rows.map((t, i) => {
            const dayOf = (x) => { const iso = x.status === 'sent' ? x.published_at : x.scheduled_at; return iso ? new Date(iso).toLocaleDateString(undefined, { timeZone: fl.tz, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '' }
            const day = dayOf(t)
            const prev = i ? dayOf(rows[i - 1]) : null
            return (
              <div key={t.id}>
                {['queue', 'sent'].includes(tab) && day !== prev && <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-muted">{day || 'Unscheduled'}</h3>}
                <PostCard t={t} tz={fl.tz} onChange={load} highlight={query.post === t.id} selected={picked.includes(t.id)} onSelect={(on) => setPicked(on ? [...picked, t.id] : picked.filter((x) => x !== t.id))} />
              </div>
            )
          })}
        </div>
      )}
      {slotDays.length > 0 && (
        <section className="space-y-2" data-testid="queue-open-slots" aria-label="Open posting slots">
          <h2 className="text-sm font-semibold text-ink-2">Open posting slots</h2>
          {slotDays.map((g) => (
            <div key={g.k} className="space-y-2" data-testid="publish-day">
              <h3 className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted">{new Date(g.k + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</h3>
              {g.items.map((sl) => <SlotChip key={sl.at} ch={ch} slot={sl} />)}
            </div>
          ))}
        </section>
      )}
      {tab === 'approvals' && rows?.length > 0 && <Badge tone="amber">Contributors and agents request; editors and up approve.</Badge>}
      </>}
    </div>
  )
}
