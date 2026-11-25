// The one header every channel page shares (Publish at #/queue/<id>, and Community / Insights / History / Settings at
// #/channel/<id>?tab=...): avatar, @name, network line, page actions, then the underline section nav.
import { ChartNoAxesColumn, History, ListOrdered, MessagesSquare, Settings } from 'lucide-react'
import { Badge, ChannelAvatar, cx, fmt, NETWORKS } from '../ui'

export const SECTIONS = [
  ['publish', 'Publish', ListOrdered],
  ['community', 'Community', MessagesSquare],
  ['insights', 'Insights', ChartNoAxesColumn],
  ['history', 'Sent / History', History],
  ['overview', 'Settings', Settings],
]

export default function ChannelHeader({ ch, section, children }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-4" data-testid="channel-header">
        <ChannelAvatar ch={ch} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">@{ch.username}</h1>
            {ch.status && ch.status !== 'active' && <Badge tone="red" data-testid="channel-status">Needs reconnect</Badge>}
            {ch.paused && <Badge tone="amber">Queue paused</Badge>}
          </div>
          <p className="text-sm text-muted">
            {NETWORKS[ch.provider]?.name || ch.provider} · {ch.timezone} · {ch.daily_limit}/day limit
            <span data-testid="channel-profile-stats"> · {fmt(ch.followers_count)} followers · {fmt(ch.media_count)} posts</span>
          </p>
          {ch.status_detail && <p className="mt-1 text-sm text-rose-700">{ch.status_detail}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      </div>
      <nav className="-mt-1 flex gap-1 overflow-x-auto border-b border-lav-200" aria-label="Channel sections" data-testid="channel-section-tabs">
        {SECTIONS.map(([k, l, I]) => (
          <a key={k} href={k === 'publish' ? `#/queue/${ch.id}` : `#/channel/${ch.id}?tab=${k}`} data-testid={`channel-tabs-${k}`} aria-current={k === section ? 'page' : undefined}
            className={cx('-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm', k === section ? 'border-lav-600 font-medium text-ink' : 'border-transparent text-muted hover:text-ink')}><I className="size-4" />{l}</a>
        ))}
      </nav>
    </>
  )
}
