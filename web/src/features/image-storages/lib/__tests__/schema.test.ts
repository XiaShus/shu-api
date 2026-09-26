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
import { describe, expect, it } from 'vitest'

import {
  createImageStorageSchema,
  emptyImageStorageFormValues,
  imageStorageFormToPayload,
} from '../schema'

describe('image storage form schema', () => {
  it('rejects a user endpoint that is not HTTPS', () => {
    const result = createImageStorageSchema('user', 'create').safeParse({
      ...emptyImageStorageFormValues(),
      name: 'qiniu',
      endpoint: 'http://s3.example.com',
      bucket: 'images',
      access_key: 'ak',
      secret_key: 'sk',
    })
    expect(result.success).toBe(false)
  })

  it('accepts an HTTPS user endpoint and keeps an unchanged access key empty on edit', () => {
    const values = {
      ...emptyImageStorageFormValues(),
      name: 'qiniu',
      endpoint: 'https://s3.example.com',
      bucket: 'images',
      access_key: 'ak12**********6789',
      secret_key: '',
    }
    const parsed = createImageStorageSchema('user', 'edit').safeParse(values)
    expect(parsed.success).toBe(true)
    const payload = imageStorageFormToPayload(values, {
      id: 1,
      user_id: 2,
      name: 'qiniu',
      cdn_key: 'cdn_x',
      provider: 's3',
      endpoint: 'https://s3.example.com',
      region: '',
      bucket: 'images',
      access_key: 'ak12**********6789',
      prefix: 'images',
      public_base_url: '',
      path_style: true,
      status: 1,
      last_error: '',
      last_error_at: 0,
      last_success_at: 0,
      created_time: 0,
      updated_time: 0,
      has_secret_key: true,
    })
    expect(payload.access_key).toBe('')
    expect(payload.secret_key).toBe('')
  })

  it('allows a system endpoint without HTTPS', () => {
    const result = createImageStorageSchema('system', 'create').safeParse({
      ...emptyImageStorageFormValues(),
      name: 'local',
      endpoint: 'http://minio:9000',
      bucket: 'images',
      access_key: 'ak',
      secret_key: 'sk',
    })
    expect(result.success).toBe(true)
  })
})
