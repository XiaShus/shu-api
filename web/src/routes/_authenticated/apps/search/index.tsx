import { createFileRoute, redirect } from '@tanstack/react-router'

import { Main } from '@/components/layout'
import { SearchWorkbench } from '@/features/search'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

export const Route = createFileRoute('/_authenticated/apps/search/')({
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'playground')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: SearchRoute,
})

function SearchRoute() {
  return (
    <Main className='p-0'>
      <SearchWorkbench />
    </Main>
  )
}
