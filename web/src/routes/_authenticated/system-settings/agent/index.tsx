import { createFileRoute } from '@tanstack/react-router'

import { Main } from '@/components/layout'
import { AgentSettings } from '@/features/agent'

export const Route = createFileRoute('/_authenticated/system-settings/agent/')({
  component: AgentRoute,
})

function AgentRoute() {
  return (
    <Main>
      <AgentSettings />
    </Main>
  )
}
