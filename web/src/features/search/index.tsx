import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { sendChatCompletion, getUserModels } from '@/features/playground/api'
import { useQuery } from '@tanstack/react-query'

const EXAMPLES = [
  'Compare vector databases for production',
  'List common MCP tools and their risks',
  'Compare React Markdown editors',
  'Compare AI coding assistants',
]

export function SearchWorkbench() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('basic')
  const [imageSearch, setImageSearch] = useState(false)
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const models = useQuery({
    queryKey: ['search-models'],
    queryFn: () => getUserModels(''),
  })

  const run = async (text: string) => {
    const question = text.trim()
    const model = models.data?.[0]?.value
    if (!question || !model || busy) return
    setQuery(question)
    setBusy(true)
    setError('')
    try {
      const response = await sendChatCompletion({
        model,
        stream: false,
        messages: [
          {
            role: 'user',
            content: imageSearch
              ? `Search-style answer. Also suggest image queries.\n${question}`
              : `Answer like a web research brief. Mode: ${mode}.\n${question}`,
          },
        ],
      })
      setAnswer(response.choices?.[0]?.message?.content || t('Request failed'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Request failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='mx-auto flex h-full w-full max-w-3xl flex-col items-center px-6 py-16'>
      <h1 className='text-center text-3xl font-semibold'>{t('What do you want to know today?')}</h1>
      <form
        className='border-border mt-8 w-full rounded-3xl border p-4 shadow-sm'
        onSubmit={(event) => {
          event.preventDefault()
          void run(query)
        }}
      >
        <textarea
          className='min-h-16 w-full resize-none bg-transparent text-sm outline-none'
          placeholder={t('Ask a question')}
          aria-label={t('Ask a question')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className='mt-2 flex items-center gap-2'>
          <select className='border-border h-8 rounded-full border px-2 text-xs' aria-label={t('Search mode')} value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value='basic'>{t('Basic search')}</option>
            <option value='deep'>{t('Deep search')}</option>
          </select>
          <button type='button' className={imageSearch ? 'bg-foreground text-background rounded-full px-3 py-1 text-xs' : 'border-border rounded-full border px-3 py-1 text-xs'} onClick={() => setImageSearch((value) => !value)}>
            {t('Image search')}
          </button>
          <Button className='ml-auto rounded-full' type='submit' disabled={busy || !query.trim()}>
            {busy ? t('Loading...') : t('Search')}
          </Button>
        </div>
      </form>
      <div className='mt-6 flex flex-wrap justify-center gap-2'>
        {EXAMPLES.map((item) => (
          <button key={item} type='button' className='border-border hover:bg-muted rounded-full border px-3 py-1.5 text-xs' onClick={() => void run(t(item))}>
            {t(item)}
          </button>
        ))}
      </div>
      {error ? <p className='text-destructive mt-6 text-sm'>{error}</p> : null}
      {answer ? <article className='mt-8 w-full text-sm leading-7 whitespace-pre-wrap'>{answer}</article> : null}
    </div>
  )
}
