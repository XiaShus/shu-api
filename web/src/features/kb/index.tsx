import { useTranslation } from 'react-i18next'

import { StudioWorkbench } from '@/features/studio/workbench'

export function KnowledgeWorkbench() {
  const { t } = useTranslation()
  return (
    <StudioWorkbench
      kind='kb'
      title={t('Knowledge base')}
      hint={t('Name a library and paste the source text.')}
      action={t('Save')}
      fields={[
        { name: 'title', label: t('Knowledge base'), placeholder: t('Knowledge base') },
        {
          name: 'source',
          label: t('Source text'),
          placeholder: t('Source text'),
          multiline: true,
        },
      ]}
    />
  )
}
