import { api, getSelf, getUserGroups } from '@/lib/api'
import axios from 'axios'

import type { MjButton, MjTask } from './types'

type SubmitBody = {
  prompt?: string
  taskId?: string
  customId?: string
  botType?: string
  state?: string
  base64Array?: string[]
  content?: string
  accountFilter?: { modes: string[] }
}

export async function submitMj(
  path: string,
  body: SubmitBody,
  group: string
): Promise<{ result: string; description: string }> {
  const res = await api.post(`/pg/mj${path}`, body, {
    params: group ? { group } : undefined,
    skipErrorHandler: true,
  })
  const data = res.data as { result?: string; description?: string; code?: number }
  if (typeof data.code === 'number' && data.code !== 1) {
    throw new Error(data.description || 'Request failed')
  }
  if (!data.result) {
    throw new Error(data.description || 'Request failed')
  }
  return {
    result: String(data.result),
    description: String(data.description ?? ''),
  }
}

export function readMjError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { description?: unknown } | undefined
    if (typeof data?.description === 'string' && data.description.trim() !== '') {
      return data.description
    }
  }
  if (error instanceof Error && error.message.trim() !== '') return error.message
  return 'Request failed'
}

export async function uploadMjImages(
  images: string[],
  group: string
): Promise<string[]> {
  const res = await api.post(
    '/pg/mj/submit/upload-discord-images',
    { base64Array: images },
    { params: group ? { group } : undefined, skipErrorHandler: true }
  )
  const data = res.data as { result?: string | string[]; code?: number; description?: string }
  if (typeof data.code === 'number' && data.code !== 1) {
    throw new Error(data.description || 'Request failed')
  }
  if (Array.isArray(data.result)) return data.result.filter(Boolean)
  return String(data.result ?? '')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export async function fetchMjTask(id: string): Promise<MjTask | null> {
  const res = await api.get(`/pg/mj/task/${encodeURIComponent(id)}/fetch`, {
    skipErrorHandler: true,
  })
  return normalizeTask(res.data)
}

export async function listMjTasks(): Promise<MjTask[]> {
  const res = await api.get('/api/mj/self', {
    params: { p: 1, page_size: 50 },
    skipErrorHandler: true,
  })
  const data = res.data as { data?: { items?: unknown[] }; items?: unknown[] }
  const items = data.data?.items ?? data.items ?? []
  return items.map(normalizeTask).filter((task): task is MjTask => task !== null)
}

export async function loadAccount(): Promise<{
  name: string
  quota: number
  group: string
  groups: string[]
}> {
  const [selfRes, groups] = await Promise.all([getSelf(), getUserGroups()])
  const self = selfRes as {
    data?: { display_name?: string; username?: string; quota?: number; group?: string }
  }
  const data = self.data ?? {}
  const groupNames = groups.success && groups.data ? Object.keys(groups.data) : []
  return {
    name: data.display_name || data.username || '',
    quota: Number(data.quota ?? 0),
    group: data.group || groupNames[0] || '',
    groups: groupNames.length > 0 ? groupNames : data.group ? [data.group] : [],
  }
}

function normalizeTask(raw: unknown): MjTask | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const mjId = typeof row.mj_id === 'string' ? row.mj_id.trim() : ''
  const id = mjId || String(row.id ?? '')
  if (!id || id === '0') return null
  const imageUrl = String(row.imageUrl ?? row.image_url ?? '')
  return {
    id,
    action: String(row.action ?? ''),
    prompt: String(row.prompt ?? row.promptEn ?? row.prompt_en ?? ''),
    status: String(row.status ?? ''),
    progress: String(row.progress ?? ''),
    imageUrl: imageUrl || (row.status === 'SUCCESS' ? `/mj/image/${id}` : ''),
    videoUrl: String(row.videoUrl ?? row.video_url ?? ''),
    failReason: String(row.failReason ?? row.fail_reason ?? ''),
    buttons: parseButtons(row.buttons),
    imageUrls: parseImageUrls(row),
    state: String(row.state ?? ''),
    submitTime: Number(row.submitTime ?? row.submit_time ?? 0),
    mode: String(row.mode ?? ''),
  }
}

function parseImageUrls(row: Record<string, unknown>): string[] {
  const urls = urlsFromUnknown(row.imageUrls)
  if (urls.length > 0) return urls
  const payload = row.payload
  if (typeof payload === 'string' && payload.trim() !== '') {
    try {
      const parsed = JSON.parse(payload) as Record<string, unknown>
      return urlsFromUnknown(parsed.imageUrls)
    } catch {
      return []
    }
  }
  if (payload && typeof payload === 'object') {
    return urlsFromUnknown((payload as Record<string, unknown>).imageUrls)
  }
  return []
}

function urlsFromUnknown(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const urls: string[] = []
  for (const item of raw) {
    if (typeof item === 'string' && item.trim() !== '') {
      urls.push(item)
      continue
    }
    if (item && typeof item === 'object') {
      const url = (item as Record<string, unknown>).url
      if (typeof url === 'string' && url.trim() !== '') urls.push(url)
    }
  }
  return urls
}

function parseButtons(raw: unknown): MjButton[] {
  let value = raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    try {
      value = JSON.parse(raw) as unknown
    } catch {
      return []
    }
  }
  if (!Array.isArray(value)) return []
  const buttons: MjButton[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const button = item as Record<string, unknown>
    const customId = String(button.customId ?? button.custom_id ?? '')
    if (!customId) continue
    const label = String(button.label ?? button.emoji ?? customId)
    buttons.push({ customId, label: label || customId })
  }
  return buttons
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export async function createProfile(title: string, group: string): Promise<string> {
  const created = await submitMj(
    '/profile/create',
    { title, service: 'midjourney', version: '8.2' } as never,
    group
  )
  return created.result
}

export async function fetchProfile(id: string, group: string): Promise<Record<string, unknown>> {
  const res = await api.get(`/pg/mj/profile/${encodeURIComponent(id)}/fetch`, {
    params: group ? { group } : undefined,
    skipErrorHandler: true,
  })
  return (res.data ?? {}) as Record<string, unknown>
}

export async function fetchProfilePair(id: string, group: string): Promise<Record<string, unknown>> {
  const res = await api.get(`/pg/mj/profile/pair/${encodeURIComponent(id)}`, {
    params: group ? { group } : undefined,
    skipErrorHandler: true,
  })
  return (res.data ?? {}) as Record<string, unknown>
}

export async function rateProfile(
  profileId: string,
  jobId: string,
  group: string
): Promise<void> {
  await api.post(
    '/pg/mj/profile/pair/rate',
    { profileId, jobId },
    { params: group ? { group } : undefined, skipErrorHandler: true }
  )
}

export async function skipProfile(profileId: string, group: string): Promise<void> {
  await api.post(
    '/pg/mj/profile/pair/skip',
    { profile_id: profileId },
    { params: group ? { group } : undefined, skipErrorHandler: true }
  )
}
