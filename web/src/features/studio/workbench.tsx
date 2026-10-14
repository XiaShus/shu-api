import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  createWorkbenchSession,
  listWorkbenchSessions,
} from '@/features/playground/api'

type StudioField = {
  name: string
  label: string
  placeholder: string
  multiline?: boolean
}

export function StudioWorkbench(props: {
  kind: string
  title: string
  hint: string
  action: string
  fields: StudioField[]
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [values, setValues] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState('')
  const sessions = useQuery({
    queryKey: ['workbench-sessions', props.kind],
    queryFn: () => listWorkbenchSessions(props.kind),
  })
  const create = useMutation({
    mutationFn: () =>
      createWorkbenchSession({
        kind: props.kind,
        title: values.title || t('New session'),
        layout: 'immersive',
        payload: JSON.stringify(values),
      }),
    onSuccess: () => {
      setDraft(Object.values(values).filter(Boolean).join('\n'))
      void queryClient.invalidateQueries({ queryKey: ['workbench-sessions', props.kind] })
    },
  })

  return (
    <div className='flex h-full min-h-0'>
      <aside className='border-border flex w-56 shrink-0 flex-col gap-3 border-r p-3'>
        <Button type='button' variant='outline' className='rounded-full' onClick={() => create.mutate()}>
          {t('Start a new chat')}
        </Button>
        <p className='text-muted-foreground text-xs'>{t('Recent chats')}</p>
        <ul className='space-y-1 overflow-auto'>
          {(sessions.data ?? []).map((session) => (
            <li key={session.id} className='truncate text-sm'>
              {session.title}
            </li>
          ))}
        </ul>
      </aside>
      <div className='flex min-w-0 flex-1 flex-col items-center px-6 py-10'>
        <h1 className='text-center text-3xl font-semibold'>{props.title}</h1>
        <p className='text-muted-foreground mt-3 max-w-xl text-center text-sm'>{props.hint}</p>
        <form
          className='mt-8 w-full max-w-2xl space-y-3'
          onSubmit={(event) => {
            event.preventDefault()
            create.mutate()
          }}
        >
          {props.fields.map((field) =>
            field.multiline ? (
              <textarea
                key={field.name}
                aria-label={field.label}
                placeholder={field.placeholder}
                className='border-border min-h-28 w-full rounded-2xl border px-3 py-2 text-sm'
                value={values[field.name] ?? ''}
                onChange={(event) =>
                  setValues({ ...values, [field.name]: event.target.value })
                }
              />
            ) : (
              <input
                key={field.name}
                aria-label={field.label}
                placeholder={field.placeholder}
                className='border-border h-11 w-full rounded-full border px-4 text-sm'
                value={values[field.name] ?? ''}
                onChange={(event) =>
                  setValues({ ...values, [field.name]: event.target.value })
                }
              />
            )
          )}
          <Button type='submit' disabled={create.isPending}>
            {props.action}
          </Button>
        </form>
        {draft ? <pre className='mt-6 w-full max-w-2xl text-sm whitespace-pre-wrap'>{draft}</pre> : null}
      </div>
    </div>
  )
}
