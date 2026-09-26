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
export type ImageStorageScope = 'user' | 'system'

export type ImageStorage = {
  id: number
  user_id: number
  name: string
  cdn_key: string
  provider: string
  endpoint: string
  region: string
  bucket: string
  access_key: string
  prefix: string
  public_base_url: string
  path_style: boolean
  status: number
  last_error: string
  last_error_at: number
  last_success_at: number
  created_time: number
  updated_time: number
  has_secret_key: boolean
}

export type ImageStoragePayload = {
  name: string
  provider: string
  endpoint: string
  region: string
  bucket: string
  access_key: string
  secret_key: string
  prefix: string
  public_base_url: string
  path_style: boolean
  status: number
}

export type ImageStorageFormValues = {
  name: string
  endpoint: string
  region: string
  bucket: string
  access_key: string
  secret_key: string
  prefix: string
  public_base_url: string
  path_style: boolean
  enabled: boolean
}
