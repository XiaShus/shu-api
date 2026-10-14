import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

export function FilmSettings() {
  const { t } = useTranslation()
  const [notes, setNotes] = useState('')
  const save = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/agent/configs', {
        kind: 'global',
        name: 'film',
        payload: notes,
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
      <h1 className='text-2xl font-semibold'>{t('Film settings')}</h1>
      <p className='text-muted-foreground text-sm'>
        {t('Set the film module options. The public film page is not confirmed.')}
      </p>
      <textarea aria-label={t('Film settings')} placeholder={t('Film settings')} className='border-border min-h-40 rounded-md border px-3 py-2 text-sm' value={notes} onChange={(event) => setNotes(event.target.value)} />
      <Button type='submit' disabled={save.isPending}>{t('Save')}</Button>
    </form>
  )
}
