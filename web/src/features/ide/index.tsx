import { useTranslation } from 'react-i18next'

import { StudioWorkbench } from '@/features/studio/workbench'

export function IdeWorkbench() {
  const { t } = useTranslation()
  return (
    <StudioWorkbench
      kind='ide'
      title={t('IDE')}
      hint={t('Name a project and describe the change.')}
      action={t('Save')}
      fields={[
        { name: 'title', label: t('Project'), placeholder: t('Project') },
        {
          name: 'prompt',
          label: t('Prompt'),
          placeholder: t('Prompt'),
          multiline: true,
        },
      ]}
    />
  )
}
