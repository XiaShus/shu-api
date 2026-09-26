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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Cloud } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { CopyButton } from '@/components/copy-button'
import { EmptyState } from '@/components/empty-state'
import { TruncatedText } from '@/components/truncated-text'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'

import {
  createImageStorage,
  deleteImageStorage,
  getImageStorages,
  resetImageStorageKey,
  testImageStorage,
  updateImageStorage,
} from '../api'
import { IMAGE_STORAGE_STATUS } from '../constants'
import { imageStorageFormToPayload } from '../lib/schema'
import type {
  ImageStorage,
  ImageStorageFormValues,
  ImageStorageScope,
} from '../types'
import { ImageStorageFormDialog } from './image-storage-form-dialog'

type ImageStorageManagerProps = {
  scope: ImageStorageScope
}

export function ImageStorageManager(props: ImageStorageManagerProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const queryKey = ['image-storages', props.scope] as const
  const [editing, setEditing] = useState<ImageStorage | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<ImageStorage | null>(null)
  const [resetting, setResetting] = useState<ImageStorage | null>(null)

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const response = requireServerSuccess(
        await getImageStorages(props.scope)
      )
      return response.data ?? []
    },
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['image-storages'] })

  const saveMutation = useMutation({
    mutationFn: async (values: ImageStorageFormValues) => {
      const payload = imageStorageFormToPayload(values, editing ?? undefined)
      if (editing) {
        return requireServerSuccess(
          await updateImageStorage(props.scope, editing.id, payload)
        )
      }
      return requireServerSuccess(
        await createImageStorage(props.scope, payload)
      )
    },
    onSuccess: () => {
      toast.success(
        editing
          ? t('Object storage updated')
          : t('Object storage created')
      )
      setFormOpen(false)
      setEditing(null)
      void invalidate()
    },
    onError: (error) => {
      handleServerError(error, t('Failed to save object storage'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (item: ImageStorage) =>
      requireServerSuccess(await deleteImageStorage(props.scope, item.id)),
    onSuccess: () => {
      toast.success(t('Object storage deleted'))
      setDeleting(null)
      void invalidate()
    },
    onError: (error) => {
      handleServerError(error, t('Failed to delete object storage'))
    },
  })

  const testMutation = useMutation({
    mutationFn: async (item: ImageStorage) =>
      requireServerSuccess(await testImageStorage(props.scope, item.id)),
    onSuccess: () => {
      toast.success(t('Object storage test succeeded'))
      void invalidate()
    },
    onError: (error) => {
      handleServerError(error, t('Object storage test failed'))
      void invalidate()
    },
  })

  const resetMutation = useMutation({
    mutationFn: async (item: ImageStorage) =>
      requireServerSuccess(await resetImageStorageKey(props.scope, item.id)),
    onSuccess: () => {
      toast.success(t('CDN key rotated'))
      setResetting(null)
      void invalidate()
    },
    onError: (error) => {
      handleServerError(error, t('Failed to rotate CDN key'))
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async (item: ImageStorage) => {
      const enabled = item.status === IMAGE_STORAGE_STATUS.DISABLED
      return requireServerSuccess(
        await updateImageStorage(props.scope, item.id, {
          name: item.name,
          provider: item.provider || 's3',
          endpoint: item.endpoint,
          region: item.region,
          bucket: item.bucket,
          access_key: '',
          secret_key: '',
          prefix: item.prefix,
          public_base_url: item.public_base_url,
          path_style: item.path_style,
          status: enabled
            ? IMAGE_STORAGE_STATUS.ENABLED
            : IMAGE_STORAGE_STATUS.DISABLED,
        })
      )
    },
    onSuccess: () => {
      void invalidate()
    },
    onError: (error) => {
      handleServerError(error, t('Failed to save object storage'))
    },
  })

  const items = listQuery.data ?? []

  if (listQuery.isLoading) {
    return <LoadingState message={t('Loading object storage...')} />
  }

  if (listQuery.isError) {
    return (
      <ErrorState
        title={t('Failed to load object storage')}
        onRetry={() => {
          void listQuery.refetch()
        }}
      />
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex justify-end'>
        <Button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          {t('Add object storage')}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Cloud}
          title={t('No object storage yet')}
          description={t(
            'Add an S3-compatible bucket, then pass its cdn_key on image requests.'
          )}
        />
      ) : (
        <div className='grid gap-3'>
          {items.map((item) => {
            const enabled = item.status !== IMAGE_STORAGE_STATUS.DISABLED
            return (
              <Card key={item.id} size='sm'>
                <CardHeader className='flex flex-row items-start justify-between gap-3 space-y-0'>
                  <div className='min-w-0 space-y-1'>
                    <CardTitle className='truncate text-base'>
                      {item.name}
                    </CardTitle>
                    <CardDescription className='truncate'>
                      {item.bucket}
                      {item.endpoint ? ` · ${item.endpoint}` : ''}
                    </CardDescription>
                  </div>
                  <div className='flex shrink-0 items-center gap-2'>
                    <Badge variant={enabled ? 'secondary' : 'outline'}>
                      {enabled ? t('Enabled') : t('Disabled')}
                    </Badge>
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => toggleMutation.mutate(item)}
                      disabled={toggleMutation.isPending}
                      aria-label={t('Enabled')}
                    />
                  </div>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='flex min-w-0 items-center gap-2'>
                    <code className='bg-muted truncate rounded-md px-2 py-1 font-mono text-xs'>
                      {item.cdn_key}
                    </code>
                    <CopyButton value={item.cdn_key} aria-label={t('Copy CDN key')} />
                  </div>
                  {item.last_error ? (
                    <TruncatedText
                      text={item.last_error}
                      className='text-destructive text-xs'
                      maxWidth='max-w-full'
                    />
                  ) : null}
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      onClick={() => {
                        setEditing(item)
                        setFormOpen(true)
                      }}
                    >
                      {t('Edit')}
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      onClick={() => testMutation.mutate(item)}
                      disabled={testMutation.isPending}
                    >
                      {t('Test connection')}
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      onClick={() => setResetting(item)}
                    >
                      {t('Rotate CDN key')}
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='destructive'
                      onClick={() => setDeleting(item)}
                    >
                      {t('Delete')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <ImageStorageFormDialog
        open={formOpen}
        scope={props.scope}
        item={editing}
        isSaving={saveMutation.isPending}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditing(null)
        }}
        onSubmit={async (values) => {
          await saveMutation.mutateAsync(values)
        }}
      />

      <ConfirmDialog
        open={deleting != null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={t('Delete object storage?')}
        desc={t(
          'Requests using this cdn_key will stop uploading to the bucket. This cannot be undone.'
        )}
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting)
        }}
      />

      <ConfirmDialog
        open={resetting != null}
        onOpenChange={(open) => {
          if (!open) setResetting(null)
        }}
        title={t('Rotate CDN key?')}
        desc={t(
          'The current cdn_key will stop working immediately. Copy the new key after rotation.'
        )}
        isLoading={resetMutation.isPending}
        handleConfirm={() => {
          if (resetting) resetMutation.mutate(resetting)
        }}
      />
    </div>
  )
}
