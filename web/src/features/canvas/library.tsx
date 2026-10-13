/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { LayoutGrid, MoreHorizontal, Plus, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  deleteWorkbenchSession,
  listWorkbenchSessions,
  updateWorkbenchSession,
  type WorkbenchSession,
} from '@/features/playground/api'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { createCanvasSession, getCanvasDraft } from './api'
import { draftFromPayload, normalizeCanvasDraft, type CanvasDraft } from './types'

export function CanvasLibrary() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const [pendingDelete, setPendingDelete] = useState<WorkbenchSession | null>(null)
  const migrated = useRef(false)
  const canvases = useQuery({
    queryKey: ['workbench-sessions', 'canvas'],
    queryFn: () => listWorkbenchSessions('canvas'),
  })
  useEffect(() => {
    if (!canvases.isFetched || (canvases.data?.length ?? 0) > 0 || migrated.current) return
    migrated.current = true
    void getCanvasDraft()
      .then(async (legacy) => {
        if (!legacy || legacy.nodes.length === 0) return
        await createCanvasSession(t('Infinite canvas'), legacy)
        await queryClient.invalidateQueries({ queryKey: ['workbench-sessions', 'canvas'] })
      })
      .catch(() => undefined)
  }, [canvases.data, canvases.isFetched, queryClient, t])

  const openNew = async (draft?: CanvasDraft, title?: string) => {
    const created = await createCanvasSession(title ?? t('New session'), draft)
    await queryClient.invalidateQueries({ queryKey: ['workbench-sessions', 'canvas'] })
    await navigate({
      to: '/apps/canvas/$canvasId',
      params: { canvasId: String(created.id) },
    })
  }

  const remove = useMutation({
    mutationFn: (id: number) => deleteWorkbenchSession(id),
    onSuccess: async () => {
      setPendingDelete(null)
      await queryClient.invalidateQueries({ queryKey: ['workbench-sessions', 'canvas'] })
    },
    onError: () => toast.error(t('Draft save failed')),
  })

  const rows = canvases.data ?? []

  return (
    <div className='h-full overflow-auto px-8 py-6'>
      <div className='mb-6 flex items-end justify-between gap-4'>
        <div>
          <div className='mb-2 flex items-center gap-2'>
            <Button
              type='button'
              size='icon'
              variant='outline'
              aria-label={t('Import canvas')}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className='size-4' />
            </Button>
            <Button
              type='button'
              size='icon'
              aria-label={t('New canvas')}
              onClick={() => {
                void openNew().catch(() => toast.error(t('Draft save failed')))
              }}
            >
              <Plus className='size-4' />
            </Button>
            <span className='text-muted-foreground text-xs tracking-[0.14em]'>
              {t('Canvas library')}
            </span>
          </div>
          <h1 className='text-2xl font-semibold'>{t('My canvases')}</h1>
        </div>
        <p className='text-muted-foreground flex items-center gap-2 text-sm'>
          <LayoutGrid className='size-4' />
          {t('{{count}} projects', { count: formatNumber(rows.length, locale) })}
        </p>
      </div>
      <input
        ref={fileRef}
        type='file'
        accept='application/json,.json'
        className='hidden'
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          void file
            .text()
            .then((text) => {
              const draft = normalizeCanvasDraft(JSON.parse(text))
              if (!draft) throw new Error('invalid')
              return openNew(draft, file.name.replace(/\.json$/i, '') || t('New session'))
            })
            .catch(() => toast.error(t('Invalid canvas file')))
        }}
      />
      {canvases.isFetched && rows.length === 0 ? (
        <p className='text-muted-foreground py-16 text-center text-sm'>{t('No canvases yet')}</p>
      ) : (
        <ul className='grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3'>
          {rows.map((session) => (
            <CanvasCard
              key={session.id}
              session={session}
              locale={locale}
              onDelete={() => setPendingDelete(session)}
            />
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={t('Delete canvas')}
        desc={t('This canvas will be removed.')}
        confirmText={t('Delete')}
        destructive
        isLoading={remove.isPending}
        handleConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete.id)
        }}
      />
    </div>
  )
}

function CanvasCard(props: {
  session: WorkbenchSession
  locale: string | undefined
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const draft = draftFromPayload(props.session.payload)
  const previewCount = draft.nodes.filter((node) => node.type === 'image' && node.data.url).length
  const [title, setTitle] = useState(props.session.title)
  const [renaming, setRenaming] = useState(false)
  const updated = new Intl.DateTimeFormat(props.locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(props.session.updated_at * 1000))

  const saveTitle = () => {
    const next = title.trim() || t('New session')
    setRenaming(false)
    setTitle(next)
    if (next === props.session.title) return
    void updateWorkbenchSession(props.session.id, {
      title: next,
      layout: props.session.layout || 'immersive',
      payload: props.session.payload,
    })
      .then(() => queryClient.invalidateQueries({ queryKey: ['workbench-sessions', 'canvas'] }))
      .catch(() => {
        setTitle(props.session.title)
        toast.error(t('Draft save failed'))
      })
  }

  return (
    <li className='bg-card rounded-2xl border p-3'>
      <Link
        to='/apps/canvas/$canvasId'
        params={{ canvasId: String(props.session.id) }}
        className='block'
      >
        <CanvasPreview draft={draft} label={`#${props.session.id}`} />
      </Link>
      <div className='mt-3 flex items-start gap-2'>
        <div className='min-w-0 flex-1'>
          {renaming ? (
            <input
              className='border-border h-8 w-full rounded-md border px-2 text-sm'
              value={title}
              autoFocus
              aria-label={t('Rename')}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={saveTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
          ) : (
            <Link
              to='/apps/canvas/$canvasId'
              params={{ canvasId: String(props.session.id) }}
              className='block truncate text-sm font-medium'
            >
              {props.session.title || t('New session')}
            </Link>
          )}
          <p className='text-muted-foreground text-xs'>{t('{{time}} updated', { time: updated })}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type='button' size='icon' variant='ghost' aria-label={t('Canvas actions')} />
            }
          >
            <MoreHorizontal className='size-4' />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem onClick={() => setRenaming(true)}>{t('Rename')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadCanvas(props.session)}>
              {t('Export canvas')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={props.onDelete}>{t('Delete canvas')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className='mt-3 grid grid-cols-3 gap-2 text-center text-xs'>
        <Stat value={draft.nodes.length} label={t('Nodes')} locale={props.locale} />
        <Stat value={draft.edges.length} label={t('Connections')} locale={props.locale} />
        <Stat value={previewCount} label={t('Preview')} locale={props.locale} />
      </div>
    </li>
  )
}

function CanvasPreview(props: { draft: CanvasDraft; label: string }) {
  const nodes = props.draft.nodes.slice(0, 6)
  const xs = nodes.map((node) => node.position.x)
  const ys = nodes.map((node) => node.position.y)
  const minX = xs.length ? Math.min(...xs) : 0
  const minY = ys.length ? Math.min(...ys) : 0
  const spanX = Math.max((xs.length ? Math.max(...xs) : 0) - minX, 1)
  const spanY = Math.max((ys.length ? Math.max(...ys) : 0) - minY, 1)
  return (
    <div className='border-border relative h-44 overflow-hidden rounded-xl border bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:14px_14px]'>
      <span className='text-muted-foreground absolute top-3 left-3 text-xs'>{props.label}</span>
      {nodes.map((node) => (
        <span
          key={node.id}
          className='bg-background absolute h-8 w-20 rounded-lg border shadow-sm'
          style={{
            left: `${12 + ((node.position.x - minX) / spanX) * 62}%`,
            top: `${22 + ((node.position.y - minY) / spanY) * 48}%`,
          }}
        />
      ))}
    </div>
  )
}

function Stat(props: { value: number; label: string; locale: string | undefined }) {
  return (
    <div className='bg-muted/40 rounded-lg px-2 py-2'>
      <div className='text-sm font-medium'>{formatNumber(props.value, props.locale)}</div>
      <div className='text-muted-foreground'>{props.label}</div>
    </div>
  )
}

function downloadCanvas(session: WorkbenchSession) {
  const blob = new Blob([session.payload || '{}'], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${session.title || 'canvas'}.json`
  link.click()
  URL.revokeObjectURL(url)
}
