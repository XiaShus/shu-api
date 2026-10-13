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
    mode: null,
  },
  {
    id: 'midjourney',
    titleKey: 'Midjourney Discord',
    href: '/apps/midjourney',
    enabled: true,
    mode: null,
  },
  {
    id: 'image',
    titleKey: 'Image',
    href: '/playground',
    enabled: true,
    mode: 'image',
  },
  {
    id: 'video',
    titleKey: 'Video',
    href: '/playground',
    enabled: true,
    mode: 'video',
  },
  {
    id: 'canvas',
    titleKey: 'Canvas',
    href: '/apps/canvas',
    enabled: true,
    mode: null,
  },
  {
    id: 'ecom',
    titleKey: 'Commerce images',
    href: '/apps/ecom',
    enabled: true,
    mode: null,
  },
] as const
