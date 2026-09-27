const CHUNK_RELOAD_STORAGE_KEY = 'newapi:chunk-reload'

// chunkLoadRequestURL returns the script URL from an rspack/webpack chunk
// failure. Other render errors stay on the error page.
export function chunkLoadRequestURL(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const record = error as {
    name?: unknown
    message?: unknown
    request?: unknown
  }
  const name = typeof record.name === 'string' ? record.name : ''
  const message = typeof record.message === 'string' ? record.message : ''
  if (name !== 'ChunkLoadError' && !message.includes('Loading chunk')) {
    return undefined
  }
  if (
    typeof record.request === 'string' &&
    /^https?:\/\//.test(record.request)
  ) {
    return record.request
  }
  const matched = message.match(/\(error:\s*(https?:\/\/[^\s)]+)\)/)
  return matched?.[1]
}

// claimChunkReload allows one automatic reload per failed chunk URL.
export function claimChunkReload(url: string): boolean {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) === url) return false
    sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, url)
    return true
  } catch {
    return false
  }
}
