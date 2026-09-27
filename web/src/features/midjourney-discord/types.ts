export type MjMode = '' | 'fast' | 'relax' | 'turbo' | 'draft'

export type MjBot = 'MID_JOURNEY' | 'NIJI_JOURNEY'

export type DrawSettings = {
  bot: MjBot
  version: string
  aspect: string
  stylize: string
  remix: boolean
  profileId: string
}

export type DrawChannel = {
  id: string
  name: string
}

export type MjButton = {
  customId: string
  label: string
}

export type MjTask = {
  id: string
  action: string
  prompt: string
  status: string
  progress: string
  imageUrl: string
  videoUrl: string
  failReason: string
  buttons: MjButton[]
  imageUrls: string[]
  state: string
  submitTime: number
  mode: string
}

export type LocalNote = {
  id: string
  channelId: string
  role: 'user' | 'bot' | 'error'
  text: string
  createdAt: number
}
