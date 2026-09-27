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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

import { APP_CENTER_APPS } from './constants'

export function AppCenter() {
  const { t } = useTranslation()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('App Center')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
          {APP_CENTER_APPS.map((app) => {
            const card = (
              <Card className={app.enabled ? undefined : 'opacity-60'}>
                <CardHeader>
                  <CardTitle>{t(app.titleKey)}</CardTitle>
                  {app.enabled ? null : (
                    <p className='text-muted-foreground text-sm'>
                      {t('Coming soon')}
                    </p>
                  )}
                </CardHeader>
              </Card>
            )

            if (app.enabled) {
              return (
                <Link key={app.id} to={app.href} className='block'>
                  {card}
                </Link>
              )
            }

            return (
              <div key={app.id} aria-disabled='true'>
                {card}
              </div>
            )
          })}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
