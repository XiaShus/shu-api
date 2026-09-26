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
import { z } from 'zod'

import { IMAGE_STORAGE_PROVIDER, IMAGE_STORAGE_STATUS } from '../constants'
import type {
  ImageStorage,
  ImageStorageFormValues,
  ImageStoragePayload,
  ImageStorageScope,
} from '../types'

export type ImageStorageFormMode = 'create' | 'edit'

export function createImageStorageSchema(
  scope: ImageStorageScope,
  mode: ImageStorageFormMode,
  translate: (key: string) => string = (key) => key
) {
  return z
    .object({
      name: z.string().trim().min(1).max(64),
      endpoint: z.string().trim(),
      region: z.string().trim(),
      bucket: z.string().trim().min(1),
      access_key: z.string(),
      secret_key: z.string(),
      prefix: z.string().trim(),
      public_base_url: z.string().trim(),
      path_style: z.boolean(),
      enabled: z.boolean(),
    })
    .superRefine((values, ctx) => {
      if (scope === 'user' && !values.endpoint.toLowerCase().startsWith('https://')) {
        ctx.addIssue({
          code: 'custom',
          path: ['endpoint'],
          message: translate('User-owned endpoints must use HTTPS.'),
        })
      }
      if (mode === 'create' && values.access_key.trim() === '') {
        ctx.addIssue({
          code: 'custom',
          path: ['access_key'],
          message: translate('Access key is required'),
        })
      }
      if (mode === 'create' && values.secret_key.trim() === '') {
        ctx.addIssue({
          code: 'custom',
          path: ['secret_key'],
          message: translate('Secret key is required'),
        })
      }
    })
}

export function emptyImageStorageFormValues(): ImageStorageFormValues {
  return {
    name: '',
    endpoint: '',
    region: '',
    bucket: '',
    access_key: '',
    secret_key: '',
    prefix: 'images',
    public_base_url: '',
    path_style: true,
    enabled: true,
  }
}

export function imageStorageToFormValues(
  item: ImageStorage
): ImageStorageFormValues {
  return {
    name: item.name,
    endpoint: item.endpoint,
    region: item.region,
    bucket: item.bucket,
    access_key: item.access_key,
    secret_key: '',
    prefix: item.prefix,
    public_base_url: item.public_base_url,
    path_style: item.path_style,
    enabled: item.status !== IMAGE_STORAGE_STATUS.DISABLED,
  }
}

export function imageStorageFormToPayload(
  values: ImageStorageFormValues,
  original?: ImageStorage
): ImageStoragePayload {
  const accessKeyUnchanged =
    original != null && values.access_key.trim() === original.access_key.trim()

  return {
    name: values.name.trim(),
    provider: IMAGE_STORAGE_PROVIDER,
    endpoint: values.endpoint.trim(),
    region: values.region.trim(),
    bucket: values.bucket.trim(),
    access_key: accessKeyUnchanged ? '' : values.access_key.trim(),
    secret_key: values.secret_key,
    prefix: values.prefix.trim(),
    public_base_url: values.public_base_url.trim(),
    path_style: values.path_style,
    status: values.enabled
      ? IMAGE_STORAGE_STATUS.ENABLED
      : IMAGE_STORAGE_STATUS.DISABLED,
  }
}
