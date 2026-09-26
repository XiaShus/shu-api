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
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import { Label } from '@/components/ui/label'

import type { MidjourneyLog } from '../../types'

interface SplitImage {
  url: string
  thumbnail?: string
}

function parsePayload(payload?: string): Record<string, unknown> | null {
  if (!payload?.trim()) return null
  try {
    const parsed: unknown = JSON.parse(payload)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function splitImages(payload: Record<string, unknown> | null): SplitImage[] {
  const raw = payload?.imageUrls
  if (!Array.isArray(raw)) return []
  const images: SplitImage[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (typeof record.url !== 'string' || record.url === '') continue
    images.push({
      url: record.url,
      thumbnail:
        typeof record.thumbnail === 'string' ? record.thumbnail : undefined,
    })
  }
  return images
}

interface DrawingTaskDetailsDialogProps {
  log: MidjourneyLog
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DrawingTaskDetailsDialog(props: DrawingTaskDetailsDialogProps) {
  const { t } = useTranslation()
  const payload = parsePayload(props.log.payload)
  const images = splitImages(payload)
  const pretty = payload ? JSON.stringify(payload, null, 2) : ''

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Task Details')}
      description={props.log.mj_id}
      contentClassName='min-w-0 overflow-hidden sm:max-w-3xl'
      contentHeight='min(72dvh, 720px)'
      bodyClassName='space-y-4 pr-2 sm:pr-4'
    >
      {images.length > 0 && (
        <section className='space-y-2'>
          <Label className='text-xs font-semibold'>{t('Split images')}</Label>
          <div className='grid grid-cols-2 gap-2'>
            {images.map((image, index) => (
              <a
                key={image.url}
                href={image.url}
                target='_blank'
                rel='noreferrer'
                className='bg-muted block overflow-hidden rounded-md border'
              >
                <img
                  src={image.thumbnail || image.url}
                  alt={t('Split image {{n}}', { n: index + 1 })}
                  className='aspect-square w-full object-cover'
                />
              </a>
            ))}
          </div>
        </section>
      )}
      <section className='space-y-2'>
        <div className='flex items-center justify-between gap-2'>
          <Label className='text-xs font-semibold'>{t('All parameters')}</Label>
          {pretty ? <CopyButton value={pretty} /> : null}
        </div>
        {pretty ? (
          <pre className='bg-muted/40 max-h-[420px] overflow-auto rounded-md border p-3 font-mono text-[11px] leading-relaxed wrap-break-word whitespace-pre-wrap'>
            {pretty}
          </pre>
        ) : (
          <p className='text-muted-foreground text-xs'>
            {t('No upstream task payload yet')}
          </p>
        )}
      </section>
    </Dialog>
  )
}
