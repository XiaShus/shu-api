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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SendIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { sendImageGeneration } from './api'
import { IMAGE_ASPECTS, IMAGE_ASPECT_SIZE, type ImageAspect } from './constants'

type ImagePanelProps = {
  model: string
  group: string
}

export function ImagePanel(props: ImagePanelProps) {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [aspect, setAspect] = useState<ImageAspect>('1:1')
  const [count, setCount] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [images, setImages] = useState<string[]>([])

  const submit = async () => {
    const text = prompt.trim()
    if (!text || !props.model || busy) return
    setBusy(true)
    setError('')
    try {
      const data = await sendImageGeneration({
        model: props.model,
        prompt: text,
        n: count,
        size: IMAGE_ASPECT_SIZE[aspect],
        group: props.group,
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

  return (
    <div className='mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8'>
      {images.length === 0 ? (
        <h2 className='mb-8 text-center text-3xl font-semibold'>{t('Try image generation')}</h2>
      ) : (
        <div className='mb-6 grid grid-cols-2 gap-3'>
          {images.map((src) => (
            <img key={src} src={src} alt='' className='w-full rounded-xl' />
          ))}
        </div>
      )}
      <div className='border-border bg-background rounded-2xl border p-3 shadow-sm'>
        <textarea
          className='min-h-24 w-full resize-none bg-transparent px-2 py-1 text-sm outline-none'
          placeholder={t('Describe what you want')}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void submit()
            }
          }}
        />
        <div className='mt-2 flex items-center gap-2'>
          <span className='text-muted-foreground px-2 text-sm'>{t('Image generation')}</span>
          <select
            className='border-border rounded-md border bg-transparent px-2 py-1 text-sm'
            aria-label={t('Image generation')}
            value={aspect}
            onChange={(event) => setAspect(event.target.value as ImageAspect)}
          >
            {IMAGE_ASPECTS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            className='border-border rounded-md border bg-transparent px-2 py-1 text-sm'
            aria-label={t('Count')}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          >
            {[1, 2, 3, 4].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <Button
            type='button'
            size='icon'
            className='ml-auto rounded-full'
            disabled={busy || !props.model || !prompt.trim()}
            aria-label={t('Send')}
            onClick={() => void submit()}
          >
            <SendIcon />
          </Button>
        </div>
        {error ? <p className='text-destructive mt-2 px-2 text-sm'>{error}</p> : null}
      </div>
    </div>
  )
}
