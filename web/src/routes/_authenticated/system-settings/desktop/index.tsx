import { createFileRoute } from '@tanstack/react-router'

import { Main } from '@/components/layout'
import { DesktopSettings } from '@/features/desktop-settings'

export const Route = createFileRoute('/_authenticated/system-settings/desktop/')({
  component: DesktopRoute,
})

function DesktopRoute() {
  return (
    <Main>
      <DesktopSettings />
    </Main>
  )
}
