import { useTranslation } from 'react-i18next'

import { StudioWorkbench } from '@/features/studio/workbench'

export function GalleryWorkbench() {
  const { t } = useTranslation()
  return (
    <StudioWorkbench
      kind='gallery'
      title={t('Gallery')}
      hint={t('Collect finished images into a gallery.')}
      action={t('Save')}
      fields={[
        { name: 'title', label: t('Title'), placeholder: t('Title') },
        { name: 'category', label: t('Category'), placeholder: t('Category') },
      ]}
    />
  )
}
