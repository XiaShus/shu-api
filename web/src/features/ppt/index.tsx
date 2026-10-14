import { useQuery } from '@tanstack/react-query'
import { Presentation, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getUserModels, sendChatCompletion } from '@/features/playground/api'
import { cn } from '@/lib/utils'

type Detail = 'brief' | 'standard' | 'detailed' | 'deep'

type SlideRecord = {
  id: string
  title: string
  pages: number
  detail: Detail
  outline: string
  createdAt: number
}

const DETAILS: Array<[Detail, string, string]> = [
  ['brief', 'Concise', 'Key points'],
  ['standard', 'Standard', 'Balanced'],
  ['detailed', 'Detailed', 'More evidence'],
  ['deep', 'In depth', 'Full research'],
]

export function SlideWorkbench() {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [detail, setDetail] = useState<Detail>('standard')
  const [pages, setPages] = useState(8)
  const [webSearch, setWebSearch] = useState(false)
  const [draw, setDraw] = useState(false)
  const [textModel, setTextModel] = useState('')
  const [imageModel, setImageModel] = useState('')
  const [fileName, setFileName] = useState('')
  const [records, setRecords] = useState<SlideRecord[]>([])
  const [keyword, setKeyword] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [polishing, setPolishing] = useState(false)
  const [error, setError] = useState('')
  const models = useQuery({ queryKey: ['ppt-models'], queryFn: () => getUserModels('') })
  const allModels = models.data ?? []
  const textModels = allModels.filter((item) => !/image|video/i.test(item.value))
  const imageModels = allModels.filter((item) => /image/i.test(item.value))
  const textValue = textModel || textModels[0]?.value || allModels[0]?.value || ''
  const imageValue = imageModel || imageModels[0]?.value || ''
  const detailLabel = DETAILS.find(([id]) => id === detail)
  const visible = records.filter((item) => item.title.toLowerCase().includes(keyword.trim().toLowerCase()))
  const active = records.find((item) => item.id === activeId) ?? visible[0]

  const polish = async () => {
    if (!description.trim() || !textValue || polishing) return
    setPolishing(true)
    setError('')
    try {
      const response = await sendChatCompletion({
        model: textValue,
        stream: false,
        messages: [
          {
            role: 'user',
            content: `Rewrite this presentation brief so it is clearer. Keep the language. Return only the rewritten brief.\n${description}`,
          },
        ],
      })
      setDescription(response.choices?.[0]?.message?.content?.trim() || description)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Request failed'))
    } finally {
      setPolishing(false)
    }
  }

  const generate = async () => {
    if (!title.trim() || !textValue || busy) return
    setBusy(true)
    setError('')
    try {
      const response = await sendChatCompletion({
        model: textValue,
        stream: false,
        messages: [
          {
            role: 'user',
            content: [
              'Write a presentation outline in the user language.',
              `Title: ${title}`,
              `Brief: ${description || 'none'}`,
              `Pages: ${pages}`,
              `Detail: ${detail}`,
              `Use recent public information: ${webSearch ? 'yes' : 'no'}`,
              `Attached file: ${fileName || 'none'}`,
              'Number every slide. Each slide has a title and three bullets.',
            ].join('\n'),
          },
        ],
      })
      const outline = response.choices?.[0]?.message?.content || ''
      const record: SlideRecord = {
        id: `${Date.now()}`,
        title: title.trim(),
        pages,
        detail,
        outline,
        createdAt: Date.now(),
      }
      setRecords((current) => [record, ...current])
      setActiveId(record.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Request failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='flex h-full min-h-0'>
      <aside className='flex w-[340px] shrink-0 flex-col border-r'>
        <div className='flex items-center justify-between px-4 py-3'>
          <p className='text-sm font-medium'>{t('Generation settings')}</p>
          <span className='text-muted-foreground text-xs'>PPTX</span>
        </div>
        <div className='min-h-0 flex-1 space-y-4 overflow-auto px-4 pb-4'>
          <section>
            <p className='text-muted-foreground mb-2 text-xs'>01 {t('Slide title')}</p>
            <input
              className='border-border h-10 w-full rounded-lg border px-3 text-sm'
              placeholder={t('For example: 2026 product growth strategy')}
              aria-label={t('Slide title')}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </section>
          <section>
            <div className='mb-2 flex items-center justify-between'>
              <p className='text-muted-foreground text-xs'>02 {t('Slide description')}</p>
              <button type='button' className='text-xs disabled:opacity-40' disabled={!description.trim() || polishing} onClick={() => void polish()}>
                <Sparkles className='mr-1 inline size-3' />
                {polishing ? t('Loading...') : t('AI polish')}
              </button>
            </div>
            <textarea
              className='border-border min-h-24 w-full rounded-xl border px-3 py-2 text-sm'
              placeholder={t('Add the audience, tone, key points, or sources')}
              aria-label={t('Slide description')}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </section>
          <section>
            <p className='text-muted-foreground mb-2 text-xs'>03 {t('Detail level')}</p>
            <div className='grid grid-cols-2 gap-2'>
              {DETAILS.map(([id, name, hint]) => (
                <button
                  key={id}
                  type='button'
                  aria-pressed={detail === id}
                  className={cn('rounded-xl border px-3 py-2 text-left', detail === id ? 'border-foreground bg-muted' : 'border-border')}
                  onClick={() => setDetail(id)}
                >
                  <span className='block text-sm'>{t(name)}</span>
                  <span className='text-muted-foreground text-xs'>{t(hint)}</span>
                </button>
              ))}
            </div>
          </section>
          <section>
            <p className='text-muted-foreground mb-2 text-xs'>04 {t('Page count setting')}</p>
            <div className='border-border flex h-10 items-center rounded-lg border px-3'>
              <input
                className='w-full bg-transparent text-sm outline-none'
                type='number'
                min={1}
                max={30}
                aria-label={t('Page count, 1 to 30')}
                value={pages}
                onChange={(event) => setPages(Math.min(30, Math.max(1, Number(event.target.value) || 1)))}
              />
              <span className='text-muted-foreground text-sm'>{t('pages')}</span>
            </div>
            <p className='text-muted-foreground mt-1 text-xs'>{t('Enter 1 to 30 pages')}</p>
          </section>
          <ToggleRow
            index='05'
            label={t('Web search')}
            hint={t('Include recent information and public sources.')}
            checked={webSearch}
            onChange={setWebSearch}
          />
          <ToggleRow
            index='06'
            label={t('AI drawing')}
            hint={t('Turning this on spends extra image quota.')}
            checked={draw}
            onChange={setDraw}
          />
          <section>
            <p className='text-muted-foreground mb-2 text-xs'>07 {t('Generation model')}</p>
            <select className='border-border mb-2 h-10 w-full rounded-lg border px-2 text-sm' aria-label={t('Text model')} value={textValue} onChange={(event) => setTextModel(event.target.value)}>
              <option value=''>{t('Text model, default')}</option>
              {(textModels.length > 0 ? textModels : allModels).map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select className='border-border h-10 w-full rounded-lg border px-2 text-sm' aria-label={t('Image model')} value={imageValue} disabled={!draw} onChange={(event) => setImageModel(event.target.value)}>
              <option value=''>{t('Image model, default')}</option>
              {imageModels.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </section>
          <button type='button' className='border-border text-muted-foreground w-full rounded-xl border border-dashed px-3 py-4 text-xs' onClick={() => fileRef.current?.click()}>
            {fileName || t('Drop or click to upload PPTX, TXT, Word, Excel, or images')}
          </button>
          <input
            ref={fileRef}
            type='file'
            className='hidden'
            accept='.pptx,.txt,.doc,.docx,.xls,.xlsx,image/*'
            onChange={(event) => setFileName(event.target.files?.[0]?.name || '')}
          />
          <div className='border-border text-muted-foreground flex items-center justify-between rounded-xl border px-3 py-3 text-xs'>
            <span>{t('No template available')}</span>
            <span>PPTX</span>
          </div>
        </div>
        <div className='border-t px-4 py-3'>
          <p className='text-muted-foreground mb-2 text-xs'>
            {t('No template selected')} · {pages} {t('pages')} · {detailLabel ? t(detailLabel[1]) : ''}
            {draw && imageValue ? ` · ${imageValue}` : ''}
          </p>
          <Button className='w-full rounded-lg' type='button' disabled={busy || !title.trim() || !textValue} onClick={() => void generate()}>
            <Sparkles className='size-4' />
            {busy ? t('Loading...') : t('Generate outline')}
          </Button>
          {error ? <p className='text-destructive mt-2 text-xs'>{error}</p> : null}
        </div>
      </aside>
      <section className='flex min-w-0 flex-1 flex-col'>
        <div className='p-4'>
          <input
            className='border-border h-10 w-full rounded-full border px-4 text-sm'
            placeholder={t('Search history')}
            aria-label={t('Search history')}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        {visible.length === 0 ? (
          <div className='text-muted-foreground flex flex-1 flex-col items-center justify-center px-6 text-center'>
            <Presentation className='mb-3 size-8' />
            <h2 className='text-foreground text-lg font-semibold'>{t('No generation records yet')}</h2>
            <p className='mt-2 max-w-sm text-sm'>{t('Open the settings on the left, fill in the topic, and generate the first deck.')}</p>
          </div>
        ) : (
          <div className='grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)]'>
            <ul className='overflow-auto border-r p-3'>
              {visible.map((item) => (
                <li key={item.id}>
                  <button
                    type='button'
                    className={cn('w-full rounded-lg px-3 py-2 text-left text-sm', item.id === active?.id ? 'bg-muted' : 'hover:bg-muted')}
                    onClick={() => setActiveId(item.id)}
                  >
                    <span className='block truncate font-medium'>{item.title}</span>
                    <span className='text-muted-foreground text-xs'>
                      {item.pages} {t('pages')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <pre className='overflow-auto p-6 text-sm leading-7 whitespace-pre-wrap'>{active?.outline}</pre>
          </div>
        )}
      </section>
    </div>
  )
}

function ToggleRow(props: { index: string; label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <section className='flex items-start justify-between gap-3'>
      <div>
        <p className='text-sm'>
          <span className='text-muted-foreground mr-2 text-xs'>{props.index}</span>
          {props.label}
        </p>
        <p className='text-muted-foreground mt-1 text-xs'>{props.hint}</p>
      </div>
      <button
        type='button'
        role='switch'
        aria-checked={props.checked}
        aria-label={props.label}
        className={cn('mt-1 h-6 w-10 rounded-full p-0.5', props.checked ? 'bg-foreground' : 'bg-muted')}
        onClick={() => props.onChange(!props.checked)}
      >
        <span className={cn('bg-background block size-5 rounded-full transition', props.checked && 'translate-x-4')} />
      </button>
    </section>
  )
}
