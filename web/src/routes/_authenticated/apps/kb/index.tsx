import { createFileRoute, redirect } from '@tanstack/react-router'

import { Main } from '@/components/layout'
import { KnowledgeWorkbench } from '@/features/kb'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

export const Route = createFileRoute('/_authenticated/apps/kb/')({
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'playground')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: KnowledgeRoute,
})

function KnowledgeRoute() {
  return (
    <Main className='p-0'>
      <KnowledgeWorkbench />
    </Main>
  )
}
