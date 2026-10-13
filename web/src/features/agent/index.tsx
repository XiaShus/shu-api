import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

const KINDS = ['global', 'server', 'tool', 'skill', 'run'] as const
const KIND_LABEL: Record<(typeof KINDS)[number], string> = {
  global: 'Global settings',
  server: 'MCP servers',
  tool: 'Tools',
  skill: 'Skills',
  run: 'Run log',
}

type AgentConfig = {
  id: number
  kind: string
  name: string
  payload: string
}

async function listConfigs(kind: string): Promise<AgentConfig[]> {
  const res = await api.get('/api/agent/configs', { params: kind ? { kind } : {} })
  requireServerSuccess(res.data)
  return (res.data.data ?? []) as AgentConfig[]
}

async function createConfig(body: { kind: string; name: string; payload: string }) {
  const res = await api.post('/api/agent/configs', body)
  requireServerSuccess(res.data)
}

export function AgentSettings() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [kind, setKind] = useState<(typeof KINDS)[number]>('global')
  const [name, setName] = useState('')
  const [payload, setPayload] = useState('')
  const configs = useQuery({
    queryKey: ['agent-configs', kind],
    queryFn: () => listConfigs(kind),
  })
  const create = useMutation({
    mutationFn: () => createConfig({ kind, name, payload }),
    onSuccess: () => {
      setName('')
      setPayload('')
      void queryClient.invalidateQueries({ queryKey: ['agent-configs', kind] })
    },
  })

  return (
    <div className='mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-8'>
      <h1 className='text-2xl font-semibold'>{t('Agent tools')}</h1>
      <p className='text-muted-foreground text-sm'>
        {t('Turn the planner on, then register MCP servers, tools, and skills.')}
      </p>
      <div className='flex flex-wrap gap-2'>
        {KINDS.map((item) => (
          <Button
            key={item}
            type='button'
            size='sm'
            variant={kind === item ? 'default' : 'outline'}
            onClick={() => setKind(item)}
          >
            {t(KIND_LABEL[item])}
          </Button>
        ))}
      </div>
      <form
        className='space-y-3'
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim()) return
          create.mutate()
        }}
      >
        <input
          aria-label={t('Name')}
          placeholder={t('Name')}
          className='border-border h-10 w-full rounded-md border px-3 text-sm'
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <textarea
          aria-label={t('Planner model')}
          placeholder={t('Planner model')}
          className='border-border min-h-28 w-full rounded-md border px-3 py-2 text-sm'
          value={payload}
          onChange={(event) => setPayload(event.target.value)}
        />
        <Button type='submit' disabled={create.isPending}>
          {t('Save')}
        </Button>
      </form>
      <ul className='space-y-2'>
        {(configs.data ?? []).map((row) => (
          <li key={row.id} className='border-border rounded-md border px-3 py-2 text-sm'>
            <p className='font-medium'>{row.name}</p>
            <p className='text-muted-foreground whitespace-pre-wrap'>{row.payload}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
