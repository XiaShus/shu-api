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
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import { API_ENDPOINTS } from './constants'
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelOption,
  GroupOption,
} from './types'

/**
 * Send chat completion request (non-streaming)
 */
export async function sendChatCompletion(
  payload: ChatCompletionRequest,
  signal?: AbortSignal
): Promise<ChatCompletionResponse> {
  const res = await api.post(API_ENDPOINTS.CHAT_COMPLETIONS, payload, {
    signal,
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Get user available models
 */
export async function getUserModels(group: string): Promise<ModelOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_MODELS, {
    params: { group },
  })
  const { data } = res
  requireServerSuccess(data)

  if (!data.success || !Array.isArray(data.data)) {
    return []
  }

  return data.data.map((model: string) => ({
    label: model,
    value: model,
  }))
}

/**
 * Get user groups
 */
export async function getUserGroups(): Promise<GroupOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_GROUPS)
  const { data } = res
  requireServerSuccess(data)

  if (!data.success || !data.data) {
    return []
  }

  const groupData = data.data as Record<
    string,
    { desc: string; ratio: number | string }
  >

  // label is for button display (name only); desc is for dropdown content
  return Object.entries(groupData).map(([group, info]) => ({
    label: group,
    value: group,
    ratio: info.ratio,
    desc: info.desc,
  }))
}

export type WorkbenchSession = {
  id: number
  user_id: number
  kind: string
  title: string
  layout: string
  payload: string
  created_at: number
  updated_at: number
}

export async function listWorkbenchSessions(kind: string): Promise<WorkbenchSession[]> {
  const res = await api.get('/api/user/workbench-sessions', { params: { kind } })
  requireServerSuccess(res.data)
  return (res.data.data ?? []) as WorkbenchSession[]
}

export async function getWorkbenchSession(id: number): Promise<WorkbenchSession> {
  const res = await api.get(`/api/user/workbench-sessions/${id}`)
  requireServerSuccess(res.data)
  return res.data.data as WorkbenchSession
}

export async function updateWorkbenchSession(
  id: number,
  body: { title: string; layout: string; payload: string }
) {
  const res = await api.put(`/api/user/workbench-sessions/${id}`, body)
  requireServerSuccess(res.data)
}

export async function deleteWorkbenchSession(id: number) {
  const res = await api.delete(`/api/user/workbench-sessions/${id}`)
  requireServerSuccess(res.data)
}

export async function createWorkbenchSession(body: {
  kind: string
  title: string
  layout: string
  payload: string
}) {
  const res = await api.post('/api/user/workbench-sessions', body)
  requireServerSuccess(res.data)
  return res.data.data as WorkbenchSession
}
