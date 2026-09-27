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
import { Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import {
  listMoodboards,
  saveMoodboards,
  moodboardParam,
  type Moodboard,
} from '@/features/midjourney-discord/moodboards'

export function StyleLibrary() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [boards, setBoards] = useState<Moodboard[]>(() => listMoodboards())
  const [query, setQuery] = useState('')
  const [title, setTitle] = useState('')

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase()
    if (!text) return boards
    return boards.filter((board) => board.title.toLowerCase().includes(text))
  }, [boards, query])

  const createBoard = () => {
    const name = title.trim()
    if (!name) return
    const board: Moodboard = { id: `${Date.now()}`, title: name, images: [] }
    const next = [board, ...boards]
    saveMoodboards(next)
    setBoards(next)
    setTitle('')
    void navigate({
      to: '/apps/midjourney/styles/$boardId',
      params: { boardId: board.id },
    })
  }

  const preview = boards.find((board) => board.images.length > 0)?.images.slice(0, 2) ?? []

  return (
    <div className='bg-background text-foreground h-full min-h-0 overflow-auto'>
      <div className='mx-auto max-w-6xl px-6 py-12'>
        <div className='flex flex-col items-center gap-8 md:flex-row md:justify-center md:gap-14'>
          <div className='relative h-44 w-64 shrink-0'>
            <PreviewCard src={preview[0]} className='top-3 left-0 -rotate-6' />
            <PreviewCard src={preview[1]} className='top-0 left-20 rotate-3' />
          </div>
          <div className='max-w-lg text-center md:text-left'>
            <h1 className='text-4xl font-semibold tracking-tight'>{t('Style library')}</h1>
            <p className='text-muted-foreground mt-4 text-sm leading-6'>
            {t('The upstream id is shown with an m prefix. Paste it into your prompt to try.')}
            </p>
          </div>
        </div>

        <div className={cn('mt-12 flex', visible.length === 0 ? 'justify-center' : 'justify-end')}>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Search')}
            className='max-w-xs'
          />
        </div>

        <div
          className={
            visible.length === 0
              ? 'mx-auto mt-8 grid max-w-xs grid-cols-1'
              : 'mt-8 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-4'
          }
        >
          <form
            className='bg-card flex flex-col justify-between rounded-2xl border border-dashed p-4 shadow-sm'
            onSubmit={(event) => {
              event.preventDefault()
              createBoard()
            }}
          >
            <div className='text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center'>
              <Plus className='size-5' />
              <span className='text-sm font-medium'>{t('Create moodboard')}</span>
            </div>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t('Moodboard name')}
            />
            <Button type='submit' className='mt-2 w-full' disabled={title.trim() === ''}>
              {t('Create moodboard')}
            </Button>
          </form>
          {visible.map((board) => (
            <Link
              key={board.id}
              to='/apps/midjourney/styles/$boardId'
              params={{ boardId: board.id }}
              className='group block'
            >
              <div className='bg-muted aspect-[4/5] overflow-hidden rounded-2xl border shadow-sm transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md'>
                {board.images[0] ? (
                  <img src={board.images[0]} alt='' className='h-full w-full object-cover' />
                ) : (
                  <div className='text-muted-foreground flex h-full items-center justify-center px-4 text-center text-xs'>
                    {t('Add images above to start')}
                  </div>
                )}
              </div>
              <div className='mt-3 truncate text-sm font-medium'>{board.title}</div>
              {board.profileId ? (
                <div className='text-muted-foreground truncate font-mono text-xs'>
                  {moodboardParam(board.profileId)}
                </div>
              ) : null}
            </Link>
          ))}
        </div>
        {query.trim() !== '' && visible.length === 0 ? (
          <p className='text-muted-foreground mt-10 text-center text-sm'>{t('No moodboards yet')}</p>
        ) : null}
      </div>
    </div>
  )
}

function PreviewCard(props: { src?: string; className: string }) {
  return (
    <div
      className={cn(
        'bg-muted absolute h-40 w-28 overflow-hidden rounded-2xl border shadow-md',
        props.className
      )}
    >
      {props.src ? (
        <img src={props.src} alt='' className='h-full w-full object-cover' />
      ) : (
        <div className='bg-muted-foreground/15 h-full w-full' />
      )}
    </div>
  )
}
