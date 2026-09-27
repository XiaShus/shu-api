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
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  Coffee,
  Download,
  FileSearch,
  Gauge,
  Image as ImageIcon,
  Images,
  Info,
  Pencil,
  Settings,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  fetchMjTask,
  listMjTasks,
  loadAccount,
  rateProfile,
  readFileAsDataUrl,
  readMjError,
  skipProfile,
  submitMj,
  uploadMjImages,
  createProfile,
  fetchProfile,
  fetchProfilePair,
} from './api'
import {
  SLASH_COMMANDS,
  accountModes,
  applyPromptSettings,
  opensCommandPanel,
  parseSlash,
  type SlashCommandName,
} from './commands'
import type {
  DrawChannel,
  DrawSettings,
  LocalNote,
  MjMode,
  MjTask,
} from './types'

const SETTINGS_KEY = 'mj-discord-settings'
const CHANNELS_KEY = 'mj-discord-channels'
const MODE_KEY = 'mj-discord-mode'
const GROUP_KEY = 'mj-discord-group'

const DEFAULT_SETTINGS: DrawSettings = {
  bot: 'MID_JOURNEY',
  version: '',
  aspect: '',
  stylize: '',
  remix: false,
  profileId: '',
}

const DEFAULT_CHANNELS: DrawChannel[] = [
  { id: '123', name: '123' },
  { id: 'new', name: 'Newcomers' },
  { id: 'general', name: 'General channel' },
]

const COMMAND_ICONS: Record<SlashCommandName, typeof ImageIcon> = {
  imagine: ImageIcon,
  blend: Images,
  describe: FileSearch,
  fast: Zap,
  relax: Coffee,
  turbo: Gauge,
  draft: Pencil,
  settings: Settings,
  info: Info,
  personalize: Sparkles,
}

type CommandPanel =
  | { kind: 'imagine'; prompt: string }
  | { kind: 'blend'; ratio: 'portrait' | 'square' | 'landscape'; files: File[] }
  | { kind: 'describe'; file: File | null; link: string }
  | {
      kind: 'personalize'
      title: string
      profileId: string
      leftUrl: string
      rightUrl: string
      leftJobId: string
      rightJobId: string
      status: string
    }

type StoredSettings = Partial<DrawSettings> & { quality?: string }

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function loadSettings(): DrawSettings {
  const raw = readJson<StoredSettings>(SETTINGS_KEY, DEFAULT_SETTINGS)
  let version = raw.version ?? ''
  let aspect = raw.aspect ?? ''
  let stylize = raw.stylize ?? ''
  if (version === '--v 6.1') version = ''
  if (aspect === '1:1' && raw.quality === '1' && stylize === '100') {
    aspect = ''
    stylize = ''
  }
  return {
    bot: raw.bot === 'NIJI_JOURNEY' ? 'NIJI_JOURNEY' : 'MID_JOURNEY',
    version,
    aspect,
    stylize,
    remix: Boolean(raw.remix),
    profileId: typeof raw.profileId === 'string' ? raw.profileId : '',
  }
}

function loadMode(): MjMode {
  const raw = readJson<StoredSettings>(SETTINGS_KEY, {})
  const mode = readJson<string>(MODE_KEY, '')
  if (raw.version === '--v 6.1' && mode === 'fast') return ''
  if (mode === 'fast' || mode === 'relax' || mode === 'turbo' || mode === 'draft') {
    return mode
  }
  return ''
}

function isPending(status: string): boolean {
  return ['NOT_START', 'SUBMITTED', 'IN_PROGRESS', 'MODAL', ''].includes(status)
}

function isDesktopSend(): boolean {
  return window.matchMedia('(min-width: 768px)').matches
}

export function MidjourneyDiscord() {
  const { t } = useTranslation()
  const [channels, setChannels] = useState<DrawChannel[]>(() =>
    readJson(CHANNELS_KEY, DEFAULT_CHANNELS)
  )
  const [channelId, setChannelId] = useState(channels[0]?.id ?? '123')
  const [channelsOpen, setChannelsOpen] = useState(false)
  const [settings, setSettings] = useState<DrawSettings>(loadSettings)
  const [mode, setMode] = useState<MjMode>(loadMode)
  const [group, setGroup] = useState('')
  const [groups, setGroups] = useState<string[]>([])
  const [accountName, setAccountName] = useState('')
  const [quota, setQuota] = useState(0)
  const [tasks, setTasks] = useState<MjTask[]>([])
  const [notes, setNotes] = useState<LocalNote[]>([])
  const [submitting, setSubmitting] = useState<LocalNote[]>([])
  const [draft, setDraft] = useState('')
  const [menuIndex, setMenuIndex] = useState(0)
  const [panel, setPanel] = useState<CommandPanel | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [addingChannel, setAddingChannel] = useState(false)
  const [channelName, setChannelName] = useState('')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [modalTask, setModalTask] = useState<MjTask | null>(null)
  const [modalPrompt, setModalPrompt] = useState('')
  const [zoomUrl, setZoomUrl] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])
  useEffect(() => {
    localStorage.setItem(CHANNELS_KEY, JSON.stringify(channels))
  }, [channels])
  useEffect(() => {
    localStorage.setItem(MODE_KEY, JSON.stringify(mode))
  }, [mode])
  useEffect(() => {
    if (group) localStorage.setItem(GROUP_KEY, group)
  }, [group])

  useEffect(() => {
    let cancelled = false
    loadAccount()
      .then((account) => {
        if (cancelled) return
        setAccountName(account.name)
        setQuota(account.quota)
        setGroups(account.groups)
        const saved = localStorage.getItem(GROUP_KEY)
        setGroup(saved && account.groups.includes(saved) ? saved : account.group)
      })
      .catch(() => {})
    listMjTasks()
      .then((items) => {
        if (!cancelled) setTasks(items)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const pendingIds = tasks
    .filter((task) => isPending(task.status))
    .map((task) => task.id)
    .join(',')

  useEffect(() => {
    if (!pendingIds) return
    const timer = window.setInterval(() => {
      const ids = pendingIds.split(',').filter(Boolean)
      Promise.all(ids.map((id) => fetchMjTask(id).catch(() => null))).then((updates) => {
        setTasks((current) => {
          const next = [...current]
          for (const update of updates) {
            if (!update) continue
            const index = next.findIndex((task) => task.id === update.id)
            if (index === -1) next.push(update)
            else next[index] = { ...next[index], ...update, state: next[index].state || update.state }
            if (update.status === 'MODAL') {
              setModalTask(update)
              setModalPrompt(update.prompt)
            }
          }
          return next
        })
      })
    }, 2000)
    return () => window.clearInterval(timer)
  }, [pendingIds])

  useEffect(() => {
    if (!settingsOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settingsOpen])

  useEffect(() => {
    if (!zoomUrl) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoomUrl('')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomUrl])

  const channel = channels.find((item) => item.id === channelId) ?? channels[0]
  const channelTasks = tasks
    .filter(
      (task) => task.state === channel?.id || (task.state === '' && channel?.id === '123')
    )
    .sort((a, b) => a.submitTime - b.submitTime)
  const channelNotes = notes.filter((note) => note.channelId === channel?.id)
  const channelSubmitting = submitting.filter((note) => note.channelId === channel?.id)
  const query = search.trim().toLowerCase()
  const visibleTasks = query
    ? channelTasks.filter((task) => task.prompt.toLowerCase().includes(query))
    : channelTasks
  const visibleNotes = query
    ? channelNotes.filter((note) => note.text.toLowerCase().includes(query))
    : channelNotes

  const slash = panel ? null : parseSlash(draft)
  const commandMatches =
    slash && slash.rest === ''
      ? SLASH_COMMANDS.filter((command) =>
          command.name.startsWith(slash.name.toLowerCase())
        )
      : []
  const menuOpen = commandMatches.length > 0

  useEffect(() => {
    setMenuIndex(0)
  }, [draft])

  const note = (role: 'user' | 'bot' | 'error', text: string) => {
    setNotes((current) => [
      ...current,
      {
        id: `${Date.now()}-${current.length}`,
        channelId: channel?.id ?? '123',
        role,
        text,
        createdAt: Date.now(),
      },
    ])
  }

  const rememberTask = (taskId: string, prompt: string) => {
    const placeholder: MjTask = {
      id: taskId,
      action: 'IMAGINE',
      prompt,
      status: 'SUBMITTED',
      progress: '',
      imageUrl: '',
      videoUrl: '',
      failReason: '',
      buttons: [],
      imageUrls: [],
      state: channel?.id ?? '123',
      submitTime: Date.now(),
      mode,
    }
    setTasks((current) => [placeholder, ...current.filter((task) => task.id !== taskId)])
    fetchMjTask(taskId)
      .then((task) => {
        if (!task) return
        setTasks((current) =>
          current.map((item) =>
            item.id === taskId ? { ...placeholder, ...task, state: placeholder.state } : item
          )
        )
      })
      .catch(() => {})
  }

  const beginSubmitting = () => {
    const item: LocalNote = {
      id: `submitting-${Date.now()}`,
      channelId: channel?.id ?? '123',
      role: 'bot',
      text: '',
      createdAt: Date.now(),
    }
    setSubmitting((current) => [...current, item])
    return item.id
  }

  const finishSubmitting = (id: string) => {
    setSubmitting((current) => current.filter((item) => item.id !== id))
  }

  const runImagine = async (prompt: string, images: string[]) => {
    const ticket = beginSubmitting()
    try {
      let finalPrompt = applyPromptSettings(
        prompt,
        settings.version,
        settings.aspect,
        settings.stylize,
        settings.profileId
      )
      if (mode === 'draft' && !/(?:^|\s)--draft(?:\s|$)/i.test(finalPrompt)) {
        finalPrompt = `${finalPrompt} --draft`.trim()
      }
      if (images.length > 0) {
        const urls = await uploadMjImages(images, group)
        if (urls.length > 0) finalPrompt = `${urls.join(' ')} ${finalPrompt}`.trim()
      }
      const modes = accountModes(mode)
      const created = await submitMj(
        '/submit/imagine',
        {
          prompt: finalPrompt,
          botType: settings.bot,
          state: channel?.id,
          accountFilter: modes ? { modes } : undefined,
        },
        group
      )
      finishSubmitting(ticket)
      rememberTask(created.result, finalPrompt)
    } catch (error) {
      finishSubmitting(ticket)
      throw error
    }
  }

  const applyMode = (next: MjMode) => {
    setMode(next)
    note('bot', t('Mode switched to {{mode}}', { mode: next }))
  }

  const showInfo = () => {
    note(
      'bot',
      t('Remaining quota {{quota}} in group {{group}}', {
        quota: formatQuota(quota),
        group: group || '-',
      })
    )
  }

  const selectCommand = (name: SlashCommandName) => {
    setDraft('')
    setMenuIndex(0)
    if (name === 'imagine') {
      setPanel({ kind: 'imagine', prompt: '' })
      return
    }
    if (name === 'blend') {
      setPanel({ kind: 'blend', ratio: 'square', files: [] })
      return
    }
    if (name === 'describe') {
      setPanel({ kind: 'describe', file: null, link: '' })
      return
    }
    if (name === 'personalize') {
      setPanel({
        kind: 'personalize',
        title: '',
        profileId: settings.profileId,
        leftUrl: '',
        rightUrl: '',
        leftJobId: '',
        rightJobId: '',
        status: '',
      })
      return
    }
    if (name === 'fast' || name === 'relax' || name === 'turbo' || name === 'draft') {
      note('user', `/${name}`)
      applyMode(name)
      return
    }
    if (name === 'settings') {
      note('user', '/settings')
      setSettingsOpen(true)
      return
    }
    note('user', '/info')
    showInfo()
  }

  const onSend = async () => {
    if (panel) {
      await submitPanel()
      return
    }
    const text = draft.trim()
    if (!text || busy) return
    const parsed = parseSlash(text)
    if (!parsed) {
      note('bot', t('Start with a slash command, for example /imagine cat'))
      return
    }
    if (parsed.rest === '' && opensCommandPanel(parsed.name)) {
      selectCommand(parsed.name)
      return
    }
    setDraft('')
    setBusy(true)
    note('user', text)
    try {
      if (parsed.name === 'imagine') {
        if (!parsed.rest) throw new Error(t('Prompt is required'))
        const images = await Promise.all(files.map(readFileAsDataUrl))
        setFiles([])
        await runImagine(parsed.rest, images)
      } else if (
        parsed.name === 'fast' ||
        parsed.name === 'relax' ||
        parsed.name === 'turbo' ||
        parsed.name === 'draft'
      ) {
        applyMode(parsed.name)
      } else if (parsed.name === 'settings') {
        setSettingsOpen(true)
      } else if (parsed.name === 'info') {
        showInfo()
      } else {
        note('bot', t('Unknown command'))
      }
    } catch (error) {
      note('error', readMjError(error))
    } finally {
      setBusy(false)
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
    }
  }

  const submitPanel = async () => {
    if (!panel || busy) return
    setBusy(true)
    try {
      if (panel.kind === 'imagine') {
        if (!panel.prompt.trim()) throw new Error(t('Prompt is required'))
        note('user', `/imagine ${panel.prompt.trim()}`)
        await runImagine(panel.prompt.trim(), [])
      } else if (panel.kind === 'blend') {
        if (panel.files.length < 2) throw new Error(t('Blend needs two to five images'))
        note('user', '/blend')
        const ticket = beginSubmitting()
        try {
          const images = await Promise.all(panel.files.slice(0, 5).map(readFileAsDataUrl))
          const ratio =
            panel.ratio === 'portrait' ? '--ar 2:3' : panel.ratio === 'landscape' ? '--ar 3:2' : ''
          const created = await submitMj(
            '/submit/blend',
            {
              prompt: ratio,
              base64Array: images,
              botType: settings.bot,
              state: channel?.id,
            },
            group
          )
          finishSubmitting(ticket)
          rememberTask(created.result, ratio || '/blend')
        } catch (error) {
          finishSubmitting(ticket)
          throw error
        }
      } else if (panel.kind === 'describe') {
        if (!panel.file && !panel.link.trim()) throw new Error(t('Describe needs an image'))
        note('user', '/describe')
        const ticket = beginSubmitting()
        try {
          const images = panel.file ? [await readFileAsDataUrl(panel.file)] : undefined
          const created = await submitMj(
            '/submit/describe',
            {
              prompt: panel.link.trim(),
              base64Array: images,
              botType: settings.bot,
              state: channel?.id,
            },
            group
          )
          finishSubmitting(ticket)
          rememberTask(created.result, panel.link.trim() || '/describe')
        } catch (error) {
          finishSubmitting(ticket)
          throw error
        }
      }
      setPanel(null)
    } catch (error) {
      note('error', readMjError(error))
    } finally {
      setBusy(false)
    }
  }

  const onComposerKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (menuOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setMenuIndex((index) => (index + 1) % commandMatches.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setMenuIndex((index) => (index - 1 + commandMatches.length) % commandMatches.length)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setDraft('')
        return
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        const command = commandMatches[menuIndex]
        if (command) selectCommand(command.name)
        return
      }
    }
    if (event.key !== 'Enter') return
    const desktop = isDesktopSend()
    if (desktop && !event.shiftKey) {
      event.preventDefault()
      void onSend()
    }
    if (!desktop && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      void onSend()
    }
  }

  const onAction = async (task: MjTask, customId: string, label: string) => {
    if (settings.remix && /^V\d/i.test(label)) {
      setModalTask(task)
      setModalPrompt(task.prompt)
      return
    }
    setBusy(true)
    const ticket = beginSubmitting()
    try {
      const created = await submitMj(
        '/submit/action',
        { taskId: task.id, customId, state: channel?.id, botType: settings.bot },
        group
      )
      finishSubmitting(ticket)
      rememberTask(created.result, task.prompt)
    } catch (error) {
      finishSubmitting(ticket)
      note('error', readMjError(error))
    } finally {
      setBusy(false)
    }
  }

  const onSimpleChange = async (task: MjTask, content: string) => {
    setBusy(true)
    const ticket = beginSubmitting()
    try {
      const created = await submitMj(
        '/submit/simple-change',
        { taskId: task.id, content, state: channel?.id },
        group
      )
      finishSubmitting(ticket)
      rememberTask(created.result, task.prompt)
    } catch (error) {
      finishSubmitting(ticket)
      note('error', readMjError(error))
    } finally {
      setBusy(false)
    }
  }

  const onModal = async () => {
    if (!modalTask || !modalPrompt.trim()) return
    setBusy(true)
    try {
      const created = await submitMj(
        '/submit/modal',
        {
          taskId: modalTask.id,
          prompt: modalPrompt.trim(),
          state: channel?.id,
          botType: settings.bot,
        },
        group
      )
      setModalTask(null)
      rememberTask(created.result, modalPrompt.trim())
    } catch (error) {
      note('error', readMjError(error))
    } finally {
      setBusy(false)
    }
  }

  const collectPairImages = (data: Record<string, unknown>) => {
    const found: { url: string; jobId: string }[] = []
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) {
        node.forEach(walk)
        return
      }
      const record = node as Record<string, unknown>
      if (typeof record.imageUrl === 'string') {
        found.push({
          url: record.imageUrl,
          jobId: String(record.jobId ?? record.id ?? ''),
        })
      }
      for (const value of Object.values(record)) {
        if (value && typeof value === 'object') walk(value)
      }
    }
    walk(data.properties ?? data)
    return found.slice(0, 2)
  }

  const showProfilePair = async (profileId: string, title: string) => {
    const fetched = await fetchProfile(profileId, group)
    const status = String(fetched.status ?? '')
    if (/success|finish|done|complete/i.test(status)) {
      setSettings((current) => ({ ...current, profileId }))
      setPanel({
        kind: 'personalize',
        title,
        profileId,
        leftUrl: '',
        rightUrl: '',
        leftJobId: '',
        rightJobId: '',
        status,
      })
      return
    }
    const pair = await fetchProfilePair(profileId, group)
    const images = collectPairImages(pair)
    setPanel({
      kind: 'personalize',
      title,
      profileId,
      leftUrl: images[0]?.url ?? '',
      rightUrl: images[1]?.url ?? '',
      leftJobId: images[0]?.jobId ?? '',
      rightJobId: images[1]?.jobId ?? '',
      status,
    })
  }

  const onCreateProfile = async () => {
    if (!panel || panel.kind !== 'personalize' || busy) return
    if (!panel.title.trim()) return
    setBusy(true)
    try {
      const profileId = await createProfile(panel.title.trim(), group)
      await showProfilePair(profileId, panel.title.trim())
    } catch (error) {
      note('error', readMjError(error))
    } finally {
      setBusy(false)
    }
  }

  const onRateProfile = async (jobId: string) => {
    if (!panel || panel.kind !== 'personalize' || !panel.profileId || !jobId) return
    setBusy(true)
    try {
      await rateProfile(panel.profileId, jobId, group)
      await showProfilePair(panel.profileId, panel.title)
    } catch (error) {
      note('error', readMjError(error))
    } finally {
      setBusy(false)
    }
  }

  const onSkipProfile = async () => {
    if (!panel || panel.kind !== 'personalize' || !panel.profileId) return
    setBusy(true)
    try {
      await skipProfile(panel.profileId, group)
      await showProfilePair(panel.profileId, panel.title)
    } catch (error) {
      note('error', readMjError(error))
    } finally {
      setBusy(false)
    }
  }

  const timeline = useMemo(() => {
    const rows: Array<
      | { kind: 'note'; at: number; note: LocalNote }
      | { kind: 'task'; at: number; task: MjTask }
      | { kind: 'submitting'; at: number; note: LocalNote }
    > = [
      ...visibleNotes.map((item) => ({ kind: 'note' as const, at: item.createdAt, note: item })),
      ...visibleTasks.map((task) => ({
        kind: 'task' as const,
        at: task.submitTime || 0,
        task,
      })),
      ...channelSubmitting.map((item) => ({
        kind: 'submitting' as const,
        at: item.createdAt,
        note: item,
      })),
    ]
    rows.sort((a, b) => a.at - b.at)
    return rows
  }, [visibleNotes, visibleTasks, channelSubmitting])

  const channelLabel = (item: DrawChannel) =>
    item.name === 'Newcomers' || item.name === 'General channel' ? t(item.name) : item.name

  const pickChannel = (id: string) => {
    setChannelId(id)
    setChannelsOpen(false)
  }

  return (
    <div className='text-foreground flex h-full min-h-0 bg-white dark:bg-[#313338] dark:text-[#f2f3f5]'>
      {channelsOpen ? (
        <button
          type='button'
          className='fixed inset-0 z-30 bg-black/50 md:hidden'
          aria-label={t('Close')}
          onClick={() => setChannelsOpen(false)}
        />
      ) : null}
      <aside
        className={cn(
          'z-40 w-60 shrink-0 flex-col bg-[#f2f3f5] dark:bg-[#2b2d31]',
          channelsOpen ? 'fixed inset-y-0 left-0 flex' : 'hidden',
          'md:static md:flex'
        )}
      >
        <header className='flex h-12 items-center border-b border-[#e3e5e8] px-4 shadow-sm dark:border-black/20'>
          <span className='truncate font-semibold'>{t('Midjourney Discord')}</span>
        </header>
        <div className='flex items-center justify-between px-4 pt-4 text-xs font-semibold tracking-wide text-[#5c5e66] dark:text-[#949ba4]'>
          <span>{t('Text channels')}</span>
          <button
            type='button'
            className='min-h-11 min-w-11 text-base leading-none'
            onClick={() => setAddingChannel(true)}
            aria-label={t('Add channel')}
          >
            +
          </button>
        </div>
        <div className='mt-2 flex-1 overflow-y-auto px-2'>
          {addingChannel ? (
            <form
              className='mb-2'
              onSubmit={(event) => {
                event.preventDefault()
                const name = channelName.trim()
                if (!name) return
                const id = `${Date.now()}`
                setChannels((current) => [...current, { id, name }])
                pickChannel(id)
                setChannelName('')
                setAddingChannel(false)
              }}
            >
              <input
                value={channelName}
                onChange={(event) => setChannelName(event.target.value)}
                className='w-full rounded bg-[#e3e5e8] px-2 py-1 text-sm outline-none dark:bg-[#1e1f22]'
                placeholder={t('Channel name')}
                autoFocus
              />
            </form>
          ) : null}
          {channels.map((item) => (
            <button
              key={item.id}
              type='button'
              onClick={() => pickChannel(item.id)}
              className={cn(
                'mb-0.5 flex min-h-11 w-full items-center gap-1.5 rounded px-2 text-left text-sm',
                item.id === channel?.id
                  ? 'bg-[#e3e5e8] dark:bg-[#404249]'
                  : 'text-[#5c5e66] hover:bg-[#e3e5e8] hover:text-[#060607] dark:text-[#949ba4] dark:hover:bg-[#35373c] dark:hover:text-[#f2f3f5]'
              )}
            >
              <span className='text-[#5c5e66] dark:text-[#80848e]'>#</span>
              {channelLabel(item)}
            </button>
          ))}
        </div>
        <Link
          to='/apps/midjourney/styles'
          className='mx-2 mb-2 flex min-h-11 items-center rounded px-2 text-sm text-[#5c5e66] hover:bg-[#e3e5e8] dark:text-[#949ba4] dark:hover:bg-[#35373c]'
        >
          {t('Style library')}
        </Link>
        <footer className='flex items-center gap-2 bg-[#e3e5e8] px-2 py-2 dark:bg-[#232428]'>
          <div className='flex size-8 items-center justify-center rounded-full bg-[#5865f2] text-xs text-white'>
            {(accountName || '?').slice(0, 1).toUpperCase()}
          </div>
          <div className='min-w-0 flex-1'>
            <div className='truncate text-sm font-semibold'>{accountName || t('Online')}</div>
            <div className='text-xs text-[#23a559]'>{t('Online')}</div>
          </div>
          <button
            type='button'
            className='min-h-11 min-w-11 rounded text-[#5c5e66] hover:text-[#060607] dark:text-[#b5bac1] dark:hover:text-white'
            onClick={() => setSettingsOpen(true)}
            aria-label={t('Open drawing settings')}
          >
            <Settings className='mx-auto size-5' />
          </button>
        </footer>
      </aside>
      <section className='flex min-w-0 flex-1 flex-col'>
        <header className='flex h-12 items-center gap-2 border-b border-[#e3e5e8] px-3 shadow-sm dark:border-black/20 md:px-4'>
          <button
            type='button'
            className='min-h-11 min-w-11 rounded text-sm md:hidden'
            onClick={() => setChannelsOpen(true)}
          >
            {t('Channels')}
          </button>
          <span className='text-[#5c5e66] dark:text-[#80848e]'>#</span>
          <span className='truncate font-semibold'>{channel ? channelLabel(channel) : ''}</span>
          <div className='ml-auto flex items-center gap-2'>
            <select
              value={group}
              onChange={(event) => setGroup(event.target.value)}
              className='max-w-[28vw] rounded bg-[#e3e5e8] px-2 py-1 text-xs dark:bg-[#1e1f22] dark:text-[#dbdee1]'
              aria-label={t('Group')}
            >
              {groups.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            {mode ? (
              <span className='rounded bg-[#e3e5e8] px-2 py-1 text-xs uppercase dark:bg-[#1e1f22] dark:text-[#dbdee1]'>
                {mode}
              </span>
            ) : null}
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('Search')}
              className='w-[40vw] max-w-40 rounded bg-[#e3e5e8] px-3 py-1 text-sm outline-none placeholder:text-[#5c5e66] dark:bg-[#1e1f22] dark:placeholder:text-[#949ba4]'
            />
          </div>
        </header>
        <div ref={listRef} className='min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-4 md:py-6'>
          {timeline.length === 0 ? (
            <div className='flex h-full flex-col items-center justify-center px-4 text-center'>
              <h2 className='text-2xl font-bold'>{t('Welcome to')}</h2>
              <div className='mt-1 text-2xl font-bold'>{channel ? channelLabel(channel) : ''}</div>
              <p className='mt-3 max-w-xl text-sm text-[#5c5e66] dark:text-[#b5bac1]'>
                {t(
                  'This is your brand new server. Type /imagine and a prompt to start. U1-U4 upscale a tile and V1-V4 make a variation.'
                )}
              </p>
            </div>
          ) : (
            <div className='space-y-4'>
              {timeline.map((row) =>
                row.kind === 'note' ? (
                  <article key={row.note.id} className='flex gap-3'>
                    <Avatar name={row.note.role === 'user' ? accountName : 'MJ'} />
                    <div>
                      <div className='text-sm font-semibold'>
                        {row.note.role === 'user' ? accountName || t('You') : 'Midjourney Bot'}
                      </div>
                      <p
                        className={
                          row.note.role === 'error'
                            ? 'rounded bg-[#da373c]/15 p-3 text-sm whitespace-pre-wrap text-[#da373c] dark:text-[#f23f43]'
                            : 'text-sm whitespace-pre-wrap text-[#060607] dark:text-[#dbdee1]'
                        }
                      >
                        {row.note.text}
                      </p>
                    </div>
                  </article>
                ) : row.kind === 'submitting' ? (
                  <article key={row.note.id} className='flex gap-3'>
                    <Avatar name='MJ' />
                    <div>
                      <div className='text-sm font-semibold'>Midjourney Bot</div>
                      <p className='text-sm text-[#5c5e66] dark:text-[#949ba4]'>{t('Submitting')}</p>
                    </div>
                  </article>
                ) : (
                  <TaskRow
                    key={row.task.id}
                    task={row.task}
                    busy={busy}
                    onAction={onAction}
                    onSimpleChange={onSimpleChange}
                    onZoom={setZoomUrl}
                  />
                )
              )}
            </div>
          )}
        </div>
        <div className='sticky bottom-0 px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-4'>
          {menuOpen ? (
            <div className='mb-2 max-h-[40vh] overflow-auto rounded-lg bg-[#f2f3f5] shadow-lg dark:bg-[#2b2d31]'>
              <div className='px-3 pt-2 text-xs font-semibold text-[#5c5e66] dark:text-[#949ba4]'>
                {t('Commands')}
              </div>
              {commandMatches.map((command, index) => {
                const Icon = COMMAND_ICONS[command.name]
                return (
                  <button
                    key={command.name}
                    type='button'
                    className={cn(
                      'flex min-h-11 w-full items-center gap-3 px-3 text-left',
                      index === menuIndex
                        ? 'bg-[#e3e5e8] dark:bg-[#404249]'
                        : 'hover:bg-[#e3e5e8] dark:hover:bg-[#35373c]'
                    )}
                    onMouseEnter={() => setMenuIndex(index)}
                    onClick={() => selectCommand(command.name)}
                  >
                    <Icon className='size-4 shrink-0' aria-hidden='true' />
                    <span className='font-semibold'>/{command.name}</span>
                    <span className='truncate text-sm text-[#5c5e66] dark:text-[#949ba4]'>
                      {t(command.description)}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : null}
          {panel?.kind === 'personalize' ? (
            <PersonalizePanel
              panel={panel}
              busy={busy}
              onChange={setPanel}
              onClose={() => setPanel(null)}
              onCreate={() => void onCreateProfile()}
              onChoose={(jobId) => void onRateProfile(jobId)}
              onSkip={() => void onSkipProfile()}
            />
          ) : panel ? (
            <CommandPanelView
              panel={panel}
              busy={busy}
              onChange={setPanel}
              onClose={() => setPanel(null)}
              onSubmit={() => void submitPanel()}
            />
          ) : (
            <div className='flex items-end gap-2 rounded-lg bg-[#ebedef] px-3 py-2 dark:bg-[#383a40]'>
              <button
                type='button'
                className='mb-1 flex size-8 items-center justify-center rounded-full bg-[#5c5e66] text-lg leading-none text-white dark:bg-[#b5bac1] dark:text-[#383a40]'
                onClick={() => fileRef.current?.click()}
                aria-label={t('Attach images')}
              >
                +
              </button>
              <input
                ref={fileRef}
                type='file'
                accept='image/*'
                multiple
                className='hidden'
                onChange={(event) => {
                  setFiles([...(event.target.files ?? [])])
                  event.target.value = ''
                }}
              />
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onComposerKeyDown}
                rows={1}
                placeholder={t('Message #{{channel}}', {
                  channel: channel ? channelLabel(channel) : '',
                })}
                className='max-h-32 min-h-8 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-[#5c5e66] dark:placeholder:text-[#6d6f78]'
              />
            </div>
          )}
          {files.length > 0 && !panel ? (
            <div className='mt-2 flex flex-wrap gap-2'>
              {files.map((file) => (
                <span
                  key={file.name}
                  className='rounded bg-[#e3e5e8] px-2 py-1 text-xs dark:bg-[#2b2d31]'
                >
                  {file.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>
      {settingsOpen ? (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'
          onClick={() => setSettingsOpen(false)}
        >
          <form
            className='w-full max-w-3xl rounded-lg bg-white p-8 text-base text-[#060607] shadow-xl dark:bg-[#313338] dark:text-[#f2f3f5]'
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              setSettingsOpen(false)
            }}
          >
            <div className='mb-4 flex items-center justify-between'>
              <h3 className='text-xl font-semibold'>{t('Open drawing settings')}</h3>
              <button type='button' onClick={() => setSettingsOpen(false)} aria-label={t('Close')}>
                <X className='size-5' />
              </button>
            </div>
            <label className='mb-3 block text-base'>
              {t('Bot')}
              <select
                value={settings.bot}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    bot: event.target.value as DrawSettings['bot'],
                  })
                }
                className='mt-1 w-full rounded bg-[#ebedef] px-2 py-1 dark:bg-[#1e1f22]'
              >
                <option value='MID_JOURNEY'>{t('Midjourney')}</option>
                <option value='NIJI_JOURNEY'>{t('Niji')}</option>
              </select>
            </label>
            <label className='mb-3 block text-base'>
              {t('Version')}
              <select
                value={settings.version}
                onChange={(event) => setSettings({ ...settings, version: event.target.value })}
                className='mt-1 w-full rounded bg-[#ebedef] px-2 py-1 dark:bg-[#1e1f22]'
              >
                <option value=''>{t('Default model')}</option>
                <option value='--v 8.2'>--v 8.2</option>
                <option value='--v 7'>--v 7</option>
                <option value='--niji 6'>--niji 6</option>
              </select>
            </label>
            <label className='mb-3 block text-base'>
              {t('Aspect ratio')}
              <select
                value={settings.aspect}
                onChange={(event) => setSettings({ ...settings, aspect: event.target.value })}
                className='mt-1 w-full rounded bg-[#ebedef] px-2 py-1 dark:bg-[#1e1f22]'
              >
                <option value=''>{t('Default model')}</option>
                <option value='1:1'>1:1</option>
                <option value='16:9'>16:9</option>
                <option value='9:16'>9:16</option>
                <option value='4:3'>4:3</option>
                <option value='3:2'>3:2</option>
                <option value='2:3'>2:3</option>
              </select>
            </label>
            <label className='mb-3 block text-base'>
              {t('Stylize')}
              <input
                value={settings.stylize}
                onChange={(event) => setSettings({ ...settings, stylize: event.target.value })}
                placeholder={t('Default model')}
                className='mt-1 w-full rounded bg-[#ebedef] px-2 py-1 dark:bg-[#1e1f22]'
              />
            </label>
            <label className='mb-4 flex min-h-11 items-center gap-2 text-sm'>
              <input
                type='checkbox'
                checked={settings.remix}
                onChange={(event) => setSettings({ ...settings, remix: event.target.checked })}
              />
              {t('Remix variations')}
            </label>
            <div className='flex justify-end'>
              <button type='submit' className='rounded bg-[#248046] px-4 py-1.5 text-sm text-white'>
                {t('Save')}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {modalTask ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'>
          <form
            className='w-full max-w-lg rounded-lg bg-white p-4 dark:bg-[#313338]'
            onSubmit={(event) => {
              event.preventDefault()
              void onModal()
            }}
          >
            <h3 className='mb-2 font-semibold'>{t('Prompt')}</h3>
            <textarea
              value={modalPrompt}
              onChange={(event) => setModalPrompt(event.target.value)}
              rows={4}
              className='w-full rounded bg-[#ebedef] p-2 text-sm outline-none dark:bg-[#1e1f22]'
            />
            <div className='mt-3 flex justify-end gap-2'>
              <button type='button' className='rounded px-3 py-1 text-sm' onClick={() => setModalTask(null)}>
                {t('Cancel')}
              </button>
              <button type='submit' className='rounded bg-[#5865f2] px-3 py-1 text-sm text-white'>
                {t('Save')}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {zoomUrl ? (
        <button
          type='button'
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4'
          onClick={() => setZoomUrl('')}
        >
          <img src={zoomUrl} alt='' className='max-h-full max-w-full object-contain' />
        </button>
      ) : null}
    </div>
  )
}

function buttonText(
  customId: string,
  label: string,
  translate: (key: string) => string
): string {
  if (/^U[1-4]$/.test(label) || /^V[1-4]$/.test(label)) return label
  const id = customId.toLowerCase()
  let key = ''
  if (id.includes('creative') && id.includes('upsample')) key = 'Upscale (Creative)'
  else if (id.includes('subtle') && id.includes('upsample')) key = 'Upscale (Subtle)'
  else if (id.includes('high_variation')) key = 'Vary (Strong)'
  else if (id.includes('low_variation')) key = 'Vary (Subtle)'
  else if (id.includes('pan_left')) key = 'Pan Left'
  else if (id.includes('pan_right')) key = 'Pan Right'
  else if (id.includes('pan_up')) key = 'Pan Up'
  else if (id.includes('pan_down')) key = 'Pan Down'
  else if (id.includes('1.5')) key = 'Zoom Out 1.5x'
  else if (id.includes('2x') || id.includes('outpaint::2')) key = 'Zoom Out 2x'
  else if (id.includes('customzoom')) key = 'Custom Zoom'
  else if (id.includes('outpaint')) key = 'Zoom Out'
  else if (id.includes('inpaint')) key = 'Vary Region'
  else if (id.includes('reroll')) key = 'Reroll'
  else if (id.includes('animate') || id.includes('video')) key = 'Animate'
  return key ? translate(key) : label
}

function TaskRow(props: {
  task: MjTask
  busy: boolean
  onAction: (task: MjTask, customId: string, label: string) => void
  onSimpleChange: (task: MjTask, content: string) => void
  onZoom: (url: string) => void
}) {
  const { t } = useTranslation()
  const task = props.task
  const done = task.status === 'SUCCESS'
  const fallback =
    done && task.buttons.length === 0 && !['UPSCALE', 'DESCRIBE'].includes(task.action.toUpperCase())
      ? [
          ...['U1', 'U2', 'U3', 'U4', 'V1', 'V2', 'V3', 'V4'].map((label) => label),
          ...(task.action.toUpperCase() === 'IMAGINE' ? ['Reroll'] : []),
        ]
      : []
  let statusText = ''
  if (!done && task.status !== 'FAILURE') {
    statusText = task.progress
      ? t('Progress {{progress}}', { progress: task.progress })
      : task.status === 'SUBMITTED' || task.status === 'NOT_START'
        ? t('Submitted')
        : t('Waiting for the task')
  }

  return (
    <article className='flex gap-3'>
      <Avatar name='MJ' />
      <div className='min-w-0'>
        <div className='text-sm font-semibold'>Midjourney Bot</div>
        {statusText ? (
          <p className='text-sm text-[#5c5e66] dark:text-[#949ba4]'>{statusText}</p>
        ) : null}
        {task.status === 'FAILURE' && task.failReason ? (
          <p className='mt-2 rounded bg-[#da373c]/15 p-3 text-sm whitespace-pre-wrap text-[#da373c] dark:text-[#f23f43]'>
            {task.failReason}
          </p>
        ) : null}
        {done && (task.imageUrls.length > 0 || task.imageUrl) ? (
          <div
            className={
              task.imageUrls.length > 1
                ? 'mt-2 inline-grid max-w-full grid-cols-2 gap-1'
                : 'mt-2 max-w-full'
            }
          >
            {(task.imageUrls.length > 0 ? task.imageUrls : [task.imageUrl]).map((url) => (
              <TaskImage
                key={url}
                src={url}
                alt={task.prompt || t('Image')}
                onZoom={props.onZoom}
              />
            ))}
          </div>
        ) : null}
        {!done && task.status !== 'FAILURE' ? (
          <div className='mt-2 h-40 w-full max-w-md animate-pulse rounded-md bg-[#e3e5e8] dark:bg-[#2b2d31]' />
        ) : null}
        {done && task.videoUrl ? (
          <video src={task.videoUrl} controls className='mt-2 max-h-64 w-full rounded-md md:max-h-80' />
        ) : null}
        {done && task.buttons.length > 0 ? (
          <div className='mt-2 flex flex-wrap gap-2'>
            {task.buttons.map((button) => (
              <button
                key={button.customId}
                type='button'
                disabled={props.busy}
                onClick={() => props.onAction(task, button.customId, button.label)}
                className='min-h-11 rounded bg-[#e3e5e8] px-3 text-sm hover:bg-[#d4d7dc] disabled:opacity-50 dark:bg-[#4e5058] dark:hover:bg-[#6d6f78]'
              >
                {buttonText(button.customId, button.label, t)}
              </button>
            ))}
          </div>
        ) : null}
        {fallback.length > 0 ? (
          <div className='mt-2 flex flex-wrap gap-2'>
            {fallback.map((content) => (
              <button
                key={content}
                type='button'
                disabled={props.busy}
                onClick={() =>
                  props.onSimpleChange(
                    task,
                    `${task.id} ${content === 'Reroll' ? 'r' : content.toLowerCase()}`
                  )
                }
                className='min-h-11 rounded bg-[#e3e5e8] px-3 text-sm hover:bg-[#d4d7dc] disabled:opacity-50 dark:bg-[#4e5058] dark:hover:bg-[#6d6f78]'
              >
                {content === 'Reroll' ? t('Reroll') : content}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}

function TaskImage(props: { src: string; alt: string; onZoom: (url: string) => void }) {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  if (failed) {
    return <p className='text-sm text-[#da373c] dark:text-[#f23f43]'>{t('Image failed to load')}</p>
  }
  return (
    <div className='group relative w-fit max-w-full'>
      <button type='button' className='block' onClick={() => props.onZoom(props.src)}>
        {!loaded ? (
          <div className='h-36 w-36 animate-pulse rounded-md bg-[#e3e5e8] dark:bg-[#2b2d31]' />
        ) : null}
        <img
          src={props.src}
          alt={props.alt}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            'h-auto w-auto max-h-64 max-w-full rounded-md object-contain md:max-h-72 md:max-w-xs',
            loaded ? 'block' : 'hidden'
          )}
        />
      </button>
      <button
        type='button'
        aria-label={t('Download')}
        className='absolute top-2 right-2 flex size-8 items-center justify-center rounded-md bg-black/55 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100 max-md:opacity-100'
        onClick={(event) => {
          event.stopPropagation()
          void downloadImage(props.src)
        }}
      >
        <Download className='size-4' />
      </button>
    </div>
  )
}

async function downloadImage(url: string) {
  const name = url.split('/').pop()?.split('?')[0] || 'image'
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('download failed')
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = name.includes('.') ? name : `${name}.png`
    link.click()
    URL.revokeObjectURL(objectUrl)
  } catch {
    const link = document.createElement('a')
    link.href = url
    link.target = '_blank'
    link.rel = 'noreferrer'
    link.click()
  }
}

function CommandPanelView(props: {
  panel: Exclude<CommandPanel, { kind: 'personalize' }>
  busy: boolean
  onChange: (panel: CommandPanel) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const { t } = useTranslation()
  const panel = props.panel
  const onEmptyBackspace = (
    event: ReactKeyboardEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    if (event.key === 'Backspace' && event.currentTarget.value === '') props.onClose()
  }
  return (
    <div className='rounded-lg bg-[#ebedef] p-3 dark:bg-[#383a40]'>
      <div className='mb-2 flex items-center justify-between'>
        <span className='font-semibold text-[#5865f2]'>/{panel.kind}</span>
        <button type='button' onClick={props.onClose} aria-label={t('Close')} className='min-h-11 min-w-11'>
          <X className='ml-auto size-4' />
        </button>
      </div>
      {panel.kind === 'imagine' ? (
        <textarea
          value={panel.prompt}
          autoFocus
          rows={3}
          placeholder={t('Prompt')}
          onChange={(event) => props.onChange({ ...panel, prompt: event.target.value })}
          onKeyDown={onEmptyBackspace}
          className='w-full resize-none rounded bg-white p-2 text-sm outline-none dark:bg-[#1e1f22]'
        />
      ) : null}
      {panel.kind === 'blend' ? (
        <div className='space-y-2'>
          <div className='flex flex-wrap gap-2'>
            {(['portrait', 'square', 'landscape'] as const).map((ratio) => (
              <button
                key={ratio}
                type='button'
                onClick={() => props.onChange({ ...panel, ratio })}
                className={cn(
                  'min-h-11 rounded px-3 text-sm',
                  panel.ratio === ratio
                    ? 'bg-[#5865f2] text-white'
                    : 'bg-white dark:bg-[#1e1f22]'
                )}
              >
                {t(ratio === 'portrait' ? 'Portrait' : ratio === 'square' ? 'Square' : 'Landscape')}
              </button>
            ))}
          </div>
          <label className='flex min-h-11 cursor-pointer items-center rounded bg-white px-3 text-sm dark:bg-[#1e1f22]'>
            {t('Attach images')} ({panel.files.length}/5)
            <input
              type='file'
              accept='image/*'
              multiple
              className='hidden'
              onChange={(event) =>
                props.onChange({
                  ...panel,
                  files: [...(event.target.files ?? [])].slice(0, 5),
                })
              }
            />
          </label>
        </div>
      ) : null}
      {panel.kind === 'describe' ? (
        <div className='space-y-2'>
          <label className='flex min-h-11 cursor-pointer items-center rounded bg-white px-3 text-sm dark:bg-[#1e1f22]'>
            {panel.file ? panel.file.name : t('Attach images')}
            <input
              type='file'
              accept='image/*'
              className='hidden'
              onChange={(event) =>
                props.onChange({ ...panel, file: event.target.files?.[0] ?? null })
              }
            />
          </label>
          <input
            value={panel.link}
            onChange={(event) => props.onChange({ ...panel, link: event.target.value })}
            onKeyDown={onEmptyBackspace}
            placeholder={t('Image link')}
            className='min-h-11 w-full rounded bg-white px-3 text-sm outline-none dark:bg-[#1e1f22]'
          />
        </div>
      ) : null}
      <div className='mt-2 flex justify-end'>
        <button
          type='button'
          disabled={props.busy}
          onClick={props.onSubmit}
          className='min-h-11 rounded bg-[#5865f2] px-4 text-sm text-white disabled:opacity-50'
        >
          {t('Save')}
        </button>
      </div>
    </div>
  )
}

function Avatar(props: { name: string }) {
  return (
    <div className='flex size-10 shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-sm font-semibold text-white'>
      {(props.name || 'M').slice(0, 1).toUpperCase()}
    </div>
  )
}

function PersonalizePanel(props: {
  panel: Extract<CommandPanel, { kind: 'personalize' }>
  busy: boolean
  onChange: (panel: CommandPanel) => void
  onClose: () => void
  onCreate: () => void
  onChoose: (jobId: string) => void
  onSkip: () => void
}) {
  const { t } = useTranslation()
  const panel = props.panel
  const ready = /success|finish|done|complete/i.test(panel.status)
  return (
    <div className='rounded-lg bg-[#ebedef] p-3 dark:bg-[#383a40]'>
      <div className='mb-2 flex items-center justify-between'>
        <span className='font-semibold text-[#5865f2]'>/personalize</span>
        <button type='button' onClick={props.onClose} aria-label={t('Close')} className='min-h-11 min-w-11'>
          <X className='ml-auto size-4' />
        </button>
      </div>
      {!panel.profileId ? (
        <div className='flex gap-2'>
          <input
            value={panel.title}
            onChange={(event) => props.onChange({ ...panel, title: event.target.value })}
            placeholder={t('Profile title')}
            className='min-h-11 flex-1 rounded bg-white px-3 text-sm outline-none dark:bg-[#1e1f22]'
          />
          <button
            type='button'
            disabled={props.busy}
            onClick={props.onCreate}
            className='min-h-11 rounded bg-[#5865f2] px-4 text-sm text-white disabled:opacity-50'
          >
            {t('Save')}
          </button>
        </div>
      ) : ready ? (
        <p className='text-sm'>{panel.profileId}</p>
      ) : (
        <div className='space-y-2'>
          <div className='grid grid-cols-2 gap-2'>
            <button type='button' disabled={props.busy} onClick={() => props.onChoose(panel.leftJobId)}>
              {panel.leftUrl ? (
                <img src={panel.leftUrl} alt={t('Choose left')} className='max-h-64 w-full object-contain' />
              ) : (
                <span className='flex min-h-11 items-center justify-center'>{t('Choose left')}</span>
              )}
            </button>
            <button type='button' disabled={props.busy} onClick={() => props.onChoose(panel.rightJobId)}>
              {panel.rightUrl ? (
                <img src={panel.rightUrl} alt={t('Choose right')} className='max-h-64 w-full object-contain' />
              ) : (
                <span className='flex min-h-11 items-center justify-center'>{t('Choose right')}</span>
              )}
            </button>
          </div>
          <button
            type='button'
            disabled={props.busy}
            onClick={props.onSkip}
            className='min-h-11 rounded bg-white px-3 text-sm dark:bg-[#1e1f22]'
          >
            {t('Skip')}
          </button>
        </div>
      )}
    </div>
  )
}
