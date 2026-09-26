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

import type {
  ImageStorage,
  ImageStoragePayload,
  ImageStorageScope,
} from './types'

type ApiResponse<T = unknown> = {
  success: boolean
  message?: string
  data?: T
}

function scopeParams(scope: ImageStorageScope) {
  return scope === 'system' ? { scope: 'system' } : undefined
}

export async function getImageStorages(
  scope: ImageStorageScope
): Promise<ApiResponse<ImageStorage[]>> {
  const res = await api.get('/api/image_storage/', {
    params: scopeParams(scope),
  })
  return res.data
}

export async function createImageStorage(
  scope: ImageStorageScope,
  data: ImageStoragePayload
): Promise<ApiResponse<ImageStorage>> {
  const res = await api.post('/api/image_storage/', data, {
    params: scopeParams(scope),
  })
  return res.data
}

export async function updateImageStorage(
  scope: ImageStorageScope,
  id: number,
  data: ImageStoragePayload
): Promise<ApiResponse<ImageStorage>> {
  const res = await api.put(`/api/image_storage/${id}`, data, {
    params: scopeParams(scope),
  })
  return res.data
}

export async function deleteImageStorage(
  scope: ImageStorageScope,
  id: number
): Promise<ApiResponse> {
  const res = await api.delete(`/api/image_storage/${id}`, {
    params: scopeParams(scope),
  })
  return res.data
}

export async function testImageStorage(
  scope: ImageStorageScope,
  id: number
): Promise<ApiResponse<{ ok: boolean }>> {
  const res = await api.post(`/api/image_storage/${id}/test`, null, {
    params: scopeParams(scope),
  })
  return res.data
}

export async function resetImageStorageKey(
  scope: ImageStorageScope,
  id: number
): Promise<ApiResponse<ImageStorage>> {
  const res = await api.post(`/api/image_storage/${id}/reset_key`, null, {
    params: scopeParams(scope),
  })
  return res.data
}
