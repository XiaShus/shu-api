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
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { PasswordInput } from '@/components/password-input'
import { Button } from '@/components/ui/button'
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
  createImageStorageSchema,
  emptyImageStorageFormValues,
  imageStorageToFormValues,
} from '../lib/schema'
import type { ImageStorage, ImageStorageFormValues, ImageStorageScope } from '../types'

type ImageStorageFormDialogProps = {
  open: boolean
  scope: ImageStorageScope
  item: ImageStorage | null
  isSaving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: ImageStorageFormValues) => Promise<void>
}

export function ImageStorageFormDialog(props: ImageStorageFormDialogProps) {
  const { t } = useTranslation()
  const mode = props.item ? 'edit' : 'create'
  const schema = useMemo(
    () => createImageStorageSchema(props.scope, mode, (key) => t(key)),
    [mode, props.scope, t]
  )
  const form = useForm<ImageStorageFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyImageStorageFormValues(),
  })

  useEffect(() => {
    if (!props.open) return
    form.reset(
      props.item
        ? imageStorageToFormValues(props.item)
        : emptyImageStorageFormValues()
    )
  }, [form, props.item, props.open])

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={
        mode === 'create' ? t('Add object storage') : t('Edit object storage')
      }
      description={t(
        'S3-compatible credentials are stored on the server. The secret key is never shown again after saving.'
      )}
      contentClassName='sm:max-w-lg'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={props.isSaving}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='submit'
            form='image-storage-form'
            disabled={props.isSaving}
          >
            {props.isSaving ? t('Saving...') : t('Save')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id='image-storage-form'
          className='grid gap-4'
          onSubmit={form.handleSubmit(props.onSubmit)}
        >
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Name')}</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={64} autoComplete='off' />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='endpoint'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Endpoint')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    inputMode='url'
                    placeholder={
                      props.scope === 'user'
                        ? 'https://s3.example.com'
                        : 'https://s3.example.com'
                    }
                    autoComplete='off'
                  />
                </FormControl>
                <FormDescription>
                  {props.scope === 'user'
                    ? t('User-owned endpoints must use HTTPS.')
                    : t('S3-compatible API endpoint.')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='region'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Region')}</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete='off' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='bucket'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Bucket')}</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete='off' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name='access_key'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Access Key')}</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete='off' />
                </FormControl>
                {mode === 'edit' ? (
                  <FormDescription>
                    {t('Leave unchanged to keep the current access key.')}
                  </FormDescription>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='secret_key'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Secret Key')}</FormLabel>
                <FormControl>
                  <PasswordInput
                    {...field}
                    autoComplete='new-password'
                    placeholder={
                      mode === 'edit'
                        ? t('Leave blank to keep the current secret')
                        : undefined
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='prefix'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Object prefix')}</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete='off' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='public_base_url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Public base URL')}</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode='url' autoComplete='off' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name='path_style'
            render={({ field }) => (
              <FormItem className='flex items-center justify-between gap-3 rounded-lg border px-3 py-2'>
                <div className='space-y-0.5'>
                  <FormLabel>{t('Path-style addressing')}</FormLabel>
                  <FormDescription>
                    {t('Required for Qiniu Kodo and many S3-compatible stores.')}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <FormItem className='flex items-center justify-between gap-3 rounded-lg border px-3 py-2'>
                <div className='space-y-0.5'>
                  <FormLabel>{t('Enabled')}</FormLabel>
                  <FormDescription>
                    {t('Disabled stores are ignored when rewriting images.')}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </Dialog>
  )
}
