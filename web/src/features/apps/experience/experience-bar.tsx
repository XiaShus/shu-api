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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'

import type { PricingModel } from '@/features/pricing/types'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import type { GroupOption, ModelOption } from '@/features/playground/types'

import type { ExperienceMode } from './constants'

type PickerTab = 'language' | 'vision' | 'speech'

type ExperienceBarProps = {
  mode: ExperienceMode
  model: string
  models: ModelOption[]
  pricingModels: PricingModel[] | null
  group: string
  groups: GroupOption[]
  onPick: (mode: ExperienceMode, model: string) => void
  onGroupChange: (group: string) => void
}

type ModelBuckets = Record<ExperienceMode, ModelOption[]>

const TABS: PickerTab[] = ['language', 'vision', 'speech']

const TAB_LABEL: Record<PickerTab, string> = {
  language: 'Language',
  vision: 'Vision',
  speech: 'Audio',
}

function tabForMode(mode: ExperienceMode): PickerTab {
  if (mode === 'audio') return 'speech'
  if (mode === 'chat') return 'language'
  return 'vision'
}

function endpointNames(pricingModels: PricingModel[] | null, endpoint: string) {
  if (!pricingModels) return null
  return new Set(
    pricingModels
      .filter((item) => item.supported_endpoint_types?.includes(endpoint))
      .map((item) => item.model_name)
  )
}

function isHiddenExperienceModel(value: string) {
  return value.startsWith('mj_') || value === 'swap_face' || value === 'swap_video_face'
}

export function catalogModels(
  models: ModelOption[],
  pricingModels: PricingModel[] | null
): ModelBuckets {
  const visible = models.filter((item) => !isHiddenExperienceModel(item.value))
  const imageNames = endpointNames(pricingModels, 'image-generation')
  const videoNames = endpointNames(pricingModels, 'openai-video')
  const tagged = (names: Set<string> | null, item: ModelOption) => names?.has(item.value) ?? false
  const image = visible.filter(
    (item) =>
      tagged(imageNames, item) ||
      /image|dall|flux|seedream|gpt-image|recraft|ideogram/i.test(item.value)
  )
  const imageIds = new Set(image.map((item) => item.value))
  const video = visible.filter(
    (item) =>
      !imageIds.has(item.value) &&
      (tagged(videoNames, item) || /video|sora|seedance|kling|\bwan\b/i.test(item.value))
  )
  const videoIds = new Set(video.map((item) => item.value))
  const audio = visible.filter(
    (item) =>
      !imageIds.has(item.value) &&
      !videoIds.has(item.value) &&
      /tts|audio|speech/i.test(item.value)
  )
  const used = new Set([...image, ...video, ...audio].map((item) => item.value))
  return {
    chat: visible.filter((item) => !used.has(item.value)),
    image,
    video,
    audio,
  }
}

function matchesQuery(item: ModelOption, query: string) {
  if (!query) return true
  const haystack = `${item.label} ${item.value}`.toLowerCase()
  return haystack.includes(query)
}

export function ExperienceBar(props: ExperienceBarProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<PickerTab>(tabForMode(props.mode))
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState(props.model)
  const buckets = catalogModels(props.models, props.pricingModels)
  const needle = query.trim().toLowerCase()
  const previewName = preview || props.model

  const pick = (mode: ExperienceMode, model: string) => {
    props.onPick(mode, model)
    setOpen(false)
  }

  return (
    <div className='px-4 pt-3'>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) return
          setTab(tabForMode(props.mode))
          setQuery('')
          setPreview(props.model)
        }}
      >
        <PopoverTrigger
          type='button'
          className='border-border bg-background hover:bg-muted inline-flex max-w-sm items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium'
        >
          <span className='truncate'>{props.model || t('Select model')}</span>
          <ChevronDownIcon className='size-4 shrink-0' />
        </PopoverTrigger>
        <PopoverContent align='start' className='w-[40rem] max-w-[calc(100vw-2rem)] p-0'>
          <div className='grid min-h-80 grid-cols-[16rem_1fr]'>
            <div className='border-border flex min-h-0 flex-col border-r p-3'>
              <div className='mb-2 text-sm font-medium'>{t('Select model')}</div>
              <input
                className='border-border mb-2 w-full rounded-md border px-2 py-1 text-sm outline-none'
                placeholder={t('Search models')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className='mb-2 flex gap-1'>
                {TABS.map((item) => (
                  <button
                    key={item}
                    type='button'
                    className={cn(
                      'rounded-md px-2 py-1 text-xs',
                      tab === item ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted'
                    )}
                    onClick={() => setTab(item)}
                  >
                    {t(TAB_LABEL[item])}
                  </button>
                ))}
              </div>
              <div className='min-h-0 flex-1 overflow-auto'>
                {tab === 'language' ? (
                  <ModelList
                    models={buckets.chat.filter((item) => matchesQuery(item, needle))}
                    active={props.model}
                    onHover={setPreview}
                    onPick={(model) => pick('chat', model)}
                  />
                ) : null}
                {tab === 'vision' ? (
                  <>
                    <p className='text-muted-foreground px-2 py-1 text-xs'>{t('Image generation')}</p>
                    <ModelList
                      models={buckets.image.filter((item) => matchesQuery(item, needle))}
                      active={props.model}
                      onHover={setPreview}
                      onPick={(model) => pick('image', model)}
                    />
                    <p className='text-muted-foreground mt-2 px-2 py-1 text-xs'>{t('Video generation')}</p>
                    <ModelList
                      models={buckets.video.filter((item) => matchesQuery(item, needle))}
                      active={props.model}
                      onHover={setPreview}
                      onPick={(model) => pick('video', model)}
                    />
                  </>
                ) : null}
                {tab === 'speech' ? (
                  <ModelList
                    models={buckets.audio.filter((item) => matchesQuery(item, needle))}
                    active={props.model}
                    onHover={setPreview}
                    onPick={(model) => pick('audio', model)}
                  />
                ) : null}
              </div>
            </div>
            <div className='flex flex-col gap-3 p-4'>
              <div className='text-base font-semibold break-all'>{previewName || t('Select model')}</div>
              <div>
                <div className='text-muted-foreground text-xs'>{t('Model ID')}</div>
                <div className='font-mono text-sm break-all'>{previewName}</div>
              </div>
              <label className='text-muted-foreground text-xs'>
                {t('Group')}
                <select
                  className='border-border bg-background mt-1 w-full rounded-md border px-2 py-1 text-sm'
                  value={props.group}
                  onChange={(event) => props.onGroupChange(event.target.value)}
                >
                  {props.groups.map((group) => (
                    <option key={group.value} value={group.value}>
                      {group.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function ModelList(props: {
  models: ModelOption[]
  active: string
  onHover: (model: string) => void
  onPick: (model: string) => void
}) {
  const { t } = useTranslation()
  if (props.models.length === 0) {
    return <p className='text-muted-foreground px-2 py-2 text-sm'>{t('No models')}</p>
  }
  return (
    <div>
      {props.models.map((model) => (
        <button
          key={model.value}
          type='button'
          className={cn(
            'hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
            model.value === props.active && 'bg-muted'
          )}
          onMouseEnter={() => props.onHover(model.value)}
          onFocus={() => props.onHover(model.value)}
          onClick={() => props.onPick(model.value)}
        >
          <span className='min-w-0 flex-1 truncate'>{model.label}</span>
          {model.value === props.active ? <CheckIcon className='size-4 shrink-0' /> : null}
        </button>
      ))}
    </div>
  )
}
