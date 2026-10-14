import { createFileRoute, redirect } from '@tanstack/react-router'

import { Main } from '@/components/layout'
import { IdeWorkbench } from '@/features/ide'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

export const Route = createFileRoute('/_authenticated/apps/ide/')({
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'playground')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: IdeRoute,
})

function IdeRoute() {
  return (
    <Main className='p-0'>
      <IdeWorkbench />
    </Main>
  )
}
