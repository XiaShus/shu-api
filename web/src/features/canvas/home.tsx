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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, AudioLines, Clapperboard, Image, Layers3, Plus, Scissors, Video } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { listWorkbenchSessions } from '@/features/playground/api'
import { toIntlLocale } from '@/i18n/languages'

import { createCanvasSession } from './api'
import { draftFromPayload } from './types'

const CAPABILITIES = [
  { id: 'canvas', label: 'Free canvas', icon: Layers3, add: '' },
  { id: 'video', label: 'Video generation', icon: Video, add: 'video' },
  { id: 'image', label: 'Image generation', icon: Image, add: 'image' },
  { id: 'audio', label: 'Audio generation', icon: AudioLines, add: 'audio' },
] as const

export function StudioHome() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const canvases = useQuery({
    queryKey: ['workbench-sessions', 'canvas'],
    queryFn: () => listWorkbenchSessions('canvas'),
  })

  const start = async (add: string) => {
    const created = await createCanvasSession(t('New session'))
    await queryClient.invalidateQueries({ queryKey: ['workbench-sessions', 'canvas'] })
    await navigate({
      to: '/apps/canvas/$canvasId',
      params: { canvasId: String(created.id) },
      search: add ? { add } : {},
    })
  }

  const recent = (canvases.data ?? []).slice(0, 4)

  return (
    <div className='h-full overflow-auto px-10 py-16'>
      <section className='bg-muted/40 relative grid min-h-40 place-items-center overflow-hidden rounded-xl border'>
        <span className='pointer-events-none absolute inset-2 bg-[radial-gradient(circle,var(--foreground)_0.6px,transparent_1.2px)] opacity-20 [background-size:18px_18px]' />
        <button
          type='button'
          className='relative flex flex-col items-center gap-3'
          onClick={() => {
            void start('').catch(() => toast.error(t('Draft save failed')))
          }}
        >
          <span className='bg-background grid h-[52px] w-[88px] place-items-center rounded-2xl border shadow-md'>
            <Plus className='size-6' />
          </span>
          <span className='text-base font-medium'>{t('Start a canvas')}</span>
        </button>
      </section>
      <nav className='mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6' aria-label={t('Creation tools')}>
        {CAPABILITIES.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type='button'
              className='flex flex-col items-center gap-2 py-2 text-sm'
              onClick={() => {
                void start(item.add).catch(() => toast.error(t('Draft save failed')))
              }}
            >
              <span className='bg-muted grid h-14 w-24 place-items-center rounded-2xl'>
                <Icon className='size-6' />
              </span>
              {t(item.label)}
            </button>
          )
        })}
        <span className='text-muted-foreground flex flex-col items-center gap-2 py-2 text-sm' aria-disabled='true'>
          <span className='bg-muted grid h-14 w-24 place-items-center rounded-2xl'>
            <Scissors className='size-6' />
          </span>
          {t('Smart edit')}
        </span>
        <span className='text-muted-foreground flex flex-col items-center gap-2 py-2 text-sm' aria-disabled='true'>
          <span className='bg-muted grid h-14 w-24 place-items-center rounded-2xl'>
            <Clapperboard className='size-6' />
          </span>
          {t('Project production')}
        </span>
      </nav>
      <section className='mt-8'>
        <header className='mb-3 flex items-center justify-between'>
          <h2 className='text-base font-medium'>{t('Recent projects')}</h2>
          <Link to='/apps/canvas' className='text-muted-foreground inline-flex items-center gap-2 text-sm'>
            {t('View all canvases')}
            <ArrowRight className='size-4' />
          </Link>
        </header>
        <div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4'>
          {recent.length === 0 ? (
            <button
              type='button'
              className='flex h-[85px] items-center gap-3 rounded-3xl border p-1 pr-4 text-left'
              onClick={() => {
                void start('').catch(() => toast.error(t('Draft save failed')))
              }}
            >
              <span className='bg-muted grid h-[75px] w-[100px] place-items-center rounded-2xl'>
                <Plus className='size-6' />
              </span>
              <span>
                <strong className='block text-sm'>{t('Create the first canvas')}</strong>
                <small className='text-muted-foreground text-xs'>{t('Give an idea a place to start')}</small>
              </span>
            </button>
          ) : (
            recent.map((session) => {
              const draft = draftFromPayload(session.payload)
              const updated = new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              }).format(new Date(session.updated_at * 1000))
              return (
                <Link
                  key={session.id}
                  to='/apps/canvas/$canvasId'
                  params={{ canvasId: String(session.id) }}
                  search={{}}
                  className='hover:bg-muted/40 flex h-[85px] items-center gap-3 rounded-3xl border p-1 pr-4'
                >
                  <span className='bg-muted relative h-[75px] w-[100px] overflow-hidden rounded-2xl bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:10px_10px]'>
                    {draft.nodes.slice(0, 3).map((node) => (
                      <span
                        key={node.id}
                        className='bg-background absolute h-3 w-6 rounded border'
                        style={{ left: 8 + (node.position.x % 40), top: 10 + (node.position.y % 28) }}
                      />
                    ))}
                  </span>
                  <span className='min-w-0'>
                    <strong className='block truncate text-sm'>{session.title || t('New session')}</strong>
                    <small className='text-muted-foreground text-xs'>{updated.replaceAll('/', '-')}</small>
                  </span>
                </Link>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
