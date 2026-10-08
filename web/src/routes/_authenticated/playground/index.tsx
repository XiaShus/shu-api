/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { createFileRoute, redirect } from '@tanstack/react-router'

import { Main } from '@/components/layout'
import { AppExperience } from '@/features/apps/experience'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

const EXPERIENCE_MODES = ['chat', 'image', 'video', 'audio'] as const

type PlaygroundSearchMode = (typeof EXPERIENCE_MODES)[number]

function isPlaygroundMode(value: unknown): value is PlaygroundSearchMode {
  return (
    typeof value === 'string' &&
    (EXPERIENCE_MODES as readonly string[]).includes(value)
  )
}

export const Route = createFileRoute('/_authenticated/playground/')({
  validateSearch: (
    search: Record<string, unknown>
  ): { mode: PlaygroundSearchMode; model: string } => ({
    mode: isPlaygroundMode(search.mode) ? search.mode : 'chat',
    model: typeof search.model === 'string' ? search.model : '',
  }),
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'playground')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: PlaygroundPage,
})

function PlaygroundPage() {
  return (
    <Main className='p-0'>
      <AppExperience />
    </Main>
  )
}
