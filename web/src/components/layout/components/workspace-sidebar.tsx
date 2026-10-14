import { Link, useLocation, useNavigate, useSearch } from '@tanstack/react-router'
import {
  ChevronRight,
  Home,
  ImageIcon,
  MessageSquare,
  MoreHorizontal,
  Palette,
  Plus,
  Presentation,
  Search,
  Shirt,
  Sparkles,
  Video,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useTheme } from '@/context/theme-provider'
import { createCanvasSession } from '@/features/canvas/api'
import { listWorkbenchSessions } from '@/features/playground/api'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

type WorkspaceItem = {
  id: string
  label: string
  icon: typeof Home
  to: '/' | '/apps/home' | '/apps/ecom' | '/apps/search' | '/apps/ppt' | '/apps/canvas' | '/apps/gallery' | '/apps/kb' | '/apps/ide'
} | {
  id: string
  label: string
  icon: typeof Home
  to: '/playground'
  search: { mode: 'chat' | 'image' | 'video' | 'audio'; model: string }
}

const PRIMARY = ['home', 'chat', 'search', 'create', 'ppt'] as const

const ITEMS: WorkspaceItem[] = [
  { id: 'home', label: 'Studio home', icon: Home, to: '/apps/home' },
  { id: 'ecom', label: 'Commerce images', icon: Shirt, to: '/apps/ecom' },
  { id: 'chat', label: 'Studio chat', icon: MessageSquare, to: '/playground', search: { mode: 'chat', model: '' } },
  { id: 'search', label: 'Studio search', icon: Search, to: '/apps/search' },
  { id: 'create', label: 'Studio create', icon: Palette, to: '/playground', search: { mode: 'image', model: '' } },
  { id: 'ppt', label: 'AIPPT', icon: Presentation, to: '/apps/ppt' },
  { id: 'canvas', label: 'Infinite canvas', icon: Sparkles, to: '/apps/canvas' },
  { id: 'video', label: 'Video', icon: Video, to: '/playground', search: { mode: 'video', model: '' } },
  { id: 'gallery', label: 'Gallery', icon: ImageIcon, to: '/apps/gallery' },
  { id: 'kb', label: 'Knowledge base', icon: Search, to: '/apps/kb' },
  { id: 'ide', label: 'IDE', icon: Sparkles, to: '/apps/ide' },
]

function currentWorkspaceId(pathname: string, mode: string) {
  if (pathname.startsWith('/apps/home') || pathname === '/') return 'home'
  if (pathname.startsWith('/apps/ecom') || pathname === '/apps') return 'ecom'
  if (pathname.startsWith('/apps/search')) return 'search'
  if (pathname.startsWith('/apps/ppt')) return 'ppt'
  if (pathname.startsWith('/apps/canvas')) return 'canvas'
  if (pathname.startsWith('/apps/gallery')) return 'gallery'
  if (pathname.startsWith('/apps/kb')) return 'kb'
  if (pathname.startsWith('/apps/ide')) return 'ide'
  if (pathname.startsWith('/playground')) {
    if (mode === 'image') return 'create'
    if (mode === 'video') return 'video'
    return 'chat'
  }
  return 'home'
}

export function WorkspaceSidebar() {
  const { t } = useTranslation()
  const pathname = useLocation({ select: (location) => location.pathname })
  const playgroundSearch = useSearch({
    strict: false,
    select: (search: { mode?: string }) => search.mode ?? '',
  })
  const user = useAuthStore((state) => state.auth.user)
  const { resolvedTheme, setTheme } = useTheme()
  const [moreOpen, setMoreOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const sessions = useQuery({
    queryKey: ['workbench-sessions', 'chat'],
    queryFn: () => listWorkbenchSessions('chat'),
  })
  const canvases = useQuery({
    queryKey: ['workbench-sessions', 'canvas'],
    queryFn: () => listWorkbenchSessions('canvas'),
    enabled: pathname.startsWith('/apps/canvas'),
  })
  const active = currentWorkspaceId(pathname, playgroundSearch)
  const byId = new Map(ITEMS.map((item) => [item.id, item]))
  let pageNav: string[] | null = null
  if (active === 'create') pageNav = ['home', 'create', 'canvas', 'video', 'chat']
  if (active === 'ppt') pageNav = ['home', 'create', 'ppt', 'canvas', 'video']
  if (active === 'canvas') pageNav = ['create', 'canvas', 'home', 'ppt', 'video']
  const pinned = (pageNav ?? PRIMARY).map((id) => byId.get(id)).filter((item): item is WorkspaceItem => Boolean(item))
  const current = byId.get(active)
  const visible = [...pinned]
  if (!pageNav && current && !PRIMARY.some((id) => id === active)) {
    visible.splice(1, 0, current)
    visible.pop()
  }
  const visibleIds = new Set(visible.map((item) => item.id))
  const more = ITEMS.filter((item) => !visibleIds.has(item.id))
  const recent = (sessions.data ?? []).filter((session) =>
    session.title.toLowerCase().includes(query.trim().toLowerCase())
  )

  return (
    <aside className='bg-background flex h-svh w-[232px] shrink-0 flex-col border-r'>
      <div className='flex items-center gap-2 px-4 py-4'>
        <span className='bg-foreground text-background flex size-7 items-center justify-center rounded-md text-sm font-semibold'>
          Y
        </span>
        <span className='text-sm font-semibold'>{t('Workspace')}</span>
      </div>
      <div className='flex items-center gap-2 px-3'>
        {active === 'canvas' ? (
          <button
            type='button'
            className='border-foreground/30 hover:bg-muted flex h-9 flex-1 items-center justify-center gap-1 rounded-full border border-dashed text-sm'
            onClick={() => {
              void createCanvasSession(t('New session'))
                .then(async (created) => {
                  await queryClient.invalidateQueries({ queryKey: ['workbench-sessions', 'canvas'] })
                  await navigate({
                    to: '/apps/canvas/$canvasId',
                    params: { canvasId: String(created.id) },
                  })
                })
                .catch(() => undefined)
            }}
          >
            <Plus className='size-4' />
            {t('Start a new canvas')}
          </button>
        ) : (
          <Link
            to='/playground'
            search={{ mode: 'chat', model: '' }}
            className='border-foreground/30 hover:bg-muted flex h-9 flex-1 items-center justify-center gap-1 rounded-full border border-dashed text-sm'
          >
            <Plus className='size-4' />
            {t('Start a new chat')}
          </Link>
        )}
        <button
          type='button'
          className='hover:bg-muted flex size-9 items-center justify-center rounded-full'
          aria-label={t('Search')}
          onClick={() => setSearchOpen((open) => !open)}
        >
          <Search className='size-4' />
        </button>
      </div>
      {searchOpen ? (
        <input
          className='border-border mx-3 mt-2 h-8 rounded-md border px-2 text-sm'
          placeholder={t('Search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t('Search')}
        />
      ) : null}
      <nav className='mt-3 flex flex-col gap-1 px-2'>
        {visible.map((item) => (
          <WorkspaceLink key={item.id} item={item} active={item.id === active} label={t(item.label)} />
        ))}
        <button
          type='button'
          className='text-muted-foreground hover:bg-muted flex h-9 items-center gap-2 rounded-lg px-3 text-sm'
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
        >
          <MoreHorizontal className='size-4' />
          <span className='flex-1 text-left'>{t('See more')}</span>
          <ChevronRight className={cn('size-4 transition', moreOpen && 'rotate-90')} />
        </button>
        {moreOpen
          ? more.map((item) => (
              <WorkspaceLink key={item.id} item={item} active={item.id === active} label={t(item.label)} />
            ))
          : null}
      </nav>
      <div className='mt-4 min-h-0 flex-1 overflow-auto px-3'>
        <p className='text-muted-foreground mb-2 text-xs'>
          {active === 'canvas' ? t('Recent drawings') : t('Recent chats')}
        </p>
        <ul className='space-y-1'>
          {active === 'canvas' ? (
            (canvases.data ?? [])
              .filter((session) => session.title.toLowerCase().includes(query.trim().toLowerCase()))
              .map((session) => (
                <li key={session.id}>
                  <Link
                    to='/apps/canvas/$canvasId'
                    params={{ canvasId: String(session.id) }}
                    className={cn(
                      'block truncate rounded-md px-2 py-1.5 text-sm',
                      pathname.endsWith(`/canvas/${session.id}`) ? 'bg-muted' : 'hover:bg-muted'
                    )}
                  >
                    {session.title || t('New session')}
                  </Link>
                </li>
              ))
          ) : (
            recent.map((session) => (
              <li key={session.id}>
                <Link
                  to='/playground'
                  search={{ mode: 'chat', model: '' }}
                  className='hover:bg-muted block truncate rounded-md px-2 py-1.5 text-sm'
                >
                  {session.title || t('New session')}
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
      <div className='flex items-center gap-2 border-t px-3 py-3'>
        <span className='bg-foreground text-background flex size-7 items-center justify-center rounded-full text-xs'>
          {(user?.display_name || user?.username || 'U').slice(0, 1).toUpperCase()}
        </span>
        <span className='min-w-0 flex-1 truncate text-sm'>{user?.display_name || user?.username}</span>
        <Link to='/dashboard' className='text-muted-foreground text-xs' aria-label={t('Console')}>
          {t('Console')}
        </Link>
        <button
          type='button'
          className='text-muted-foreground text-xs'
          aria-label={t('Toggle theme')}
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {resolvedTheme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </aside>
  )
}

function WorkspaceLink(props: { item: WorkspaceItem; active: boolean; label: string }) {
  const Icon = props.item.icon
  const className = cn(
    'flex h-9 items-center gap-2 rounded-lg px-3 text-sm',
    props.active ? 'bg-foreground text-background' : 'hover:bg-muted'
  )
  if ('search' in props.item) {
    return (
      <Link to={props.item.to} search={props.item.search} className={className}>
        <Icon className='size-4' />
        {props.label}
      </Link>
    )
  }
  return (
    <Link to={props.item.to} className={className}>
      <Icon className='size-4' />
      {props.label}
    </Link>
  )
}
