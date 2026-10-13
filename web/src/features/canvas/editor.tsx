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
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { catalogModels } from '@/features/apps/experience/experience-bar'
import { getWorkbenchSession, updateWorkbenchSession } from '@/features/playground/api'
import { usePlaygroundOptions, usePlaygroundState } from '@/features/playground/hooks'
import { getPricing } from '@/features/pricing/api'
import type { PricingModel } from '@/features/pricing/types'

import { CanvasStudio } from './studio'
import { draftFromPayload, type CanvasDraft } from './types'

export function CanvasEditor(props: { canvasId: string; add?: string }) {
  const { t } = useTranslation()
  const id = Number(props.canvasId)
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
  const session = useQuery({
    queryKey: ['workbench-session', id],
    enabled: Number.isInteger(id) && id > 0,
    queryFn: () => getWorkbenchSession(id),
  })
  const [saveFailed, setSaveFailed] = useState(false)
  const buckets = catalogModels(models, pricingModels)

  if (!Number.isInteger(id) || id <= 0 || session.isError) {
    return (
      <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
        <Link to='/apps/canvas' className='underline'>
          {t('Canvas not found')}
        </Link>
      </div>
    )
  }
  if (!session.isFetched || !session.data) return null
  const row = session.data
  const draft = draftFromPayload(row.payload)

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='flex h-12 shrink-0 items-center gap-3 border-b px-3'>
        <Link to='/apps/canvas' className='text-muted-foreground text-sm'>
          {t('Back to canvases')}
        </Link>
        <span className='truncate text-sm font-medium'>
          {row.title || t('New session')}
        </span>
        <span className='text-muted-foreground text-xs'>#{row.id}</span>
      </div>
      {saveFailed ? (
        <p className='text-destructive px-3 py-2 text-sm'>{t('Draft save failed')}</p>
      ) : null}
      <div className='min-h-0 flex-1'>
        <CanvasStudio
          initial={draft}
          chatModel={buckets.chat[0]?.value ?? ''}
          imageModel={buckets.image[0]?.value ?? ''}
          videoModel={buckets.video[0]?.value ?? ''}
          audioModel={buckets.audio[0]?.value ?? ''}
          group={config.group}
          initialAdd={props.add}
          onSave={async (next: CanvasDraft) => {
            await updateWorkbenchSession(id, {
              title: row.title,
              layout: row.layout || 'immersive',
              payload: JSON.stringify(next),
            })
            setSaveFailed(false)
          }}
          onSaveError={() => setSaveFailed(true)}
        />
      </div>
    </div>
  )
}
