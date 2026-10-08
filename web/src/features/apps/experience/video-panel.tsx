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

import { fetchVideo, sendVideoGeneration } from './api'
import { API_ENDPOINTS } from './constants'

type VideoPanelProps = {
  model: string
  group: string
}

export function VideoPanel(props: VideoPanelProps) {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [url, setUrl] = useState('')
  const [jobId, setJobId] = useState('')

  useEffect(() => {
    if (!jobId || url) return
    let stopped = false
    let timer = 0
    const tick = async () => {
      try {
        const data = await fetchVideo(jobId)
        if (stopped) return
        const next = data.status || ''
        const progress =
          typeof data.progress === 'number' ? `${data.progress}%` : ''
        setStatus([next, progress].filter(Boolean).join(' '))
        if (next === 'completed') {
          setUrl(`${API_ENDPOINTS.VIDEOS}/${encodeURIComponent(jobId)}/content`)
          return
        }
        if (next === 'failed') {
          setError(data.error?.message || data.message || t('Request failed'))
          return
        }
        timer = window.setTimeout(() => {
          void tick()
        }, 2000)
      } catch (cause) {
        if (!stopped) {
          setError(cause instanceof Error ? cause.message : t('Request failed'))
        }
      }
    }
    void tick()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [jobId, t, url])

  const submit = async () => {
    const text = prompt.trim()
    if (!text || !props.model || busy) return
    setBusy(true)
    setError('')
    setUrl('')
    setJobId('')
    setStatus('')
    try {
      const data = await sendVideoGeneration({
        model: props.model,
        prompt: text,
        group: props.group,
      })
      if (data.error?.message) throw new Error(data.error.message)
      const direct = data.video_url || data.url || ''
      if (direct) {
        setUrl(direct)
        setStatus(data.status || '')
        return
      }
      const id = data.id || data.task_id || ''
      if (!id) throw new Error(data.message || t('Request failed'))
      setStatus(data.status || t('Submitted'))
      setJobId(id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Request failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10'>
      {url || status ? null : (
        <h2 className='mb-8 text-center text-3xl font-semibold'>{t('Try video generation')}</h2>
      )}
      {url ? <video src={url} controls className='mb-6 max-h-96 w-full rounded-xl' /> : null}
      {status && !url ? <p className='text-muted-foreground mb-6 text-center text-sm'>{status}</p> : null}
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
          <span className='text-muted-foreground px-2 text-sm'>{t('Video generation')}</span>
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
