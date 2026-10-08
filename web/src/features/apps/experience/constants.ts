export const EXPERIENCE_MODES = ['chat', 'image', 'video', 'audio'] as const

export type ExperienceMode = (typeof EXPERIENCE_MODES)[number]

export const API_ENDPOINTS = {
  IMAGE_GENERATIONS: '/pg/images/generations',
  VIDEOS: '/pg/videos',
  AUDIO_SPEECH: '/pg/audio/speech',
} as const

export const IMAGE_ASPECTS = ['1:1', '16:9', '9:16', '4:3', '3:4'] as const

export type ImageAspect = (typeof IMAGE_ASPECTS)[number]

export const IMAGE_ASPECT_SIZE: Record<ImageAspect, string> = {
  '1:1': '1024x1024',
  '16:9': '1792x1024',
  '9:16': '1024x1792',
  '4:3': '1024x768',
  '3:4': '768x1024',
}
