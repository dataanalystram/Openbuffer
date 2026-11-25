// Pieces of a channel's Publish view (#/queue/<channel_id>, rendered by Queue.jsx): weekly goal + timezone pills,
// "Add a post to <network> at <time>" chips for empty slots, and (visual networks) a planned Grid preview: queued posts
// above the live profile grid, drag (or arrows) to reorder the queue.
import { ArrowLeft, ArrowRight, Film, Globe, Grid3x3, Images, Plus, Target, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { get, post } from '../api'
import { go, href } from '../router'
import { Badge, cx, Empty, NETWORKS, Skeleton, SkeletonList, useToast } from '../ui'

export function compose(ch, extra = {}) {
  go(`/queue/${ch.id}`, { compose: 'new', channels: ch.id, ...extra })
}

export function SlotChip({ ch, slot, compact }) {
  const net = NETWORKS[ch.provider]?.name || ch.provider
  return (
    <button type="button" data-testid="empty-slot" data-at={slot.local} onClick={() => compose(ch, { when: 'custom', at: slot.local })}
      aria-label={`Add a post to ${net} at ${slot.time} on ${slot.day}`}
      className={cx('group flex w-full cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-lav-300 bg-lav-50/40 text-left text-sm text-muted transition hover:border-lav-500 hover:bg-lav-100 hover:text-ink',
        compact ? 'px-2 py-1.5 text-xs' : 'px-4 py-3')}>
      <span className="tabular-nums font-medium text-ink-2">{slot.time}</span>
      <Plus className="size-3.5 text-lav-600" />
      <span className="truncate">Add a post to {net} at {slot.time}</span>
    </button>
  )
}

export function PublishHeader({ ch, sum }) {
  if (!sum) return <div className="flex gap-2" data-testid="channel-publish-header-loading"><Skeleton className="h-8 w-48 rounded-full" /><Skeleton className="h-8 w-32 rounded-full" /></div>
  const met = sum.sent_this_week >= sum.goal
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="channel-publish-header">
      <a href={href(`/channel/${ch.id}`, { tab: 'schedule' })} data-testid="channel-goal-pill" title="Posting goal - change it in the posting schedule"
        className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium', met ? 'bg-emerald-100 text-emerald-800' : 'bg-lav-100 text-ink-2 hover:bg-lav-200')}>
        <Target className="size-3.5" />{sum.sent_this_week}/{sum.goal} posts sent this week
      </a>
      <a href={href(`/channel/${ch.id}`, { tab: 'schedule' })} data-testid="channel-tz-pill" title={`Queue times are in ${sum.timezone}`}
        className="inline-flex items-center gap-1.5 rounded-full bg-lav-100 px-3 py-1.5 text-[13px] text-ink-2 hover:bg-lav-200"><Globe className="size-3.5" />{sum.timezone_label}</a>
      {sum.paused && <Badge tone="amber" data-testid="channel-paused-pill">Queue paused</Badge>}
      {!sum.slots && <a href={href(`/channel/${ch.id}`, { tab: 'schedule' })} className="text-[13px] text-lav-700 underline" data-testid="channel-no-slots">Set posting times</a>}
    </div>
  )
}

export const GRID_NETWORKS = ['instagram', 'tiktok', 'fake']

/** Move the visible queue tiles to a new order and slot them back into the full queue (stories keep their place). */
export function reorderQueue(queueIds, visibleAsc, from, to) {
  const next = [...visibleAsc]
  const [m] = next.splice(from, 1)
  next.splice(to, 0, m)
  const vis = new Set(visibleAsc)
  let k = 0
  return queueIds.map((id) => (vis.has(id) ? next[k++] : id))
}

export function PlannedGrid({ ch }) {
  const toast = useToast()
  const [g, setG] = useState(null)
  const [drag, setDrag] = useState(null)
  const load = () => get(`/api/channels/${ch.id}/grid`).then(setG).catch((e) => { toast(e.message, 'err'); setG({ planned: [], live: [], queue_ids: [] }) })
  useEffect(() => { load() }, [ch.id])
  useEffect(() => { const f = () => load(); window.addEventListener('huhq:posts-changed', f); return () => window.removeEventListener('huhq:posts-changed', f) })
  if (!g) return <SkeletonList rows={2} testid="planned-grid-loading" />
  // tiles are newest-first (top-left = last to go out); the queue order is oldest-first
  const visibleAsc = g.planned.filter((p) => p.in_queue).map((p) => p.id).reverse()
  const move = async (id, dir) => {
    const from = visibleAsc.indexOf(id)
    const to = from + dir
    if (from < 0 || to < 0 || to >= visibleAsc.length) return
    try { await post(`/api/queue/${ch.id}/order`, { ids: reorderQueue(g.queue_ids, visibleAsc, from, to) }); toast('Queue reordered'); load() } catch (e) { toast(e.message, 'err') }
  }
  const dropOn = (targetId) => {
    if (!drag || drag === targetId) return
    const from = visibleAsc.indexOf(drag), to = visibleAsc.indexOf(targetId)
    setDrag(null)
    if (from < 0 || to < 0) return
    post(`/api/queue/${ch.id}/order`, { ids: reorderQueue(g.queue_ids, visibleAsc, from, to) }).then(() => { toast('Queue reordered'); load() }).catch((e) => toast(e.message, 'err'))
  }
  return (
    <div className="space-y-3" data-testid="planned-grid">
      <p className="text-sm text-muted">How @{ch.username}’s profile will look: planned posts (lavender) above what’s live now. Drag a queued tile — or use the arrows — to change the order; times stay put.</p>
      {g.live_error && <p className="text-xs text-rose-700" data-testid="planned-grid-live-error">Couldn’t load the live grid: {g.live_error}</p>}
      <div className="mx-auto grid max-w-xl grid-cols-3 gap-1" data-testid="planned-grid-tiles">
        {g.planned.map((p) => {
          const qi = visibleAsc.indexOf(p.id)
          return (
            <div key={p.id} data-testid="grid-planned" data-id={p.id} draggable={p.in_queue} aria-roledescription={p.in_queue ? 'draggable queued post' : undefined}
              onDragStart={() => setDrag(p.id)} onDragOver={(e) => p.in_queue && e.preventDefault()} onDrop={() => dropOn(p.id)}
              className={cx('group relative aspect-square overflow-hidden rounded-md bg-lav-100 ring-2 ring-lav-300', p.in_queue && 'cursor-grab', drag === p.id && 'opacity-50')}>
              {p.thumb_url ? <img src={p.thumb_url} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center p-2 text-center text-[11px] text-ink-2">{(p.caption || '').slice(0, 90) || 'No media'}</div>}
              <span className="absolute left-1 top-1 rounded-full bg-lav-600 px-1.5 py-0.5 text-[10px] font-medium text-white" data-testid="grid-planned-time">{(p.scheduled_local_iso || '').slice(5, 16).replace('T', ' ') || p.status}</span>
              {p.format === 'reel' && <Film className="absolute right-1 top-1 size-4 text-white drop-shadow" />}
              {p.format === 'carousel' && <Images className="absolute right-1 top-1 size-4 text-white drop-shadow" />}
              {p.collaborators && <span title={`Collaborators: ${p.collaborators}`} className="absolute bottom-1 left-1 rounded-full bg-black/60 p-1 text-white"><Users className="size-3" /></span>}
              {p.in_queue && visibleAsc.length > 1 && (
                <span className="absolute bottom-1 right-1 flex gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                  <button type="button" aria-label="Post later" data-testid="grid-move-later" disabled={qi >= visibleAsc.length - 1} onClick={() => move(p.id, 1)} className="cursor-pointer rounded bg-black/60 p-0.5 text-white disabled:opacity-30"><ArrowLeft className="size-3" /></button>
                  <button type="button" aria-label="Post earlier" data-testid="grid-move-earlier" disabled={qi <= 0} onClick={() => move(p.id, -1)} className="cursor-pointer rounded bg-black/60 p-0.5 text-white disabled:opacity-30"><ArrowRight className="size-3" /></button>
                </span>
              )}
            </div>
          )
        })}
        {g.live.map((m) => (
          <a key={m.external_id} href={m.permalink} target="_blank" rel="noreferrer" data-testid="grid-live" className="relative aspect-square overflow-hidden rounded-md bg-lav-50">
            {m.thumbnail_url ? <img src={m.thumbnail_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" /> : <div className="grid size-full place-items-center p-2 text-center text-[11px] text-muted">{(m.caption || '').slice(0, 90)}</div>}
          </a>
        ))}
      </div>
      {!g.planned.length && !g.live.length && <Empty icon={Grid3x3} title="Nothing to preview yet" testid="planned-grid-empty">Queue a post and it shows up here as the newest tile.</Empty>}
    </div>
  )
}
