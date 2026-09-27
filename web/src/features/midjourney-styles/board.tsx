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
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { ImagePlus, Images, Link2 } from 'lucide-react'
import { useEffect, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { cn } from '@/lib/utils'

import {
  createProfile,
  listMjTasks,
  loadAccount,
  readFileAsDataUrl,
  readMjError,
  uploadMjImages,
} from '@/features/midjourney-discord/api'
import {
  activeMoodboardId,
  getMoodboard,
  listMoodboards,
  moodboardParam,
  saveMoodboards,
  setActiveMoodboard,
  type Moodboard,
} from '@/features/midjourney-discord/moodboards'

export function StyleBoard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { boardId } = useParams({ from: '/_authenticated/apps/midjourney/styles/$boardId' })
  const [board, setBoard] = useState<Moodboard | null>(() => getMoodboard(boardId))
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [activeId] = useState(() => activeMoodboardId())
  const { copyToClipboard } = useCopyToClipboard({ notify: false })
  const param = board?.profileId ? moodboardParam(board.profileId) : ''

  useEffect(() => {
    setBoard(getMoodboard(boardId))
  }, [boardId])

  const commit = (next: Moodboard) => {
    const boards = listMoodboards().map((item) => (item.id === next.id ? next : item))
    saveMoodboards(boards)
    setBoard(next)
  }

  const addImages = (urls: string[]) => {
    if (!board) return
    const merged = [...board.images]
    for (const url of urls) {
      const value = url.trim()
      if (!value || merged.includes(value)) continue
      merged.push(value)
    }
    commit({ ...board, images: merged.slice(0, 40) })
  }

  const uploadFiles = async (incoming: File[]) => {
    const files = incoming.filter((file) => file.type.startsWith('image/')).slice(0, 8)
    if (!board) return
    if (files.length === 0) {
      setError(t('Only image files can be added'))
      return
    }
    setBusy(t('Upload images'))
    setError('')
    try {
      const account = await loadAccount()
      const dataUrls = (await Promise.all(files.map((file) => readFileAsDataUrl(file)))).filter(
        (url) => url.startsWith('data:image/')
      )
      if (dataUrls.length === 0) {
        setError(t('Only image files can be added'))
        return
      }
      const urls = await uploadMjImages(dataUrls, account.group)
      addImages(urls)
    } catch (cause) {
      setError(readMjError(cause))
    } finally {
      setBusy('')
    }
  }

  const addLink = () => {
    const value = link.trim()
    if (!/^https?:\/\//i.test(value)) {
      setError(t('Enter an http or https image URL'))
      return
    }
    setError('')
    addImages([value])
    setLink('')
  }

  const openPicker = async () => {
    setBusy(t('Add from your images'))
    setError('')
    try {
      const tasks = await listMjTasks()
      const urls: string[] = []
      for (const task of tasks) {
        if (task.imageUrls.length > 0) {
          urls.push(...task.imageUrls)
          continue
        }
        if (task.imageUrl) urls.push(task.imageUrl)
      }
      setPicked([...new Set(urls)])
      setPickerOpen(true)
    } catch (cause) {
      setError(readMjError(cause))
    } finally {
      setBusy('')
    }
  }

  const removeImage = (url: string) => {
    if (!board) return
    commit({ ...board, images: board.images.filter((item) => item !== url) })
  }

  const removeBoard = () => {
    const boards = listMoodboards().filter((item) => item.id !== boardId)
    saveMoodboards(boards)
    if (activeId === boardId) setActiveMoodboard('')
    void navigate({ to: '/apps/midjourney/styles' })
  }

  const issueCode = async () => {
    if (!board || busy) return
    setError('')
    let profileId = board.profileId?.trim() ?? ''
    if (!profileId) {
      setBusy(t('Get personalization code'))
      try {
        const account = await loadAccount()
        profileId = (await createProfile(board.title, account.group)).trim()
        if (!profileId) throw new Error(t('Request failed'))
        commit({ ...board, profileId })
      } catch (cause) {
        setError(readMjError(cause))
        setBusy('')
        return
      }
      setBusy('')
    }
    const next = moodboardParam(profileId)
    const copied = await copyToClipboard(next)
    if (copied) {
      toast.success(t('Copied {{param}}. Paste it into your prompt when drawing.', { param: next }))
    }
  }

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (![...event.dataTransfer.types].includes('Files')) return
    event.preventDefault()
    setDragging(true)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    void uploadFiles([...event.dataTransfer.files])
  }

  const images = board?.images ?? []

  if (!board) {
    return (
      <div className='bg-background text-foreground flex h-full min-h-0 flex-col items-center justify-center gap-3'>
        <p>{t('No moodboards yet')}</p>
        <Link to='/apps/midjourney/styles' className='text-sm underline'>
          {t('Back')}
        </Link>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'bg-background text-foreground h-full min-h-0 overflow-auto px-6 py-8',
        dragging && 'bg-muted/40'
      )}
      onDragOver={onDragOver}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setDragging(false)
      }}
      onDrop={onDrop}
    >
      <div className='mx-auto max-w-5xl'>
        <div className='flex items-center justify-between gap-3'>
          <Link to='/apps/midjourney/styles' className='text-muted-foreground text-sm hover:underline'>
            {t('Back')}
          </Link>
          <div className='flex gap-2'>
            <Button type='button' disabled={busy !== ''} onClick={() => void issueCode()}>
              {param ? t('Use this board') : t('Get personalization code')}
            </Button>
            <Button type='button' variant='outline' onClick={() => setConfirmOpen(true)}>
              {t('Delete moodboard')}
            </Button>
          </div>
        </div>
        <h1 className='mt-8 text-center text-4xl font-semibold tracking-tight'>{board.title}</h1>
        {param ? (
          <p className='mt-3 text-center font-mono text-sm'>{param}</p>
        ) : (
          <p className='text-muted-foreground mt-3 text-center text-sm'>
            {t('Get personalization code')}
          </p>
        )}
        <p className='text-muted-foreground mt-3 text-center text-sm'>{t('Drop images to add them')}</p>
        <div className='mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3'>
          <label
            className={cn(
              'bg-card hover:bg-muted/60 flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-6 text-center transition',
              dragging && 'border-primary bg-primary/5'
            )}
          >
            <ImagePlus className='text-muted-foreground size-5' />
            <span className='text-sm font-medium'>{t('Upload images')}</span>
            <span className='text-muted-foreground text-xs'>{t('From your computer')}</span>
            <input
              type='file'
              accept='image/*'
              multiple
              className='hidden'
              onChange={(event) => {
                const files = event.target.files ? [...event.target.files] : []
                event.target.value = ''
                void uploadFiles(files)
              }}
            />
          </label>
          <form
            className='bg-card flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-6 text-center'
            onSubmit={(event) => {
              event.preventDefault()
              addLink()
            }}
          >
            <Link2 className='text-muted-foreground size-5' />
            <span className='text-sm font-medium'>{t('Add from link')}</span>
            <Input
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder={t('Image URL')}
            />
            <Button type='submit' size='sm' variant='outline'>
              {t('Add')}
            </Button>
          </form>
          <button
            type='button'
            className='bg-card hover:bg-muted/60 flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-6 text-center transition'
            onClick={() => void openPicker()}
          >
            <Images className='text-muted-foreground size-5' />
            <span className='text-sm font-medium'>{t('Add from your images')}</span>
          </button>
        </div>
        {busy ? <p className='text-muted-foreground mt-4 text-center text-sm'>{busy}</p> : null}
        {error ? <p className='text-destructive mt-4 text-center text-sm whitespace-pre-wrap'>{error}</p> : null}
        {images.length === 0 ? (
          <p className='text-muted-foreground mt-16 text-center text-sm'>{t('Add images above to start')}</p>
        ) : (
          <div
            className={cn(
              'mt-10',
              images.length === 1
                ? 'mx-auto max-w-sm'
                : 'columns-2 gap-3 sm:columns-3 lg:columns-4'
            )}
          >
            {images.map((url) => (
              <div key={url} className='group relative mb-3 break-inside-avoid'>
                <img src={url} alt='' className='w-full rounded-xl shadow-sm' />
                <button
                  type='button'
                  className='absolute top-2 right-2 rounded-md bg-black/55 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100'
                  onClick={() => removeImage(url)}
                >
                  {t('Remove image')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {pickerOpen ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
          <div className='bg-background max-h-[80vh] w-full max-w-3xl overflow-auto rounded-2xl border p-6 shadow-xl'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-lg font-semibold'>{t('Add from your images')}</h2>
              <Button type='button' variant='outline' onClick={() => setPickerOpen(false)}>
                {t('Close')}
              </Button>
            </div>
            {picked.length === 0 ? (
              <p className='text-muted-foreground text-sm'>{t('No images yet')}</p>
            ) : (
              <div className='grid grid-cols-3 gap-3 sm:grid-cols-4'>
                {picked.map((url) => (
                  <button
                    key={url}
                    type='button'
                    className='overflow-hidden rounded-xl border'
                    onClick={() => {
                      addImages([url])
                      setPickerOpen(false)
                    }}
                  >
                    <img src={url} alt='' className='h-28 w-full object-cover' />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('Delete moodboard')}
        desc={t('This moodboard and its images will be removed from this browser.')}
        destructive
        confirmText={t('Delete')}
        handleConfirm={() => {
          setConfirmOpen(false)
          removeBoard()
        }}
      />
    </div>
  )
}
