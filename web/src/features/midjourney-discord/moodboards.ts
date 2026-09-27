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
const BOARDS_KEY = 'mj-moodboards'
const ACTIVE_KEY = 'mj-active-moodboard'

export type Moodboard = {
  id: string
  title: string
  images: string[]
  profileId?: string
}

export function listMoodboards(): Moodboard[] {
  try {
    const raw = localStorage.getItem(BOARDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Moodboard[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveMoodboards(boards: Moodboard[]) {
  localStorage.setItem(BOARDS_KEY, JSON.stringify(boards))
}

export function getMoodboard(id: string): Moodboard | null {
  return listMoodboards().find((board) => board.id === id) ?? null
}

export function activeMoodboardId(): string {
  return localStorage.getItem(ACTIVE_KEY) ?? ''
}

export function setActiveMoodboard(id: string) {
  if (!id) localStorage.removeItem(ACTIVE_KEY)
  else localStorage.setItem(ACTIVE_KEY, id)
}

export function moodboardParam(profileId: string): string {
  const id = profileId.trim()
  if (!id) return ''
  return id.startsWith('m') ? `--p ${id}` : `--p m${id}`
}
