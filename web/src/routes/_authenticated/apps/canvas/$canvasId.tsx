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

import { CanvasEditor } from '@/features/canvas'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

type CanvasSearch = { add?: string }

export const Route = createFileRoute('/_authenticated/apps/canvas/$canvasId')({
  validateSearch: (search: Record<string, unknown>): CanvasSearch => {
    return typeof search.add === 'string' && search.add ? { add: search.add } : {}
  },
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'playground')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: CanvasDetailRoute,
})

function CanvasDetailRoute() {
  const { canvasId } = Route.useParams()
  const { add } = Route.useSearch()
  return (
    <div className='h-full min-h-0'>
      <CanvasEditor canvasId={canvasId} add={add} />
    </div>
  )
}
