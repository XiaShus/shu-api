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
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect } from 'react'

import { PlaygroundChat } from '@/features/playground/components/chat/playground-chat'
import { PlaygroundInput } from '@/features/playground/components/input/playground-input'
import {
  useChatHandler,
  usePlaygroundConversation,
  usePlaygroundOptions,
  usePlaygroundState,
} from '@/features/playground/hooks'
import { getPricing } from '@/features/pricing/api'
import type { PricingModel } from '@/features/pricing/types'

import { AudioPanel } from './audio-panel'
import { catalogModels, ExperienceBar } from './experience-bar'
import { ImagePanel } from './image-panel'
import { VideoPanel } from './video-panel'
import type { ExperienceMode } from './constants'

export function AppExperience() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/_authenticated/playground/' })
  const mode = (search.mode || 'chat') as ExperienceMode
  const {
    config,
    parameterEnabled,
    messages,
    isLoadingMessages,
    models,
    groups,
    updateMessages,
    setModels,
    setGroups,
    updateConfig,
    updateParameterEnabled,
    clearMessages,
  } = usePlaygroundState()

  const { sendChat, stopGeneration, isGenerating } = useChatHandler({
    config,
    parameterEnabled,
    onMessageUpdate: updateMessages,
  })

  const {
    editingMessageKey,
    handleSendMessage,
    handleRegenerateMessage,
    handleEditMessage,
    handleEditOpenChange,
    applyEdit,
    handleDeleteMessage,
  } = usePlaygroundConversation({
    messages,
    updateMessages,
    sendChat,
  })

  const handleClearMessages = () => {
    handleEditOpenChange(false)
    clearMessages()
  }

  const { isLoadingModels } = usePlaygroundOptions({
    currentGroup: config.group,
    currentModel: config.model,
    setGroups,
    setModels,
    updateConfig,
  })

  const { data: pricingModels = null } = useQuery({
    queryKey: ['app-experience-pricing'],
    queryFn: async (): Promise<PricingModel[] | null> => {
      try {
        const data = await getPricing()
        return data.data ?? []
      } catch {
        return null
      }
    },
  })

  useEffect(() => {
    if (!search.model || search.model === config.model) return
    updateConfig('model', search.model)
  }, [search.model, config.model, updateConfig])

  useEffect(() => {
    if (models.length === 0) return
    const list = catalogModels(models, pricingModels)[mode]
    const nextModel = list.some((item) => item.value === config.model)
      ? config.model
      : (list[0]?.value ?? '')
    if (nextModel !== config.model) updateConfig('model', nextModel)
    if (search.model === nextModel) return
    void navigate({
      to: '/playground',
      search: { mode, model: nextModel },
      replace: true,
    })
  }, [mode, models, pricingModels, config.model, search.model, updateConfig, navigate])

  const writeSearch = (nextMode: ExperienceMode, nextModel: string) => {
    void navigate({
      to: '/playground',
      search: { mode: nextMode, model: nextModel },
      replace: true,
    })
  }

  const pickModel = (nextMode: ExperienceMode, nextModel: string) => {
    if (nextModel) updateConfig('model', nextModel)
    writeSearch(nextMode, nextModel)
  }

  const buckets = catalogModels(models, pricingModels)
  const imageModels = buckets.image

  return (
    <div className='relative flex size-full min-h-0 flex-col overflow-hidden'>
      {mode === 'image' ? null : (
        <ExperienceBar
          mode={mode}
          model={config.model}
          models={models}
          pricingModels={pricingModels}
          group={config.group}
          groups={groups}
          onPick={pickModel}
          onGroupChange={(value) => updateConfig('group', value)}
        />
      )}
      {mode === 'chat' ? (
        <>
          <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
            <PlaygroundChat
              messages={messages}
              isLoadingMessages={isLoadingMessages}
              onRegenerateMessage={handleRegenerateMessage}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onSelectPrompt={handleSendMessage}
              isGenerating={isGenerating}
              editingKey={editingMessageKey}
              onCancelEdit={handleEditOpenChange}
              onSaveEdit={(newContent) => applyEdit(newContent, false)}
              onSaveEditAndSubmit={(newContent) => applyEdit(newContent, true)}
            />
          </div>
          <div className='mx-auto w-full max-w-4xl'>
            <PlaygroundInput
              config={config}
              disabled={isGenerating}
              groups={groups}
              groupValue={config.group}
              isGenerating={isGenerating}
              isModelLoading={isLoadingModels}
              modelValue={config.model}
              models={models}
              onGroupChange={(value) => updateConfig('group', value)}
              onConfigChange={updateConfig}
              onClearMessages={handleClearMessages}
              onModelChange={(value) => {
                updateConfig('model', value)
                writeSearch(mode, value)
              }}
              onParameterEnabledChange={updateParameterEnabled}
              onStop={stopGeneration}
              onSubmit={handleSendMessage}
              parameterEnabled={parameterEnabled}
              hasMessages={messages.length > 0}
            />
          </div>
        </>
      ) : null}
      {mode === 'image' ? (
        <ImagePanel
          model={config.model}
          models={imageModels}
          group={config.group}
          onModelChange={(value) => pickModel(mode, value)}
        />
      ) : null}
      {mode === 'video' ? <VideoPanel model={config.model} group={config.group} /> : null}
      {mode === 'audio' ? <AudioPanel model={config.model} group={config.group} /> : null}
    </div>
  )
}
