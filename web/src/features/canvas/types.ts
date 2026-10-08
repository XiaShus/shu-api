export type CanvasNodeStatus = 'idle' | 'running' | 'done' | 'error'

export type TextNodeData = {
  text: string
  reply: string
  status: CanvasNodeStatus
  error: string
}

export type ImageNodeData = {
  prompt: string
  model: string
  status: CanvasNodeStatus
  url: string
  error: string
}

export type CanvasNode =
  | {
      id: string
      type: 'text'
      position: { x: number; y: number }
      data: TextNodeData
    }
  | {
      id: string
      type: 'image'
      position: { x: number; y: number }
      data: ImageNodeData
    }

export type CanvasEdge = {
  id: string
  source: string
  target: string
}

export type CanvasViewport = {
  x: number
  y: number
  zoom: number
}

export type CanvasDraft = {
  version: 1
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  viewport: CanvasViewport
}

export function emptyCanvasDraft(): CanvasDraft {
  return {
    version: 1,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function statusOf(value: unknown): CanvasNodeStatus {
  if (value === 'running' || value === 'done' || value === 'error' || value === 'idle') {
    return value
  }
  return 'idle'
}

export function normalizeCanvasDraft(value: unknown): CanvasDraft | null {
  if (!isRecord(value) || value.version !== 1) return null
  const nodes: CanvasNode[] = []
  if (Array.isArray(value.nodes)) {
    for (const item of value.nodes) {
      if (!isRecord(item) || typeof item.id !== 'string' || !isRecord(item.position)) continue
      const x = Number(item.position.x)
      const y = Number(item.position.y)
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      const data = isRecord(item.data) ? item.data : {}
      if (item.type === 'text') {
        nodes.push({
          id: item.id,
          type: 'text',
          position: { x, y },
          data: {
            text: typeof data.text === 'string' ? data.text : '',
            reply: typeof data.reply === 'string' ? data.reply : '',
            status: statusOf(data.status),
            error: typeof data.error === 'string' ? data.error : '',
          },
        })
      }
      if (item.type === 'image') {
        nodes.push({
          id: item.id,
          type: 'image',
          position: { x, y },
          data: {
            prompt: typeof data.prompt === 'string' ? data.prompt : '',
            model: typeof data.model === 'string' ? data.model : '',
            status: statusOf(data.status),
            url: typeof data.url === 'string' ? data.url : '',
            error: typeof data.error === 'string' ? data.error : '',
          },
        })
      }
    }
  }
  const edges: CanvasEdge[] = []
  if (Array.isArray(value.edges)) {
    for (const item of value.edges) {
      if (!isRecord(item)) continue
      if (typeof item.id !== 'string' || typeof item.source !== 'string' || typeof item.target !== 'string') {
        continue
      }
      edges.push({ id: item.id, source: item.source, target: item.target })
    }
  }
  const viewport = isRecord(value.viewport) ? value.viewport : {}
  const zoom = Number(viewport.zoom)
  return {
    version: 1,
    nodes,
    edges,
    viewport: {
      x: Number.isFinite(Number(viewport.x)) ? Number(viewport.x) : 0,
      y: Number.isFinite(Number(viewport.y)) ? Number(viewport.y) : 0,
      zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : 1,
    },
  }
}
