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
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { catalogModels } from '@/features/apps/experience/experience-bar'
import { usePlaygroundOptions, usePlaygroundState } from '@/features/playground/hooks'
import { getPricing } from '@/features/pricing/api'
import type { PricingModel } from '@/features/pricing/types'

import { getCanvasDraft, saveCanvasDraft } from './api'
import { CanvasBoard } from './canvas-board'
import { emptyCanvasDraft, type CanvasDraft } from './types'

export { CanvasEditor } from './editor'
export { StudioHome } from './home'
export { CanvasLibrary } from './library'

export function CanvasPage() {
  const { t } = useTranslation()
  const { config, models, setGroups, setModels, updateConfig } = usePlaygroundState()
  usePlaygroundOptions({
    currentGroup: config.group,
    currentModel: config.model,
    setGroups,
    setModels,
    updateConfig,
  })
  const { data: pricingModels = null } = useQuery({
    queryKey: ['canvas-pricing'],
    queryFn: async (): Promise<PricingModel[] | null> => {
      try {
        const data = await getPricing()
        return data.data ?? []
      } catch {
        return null
      }
    },
  })
  const { data: draft = null, isFetched } = useQuery({
    queryKey: ['canvas-draft'],
    queryFn: async () => {
      try {
        return (await getCanvasDraft()) ?? emptyCanvasDraft()
      } catch {
        return emptyCanvasDraft()
      }
    },
  })
  const [saveFailed, setSaveFailed] = useState(false)
  const buckets = catalogModels(models, pricingModels)

  if (!isFetched || !draft) return null

  return (
    <div className='flex h-full min-h-0 flex-col'>
      {saveFailed ? (
        <p className='text-destructive px-3 py-2 text-sm'>{t('Draft save failed')}</p>
      ) : null}
      <CanvasBoard
        initial={draft}
        chatModel={buckets.chat[0]?.value ?? ''}
        defaultImageModel={buckets.image[0]?.value ?? ''}
        group={config.group}
        onSave={async (next: CanvasDraft) => {
          await saveCanvasDraft(next)
          setSaveFailed(false)
        }}
        onSaveError={() => setSaveFailed(true)}
      />
    </div>
  )
}
