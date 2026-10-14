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
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import type { ModelOption } from '@/features/playground/types'
import { cn } from '@/lib/utils'

import { sendImageGeneration } from './api'
import { IMAGE_ASPECTS, IMAGE_ASPECT_SIZE, type ImageAspect } from './constants'

/** 创作页的版面：左侧设置、纵向结果流、三栏、聚焦、点阵画板。 */
const CREATE_LAYOUTS = ['split', 'flow', 'three', 'focus', 'board'] as const

type CreateLayout = (typeof CREATE_LAYOUTS)[number]

const LAYOUT_LABELS: Record<CreateLayout, string> = {
  split: 'Split',
  flow: 'Chat flow',
  three: 'Three columns',
  focus: 'Focus',
  board: 'Board',
}

const NEGATIVE_PRESETS = ['Low quality', 'Watermark', 'Blurry', 'Extra fingers'] as const

const QUALITIES = [
  { value: 'auto', label: 'Auto' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
] as const

type ImagePanelProps = {
  model: string
  models: ModelOption[]
  group: string
  onModelChange: (model: string) => void
}

export function ImagePanel(props: ImagePanelProps) {
  const { t } = useTranslation()
  const [layout, setLayout] = useState<CreateLayout>('split')
  const [prompt, setPrompt] = useState('')
  const [negative, setNegative] = useState<string[]>([])
  const [aspect, setAspect] = useState<ImageAspect>('1:1')
  const [count, setCount] = useState(1)
  const [quality, setQuality] = useState('auto')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [images, setImages] = useState<string[]>([])

  const submit = async () => {
    const text = prompt.trim()
    if (!text || !props.model || busy) return
    setBusy(true)
    setError('')
    try {
      // 网关接口没有独立的负向词字段，这里按约定把它拼进提示词尾行。
      const full = negative.length
        ? `${text}\nAvoid: ${negative.map((item) => t(item)).join(', ')}`
        : text
      const data = await sendImageGeneration({
        model: props.model,
        prompt: full,
        n: count,
        size: IMAGE_ASPECT_SIZE[aspect],
        group: props.group,
        quality,
      })
      if (data.error?.message) throw new Error(data.error.message)
      const next = (data.data ?? [])
        .map((item) => {
          if (item.url) return item.url
          if (item.b64_json) return `data:image/png;base64,${item.b64_json}`
          return ''
        })
        .filter(Boolean)
      setImages(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Request failed'))
    } finally {
      setBusy(false)
    }
  }

  const settings = (
    <div className='flex flex-col gap-4'>
      <label className='flex flex-col gap-1.5'>
        <span className='text-muted-foreground text-xs'>{t('Model')}</span>
        <select
          className='border-border h-9 rounded-lg border bg-transparent px-2 text-sm'
          value={props.model}
          onChange={(event) => props.onModelChange(event.target.value)}
        >
          {props.models.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className='flex flex-col gap-1.5'>
        <span className='text-muted-foreground text-xs'>{t('Prompt')}</span>
        <textarea
          className='border-border min-h-24 resize-none rounded-lg border bg-transparent px-2 py-1.5 text-sm outline-none'
          placeholder={t('Describe what you want')}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
      </label>
      <div className='flex flex-col gap-1.5'>
        <span className='text-muted-foreground text-xs'>{t('Negative prompt')}</span>
        <div className='flex flex-wrap gap-1.5'>
          {NEGATIVE_PRESETS.map((item) => (
            <button
              key={item}
              type='button'
              aria-pressed={negative.includes(item)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs',
                negative.includes(item) ? 'bg-foreground text-background border-transparent' : 'border-border'
              )}
              onClick={() =>
                setNegative((current) =>
                  current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item]
                )
              }
            >
              {t(item)}
            </button>
          ))}
        </div>
      </div>
      <SizeGrid value={aspect} onChange={setAspect} />
      <div className='flex flex-col gap-1.5'>
        <span className='text-muted-foreground text-xs'>{t('Count')}</span>
        <div className='flex gap-1.5'>
          {[1, 2, 3, 4].map((item) => (
            <button
              key={item}
              type='button'
              aria-pressed={count === item}
              className={cn(
                'size-8 rounded-lg border text-sm',
                count === item ? 'bg-foreground text-background border-transparent' : 'border-border'
              )}
              onClick={() => setCount(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className='flex flex-col gap-1.5'>
        <span className='text-muted-foreground text-xs'>{t('Quality')}</span>
        <div className='flex flex-wrap gap-1.5'>
          {QUALITIES.map((item) => (
            <button
              key={item.value}
              type='button'
              aria-pressed={quality === item.value}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-xs',
                quality === item.value ? 'bg-foreground text-background border-transparent' : 'border-border'
              )}
              onClick={() => setQuality(item.value)}
            >
              {t(item.label)}
            </button>
          ))}
        </div>
      </div>
      <Button type='button' disabled={busy || !props.model || !prompt.trim()} onClick={() => void submit()}>
        {busy ? t('Generating') : t('Generate')}
      </Button>
      {error ? <p className='text-destructive text-sm'>{error}</p> : null}
    </div>
  )

  const gallery = <ImageGallery images={images} />

  return (
    <div className='relative flex min-h-0 flex-1 flex-col'>
      <LayoutBar layout={layout} onChange={setLayout} />
      {layout === 'split' ? (
        <div className='flex min-h-0 flex-1'>
          <aside className='w-[340px] shrink-0 overflow-auto border-r p-4'>{settings}</aside>
          <section className='min-w-0 flex-1 overflow-auto p-4'>{gallery}</section>
        </div>
      ) : null}
      {layout === 'three' ? (
        <div className='flex min-h-0 flex-1'>
          <aside className='w-[300px] shrink-0 overflow-auto border-r p-4'>{settings}</aside>
          <section className='min-w-0 flex-1 overflow-auto p-4'>{gallery}</section>
          <aside className='w-[300px] shrink-0 overflow-auto border-l p-4'>
            <PromptBlock prompt={prompt} onPromptChange={setPrompt} onGenerate={submit} busy={busy} />
          </aside>
        </div>
      ) : null}
      {layout === 'flow' ? (
        <div className='flex min-h-0 flex-1 flex-col'>
          <div className='min-h-0 flex-1 overflow-auto p-4'>{gallery}</div>
          <div className='mx-auto w-full max-w-3xl p-4'>
            <PromptBlock prompt={prompt} onPromptChange={setPrompt} onGenerate={submit} busy={busy} />
          </div>
        </div>
      ) : null}
      {layout === 'focus' ? (
        <div className='min-h-0 flex-1 overflow-auto'>
          <div className='mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-16'>
            <h2 className='text-center text-2xl font-semibold'>{t('Draw something')}</h2>
            <PromptBlock prompt={prompt} onPromptChange={setPrompt} onGenerate={submit} busy={busy} />
            {gallery}
          </div>
        </div>
      ) : null}
      {layout === 'board' ? (
        <div className='relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:18px_18px]'>
          {images.length === 0 ? (
            <p className='text-muted-foreground absolute inset-0 flex items-center justify-center text-sm'>
              {t('Nothing here yet')}
            </p>
          ) : null}
          {images.map((src, index) => (
            <img
              key={src}
              src={src}
              alt=''
              className='bg-background absolute w-48 rounded-xl border shadow-sm'
              style={{
                left: `${12 + (index % 4) * 24}%`,
                top: `${10 + Math.floor(index / 4) * 34}%`,
              }}
            />
          ))}
          <aside className='bg-background absolute top-4 left-4 w-[300px] rounded-2xl border p-4 shadow-lg'>
            {settings}
          </aside>
        </div>
      ) : null}
    </div>
  )
}

function LayoutBar(props: { layout: CreateLayout; onChange: (layout: CreateLayout) => void }) {
  const { t } = useTranslation()
  return (
    <div className='bg-background/95 absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full border px-1.5 py-1 shadow-sm'>
      {CREATE_LAYOUTS.map((item) => (
        <Button
          key={item}
          type='button'
          size='sm'
          variant={props.layout === item ? 'default' : 'ghost'}
          aria-pressed={props.layout === item}
          onClick={() => props.onChange(item)}
        >
          {t(LAYOUT_LABELS[item])}
        </Button>
      ))}
    </div>
  )
}

function SizeGrid(props: { value: ImageAspect; onChange: (value: ImageAspect) => void }) {
  const { t } = useTranslation()
  return (
    <div className='flex flex-col gap-1.5'>
      <span className='text-muted-foreground text-xs'>{t('Size')}</span>
      <div className='grid grid-cols-3 gap-1.5'>
        {IMAGE_ASPECTS.map((item) => (
          <button
            key={item}
            type='button'
            aria-pressed={props.value === item}
            className={cn(
              'rounded-lg border px-2 py-1.5 text-xs',
              props.value === item ? 'bg-foreground text-background border-transparent' : 'border-border'
            )}
            onClick={() => props.onChange(item)}
          >
            {item}
            <span className='text-muted-foreground block text-[10px]'>{IMAGE_ASPECT_SIZE[item]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function PromptBlock(props: {
  prompt: string
  onPromptChange: (prompt: string) => void
  onGenerate: () => Promise<void>
  busy: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className='border-border bg-background flex flex-col gap-2 rounded-2xl border p-3 shadow-sm'>
      <textarea
        className='min-h-20 w-full resize-none bg-transparent px-2 py-1 text-sm outline-none'
        placeholder={t('Describe what you want')}
        value={props.prompt}
        onChange={(event) => props.onPromptChange(event.target.value)}
      />
      <div className='flex justify-end'>
        <Button
          type='button'
          disabled={props.busy || !props.prompt.trim()}
          onClick={() => void props.onGenerate()}
        >
          {props.busy ? t('Generating') : t('Generate')}
        </Button>
      </div>
    </div>
  )
}

function ImageGallery(props: { images: string[] }): ReactNode {
  const { t } = useTranslation()
  if (props.images.length === 0) {
    return (
      <div className='text-muted-foreground flex h-full min-h-48 flex-col items-center justify-center gap-1 text-sm'>
        <p className='text-foreground text-base'>{t('Nothing here yet')}</p>
        <p>{t('Start a new generation')}</p>
      </div>
    )
  }
  return (
    <div className='grid grid-cols-2 gap-3 xl:grid-cols-3'>
      {props.images.map((src) => (
        <img key={src} src={src} alt='' className='w-full rounded-xl' />
      ))}
    </div>
  )
}
