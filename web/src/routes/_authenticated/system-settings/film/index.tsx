import { createFileRoute } from '@tanstack/react-router'

import { Main } from '@/components/layout'
import { FilmSettings } from '@/features/film'

export const Route = createFileRoute('/_authenticated/system-settings/film/')({
  component: FilmRoute,
})

function FilmRoute() {
  return (
    <Main>
      <FilmSettings />
    </Main>
  )
}
