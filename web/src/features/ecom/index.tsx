import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

type EcomTemplate = {
  id: number
  slug: string
  title: string
  category: string
  badge: string
  recommended: boolean
  summary: string
  billing: string
}

type TemplateResponse = {
  success: boolean
  data: EcomTemplate[]
  counts: Record<string, number>
}

const FILTERS = [
  ['all', 'All templates'],
  ['recommended', 'Recommended'],
  ['scene', 'Creative scenes'],
  ['cutout', 'Cutout and enhance'],
  ['model', 'Model try-on'],
  ['hero', 'Product hero images'],
] as const

const COVER: Record<string, string> = {
  cutout: 'from-stone-200 to-stone-400',
  hero: 'from-zinc-200 to-neutral-500',
  model: 'from-orange-100 to-stone-300',
  scene: 'from-slate-200 to-slate-400',
}

async function loadTemplates(category: string): Promise<TemplateResponse> {
  const res = await api.get('/api/user/ecom/templates', {
    params: category === 'all' ? {} : { category },
  })
  requireServerSuccess(res.data)
  return res.data as TemplateResponse
}

export function CommerceWorkbench() {
  const { t } = useTranslation()
  const [category, setCategory] = useState<(typeof FILTERS)[number][0]>('all')
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState<EcomTemplate | null>(null)
  const templates = useQuery({
    queryKey: ['ecom-templates', category],
    queryFn: () => loadTemplates(category),
  })
  const rows = useMemo(() => {
    const list = templates.data?.data ?? []
    const text = keyword.trim()
    if (!text) return list
    return list.filter((item) => item.title.includes(text) || item.summary.includes(text))
  }, [keyword, templates.data])
  const counts = templates.data?.counts ?? {}

  return (
    <div className='flex h-full min-h-0'>
      <aside className='w-[196px] shrink-0 border-r px-3 py-4'>
        <input
          className='border-border mb-3 h-9 w-full rounded-full border px-3 text-sm'
          placeholder={t('Search templates')}
          aria-label={t('Search templates')}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <div className='flex flex-col gap-1'>
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              type='button'
              className={cn(
                'flex h-9 items-center justify-between rounded-lg px-2 text-sm',
                category === id ? 'bg-muted font-medium' : 'hover:bg-muted'
              )}
              onClick={() => setCategory(id)}
            >
              <span>{t(label)}</span>
              <span className='text-muted-foreground text-xs'>{counts[id] ?? 0}</span>
            </button>
          ))}
        </div>
      </aside>
      <div className='min-w-0 flex-1 overflow-auto px-6 py-5'>
        <section className='bg-muted/40 mb-5 flex items-start justify-between gap-6 rounded-2xl px-6 py-5'>
          <div>
            <p className='text-muted-foreground text-xs tracking-wide'>{t('Commerce studio')}</p>
            <h1 className='mt-2 text-2xl font-semibold'>{t('One-click images, tuned for commerce')}</h1>
            <p className='text-muted-foreground mt-2 max-w-2xl text-sm'>
              {t('Cut out, sharpen, redraw, hero images, and try-on. Pick a template, fill the form, and batch the results.')}
            </p>
          </div>
          <label className='text-sm'>
            <span className='text-muted-foreground mb-1 block'>{t('Choose a template')}</span>
            <select
              className='border-border bg-background h-9 rounded-full border px-3'
              value={selected?.slug ?? ''}
              onChange={(event) => {
                const next = rows.find((item) => item.slug === event.target.value) ?? null
                setSelected(next)
              }}
            >
              <option value=''>{t('Choose a template')}</option>
              {rows.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
        </section>
        {selected ? (
          <form
            className='border-border mb-5 rounded-2xl border p-4'
            onSubmit={(event) => event.preventDefault()}
          >
            <h2 className='text-lg font-medium'>{selected.title}</h2>
            <p className='text-muted-foreground mt-1 text-sm'>{selected.summary}</p>
            <textarea
              className='border-border mt-3 min-h-24 w-full rounded-xl border px-3 py-2 text-sm'
              placeholder={t('Prompt')}
              aria-label={t('Prompt')}
            />
            <Button type='submit' className='mt-3'>
              {t('Use now')}
            </Button>
          </form>
        ) : null}
        <div className='grid grid-cols-2 gap-4 xl:grid-cols-4 2xl:grid-cols-5'>
          {rows.map((item) => (
            <button
              key={item.id}
              type='button'
              className='hover:bg-muted/40 rounded-2xl p-1 text-left'
              onClick={() => setSelected(item)}
            >
              <div className={cn('relative h-36 rounded-xl bg-gradient-to-br', COVER[item.category] ?? COVER.scene)}>
                {item.badge ? (
                  <span className='absolute top-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-xs'>
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <div className='px-1 pt-2'>
                <div className='flex items-center gap-2'>
                  <p className='truncate text-sm font-medium'>{item.title}</p>
                  <span className='text-muted-foreground shrink-0 text-xs'>{t(categoryLabel(item.category))}</span>
                </div>
                <p className='text-muted-foreground mt-1 line-clamp-2 text-xs'>{item.summary}</p>
                <p className='text-muted-foreground mt-2 text-xs'>{t('Per image')}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function categoryLabel(category: string) {
  const match = FILTERS.find(([id]) => id === category)
  return match ? match[1] : category
}
