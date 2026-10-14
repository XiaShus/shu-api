import { createFileRoute, redirect } from '@tanstack/react-router'

import { Main } from '@/components/layout'
import { GalleryWorkbench } from '@/features/gallery'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

export const Route = createFileRoute('/_authenticated/apps/gallery/')({
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'playground')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: GalleryRoute,
})

function GalleryRoute() {
  return (
    <Main className='p-0'>
      <GalleryWorkbench />
    </Main>
  )
}
