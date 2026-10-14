import { createFileRoute, redirect } from '@tanstack/react-router'

import { Main } from '@/components/layout'
import { SlideWorkbench } from '@/features/ppt'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

export const Route = createFileRoute('/_authenticated/apps/ppt/')({
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'playground')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: SlideRoute,
})

function SlideRoute() {
  return (
    <Main className='p-0'>
      <SlideWorkbench />
    </Main>
  )
}
