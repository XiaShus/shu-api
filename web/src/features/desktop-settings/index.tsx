import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

export function DesktopSettings() {
  const { t } = useTranslation()
  const [basic, setBasic] = useState('')
  const [mode, setMode] = useState('')
  const [worker, setWorker] = useState('')
  const save = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/agent/configs', {
        kind: 'global',
        name: 'desktop',
        payload: JSON.stringify({ basic, mode, worker }),
      })
      requireServerSuccess(res.data)
    },
  })

  return (
    <form
      className='mx-auto flex w-full max-w-xl flex-col gap-3 px-6 py-8'
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <h1 className='text-2xl font-semibold'>{t('Desktop')}</h1>
      <p className='text-muted-foreground text-sm'>
        {t('Basic desktop settings, work mode, and the browser worker.')}
      </p>
      <input aria-label={t('Basic settings')} placeholder={t('Basic settings')} className='border-border h-10 rounded-md border px-3 text-sm' value={basic} onChange={(event) => setBasic(event.target.value)} />
      <input aria-label={t('Work mode')} placeholder={t('Work mode')} className='border-border h-10 rounded-md border px-3 text-sm' value={mode} onChange={(event) => setMode(event.target.value)} />
      <input aria-label={t('Browser worker')} placeholder={t('Browser worker')} className='border-border h-10 rounded-md border px-3 text-sm' value={worker} onChange={(event) => setWorker(event.target.value)} />
      <Button type='submit' disabled={save.isPending}>{t('Save')}</Button>
    </form>
  )
}
