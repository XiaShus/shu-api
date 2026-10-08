import axios from 'axios'

import { api } from '@/lib/api'

import { normalizeCanvasDraft, type CanvasDraft } from './types'

function failureMessage(cause: unknown) {
  if (axios.isAxiosError(cause)) {
    const data = cause.response?.data as { error?: { message?: string }; message?: string } | undefined
    return data?.error?.message || data?.message || cause.message
  }
  return cause instanceof Error ? cause.message : ''
}

export async function getCanvasDraft(): Promise<CanvasDraft | null> {
  const res = await api.get('/api/user/canvas-draft')
  const body = res.data as { success?: boolean; data?: unknown }
  if (!body.success || body.data == null) return null
  return normalizeCanvasDraft(body.data)
}

export async function saveCanvasDraft(draft: CanvasDraft) {
  await api.put('/api/user/canvas-draft', draft)
}

export async function sendCanvasChat(body: { model: string; group: string; text: string }) {
  try {
    const res = await api.post(
      '/pg/chat/completions',
      {
        model: body.model,
        group: body.group,
        messages: [{ role: 'user', content: body.text }],
      },
      { skipErrorHandler: true }
    )
    const data = res.data as {
      choices?: Array<{ message?: { content?: string } }>
      error?: { message?: string }
      message?: string
    }
    if (data.error?.message) throw new Error(data.error.message)
    const reply = data.choices?.[0]?.message?.content
    if (!reply) throw new Error(data.message || 'Request failed')
    return reply
  } catch (cause) {
    throw new Error(failureMessage(cause) || 'Request failed')
  }
}

export { failureMessage }
