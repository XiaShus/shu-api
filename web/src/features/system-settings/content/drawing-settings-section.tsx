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
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { JsonCodeEditor } from '@/components/json-code-editor'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'

const DEFAULT_MJ_MODE_RATIO = {
  fast: 1,
  relax: 1,
  turbo: 2,
  draft: 0.5,
}

const drawingSchema = z.object({
  DrawingEnabled: z.boolean(),
  MjNotifyEnabled: z.boolean(),
  MjAccountFilterEnabled: z.boolean(),
  MjForwardUrlEnabled: z.boolean(),
  MjModeClearEnabled: z.boolean(),
  MjActionCheckSuccessEnabled: z.boolean(),
  MjModePathPrefixEnabled: z.boolean(),
  fast: z.number().positive(),
  relax: z.number().positive(),
  turbo: z.number().positive(),
  draft: z.number().positive(),
  MjGroupModePolicy: z.string().superRefine((value, ctx) => {
    try {
      const parsed: unknown = JSON.parse(value)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Group mode policy must be a JSON object',
        })
      }
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'Group mode policy must be valid JSON',
      })
    }
  }),
})

type DrawingFormValues = z.infer<typeof drawingSchema>

type DrawingSettingsSectionProps = {
  defaultValues: {
    DrawingEnabled: boolean
    MjNotifyEnabled: boolean
    MjAccountFilterEnabled: boolean
    MjForwardUrlEnabled: boolean
    MjModeClearEnabled: boolean
    MjActionCheckSuccessEnabled: boolean
    MjModePathPrefixEnabled: boolean
    MjModeRatio: string
    MjGroupModePolicy: string
  }
}

function parseMjModeRatio(raw: string): typeof DEFAULT_MJ_MODE_RATIO {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const next = { ...DEFAULT_MJ_MODE_RATIO }
    for (const key of Object.keys(DEFAULT_MJ_MODE_RATIO) as Array<
      keyof typeof DEFAULT_MJ_MODE_RATIO
    >) {
      const value = parsed[key]
      if (typeof value === 'number' && value > 0) {
        next[key] = value
      }
    }
    return next
  } catch {
    return { ...DEFAULT_MJ_MODE_RATIO }
  }
}

function toDrawingFormValues(
  values: DrawingSettingsSectionProps['defaultValues']
): DrawingFormValues {
  const ratio = parseMjModeRatio(values.MjModeRatio)
  return {
    DrawingEnabled: values.DrawingEnabled,
    MjNotifyEnabled: values.MjNotifyEnabled,
    MjAccountFilterEnabled: values.MjAccountFilterEnabled,
    MjForwardUrlEnabled: values.MjForwardUrlEnabled,
    MjModeClearEnabled: values.MjModeClearEnabled,
    MjActionCheckSuccessEnabled: values.MjActionCheckSuccessEnabled,
    MjModePathPrefixEnabled: values.MjModePathPrefixEnabled,
    fast: ratio.fast,
    relax: ratio.relax,
    turbo: ratio.turbo,
    draft: ratio.draft,
    MjGroupModePolicy: values.MjGroupModePolicy || '{}',
  }
}

export function DrawingSettingsSection({
  defaultValues,
}: DrawingSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const form = useForm<DrawingFormValues>({
    resolver: zodResolver(drawingSchema),
    defaultValues: toDrawingFormValues(defaultValues),
  })

  useEffect(() => {
    form.reset(toDrawingFormValues(defaultValues))
  }, [defaultValues, form])

  const onSubmit = async (values: DrawingFormValues) => {
    const current = toDrawingFormValues(defaultValues)
    const ratioJson = JSON.stringify({
      fast: values.fast,
      relax: values.relax,
      turbo: values.turbo,
      draft: values.draft,
    })
    const currentRatioJson = JSON.stringify({
      fast: current.fast,
      relax: current.relax,
      turbo: current.turbo,
      draft: current.draft,
    })

    const flagKeys: Array<
      Exclude<keyof DrawingFormValues, 'fast' | 'relax' | 'turbo' | 'draft'>
    > = [
      'DrawingEnabled',
      'MjNotifyEnabled',
      'MjAccountFilterEnabled',
      'MjForwardUrlEnabled',
      'MjModeClearEnabled',
      'MjActionCheckSuccessEnabled',
      'MjModePathPrefixEnabled',
      'MjGroupModePolicy',
    ]

    for (const key of flagKeys) {
      if (values[key] !== current[key]) {
        await updateOption.mutateAsync({ key, value: values[key] })
      }
    }
    if (ratioJson !== currentRatioJson) {
      await updateOption.mutateAsync({ key: 'MjModeRatio', value: ratioJson })
    }
  }

  const switches: Array<{
    name: Extract<
      keyof DrawingFormValues,
      | 'DrawingEnabled'
      | 'MjNotifyEnabled'
      | 'MjAccountFilterEnabled'
      | 'MjForwardUrlEnabled'
      | 'MjModeClearEnabled'
      | 'MjActionCheckSuccessEnabled'
      | 'MjModePathPrefixEnabled'
    >
    label: string
    description: string
  }> = [
    {
      name: 'DrawingEnabled',
      label: t('Enable drawing features'),
      description: t(
        'Required to expose MjProxy-style image generation to end users.'
      ),
    },
    {
      name: 'MjNotifyEnabled',
      label: t('Allow upstream callbacks'),
      description: t(
        'When enabled, MjProxy callbacks are accepted (reveals server IP).'
      ),
    },
    {
      name: 'MjAccountFilterEnabled',
      label: t('Allow accountFilter parameter'),
      description: t(
        'Keep enabled if you need to proxy requests for different upstream accounts.'
      ),
    },
    {
      name: 'MjForwardUrlEnabled',
      label: t('Rewrite callback URLs to the local server'),
      description: t(
        'Automatically replaces upstream callback URLs with the server address.'
      ),
    },
    {
      name: 'MjModeClearEnabled',
      label: t('Clear mode flags in prompts'),
      description: t(
        'Removes MjProxy flags such as --fast, --relax, and --turbo from user prompts. Do not combine this with path-prefix mode rewriting on the same request.'
      ),
    },
    {
      name: 'MjActionCheckSuccessEnabled',
      label: t('Require job success before follow-up actions'),
      description: t(
        'Users must wait for a successful drawing before upscales or variations.'
      ),
    },
    {
      name: 'MjModePathPrefixEnabled',
      label: t('Send mode as /mj-{mode} path prefix'),
      description: t(
        'Rewrite upstream paths to /mj-fast, /mj-relax, or /mj-turbo. Draft still uses the --draft prompt flag.'
      ),
    },
  ]

  const ratioFields: Array<{
    name: 'fast' | 'relax' | 'turbo' | 'draft'
    label: string
  }> = [
    { name: 'fast', label: t('Fast mode ratio') },
    { name: 'relax', label: t('Relax mode ratio') },
    { name: 'turbo', label: t('Turbo mode ratio') },
    { name: 'draft', label: t('Draft mode ratio') },
  ]

  return (
    <SettingsSection title={t('Drawing')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save drawing settings'
          />
          <div className='space-y-4'>
            {switches.map((item) => (
              <FormField
                key={item.name}
                control={form.control}
                name={item.name}
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{item.label}</FormLabel>
                      <FormDescription>{item.description}</FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={Boolean(field.value)}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </SettingsSwitchItem>
                )}
              />
            ))}
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            {ratioFields.map((item) => (
              <FormField
                key={item.name}
                control={form.control}
                name={item.name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{item.label}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0.01}
                        step='0.01'
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Applied when a mode-specific model price is not configured.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
          <FormField
            control={form.control}
            name='MjGroupModePolicy'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Group mode policy')}</FormLabel>
                <FormControl>
                  <JsonCodeEditor
                    value={field.value}
                    onChange={field.onChange}
                    name={field.name}
                    onBlur={field.onBlur}
                    textareaRef={field.ref}
                    placeholder='{"default":{"allowed":["fast","relax","turbo","draft"],"default":"fast"}}'
                    heightClassName='h-48 min-h-48 max-h-72'
                    aria-invalid={Boolean(
                      form.formState.errors.MjGroupModePolicy
                    )}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Map billing groups to allowed Midjourney modes. Groups not listed allow every mode.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
