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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useForm, type FieldErrors } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ImageStorageManager } from '@/features/image-storages/components/image-storage-manager'
import { getImageStorages } from '@/features/image-storages/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { updateSystemOption } from '../api'
import { useResetForm } from '../hooks/use-reset-form'
import { safeNumberFieldProps } from '../utils/numeric-field'

const objectStorageSchema = z.object({
  enabled: z.boolean(),
  image_rewrite_enabled: z.boolean(),
  gemini_native_rewrite_enabled: z.boolean(),
  strict_mode: z.boolean(),
  mj_media_persist_enabled: z.boolean(),
  user_storage_enabled: z.boolean(),
  default_storage_id: z.number().int().min(0),
  upload_timeout_seconds: z.number().int().min(1).max(300),
  max_object_bytes: z.number().int().min(1),
  presign_ttl_seconds: z.number().int().min(1),
  user_storage_max_count: z.number().int().min(1).max(50),
})

export type ObjectStorageFormValues = z.infer<typeof objectStorageSchema>

type ObjectStorageSettings = {
  'object_storage.enabled': boolean
  'object_storage.image_rewrite_enabled': boolean
  'object_storage.gemini_native_rewrite_enabled': boolean
  'object_storage.strict_mode': boolean
  'object_storage.mj_media_persist_enabled': boolean
  'object_storage.user_storage_enabled': boolean
  'object_storage.default_storage_id': number
  'object_storage.upload_timeout_seconds': number
  'object_storage.max_object_bytes': number
  'object_storage.presign_ttl_seconds': number
  'object_storage.user_storage_max_count': number
}

type ObjectStorageSectionProps = {
  defaultValues: ObjectStorageSettings
}

function toFormValues(settings: ObjectStorageSettings): ObjectStorageFormValues {
  return {
    enabled: settings['object_storage.enabled'],
    image_rewrite_enabled: settings['object_storage.image_rewrite_enabled'],
    gemini_native_rewrite_enabled:
      settings['object_storage.gemini_native_rewrite_enabled'],
    strict_mode: settings['object_storage.strict_mode'],
    mj_media_persist_enabled: settings['object_storage.mj_media_persist_enabled'],
    user_storage_enabled: settings['object_storage.user_storage_enabled'],
    default_storage_id: settings['object_storage.default_storage_id'],
    upload_timeout_seconds: settings['object_storage.upload_timeout_seconds'],
    max_object_bytes: settings['object_storage.max_object_bytes'],
    presign_ttl_seconds: settings['object_storage.presign_ttl_seconds'],
    user_storage_max_count: settings['object_storage.user_storage_max_count'],
  }
}

export function ObjectStorageSection(props: ObjectStorageSectionProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isSaving, setIsSaving] = useState(false)
  const formDefaults = useMemo(
    () => toFormValues(props.defaultValues),
    [props.defaultValues]
  )
  const form = useForm<ObjectStorageFormValues>({
    resolver: zodResolver(objectStorageSchema),
    defaultValues: formDefaults,
  })
  const storagesQuery = useQuery({
    queryKey: ['image-storages', 'system'],
    queryFn: async () => {
      const response = requireServerSuccess(await getImageStorages('system'))
      return response.data ?? []
    },
  })

  useResetForm(form, formDefaults)

  const defaultStorageId = form.watch('default_storage_id')
  const storageItems = useMemo(() => {
    const items = [
      { value: '0', label: t('None') },
      ...(storagesQuery.data ?? []).map((item) => ({
        value: String(item.id),
        label: item.name,
      })),
    ]
    const currentId = String(defaultStorageId || 0)
    if (currentId !== '0' && !items.some((item) => item.value === currentId)) {
      items.push({
        value: currentId,
        label: t('Storage #{{id}}', { id: currentId }),
      })
    }
    return items
  }, [defaultStorageId, storagesQuery.data, t])

  const onSubmit = async (values: ObjectStorageFormValues) => {
    setIsSaving(true)
    try {
      for (const [key, value] of Object.entries(values)) {
        requireServerSuccess(
          await updateSystemOption({ key: `object_storage.${key}`, value })
        )
      }
      await queryClient.invalidateQueries({ queryKey: ['system-options'] })
      toast.success(t('Setting updated successfully'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to update setting')
      )
    } finally {
      setIsSaving(false)
    }
  }

  const onInvalid = (errors: FieldErrors<ObjectStorageFormValues>) => {
    const message = Object.values(errors)
      .map((error) =>
        error && typeof error.message === 'string' ? error.message : ''
      )
      .find((text) => text !== '')
    toast.error(message || t('Failed to update setting'))
  }

  const switches: Array<{
    name: Extract<
      keyof ObjectStorageFormValues,
      | 'enabled'
      | 'image_rewrite_enabled'
      | 'gemini_native_rewrite_enabled'
      | 'strict_mode'
      | 'mj_media_persist_enabled'
      | 'user_storage_enabled'
    >
    label: string
    description: string
  }> = [
    {
      name: 'enabled',
      label: t('Enable object storage'),
      description: t(
        'Master switch. Image rewrite and cdn_key uploads are ignored while this is off.'
      ),
    },
    {
      name: 'image_rewrite_enabled',
      label: t('Rewrite image base64 to object URLs'),
      description: t(
        'When no cdn_key is provided, upload generated images to the default system bucket.'
      ),
    },
    {
      name: 'gemini_native_rewrite_enabled',
      label: t('Rewrite Gemini native inline images'),
      description: t(
        'Replace Gemini inlineData with a file URI after usage is counted.'
      ),
    },
    {
      name: 'strict_mode',
      label: t('Fail the request when default storage upload fails'),
      description: t(
        'Only applies to the system default bucket. cdn_key requests always fall back to base64.'
      ),
    },
    {
      name: 'mj_media_persist_enabled',
      label: t('Persist Midjourney media'),
      description: t(
        'When a Midjourney task succeeds, download images and videos into the default system bucket.'
      ),
    },
    {
      name: 'user_storage_enabled',
      label: t('Allow user-owned buckets'),
      description: t(
        'Users can create personal S3 credentials and pass cdn_key on image requests.'
      ),
    },
  ]

  return (
    <div className='flex flex-col gap-8'>
      <SettingsSection title={t('Object Storage')}>
        <Form {...form}>
          <SettingsForm onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
            <SettingsPageFormActions
              onSave={form.handleSubmit(onSubmit, onInvalid)}
              isSaving={isSaving}
              saveLabel='Save object storage settings'
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
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </SettingsSwitchItem>
                  )}
                />
              ))}
            </div>
            <FormField
              control={form.control}
              name='default_storage_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Default system bucket')}</FormLabel>
                  <Select
                    items={storageItems}
                    value={String(field.value || 0)}
                    onValueChange={(value) => {
                      if (typeof value !== 'string') return
                      const id = Number(value)
                      if (Number.isInteger(id) && id >= 0) field.onChange(id)
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('Select a bucket')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {storageItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t(
                      'Used when image rewrite is on and the request does not include cdn_key.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className='grid gap-4 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='upload_timeout_seconds'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Upload timeout (seconds)')}</FormLabel>
                    <FormControl>
                      <Input type='number' min={1} {...safeNumberFieldProps(field)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='presign_ttl_seconds'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Presign TTL (seconds)')}</FormLabel>
                    <FormControl>
                      <Input type='number' min={1} {...safeNumberFieldProps(field)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='max_object_bytes'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Max object size (bytes)')}</FormLabel>
                    <FormControl>
                      <Input type='number' min={1} {...safeNumberFieldProps(field)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='user_storage_max_count'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Max buckets per user')}</FormLabel>
                    <FormControl>
                      <Input type='number' min={1} max={50} {...safeNumberFieldProps(field)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </SettingsForm>
        </Form>
      </SettingsSection>
      <SettingsSection title={t('System buckets')}>
        <ImageStorageManager scope='system' />
      </SettingsSection>
    </div>
  )
}
