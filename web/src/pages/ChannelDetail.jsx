import { motion } from 'motion/react'
import { PenSquare, Plug, RefreshCw, Settings2, X, PartyPopper } from 'lucide-react'
import { useEffect, useState } from 'react'
import { get, post } from '../api'
import { go, href, setQuery, useRoute } from '../router'
import { useStore } from '../store'
import { HistoryTab } from './ChannelTabs'
import { CommunityTab } from './ChannelCommunity'
import { InsightsTab } from './ChannelInsights'
import { ScheduleTab, SettingsTab } from './ChannelSettings'
import ChannelHeader from './ChannelHeader'
import { Button, NETWORKS, useToast } from '../ui'


export default function ChannelDetail() {
  const { parts, query } = useRoute()
  const { reload, connector } = useStore()
  const toast = useToast()
  const id = parts[1]
  const [ch, setCh] = useState(null)
  const tab = query.tab || 'publish'
  // A channel has one Publish view: the channel queue at #/queue/<id>. Old links (#/channel/<id>, ?tab=publish)
  // land there directly, keeping the rest of the query (compose, connected, ...), so it never shows a second layout.
  const toQueue = tab === 'publish' && id && id !== 'undefined'
  useEffect(() => {
    if (!toQueue) return
    const { tab: _t, ptab, ...rest } = query
    window.history.replaceState(null, '', href(`/queue/${id}`, { ...rest, ...(ptab && ptab !== 'queue' ? { tab: ptab } : {}) }))
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }, [toQueue, id])
  const load = () => get(`/api/channels/${id}`).then(setCh).catch((e) => toast(e.message, 'err'))
  useEffect(() => { if (!id || id === 'undefined') { go('/channels'); return } if (!toQueue) load() }, [id, toQueue])
  if (toQueue) return <div className="space-y-4" data-testid="channel-loading"><div className="skeleton h-40 w-full rounded-2xl" /></div>
  if (!ch) return <div className="space-y-4" data-testid="channel-loading"><div className="skeleton h-40 w-full rounded-2xl" /><div className="skeleton h-10 w-96" /><div className="skeleton h-64 w-full rounded-2xl" /></div>
  const net = NETWORKS[ch.provider]?.name

  return (
    <div className="space-y-5" data-testid="page-channeldetail">
      {query.connected === '1' && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900" data-testid="connected-banner">
          <PartyPopper className="size-5" /><span><b>@{ch.username}</b> is connected. Pick a weekly posting goal and we'll set your recommended posting times.</span>
          <Button data-testid="channel-detail-setquery" size="sm" variant="ghost" className="ml-auto" onClick={() => setQuery({ connected: '' })}><X className="size-4" /></Button>
        </motion.div>
      )}
      <ChannelHeader ch={ch} section={tab}>
        <Button variant="outline" onClick={() => setQuery({ tab: 'schedule' })} data-testid="channel-posting-schedule"><Settings2 className="size-4" />Posting schedule</Button>
        <Button variant="primary" onClick={() => setQuery({ compose: 'new', channels: id })} data-testid="channel-new-post"><PenSquare className="size-4" />New post</Button>
      </ChannelHeader>

      {tab === 'overview' && (
        <div className="flex flex-wrap gap-2" data-testid="channel-profile-actions">
          <Button variant="outline" onClick={async () => { try { setCh(await post(`/api/channels/${id}/refresh-profile`)); toast('Profile refreshed') } catch (e) { toast(e.message, 'err') } }} data-testid="channel-refresh-profile"><RefreshCw className="size-4" />Refresh profile</Button>
          <Button variant="ghost" onClick={() => go('/channels', { network: ch.provider })} data-testid="channel-reconnect"><Plug className="size-4" />Reconnect</Button>
        </div>
      )}

      {tab === 'history' ? <HistoryTab ch={ch} />
        : tab === 'community' ? <CommunityTab ch={ch} connector={connector(ch.provider)} />
        : tab === 'insights' ? <InsightsTab ch={ch} connector={connector(ch.provider)} />
        : tab === 'schedule' ? <ScheduleTab ch={ch} setCh={setCh} />
        : <SettingsTab ch={ch} setCh={setCh} net={net} />}
    </div>
  )
}
