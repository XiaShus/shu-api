import axios from 'axios'

import { api } from '@/lib/api'

import { API_ENDPOINTS } from './constants'

async function experienceError(cause: unknown): Promise<Error> {
  if (!axios.isAxiosError(cause)) {
    return cause instanceof Error ? cause : new Error(String(cause))
  }
  let data: unknown = cause.response?.data
  if (data instanceof Blob) {
    const text = await data.text()
    try {
      data = JSON.parse(text) as unknown
    } catch {
      return new Error(text || cause.message)
    }
  }
  if (data && typeof data === 'object') {
    const body = data as { error?: { message?: string }; message?: string }
    const message = body.error?.message || body.message
    if (message) return new Error(message)
  }
  if (typeof data === 'string' && data.trim()) return new Error(data)
  return new Error(cause.message)
}

export async function sendImageGeneration(body: {
  model: string
  prompt: string
  n: number
  size: string
  group: string
}) {
  try {
    const res = await api.post(API_ENDPOINTS.IMAGE_GENERATIONS, body, {
      skipErrorHandler: true,
    })
    return res.data as {
      data?: Array<{ url?: string; b64_json?: string }>
      error?: { message?: string }
    }
  } catch (cause) {
    throw await experienceError(cause)
  }
}

export type VideoJob = {
  id?: string
  task_id?: string
  status?: string
  progress?: number
  url?: string
  video_url?: string
  message?: string
  error?: { message?: string }
}

export async function sendVideoGeneration(body: {
  model: string
  prompt: string
  group: string
}) {
  try {
    const res = await api.post(API_ENDPOINTS.VIDEOS, body, {
      skipErrorHandler: true,
    })
    return res.data as VideoJob
  } catch (cause) {
    throw await experienceError(cause)
  }
}

export async function fetchVideo(id: string) {
  try {
    const res = await api.get(`${API_ENDPOINTS.VIDEOS}/${encodeURIComponent(id)}`, {
      skipErrorHandler: true,
    })
    return res.data as VideoJob
  } catch (cause) {
    throw await experienceError(cause)
  }
}

export async function sendSpeech(body: {
  model: string
  input: string
  group: string
  voice: string
}) {
  try {
    const res = await api.post(API_ENDPOINTS.AUDIO_SPEECH, body, {
      skipErrorHandler: true,
      responseType: 'blob',
    })
    return res.data as Blob
  } catch (cause) {
    throw await experienceError(cause)
  }
}
