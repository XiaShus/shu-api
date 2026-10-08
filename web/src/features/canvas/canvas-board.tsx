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
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type Viewport,
} from '@xyflow/react'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Canvas } from '@/components/ai-elements/canvas'
import { Button } from '@/components/ui/button'
import { sendImageGeneration } from '@/features/apps/experience/api'

import { failureMessage, sendCanvasChat } from './api'
import {
  type CanvasDraft,
  type CanvasEdge,
  type CanvasNode,
  type ImageNodeData,
  type TextNodeData,
} from './types'

type CanvasActions = {
  chatModel: string
  group: string
  updateText: (id: string, text: string) => void
  commitText: (id: string) => void
  updatePrompt: (id: string, prompt: string) => void
  commitPrompt: (id: string) => void
  generateText: (id: string) => void
  generateImage: (id: string) => void
}

const CanvasActionContext = createContext<CanvasActions | null>(null)

function useCanvasActions() {
  const value = useContext(CanvasActionContext)
  if (!value) throw new Error('canvas actions missing')
  return value
}

function TextNodeView({ id, data }: NodeProps) {
  const { t } = useTranslation()
  const actions = useCanvasActions()
  const node = data as TextNodeData
  return (
    <div className='bg-background border-border w-64 rounded-lg border p-2 shadow-sm'>
      <textarea
        className='w-full resize-none bg-transparent text-sm outline-none'
        rows={3}
        placeholder={t('Prompt')}
        value={node.text}
        onChange={(event) => actions.updateText(id, event.target.value)}
        onBlur={() => actions.commitText(id)}
      />
      {node.reply ? <p className='mt-2 text-sm whitespace-pre-wrap'>{node.reply}</p> : null}
      {node.error ? <p className='text-destructive mt-2 text-xs'>{node.error}</p> : null}
      <Button
        type='button'
        size='sm'
        className='mt-2'
        disabled={!actions.chatModel || node.status === 'running' || !node.text.trim()}
        onClick={() => actions.generateText(id)}
      >
        {t('Generate')}
      </Button>
    </div>
  )
}

function ImageNodeView({ id, data }: NodeProps) {
  const { t } = useTranslation()
  const actions = useCanvasActions()
  const node = data as ImageNodeData
  return (
    <div className='bg-background border-border w-64 rounded-lg border p-2 shadow-sm'>
      <textarea
        className='w-full resize-none bg-transparent text-sm outline-none'
        rows={3}
        placeholder={t('Image prompt')}
        value={node.prompt}
        onChange={(event) => actions.updatePrompt(id, event.target.value)}
        onBlur={() => actions.commitPrompt(id)}
      />
      {node.model ? <p className='text-muted-foreground mt-1 truncate text-xs'>{node.model}</p> : null}
      {node.url ? <img src={node.url} alt='' className='mt-2 w-full rounded-md' /> : null}
      {node.error ? <p className='text-destructive mt-2 text-xs'>{node.error}</p> : null}
      <Button
        type='button'
        size='sm'
        className='mt-2'
        disabled={!node.model || node.status === 'running' || !node.prompt.trim()}
        onClick={() => actions.generateImage(id)}
      >
        {t('Generate')}
      </Button>
    </div>
  )
}

const nodeTypes = {
  text: TextNodeView,
  image: ImageNodeView,
}

function toFlowNodes(nodes: CanvasNode[]): Node[] {
  return nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
  }))
}

function toFlowEdges(edges: CanvasEdge[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }))
}

function fromFlow(nodes: Node[], edges: Edge[], viewport: Viewport): CanvasDraft {
  const nextNodes: CanvasNode[] = []
  for (const node of nodes) {
    if (node.type === 'text') {
      nextNodes.push({
        id: node.id,
        type: 'text',
        position: node.position,
        data: node.data as TextNodeData,
      })
    }
    if (node.type === 'image') {
      nextNodes.push({
        id: node.id,
        type: 'image',
        position: node.position,
        data: node.data as ImageNodeData,
      })
    }
  }
  return {
    version: 1,
    nodes: nextNodes,
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
    viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
  }
}

type CanvasBoardProps = {
  initial: CanvasDraft
  chatModel: string
  defaultImageModel: string
  group: string
  onSave: (draft: CanvasDraft) => Promise<void>
  onSaveError: () => void
}

export function CanvasBoard(props: CanvasBoardProps) {
  const { t } = useTranslation()
  const [nodes, setNodes] = useState<Node[]>(() => toFlowNodes(props.initial.nodes))
  const [edges, setEdges] = useState<Edge[]>(() => toFlowEdges(props.initial.edges))
  const [viewport, setViewport] = useState<Viewport>(props.initial.viewport)
  const history = useRef<CanvasDraft[]>([props.initial])
  const index = useRef(0)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const viewportRef = useRef(viewport)
  nodesRef.current = nodes
  edgesRef.current = edges
  viewportRef.current = viewport

  useEffect(() => {
    if (!props.defaultImageModel) return
    setNodes((current) => {
      let changed = false
      const next = current.map((node) => {
        if (node.type !== 'image') return node
        const data = node.data as ImageNodeData
        if (data.model) return node
        changed = true
        return { ...node, data: { ...data, model: props.defaultImageModel } }
      })
      if (changed) {
        const draft = fromFlow(next, edgesRef.current, viewportRef.current)
        if (history.current[index.current]) history.current[index.current] = draft
        void props.onSave(draft).catch(() => props.onSaveError())
      }
      return changed ? next : current
    })
  }, [props.defaultImageModel, props.onSave, props.onSaveError])

  const persist = (draft: CanvasDraft, pushHistory: boolean) => {
    if (pushHistory) {
      const next = history.current.slice(0, index.current + 1)
      next.push(draft)
      if (next.length > 50) next.shift()
      history.current = next
      index.current = next.length - 1
    } else if (history.current[index.current]) {
      history.current[index.current] = {
        ...history.current[index.current],
        viewport: draft.viewport,
      }
    }
    void props.onSave(draft).catch(() => props.onSaveError())
  }

  const currentDraft = () => fromFlow(nodesRef.current, edgesRef.current, viewportRef.current)

  const applyDraft = (draft: CanvasDraft) => {
    setNodes(toFlowNodes(draft.nodes))
    setEdges(toFlowEdges(draft.edges))
    setViewport(draft.viewport)
  }

  const commitNodes = (nextNodes: Node[], nextEdges: Edge[]) => {
    setNodes(nextNodes)
    setEdges(nextEdges)
    persist(fromFlow(nextNodes, nextEdges, viewportRef.current), true)
  }

  const updateNodeData = (id: string, patch: Record<string, string>) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...patch } } : node
      )
    )
  }

  const actions: CanvasActions = {
    chatModel: props.chatModel,
    group: props.group,
    updateText: (id, text) => updateNodeData(id, { text }),
    commitText: () => persist(currentDraft(), true),
    updatePrompt: (id, prompt) => updateNodeData(id, { prompt }),
    commitPrompt: () => persist(currentDraft(), true),
    generateText: (id) => {
      const node = nodesRef.current.find((item) => item.id === id)
      const data = node?.data as TextNodeData | undefined
      if (!data?.text.trim() || !props.chatModel) return
      updateNodeData(id, { status: 'running', error: '' })
      void sendCanvasChat({
        model: props.chatModel,
        group: props.group,
        text: data.text,
      })
        .then((reply) => {
          setNodes((current) => {
            const next = current.map((item) =>
              item.id === id
                ? { ...item, data: { ...item.data, reply, status: 'done', error: '' } }
                : item
            )
            persist(fromFlow(next, edgesRef.current, viewportRef.current), true)
            return next
          })
        })
        .catch((cause: unknown) => {
          setNodes((current) => {
            const next = current.map((item) =>
              item.id === id
                ? {
                    ...item,
                    data: { ...item.data, status: 'error', error: failureMessage(cause) },
                  }
                : item
            )
            persist(fromFlow(next, edgesRef.current, viewportRef.current), true)
            return next
          })
        })
    },
    generateImage: (id) => {
      const node = nodesRef.current.find((item) => item.id === id)
      const data = node?.data as ImageNodeData | undefined
      if (!data?.prompt.trim() || !data.model) return
      updateNodeData(id, { status: 'running', error: '' })
      void sendImageGeneration({
        model: data.model,
        prompt: data.prompt,
        n: 1,
        size: '1024x1024',
        group: props.group,
      })
        .then((result) => {
          if (result.error?.message) throw new Error(result.error.message)
          const first = result.data?.[0]
          const url = first?.url || (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : '')
          if (!url) throw new Error('Request failed')
          setNodes((current) => {
            const next = current.map((item) =>
              item.id === id
                ? { ...item, data: { ...item.data, url, status: 'done', error: '' } }
                : item
            )
            persist(fromFlow(next, edgesRef.current, viewportRef.current), true)
            return next
          })
        })
        .catch((cause: unknown) => {
          setNodes((current) => {
            const next = current.map((item) =>
              item.id === id
                ? {
                    ...item,
                    data: { ...item.data, status: 'error', error: failureMessage(cause) },
                  }
                : item
            )
            persist(fromFlow(next, edgesRef.current, viewportRef.current), true)
            return next
          })
        })
    },
  }

  const addNode = (type: 'text' | 'image') => {
    const id = crypto.randomUUID()
    const position = { x: 80 + nodes.length * 24, y: 80 + nodes.length * 24 }
    const node: Node =
      type === 'text'
        ? {
            id,
            type,
            position,
            data: { text: '', reply: '', status: 'idle', error: '' },
          }
        : {
            id,
            type,
            position,
            data: { prompt: '', model: props.defaultImageModel, status: 'idle', url: '', error: '' },
          }
    commitNodes([...nodes, node], edges)
  }

  const undo = () => {
    if (index.current <= 0) return
    index.current -= 1
    const draft = history.current[index.current]
    applyDraft(draft)
    void props.onSave(draft).catch(() => props.onSaveError())
  }

  const redo = () => {
    if (index.current >= history.current.length - 1) return
    index.current += 1
    const draft = history.current[index.current]
    applyDraft(draft)
    void props.onSave(draft).catch(() => props.onSaveError())
  }

  return (
    <CanvasActionContext.Provider value={actions}>
      <div className='flex h-full min-h-0 flex-col'>
        <div className='border-border flex gap-2 border-b px-3 py-2'>
          <Button type='button' size='sm' variant='outline' onClick={() => addNode('text')}>
            {t('Add text')}
          </Button>
          <Button type='button' size='sm' variant='outline' onClick={() => addNode('image')}>
            {t('Add image')}
          </Button>
          <Button type='button' size='sm' variant='outline' onClick={undo}>
            {t('Undo')}
          </Button>
          <Button type='button' size='sm' variant='outline' onClick={redo}>
            {t('Redo')}
          </Button>
        </div>
        <div className='relative min-h-0 flex-1'>
          {nodes.length === 0 ? (
            <p className='text-muted-foreground pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-sm'>
              {t('Nothing on the canvas yet')}
            </p>
          ) : null}
          <Canvas
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            defaultViewport={props.initial.viewport}
            viewport={viewport}
            onViewportChange={setViewport}
            onNodesChange={(changes: NodeChange[]) => {
              setNodes((current) => {
                const next = applyNodeChanges(changes, current)
                const removed = changes.some((change) => change.type === 'remove')
                const dragStop = changes.some(
                  (change) => change.type === 'position' && change.dragging === false
                )
                if (removed || dragStop) {
                  persist(fromFlow(next, edgesRef.current, viewportRef.current), true)
                }
                return next
              })
            }}
            onEdgesChange={(changes: EdgeChange[]) => {
              setEdges((current) => {
                const next = applyEdgeChanges(changes, current)
                if (changes.some((change) => change.type === 'remove')) {
                  persist(fromFlow(nodesRef.current, next, viewportRef.current), true)
                }
                return next
              })
            }}
            onConnect={(connection: Connection) => {
              setEdges((current) => {
                const next = addEdge({ ...connection, id: crypto.randomUUID() }, current)
                persist(fromFlow(nodesRef.current, next, viewportRef.current), true)
                return next
              })
            }}
            onMoveEnd={(_, nextViewport) => {
              setViewport(nextViewport)
              persist(fromFlow(nodesRef.current, edgesRef.current, nextViewport), false)
            }}
          />
        </div>
      </div>
    </CanvasActionContext.Provider>
  )
}
