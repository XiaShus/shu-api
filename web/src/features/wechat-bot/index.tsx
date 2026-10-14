import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

export function WechatBotSettings() {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [preset, setPreset] = useState('')
  const [policy, setPolicy] = useState('')
  const save = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/agent/configs', {
        kind: 'server',
        name,
        payload: JSON.stringify({ preset, policy }),
      })
      requireServerSuccess(res.data)
    },
  })

  return (
    <form
      className='mx-auto flex w-full max-w-xl flex-col gap-3 px-6 py-8'
      onSubmit={(event) => {
        event.preventDefault()
        if (!name.trim()) return
        save.mutate()
      }}
    >
      <h1 className='text-2xl font-semibold'>{t('WeChat bots')}</h1>
      <p className='text-muted-foreground text-sm'>
        {t('Name a bot, pick a preset, and set a quota policy. There is no public bot page yet.')}
      </p>
      <input aria-label={t('Bot name')} placeholder={t('Bot name')} className='border-border h-10 rounded-md border px-3 text-sm' value={name} onChange={(event) => setName(event.target.value)} />
      <input aria-label={t('Preset')} placeholder={t('Preset')} className='border-border h-10 rounded-md border px-3 text-sm' value={preset} onChange={(event) => setPreset(event.target.value)} />
      <textarea aria-label={t('Policy')} placeholder={t('Policy')} className='border-border min-h-28 rounded-md border px-3 py-2 text-sm' value={policy} onChange={(event) => setPolicy(event.target.value)} />
      <Button type='submit' disabled={save.isPending}>{t('Save')}</Button>
    </form>
  )
}
