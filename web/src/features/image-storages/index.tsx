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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { ImageStorageManager } from './components/image-storage-manager'
import type { ImageStorageScope } from './types'

export function ImageStorages() {
  const { t } = useTranslation()
  const isRoot = useAuthStore(
    (state) => state.auth.user?.role === ROLE.SUPER_ADMIN
  )
  const [tab, setTab] = useState<ImageStorageScope>('user')

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Object Storage')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <p className='text-muted-foreground mb-4 text-sm'>
          {t(
            'Send cdn_key in the image request JSON or the X-CDN-Key header to upload generated images to this bucket. Failures fall back to the original base64 payload.'
          )}
        </p>
        {isRoot ? (
          <Tabs
            value={tab}
            onValueChange={(value) => {
              if (value === 'user' || value === 'system') {
                setTab(value)
              }
            }}
          >
            <TabsList>
              <TabsTrigger value='user'>{t('My storage')}</TabsTrigger>
              <TabsTrigger value='system'>{t('System buckets')}</TabsTrigger>
            </TabsList>
            <TabsContent value='user'>
              <ImageStorageManager scope='user' />
            </TabsContent>
            <TabsContent value='system'>
              <ImageStorageManager scope='system' />
            </TabsContent>
          </Tabs>
        ) : (
          <ImageStorageManager scope='user' />
        )}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
