import type { MjMode } from './types'

export const SLASH_COMMANDS = [
  {
    name: 'imagine',
    hint: 'prompt',
    description: 'Create an image from a prompt',
  },
  {
    name: 'blend',
    hint: 'images',
    description: 'Blend two to five images',
  },
  {
    name: 'describe',
    hint: 'image',
    description: 'Write a prompt from an image',
  },
  {
    name: 'fast',
    hint: '',
    description: 'Use fast mode',
  },
  {
    name: 'relax',
    hint: '',
    description: 'Use relax mode',
  },
  {
    name: 'turbo',
    hint: '',
    description: 'Use turbo mode',
  },
  {
    name: 'draft',
    hint: '',
    description: 'Use draft mode',
  },
  {
    name: 'settings',
    hint: '',
    description: 'Open drawing settings',
  },
  {
    name: 'info',
    hint: '',
    description: 'Show remaining quota',
  },
  {
    name: 'personalize',
    hint: '',
    description: 'Personalize',
  },
] as const

export type SlashCommandName = (typeof SLASH_COMMANDS)[number]['name']

const PANEL_COMMANDS = new Set<SlashCommandName>(['imagine', 'blend', 'describe', 'personalize'])

export function opensCommandPanel(
  name: string
): name is 'imagine' | 'blend' | 'describe' | 'personalize' {
  return PANEL_COMMANDS.has(name as SlashCommandName)
}

export function parseSlash(input: string): {
  name: string
  rest: string
} | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null
  const body = trimmed.slice(1)
  const space = body.search(/\s/)
  if (space === -1) return { name: body.toLowerCase(), rest: '' }
  return {
    name: body.slice(0, space).toLowerCase(),
    rest: body.slice(space + 1).trim(),
  }
}

export function applyPromptSettings(
  prompt: string,
  version: string,
  aspect: string,
  stylize: string,
  profileId: string
): string {
  let next = prompt.trim()
  if (version && !/(?:^|\s)--(?:v|niji)\s/i.test(next)) {
    next = `${next} ${version}`
  }
  if (aspect && !/(?:^|\s)--ar\s/i.test(next)) {
    next = `${next} --ar ${aspect}`
  }
  if (stylize && !/(?:^|\s)--s\s/i.test(next)) {
    next = `${next} --s ${stylize}`
  }
  if (profileId && !/(?:^|\s)--p\s/i.test(next)) {
    next = `${next} --p ${profileId}`
  }
  return next.replace(/\s+/g, ' ').trim()
}

export function accountModes(mode: MjMode): string[] | undefined {
  if (mode === '' || mode === 'draft') return undefined
  return [mode.toUpperCase()]
}
