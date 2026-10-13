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
import { Hand, Image as ImageIcon, MousePointer2, Plus, Redo2, Type, Undo2, Video } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { fetchVideo, sendImageGeneration, sendSpeech, sendVideoGeneration } from '@/features/apps/experience/api'
import { API_ENDPOINTS } from '@/features/apps/experience/constants'

import { failureMessage, sendCanvasChat } from './api'
import { generationKind, NODE_CATALOG, nodeLabel, nodeSize } from './node-catalog'
import type { CanvasDraft, CanvasEdge, CanvasNode, CanvasNodeStatus, CanvasViewport, ContentNodeData } from './types'

type Tool = 'select' | 'pan'

type StudioProps = {
  initial: CanvasDraft
  chatModel: string
  imageModel: string
  videoModel: string
  audioModel: string
  group: string
  initialAdd?: string
  onSave: (draft: CanvasDraft) => Promise<void>
  onSaveError: () => void
}

export function CanvasStudio(props: StudioProps) {
  const { t } = useTranslation()
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState(props.initial)
  const [tool, setTool] = useState<Tool>('select')
  const [selectedId, setSelectedId] = useState('')
  const [linking, setLinking] = useState<{ source: string; x: number; y: number } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const draftRef = useRef(draft)
  const history = useRef<CanvasDraft[]>([props.initial])
  const index = useRef(0)
  const polls = useRef(new Map<string, number>())
  draftRef.current = draft

  const commit = (next: CanvasDraft, pushHistory: boolean) => {
    draftRef.current = next
    setDraft(next)
    if (pushHistory) {
      history.current = history.current.slice(0, index.current + 1)
      history.current.push(next)
      index.current = history.current.length - 1
    }
    void props.onSave(next).catch(() => props.onSaveError())
  }

  const patchNode = (id: string, data: CanvasNode['data'], pushHistory: boolean) => {
    const current = draftRef.current
    const next: CanvasDraft = {
      ...current,
      nodes: current.nodes.map((node) => (node.id === id ? ({ ...node, data } as CanvasNode) : node)),
    }
    commit(next, pushHistory)
  }

  const worldFromClient = (clientX: number, clientY: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect()
    const viewport = draftRef.current.viewport
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left - viewport.x) / viewport.zoom,
      y: (clientY - rect.top - viewport.y) / viewport.zoom,
    }
  }

  const addNode = (type: CanvasNode['type'], at?: { x: number; y: number }) => {
    const size = nodeSize(type)
    const viewport = draftRef.current.viewport
    const rect = surfaceRef.current?.getBoundingClientRect()
    const origin = at ?? {
      x: ((rect?.width ?? 800) / 2 - viewport.x) / viewport.zoom - size.w / 2,
      y: ((rect?.height ?? 600) / 2 - viewport.y) / viewport.zoom - size.h / 2,
    }
    const id = crypto.randomUUID()
    const node = emptyCanvasNode(type, id, origin, props)
    commit({ ...draftRef.current, nodes: [...draftRef.current.nodes, node] }, true)
    setSelectedId(id)
  }

  const seeded = useRef(false)
  const addRef = useRef(addNode)
  addRef.current = addNode
  useEffect(() => {
    if (seeded.current || !props.initialAdd) return
    const match = NODE_CATALOG.find((item) => item.type === props.initialAdd)
    if (!match || draftRef.current.nodes.length > 0) return
    seeded.current = true
    addRef.current(match.type)
  }, [props.initialAdd])

  const removeNode = (id: string) => {
    const current = draftRef.current
    commit(
      {
        ...current,
        nodes: current.nodes.filter((node) => node.id !== id),
        edges: current.edges.filter((edge) => edge.source !== id && edge.target !== id),
      },
      true
    )
    setSelectedId('')
  }

  const pollVideo = (id: string, jobId: string) => {
    const previous = polls.current.get(id)
    if (previous) window.clearTimeout(previous)
    let attempts = 0
    const tick = () => {
      void fetchVideo(jobId)
        .then((data) => {
          const node = draftRef.current.nodes.find((item) => item.id === id)
          if (!node || (node.type !== 'video' && node.type !== 'media-conversion')) return
          if (data.error?.message) throw new Error(data.error.message)
          const status = data.status || ''
          if (status === 'completed') {
            patchNode(
              id,
              {
                ...node.data,
                status: 'done',
                url: `${API_ENDPOINTS.VIDEOS}/${encodeURIComponent(jobId)}/content`,
                error: '',
                jobId,
              },
              true
            )
            return
          }
          if (status === 'failed') throw new Error(data.message || 'Request failed')
          attempts += 1
          if (attempts > 90) throw new Error('Request failed')
          const timer = window.setTimeout(tick, 2000)
          polls.current.set(id, timer)
        })
        .catch((cause: unknown) => {
          const node = draftRef.current.nodes.find((item) => item.id === id)
          if (!node || (node.type !== 'video' && node.type !== 'media-conversion')) return
          patchNode(id, { ...node.data, status: 'error', error: failureMessage(cause), jobId }, true)
        })
    }
    const timer = window.setTimeout(tick, 1500)
    polls.current.set(id, timer)
  }

  useEffect(() => {
    for (const node of props.initial.nodes) {
      if (node.type === 'video' && node.data.status === 'running' && node.data.jobId) {
        pollVideo(node.id, node.data.jobId)
      }
    }
    const active = polls.current
    return () => {
      for (const timer of active.values()) window.clearTimeout(timer)
      active.clear()
    }
    // Resume in-flight video jobs once when this canvas opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const removeRef = useRef(removeNode)
  removeRef.current = removeNode
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return
      const tag = event.target instanceof HTMLElement ? event.target.tagName : ''
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (!selectedId) return
      event.preventDefault()
      removeRef.current(selectedId)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId])

  const generateContent = (node: Extract<CanvasNode, { data: ContentNodeData }>) => {
    const kind = generationKind(node.type)
    const source = (kind === 'text' ? node.data.text : node.data.prompt).trim()
    const model = kind === 'text' ? props.chatModel : node.data.model
    if (!source || !model) return
    patchNode(node.id, { ...node.data, status: 'running', error: '' }, false)
    if (kind === 'audio') {
      void sendSpeech({ model, input: source, group: props.group, voice: 'alloy' })
        .then((blob) => {
          const current = draftRef.current.nodes.find((item) => item.id === node.id)
          if (!current || current.type === 'text' || current.type === 'image' || current.type === 'video') return
          patchNode(node.id, { ...current.data, url: URL.createObjectURL(blob), status: 'done', error: '' }, true)
        })
        .catch((cause: unknown) => finishContentError(node.id, cause))
      return
    }
    if (kind === 'image') {
      void sendImageGeneration({ model, prompt: source, n: 1, size: '1024x1024', group: props.group })
        .then((result) => {
          if (result.error?.message) throw new Error(result.error.message)
          const first = result.data?.[0]
          const url = first?.url || (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : '')
          if (!url) throw new Error('Request failed')
          const current = draftRef.current.nodes.find((item) => item.id === node.id)
          if (!current || current.type === 'text' || current.type === 'image' || current.type === 'video') return
          patchNode(node.id, { ...current.data, url, status: 'done', error: '' }, true)
        })
        .catch((cause: unknown) => finishContentError(node.id, cause))
      return
    }
    if (kind === 'video') {
      void sendVideoGeneration({ model, prompt: source, group: props.group })
        .then((data) => {
          if (data.error?.message) throw new Error(data.error.message)
          const current = draftRef.current.nodes.find((item) => item.id === node.id)
          if (!current || current.type !== 'media-conversion') return
          const direct = data.video_url || data.url || ''
          if (direct) {
            patchNode(node.id, { ...current.data, url: direct, status: 'done', error: '', jobId: '' }, true)
            return
          }
          const jobId = data.id || data.task_id || ''
          if (!jobId) throw new Error(data.message || 'Request failed')
          patchNode(node.id, { ...current.data, status: 'running', jobId, error: '' }, true)
          pollVideo(node.id, jobId)
        })
        .catch((cause: unknown) => finishContentError(node.id, cause))
      return
    }
    void sendCanvasChat({ model, group: props.group, text: source })
      .then((reply) => {
        const current = draftRef.current.nodes.find((item) => item.id === node.id)
        if (!current || current.type === 'text' || current.type === 'image' || current.type === 'video') return
        patchNode(node.id, { ...current.data, reply, status: 'done', error: '' }, true)
      })
      .catch((cause: unknown) => finishContentError(node.id, cause))
  }

  const finishContentError = (id: string, cause: unknown) => {
    const current = draftRef.current.nodes.find((item) => item.id === id)
    if (!current || current.type === 'text' || current.type === 'image' || current.type === 'video') return
    patchNode(id, { ...current.data, status: 'error', error: failureMessage(cause) }, true)
  }

  const generate = (id: string) => {
    const node = draftRef.current.nodes.find((item) => item.id === id)
    if (!node || node.data.status === 'running') return
    if (node.type === 'text') {
      if (!node.data.text.trim() || !props.chatModel) return
      patchNode(id, { ...node.data, status: 'running', error: '' }, false)
      void sendCanvasChat({ model: props.chatModel, group: props.group, text: node.data.text })
        .then((reply) => {
          const current = draftRef.current.nodes.find((item) => item.id === id)
          if (!current || current.type !== 'text') return
          patchNode(id, { ...current.data, reply, status: 'done', error: '' }, true)
        })
        .catch((cause: unknown) => {
          const current = draftRef.current.nodes.find((item) => item.id === id)
          if (!current || current.type !== 'text') return
          patchNode(id, { ...current.data, status: 'error', error: failureMessage(cause) }, true)
        })
      return
    }
    if (node.type === 'image') {
      if (!node.data.prompt.trim() || !node.data.model) return
      patchNode(id, { ...node.data, status: 'running', error: '' }, false)
      void sendImageGeneration({
        model: node.data.model,
        prompt: node.data.prompt,
        n: 1,
        size: '1024x1024',
        group: props.group,
      })
        .then((result) => {
          if (result.error?.message) throw new Error(result.error.message)
          const first = result.data?.[0]
          const url = first?.url || (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : '')
          if (!url) throw new Error('Request failed')
          const current = draftRef.current.nodes.find((item) => item.id === id)
          if (!current || current.type !== 'image') return
          patchNode(id, { ...current.data, url, status: 'done', error: '' }, true)
        })
        .catch((cause: unknown) => {
          const current = draftRef.current.nodes.find((item) => item.id === id)
          if (!current || current.type !== 'image') return
          patchNode(id, { ...current.data, status: 'error', error: failureMessage(cause) }, true)
        })
      return
    }
    if (node.type !== 'video') {
      generateContent(node)
      return
    }
    if (!node.data.prompt.trim() || !node.data.model) return
    patchNode(id, { ...node.data, status: 'running', error: '', url: '' }, false)
    void sendVideoGeneration({ model: node.data.model, prompt: node.data.prompt, group: props.group })
      .then((data) => {
        if (data.error?.message) throw new Error(data.error.message)
        const direct = data.video_url || data.url || ''
        const current = draftRef.current.nodes.find((item) => item.id === id)
        if (!current || current.type !== 'video') return
        if (direct) {
          patchNode(id, { ...current.data, url: direct, status: 'done', error: '', jobId: '' }, true)
          return
        }
        const jobId = data.id || data.task_id || ''
        if (!jobId) throw new Error(data.message || 'Request failed')
        patchNode(id, { ...current.data, status: 'running', jobId, error: '' }, true)
        pollVideo(id, jobId)
      })
      .catch((cause: unknown) => {
        const current = draftRef.current.nodes.find((item) => item.id === id)
        if (!current || current.type !== 'video') return
        patchNode(id, { ...current.data, status: 'error', error: failureMessage(cause) }, true)
      })
  }

  const undo = () => {
    if (index.current <= 0) return
    index.current -= 1
    const next = history.current[index.current]
    draftRef.current = next
    setDraft(next)
    void props.onSave(next).catch(() => props.onSaveError())
  }
  const redo = () => {
    if (index.current >= history.current.length - 1) return
    index.current += 1
    const next = history.current[index.current]
    draftRef.current = next
    setDraft(next)
    void props.onSave(next).catch(() => props.onSaveError())
  }

  const onBackgroundDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return
    if (event.target !== event.currentTarget) return
    const pan = tool === 'pan' || event.button === 1
    if (!pan) {
      setSelectedId('')
      return
    }
    const startX = event.clientX
    const startY = event.clientY
    const origin = draftRef.current.viewport
    const move = (next: PointerEvent) => {
      setViewport({
        ...origin,
        x: origin.x + next.clientX - startX,
        y: origin.y + next.clientY - startY,
      }, false)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      commit(draftRef.current, false)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const setViewport = (viewport: CanvasViewport, save: boolean) => {
    const next = { ...draftRef.current, viewport }
    draftRef.current = next
    setDraft(next)
    if (save) void props.onSave(next).catch(() => props.onSaveError())
  }

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const viewport = draftRef.current.viewport
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (!rect) return
    const nextZoom = Math.min(2.5, Math.max(0.25, viewport.zoom * (event.deltaY < 0 ? 1.08 : 0.92)))
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top
    const worldX = (px - viewport.x) / viewport.zoom
    const worldY = (py - viewport.y) / viewport.zoom
    setViewport({ x: px - worldX * nextZoom, y: py - worldY * nextZoom, zoom: nextZoom }, false)
  }

  const dragNode = (id: string, event: React.PointerEvent<HTMLDivElement>) => {
    if (tool === 'pan' || event.button !== 0) return
    const target = event.target instanceof HTMLElement ? event.target : null
    if (target?.closest('textarea,button,input,video,a')) return
    event.stopPropagation()
    setSelectedId(id)
    const node = draftRef.current.nodes.find((item) => item.id === id)
    if (!node) return
    const start = worldFromClient(event.clientX, event.clientY)
    const origin = node.position
    const move = (next: PointerEvent) => {
      const point = worldFromClient(next.clientX, next.clientY)
      const current = draftRef.current
      const moved: CanvasDraft = {
        ...current,
        nodes: current.nodes.map((item) =>
          item.id === id
            ? { ...item, position: { x: origin.x + point.x - start.x, y: origin.y + point.y - start.y } }
            : item
        ),
      }
      draftRef.current = moved
      setDraft(moved)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      commit(draftRef.current, true)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const viewport = draft.viewport
  return (
    <div className='relative h-full min-h-0'>
      <div
        ref={surfaceRef}
        className='absolute inset-0 overflow-hidden bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)]'
        style={{
          backgroundSize: `${16 * viewport.zoom}px ${16 * viewport.zoom}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          cursor: tool === 'pan' ? 'grab' : 'default',
        }}
        onPointerDown={onBackgroundDown}
        onWheel={onWheel}
        onDoubleClick={(event) => {
          if (event.target !== event.currentTarget) return
          addNode('text', worldFromClient(event.clientX, event.clientY))
        }}
      >
        <div
          className='absolute top-0 left-0'
          style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`, transformOrigin: '0 0' }}
        >
          <svg className='pointer-events-none absolute overflow-visible' width='1' height='1'>
            {draft.edges.map((edge) => (
              <StudioEdge key={edge.id} edge={edge} nodes={draft.nodes} />
            ))}
            {linking ? <LinkPreview source={linking.source} x={linking.x} y={linking.y} nodes={draft.nodes} /> : null}
          </svg>
          {draft.nodes.map((node) => (
            <StudioCard
              key={node.id}
              node={node}
              selected={node.id === selectedId}
              onPointerDown={(event) => dragNode(node.id, event)}
              onChange={(data) => patchNode(node.id, data, false)}
              onCommit={(data) => patchNode(node.id, data, true)}
              onGenerate={() => generate(node.id)}
              onConnectStart={(event) => {
                event.stopPropagation()
                const move = (next: PointerEvent) => {
                  const point = worldFromClient(next.clientX, next.clientY)
                  setLinking({ source: node.id, x: point.x, y: point.y })
                }
                const up = (next: PointerEvent) => {
                  window.removeEventListener('pointermove', move)
                  window.removeEventListener('pointerup', up)
                  const hit = document.elementFromPoint(next.clientX, next.clientY)
                  const target = hit instanceof HTMLElement ? hit.closest('[data-canvas-target]') : null
                  const targetId = target?.getAttribute('data-node-id') || ''
                  setLinking(null)
                  if (!targetId || targetId === node.id) return
                  const exists = draftRef.current.edges.some((edge) => edge.source === node.id && edge.target === targetId)
                  if (exists) return
                  commit(
                    {
                      ...draftRef.current,
                      edges: [...draftRef.current.edges, { id: crypto.randomUUID(), source: node.id, target: targetId }],
                    },
                    true
                  )
                }
                window.addEventListener('pointermove', move)
                window.addEventListener('pointerup', up)
              }}
            />
          ))}
        </div>
        {draft.nodes.length === 0 ? (
          <p className='text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-sm'>
            {t('Double-click the canvas or add a node from the dock')}
          </p>
        ) : null}
      </div>
      {menuOpen ? (
        <div className='bg-background absolute bottom-20 left-1/2 grid w-[440px] -translate-x-1/2 grid-cols-3 gap-1 rounded-2xl border p-2 shadow-lg'>
          {NODE_CATALOG.map((item) => (
            <button
              key={item.type}
              type='button'
              className='hover:bg-muted rounded-lg px-2 py-2 text-left text-xs'
              onClick={() => {
                addNode(item.type)
                setMenuOpen(false)
              }}
            >
              {t(item.label)}
            </button>
          ))}
        </div>
      ) : null}
      <div className='bg-background/95 absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border px-2 py-1 shadow-sm'>
        <DockButton label={t('Canvas select')} pressed={tool === 'select'} onClick={() => setTool('select')}>
          <MousePointer2 className='size-4' />
        </DockButton>
        <DockButton label={t('Canvas pan')} pressed={tool === 'pan'} onClick={() => setTool('pan')}>
          <Hand className='size-4' />
        </DockButton>
        <span className='bg-border mx-1 h-5 w-px' />
        <DockButton label={t('Add text')} onClick={() => addNode('text')}>
          <Type className='size-4' />
        </DockButton>
        <DockButton label={t('Add image')} onClick={() => addNode('image')}>
          <ImageIcon className='size-4' />
        </DockButton>
        <DockButton label={t('Add video')} onClick={() => addNode('video')}>
          <Video className='size-4' />
        </DockButton>
        <DockButton label={t('All nodes')} pressed={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          <Plus className='size-4' />
        </DockButton>
        <span className='bg-border mx-1 h-5 w-px' />
        <DockButton label={t('Undo')} onClick={undo}>
          <Undo2 className='size-4' />
        </DockButton>
        <DockButton label={t('Redo')} onClick={redo}>
          <Redo2 className='size-4' />
        </DockButton>
      </div>
    </div>
  )
}

function DockButton(props: { label: string; pressed?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button
      type='button'
      size='icon'
      variant={props.pressed ? 'default' : 'ghost'}
      aria-label={props.label}
      aria-pressed={props.pressed}
      onClick={props.onClick}
    >
      {props.children}
    </Button>
  )
}

function StudioCard(props: {
  node: CanvasNode
  selected: boolean
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  onChange: (data: CanvasNode['data']) => void
  onCommit: (data: CanvasNode['data']) => void
  onGenerate: () => void
  onConnectStart: (event: React.PointerEvent<HTMLButtonElement>) => void
}) {
  const { t } = useTranslation()
  const node = props.node
  const size = nodeSize(node.type)
  const title = t(nodeLabel(node.type))
  let prompt = ''
  let placeholder = t('Image prompt')
  let preview: ReactNode = null
  if (node.type === 'text') {
    prompt = node.data.text
    placeholder = t('Prompt')
    preview = node.data.reply ? <p className='px-3 pt-2 text-sm whitespace-pre-wrap'>{node.data.reply}</p> : null
  } else if (node.type === 'image') {
    prompt = node.data.prompt
    preview = node.data.url ? (
      <img src={node.data.url} alt='' className='mx-3 mt-2 max-h-36 w-[calc(100%-1.5rem)] rounded-lg object-cover' />
    ) : null
  } else if (node.type === 'video') {
    prompt = node.data.prompt
    preview = node.data.url ? (
      <video src={node.data.url} controls className='mx-3 mt-2 max-h-36 w-[calc(100%-1.5rem)] rounded-lg' />
    ) : null
  } else {
    const kind = generationKind(node.type)
    prompt = kind === 'text' ? node.data.text : node.data.prompt || node.data.text
    placeholder = kind === 'text' ? t('Prompt') : t('Image prompt')
    if (node.data.url && kind === 'audio') {
      preview = <audio src={node.data.url} controls className='mx-3 mt-2 w-[calc(100%-1.5rem)]' />
    } else if (node.data.url && kind === 'video') {
      preview = <video src={node.data.url} controls className='mx-3 mt-2 max-h-36 w-[calc(100%-1.5rem)] rounded-lg' />
    } else if (node.data.url) {
      preview = <img src={node.data.url} alt='' className='mx-3 mt-2 max-h-36 w-[calc(100%-1.5rem)] rounded-lg object-cover' />
    } else if (node.data.reply) {
      preview = <p className='px-3 pt-2 text-sm whitespace-pre-wrap'>{node.data.reply}</p>
    }
  }
  const running = node.data.status === 'running'
  return (
    <div
      className={`bg-background absolute rounded-2xl border shadow-sm ${props.selected ? 'border-foreground' : 'border-border'}`}
      style={{ left: node.position.x, top: node.position.y, width: size.w }}
      onPointerDown={props.onPointerDown}
    >
      <button
        type='button'
        data-canvas-target='true'
        data-node-id={node.id}
        className='border-border bg-background absolute top-1/2 -left-2 size-3 -translate-y-1/2 rounded-full border'
        aria-label={t('Connect')}
      />
      <button
        type='button'
        className='border-border bg-background absolute top-1/2 -right-2 size-3 -translate-y-1/2 rounded-full border'
        aria-label={t('Connect')}
        onPointerDown={props.onConnectStart}
      />
      <div className='text-muted-foreground px-3 pt-2 text-xs'>{title}</div>
      {preview}
      <textarea
        className='w-full resize-none bg-transparent px-3 py-2 text-sm outline-none'
        rows={3}
        placeholder={placeholder}
        value={prompt}
        onChange={(event) => props.onChange(withPrompt(node, event.target.value))}
        onBlur={(event) => props.onCommit(withPrompt(node, event.target.value))}
      />
      {node.data.error ? <p className='text-destructive px-3 pb-1 text-xs'>{node.data.error}</p> : null}
      <div className='flex items-center justify-between px-3 pb-3'>
        <span className='text-muted-foreground truncate text-xs'>{statusLabel(node.data.status, t)}</span>
        <Button type='button' size='sm' disabled={running || !prompt.trim()} onClick={props.onGenerate}>
          {t('Generate')}
        </Button>
      </div>
    </div>
  )
}

function withPrompt(node: CanvasNode, value: string): CanvasNode['data'] {
  if (node.type === 'text') return { ...node.data, text: value }
  if (node.type !== 'image' && node.type !== 'video' && generationKind(node.type) === 'text') {
    return { ...node.data, text: value }
  }
  return { ...node.data, prompt: value }
}

function emptyCanvasNode(
  type: CanvasNode['type'],
  id: string,
  position: { x: number; y: number },
  models: { chatModel: string; imageModel: string; videoModel: string; audioModel: string }
): CanvasNode {
  if (type === 'text') {
    return { id, type, position, data: { text: '', reply: '', status: 'idle', error: '' } }
  }
  if (type === 'image') {
    return { id, type, position, data: { prompt: '', model: models.imageModel, status: 'idle', url: '', error: '' } }
  }
  if (type === 'video') {
    return {
      id,
      type,
      position,
      data: { text: '', reply: '', prompt: '', model: models.videoModel, status: 'idle', url: '', error: '', jobId: '' },
    }
  }
  const kind = generationKind(type)
  let model = models.chatModel
  if (kind === 'image') model = models.imageModel
  if (kind === 'video') model = models.videoModel
  if (kind === 'audio') model = models.audioModel
  return {
    id,
    type,
    position,
    data: { text: '', reply: '', prompt: '', model, status: 'idle', url: '', error: '', jobId: '' },
  }
}

function statusLabel(status: CanvasNodeStatus, t: (key: string) => string) {
  if (status === 'running') return t('Running')
  if (status === 'done') return t('Done')
  if (status === 'error') return t('Failed')
  return ''
}

function anchor(node: CanvasNode, side: 'source' | 'target') {
  const size = nodeSize(node.type)
  return {
    x: node.position.x + (side === 'source' ? size.w : 0),
    y: node.position.y + 28,
  }
}

function edgePath(source: { x: number; y: number }, target: { x: number; y: number }) {
  const bend = Math.max(48, Math.abs(target.x - source.x) / 2)
  return `M ${source.x} ${source.y} C ${source.x + bend} ${source.y}, ${target.x - bend} ${target.y}, ${target.x} ${target.y}`
}

function StudioEdge(props: { edge: CanvasEdge; nodes: CanvasNode[] }) {
  const source = props.nodes.find((node) => node.id === props.edge.source)
  const target = props.nodes.find((node) => node.id === props.edge.target)
  if (!source || !target) return null
  return (
    <path
      d={edgePath(anchor(source, 'source'), anchor(target, 'target'))}
      fill='none'
      stroke='var(--foreground)'
      strokeOpacity='0.45'
      strokeWidth='1.5'
    />
  )
}

function LinkPreview(props: { source: string; x: number; y: number; nodes: CanvasNode[] }) {
  const source = props.nodes.find((node) => node.id === props.source)
  if (!source) return null
  return (
    <path
      d={edgePath(anchor(source, 'source'), { x: props.x, y: props.y })}
      fill='none'
      stroke='var(--foreground)'
      strokeDasharray='4 4'
      strokeWidth='1.5'
    />
  )
}
