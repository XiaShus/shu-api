import type { CanvasNode } from './types'

export const NODE_CATALOG: Array<{ type: CanvasNode['type']; label: string; w: number; h: number }> = [
  { type: 'text', label: 'Text node', w: 280, h: 200 },
  { type: 'image', label: 'Image', w: 300, h: 220 },
  { type: 'video', label: 'Video', w: 320, h: 220 },
  { type: 'audio', label: 'Audio node', w: 260, h: 220 },
  { type: 'drawing', label: 'Drawing node', w: 280, h: 200 },
  { type: 'script', label: 'Storyboard script', w: 420, h: 220 },
  { type: 'skill', label: 'Skill node', w: 280, h: 180 },
  { type: 'config', label: 'Generation config', w: 300, h: 220 },
  { type: 'frame', label: 'Backdrop', w: 360, h: 220 },
  { type: 'markdown', label: 'Markdown node', w: 300, h: 200 },
  { type: 'svg', label: 'SVG node', w: 300, h: 200 },
  { type: 'html', label: 'HTML node', w: 320, h: 220 },
  { type: 'panorama', label: 'Panorama node', w: 320, h: 200 },
  { type: 'compare', label: 'Compare node', w: 320, h: 200 },
  { type: 'chart', label: 'Chart node', w: 300, h: 200 },
  { type: 'colorgrade', label: 'Color grade', w: 280, h: 200 },
  { type: 'media-conversion', label: 'Media conversion', w: 300, h: 220 },
  { type: 'batch-table', label: 'Batch table', w: 460, h: 240 },
  { type: 'director', label: 'Director desk', w: 340, h: 280 },
]

export function nodeSize(type: CanvasNode['type']) {
  const found = NODE_CATALOG.find((item) => item.type === type)
  return { w: found?.w ?? 280, h: found?.h ?? 180 }
}

export function nodeLabel(type: CanvasNode['type']) {
  return NODE_CATALOG.find((item) => item.type === type)?.label ?? 'Text node'
}

export type GenerationKind = 'text' | 'image' | 'video' | 'audio'

export function generationKind(type: CanvasNode['type']): GenerationKind {
  if (type === 'image' || type === 'drawing' || type === 'panorama' || type === 'compare' || type === 'colorgrade') {
    return 'image'
  }
  if (type === 'video' || type === 'media-conversion') return 'video'
  if (type === 'audio') return 'audio'
  return 'text'
}
