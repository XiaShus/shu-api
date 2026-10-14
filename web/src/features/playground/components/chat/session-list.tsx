import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import {
  createWorkbenchSession,
  listWorkbenchSessions,
  type WorkbenchSession,
} from '../../api'

type SessionListProps = {
  kind: string
  activeId: number | null
  onSelect: (session: WorkbenchSession) => void
}

export function SessionList(props: SessionListProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const sessions = useQuery({
    queryKey: ['workbench-sessions', props.kind],
    queryFn: () => listWorkbenchSessions(props.kind),
  })
  const create = useMutation({
    mutationFn: () =>
      createWorkbenchSession({
        kind: props.kind,
        title: t('New session'),
        layout: 'immersive',
        payload: '',
      }),
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: ['workbench-sessions', props.kind] })
      props.onSelect(session)
    },
  })

  return (
    <aside className='border-border flex w-56 shrink-0 flex-col gap-3 border-r p-3'>
      <Button
        type='button'
        variant='outline'
        className='rounded-full'
        disabled={create.isPending}
        onClick={() => create.mutate()}
      >
        {t('Start a new chat')}
      </Button>
      <p className='text-muted-foreground text-xs'>{t('Recent chats')}</p>
      <ul className='min-h-0 flex-1 space-y-1 overflow-auto'>
        {(sessions.data ?? []).map((session) => (
          <li key={session.id}>
            <button
              type='button'
              className={
                session.id === props.activeId
                  ? 'bg-muted w-full truncate rounded-md px-2 py-1.5 text-left text-sm'
                  : 'hover:bg-muted w-full truncate rounded-md px-2 py-1.5 text-left text-sm'
              }
              onClick={() => props.onSelect(session)}
            >
              {session.title || t('New session')}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
