import { createFileRoute, redirect } from '@tanstack/react-router'

import { Main } from '@/components/layout'
import { CommerceWorkbench } from '@/features/ecom'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

export const Route = createFileRoute('/_authenticated/apps/ecom/')({
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'playground')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: CommerceRoute,
})

function CommerceRoute() {
  return (
    <Main className='p-0'>
      <CommerceWorkbench />
    </Main>
  )
}
