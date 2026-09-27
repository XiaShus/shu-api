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

export const APP_CENTER_APPS = [
  {
    id: 'chat',
    titleKey: 'Chat',
    href: '/playground',
    enabled: true,
  },
  {
    id: 'midjourney',
    titleKey: 'Midjourney Discord',
    href: '/apps/midjourney',
    enabled: true,
  },
  {
    id: 'image',
    titleKey: 'Image',
    href: null,
    enabled: false,
  },
  {
    id: 'video',
    titleKey: 'Video',
    href: null,
    enabled: false,
  },
  {
    id: 'canvas',
    titleKey: 'Canvas',
    href: null,
    enabled: false,
  },
] as const
