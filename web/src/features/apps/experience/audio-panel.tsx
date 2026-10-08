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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SendIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { sendSpeech } from './api'

const SPEECH_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const

type AudioPanelProps = {
  model: string
  group: string
}

export function AudioPanel(props: AudioPanelProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [voice, setVoice] = useState<(typeof SPEECH_VOICES)[number]>('alloy')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [src, setSrc] = useState('')

  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src)
    }
  }, [src])

  const submit = async () => {
    const input = text.trim()
    if (!input || !props.model || busy) return
    setBusy(true)
    setError('')
    try {
      const blob = await sendSpeech({
        model: props.model,
        input,
        group: props.group,
        voice,
      })
      if (blob.type.includes('json') || blob.type.includes('text')) {
        const message = await blob.text()
        throw new Error(message)
      }
      if (src) URL.revokeObjectURL(src)
      setSrc(URL.createObjectURL(blob))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Request failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8'>
      {!src ? <h2 className='mb-8 text-center text-3xl font-semibold'>{t('Try speech')}</h2> : null}
      {src ? <audio controls src={src} className='mb-6 w-full' /> : null}
      <div className='border-border bg-background rounded-2xl border p-3 shadow-sm'>
        <textarea
          className='min-h-24 w-full resize-none bg-transparent px-2 py-1 text-sm outline-none'
          placeholder={t('Describe what you want')}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void submit()
            }
          }}
        />
        <div className='mt-2 flex items-center gap-2'>
          <span className='text-muted-foreground px-2 text-sm'>{t('Audio')}</span>
          <select
            className='border-border rounded-md border bg-transparent px-2 py-1 text-sm'
            aria-label={t('Voice')}
            value={voice}
            onChange={(event) =>
              setVoice(event.target.value as (typeof SPEECH_VOICES)[number])
            }
          >
            {SPEECH_VOICES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <Button
            type='button'
            size='icon'
            className='ml-auto rounded-full'
            disabled={busy || !props.model || !text.trim()}
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
