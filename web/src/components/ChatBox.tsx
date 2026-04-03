import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { LoadingOverlay } from './LoadingOverlay'
import { Message as MessageBubble } from './Message'
import type { Message } from './Message'

export type ChatBoxProps = {
  messages: Message[]
  /** AI 思考中时为 true，禁用发送避免重复请求 */
  busy?: boolean
  /** 本局已结束 / 已放弃 / 已揭晓时锁定输入 */
  locked?: boolean
  /** 锁定时的输入框提示 */
  lockReason?: string
  /** 用户尝试发送空白内容时（如误点发送） */
  onEmptySubmit?: () => void
  onSendMessage: (content: string) => void
  /** 与「发送」同一行右侧的「提示×n」；未传入时不显示 */
  hintAction?: {
    label: string
    disabled: boolean
    onClick: () => void
  }
}

export function ChatBox({
  messages,
  busy = false,
  locked = false,
  lockReason = '游戏已结束',
  onEmptySubmit,
  onSendMessage,
  hintAction,
}: ChatBoxProps) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({
      top: el.scrollHeight,
      behavior: reduced ? 'instant' : 'smooth',
    })
  }, [messages])

  const submit = () => {
    if (busy || locked) return
    const text = draft.trim()
    if (!text) {
      onEmptySubmit?.()
      return
    }
    onSendMessage(text)
    setDraft('')
  }

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    e.preventDefault()
    submit()
  }

  const canSend = draft.trim().length > 0 && !busy && !locked

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800/90 bg-slate-950/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <div
        ref={listRef}
        className="relative min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden p-4 sm:space-y-4"
        role="log"
        aria-relevant="additions"
        aria-label="对话记录"
      >
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {busy ? 'AI 正在回复，请稍候。' : ''}
        </span>
        {busy ? (
          <LoadingOverlay
            variant="contained"
            label="AI 思考中…"
            className="z-20"
          />
        ) : null}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center sm:py-12">
            <p className="text-sm font-medium text-slate-400">还没有任何提问</p>
            <p className="max-w-[18rem] text-xs leading-relaxed text-slate-500">
              从汤面里抓一个细节，用「是不是 / 有没有」来问，AI 只会回答
              <span className="text-violet-400"> 是 </span>、
              <span className="text-violet-400"> 否 </span>
              或
              <span className="text-violet-400"> 无关 </span>
              。
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <MessageBubble
              key={`${message.role}-${index}-${message.content.slice(0, 24)}`}
              message={message}
              index={index}
            />
          ))
        )}
      </div>

      <form
        onSubmit={onFormSubmit}
        className="flex shrink-0 flex-col gap-2 border-t border-slate-800/90 bg-slate-950/90 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
      >
        <textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy || locked}
          placeholder={
            locked ? lockReason : busy ? '等待 AI 回复…' : '输入你的问题…'
          }
          className="min-h-[96px] min-w-0 w-full resize-none rounded-lg border border-slate-700/90 bg-slate-900/90 px-3 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[72px] sm:py-2.5 sm:text-sm"
          aria-label="聊天输入"
          aria-busy={busy}
        />
        <div className="flex w-full min-w-0 gap-2">
          {hintAction ? (
            <button
              type="button"
              onClick={() => {
                hintAction.onClick()
              }}
              disabled={hintAction.disabled}
              className="active-press min-h-[48px] min-w-0 flex-1 rounded-lg border border-violet-600/50 bg-violet-950/60 px-3 py-3 text-sm font-medium text-violet-100 transition-colors duration-200 hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-40 sm:py-2.5"
            >
              {hintAction.label}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={!canSend}
            className="active-press min-h-[48px] min-w-0 flex-1 rounded-lg border border-violet-600/50 bg-violet-950/60 px-3 py-3 text-sm font-medium text-violet-100 transition-colors duration-200 hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-40 sm:py-2.5"
          >
            {locked ? '已结束' : busy ? '等待中…' : '发送'}
          </button>
        </div>
      </form>
    </div>
  )
}
