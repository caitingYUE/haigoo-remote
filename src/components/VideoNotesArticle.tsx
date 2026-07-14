import type { CorporateEnglishVideoNoteBlock } from '../services/corporate-english-service'

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return <>{parts.map((part, index) => part.startsWith('**') && part.endsWith('**')
    ? <strong key={`${part}-${index}`} className="font-black text-slate-900">{part.slice(2, -2)}</strong>
    : part)}</>
}

function ParagraphText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="break-words text-base leading-8 text-slate-700">
      {lines.map((line, index) => line.trim() === '---'
        ? <hr key={`rule-${index}`} className="my-3 border-0 border-t border-[#dbe8f4]" />
        : <span key={`line-${index}`}><InlineText text={line} />{index < lines.length - 1 ? <br /> : null}</span>)}
    </div>
  )
}

function VideoNoteBlock({ block }: { block: CorporateEnglishVideoNoteBlock }) {
  if (block.text?.trim() === '---') return <hr className="my-3 border-0 border-t border-[#dbe8f4]" />
  if (block.type === 'heading_1') return <h2 className="pt-3 text-2xl font-black leading-tight text-slate-950 md:text-3xl"><InlineText text={block.text || ''} /></h2>
  if (block.type === 'heading_2') return <h3 className="pt-2 text-lg font-black leading-7 text-slate-900 md:text-xl"><InlineText text={block.text || ''} /></h3>
  if (block.type === 'quote') return <blockquote className="rounded-r-xl border-l-4 border-[#cfc5ff] bg-[#f8f6ff] px-4 py-3 text-base font-semibold leading-8 text-slate-700"><InlineText text={block.text || ''} /></blockquote>
  if (block.type === 'bullet_list' || block.type === 'numbered_list') {
    const List = block.type === 'numbered_list' ? 'ol' : 'ul'
    return (
      <List className={`${block.type === 'numbered_list' ? 'list-decimal' : 'list-disc'} space-y-2 pl-6 text-base leading-8 text-slate-700`}>
        {(block.items || []).map((item, index) => <li key={`${block.id}-${index}`} className="pl-1"><InlineText text={item} /></li>)}
      </List>
    )
  }
  return <ParagraphText text={block.text || ''} />
}

export function VideoNotesArticle({ notes, emptyMessage = '该课程的视频笔记正在整理中。' }: { notes: CorporateEnglishVideoNoteBlock[]; emptyMessage?: string }) {
  if (!notes.length) {
    return <div className="rounded-2xl border border-dashed border-[#dbe8f4] px-5 py-10 text-center text-sm font-semibold leading-6 text-slate-500">{emptyMessage}</div>
  }
  return (
    <article className="space-y-5">
      {notes.map((block) => <VideoNoteBlock key={block.id} block={block} />)}
    </article>
  )
}
