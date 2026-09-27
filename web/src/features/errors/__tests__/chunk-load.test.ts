import { afterEach, describe, expect, it } from 'vitest'

import { chunkLoadRequestURL, claimChunkReload } from '../chunk-load'

describe('chunkLoadRequestURL', () => {
  it('reads the script URL from an rspack ChunkLoadError message', () => {
    const error = new Error(
      'Loading chunk 15676 failed.\n(error: https://new.echoa.cn/static/js/async/15676.e709b55f8a.js)'
    )
    error.name = 'ChunkLoadError'

    expect(chunkLoadRequestURL(error)).toBe(
      'https://new.echoa.cn/static/js/async/15676.e709b55f8a.js'
    )
  })

  it('prefers the request field when the runtime provides it', () => {
    const error = Object.assign(new Error('Loading chunk 1 failed.'), {
      name: 'ChunkLoadError',
      request: 'https://example.com/static/js/async/1.js',
    })

    expect(chunkLoadRequestURL(error)).toBe(
      'https://example.com/static/js/async/1.js'
    )
  })

  it('ignores ordinary render errors', () => {
    expect(chunkLoadRequestURL(new Error('Rendered more hooks'))).toBeUndefined()
    expect(chunkLoadRequestURL(null)).toBeUndefined()
  })
})

describe('claimChunkReload', () => {
  afterEach(() => {
    sessionStorage.clear()
  })

  it('allows one reload for a chunk URL and rejects the same URL afterwards', () => {
    const url = 'https://example.com/static/js/async/15676.js'

    expect(claimChunkReload(url)).toBe(true)
    expect(claimChunkReload(url)).toBe(false)
    expect(
      claimChunkReload('https://example.com/static/js/async/other.js')
    ).toBe(true)
  })
})
