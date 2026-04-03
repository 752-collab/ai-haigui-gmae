export type Message = {
  role: 'user' | 'ai'
  content: string
  proximityFeedback?: string
}

export type MessageProps = {
  message: Message
  /** 用于错开气泡入场动画 */
  index?: number
}

function UserIcon() {
  return (
    <svg
      className="h-8 w-8 text-violet-300"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6 19c0-3.3 2.7-6 6-6s6 2.7 6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

const CACHED_PROXIMITY_PATTERN =
  /^(是|否|无关)\n(你已经接近真相了|方向对了，但还差关键点)$/

const STAGE_HINT_PATTERN = /^【阶段提示·(6|10|15)】\n([\s\S]*)$/

const MANUAL_HINT_PATTERN = /^【手动提示·(6|10|15)】\n([\s\S]*)$/

function StageHintIcon() {
  return (
    <svg
      className="h-8 w-8 text-sky-300"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 3v1M12 20v1M4.22 4.22l.7.7M18.36 18.36l.71.71M3 12h1M20 12h1M4.22 19.78l.7-.71M18.36 5.64l.71-.71"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M9 16h6l-1 4H10l-1-4z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M10 16c-1.5-1.2-2.5-3-2.5-5a4.5 4.5 0 019 0c0 2-1 3.8-2.5 5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AiIcon() {
  return (
    <svg
      className="h-8 w-8 text-indigo-300"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 4l1.2 3.2L16.5 8l-3.3 1.2L12 12l-1.2-3.8L7.5 8l3.3-.8L12 4z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <rect
        x="5"
        y="14"
        width="14"
        height="6"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="9" cy="17" r="0.9" fill="currentColor" />
      <circle cx="15" cy="17" r="0.9" fill="currentColor" />
    </svg>
  )
}

export function Message({ message, index = 0 }: MessageProps) {
  const isUser = message.role === 'user'
  let stageHintMatch: RegExpMatchArray | null = null
  if (!isUser && !message.proximityFeedback) {
    const sm = message.content.match(STAGE_HINT_PATTERN)
    if (
      sm &&
      (sm[1] === '6' || sm[1] === '10' || sm[1] === '15')
    ) {
      stageHintMatch = sm
    }
  }
  let manualHintMatch: RegExpMatchArray | null = null
  if (!isUser && !message.proximityFeedback && !stageHintMatch) {
    const hm = message.content.match(MANUAL_HINT_PATTERN)
    if (
      hm &&
      (hm[1] === '6' || hm[1] === '10' || hm[1] === '15')
    ) {
      manualHintMatch = hm
    }
  }
  let cachedProximity: RegExpMatchArray | null = null
  if (!isUser && !message.proximityFeedback && !stageHintMatch && !manualHintMatch) {
    const m = message.content.match(CACHED_PROXIMITY_PATTERN)
    if (
      m &&
      (m[1] === '是' || m[1] === '否' || m[1] === '无关') &&
      (m[2] === '你已经接近真相了' || m[2] === '方向对了，但还差关键点')
    ) {
      cachedProximity = m
    }
  }

  const isStageHint = Boolean(stageHintMatch || manualHintMatch)

  return (
    <div
      className={`animate-bubble-in flex w-full min-w-0 gap-2 sm:gap-3 ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
          isUser
            ? 'border-violet-500/40 bg-violet-950/50'
            : isStageHint
              ? 'border-sky-400/45 bg-sky-950/70'
              : 'border-indigo-500/35 bg-slate-900/80'
        }`}
        aria-hidden
      >
        {isUser ? <UserIcon /> : isStageHint ? <StageHintIcon /> : <AiIcon />}
      </div>
      <div
        className={`min-w-0 max-w-[min(100%,28rem)] rounded-2xl border px-4 py-2.5 shadow-sm transition-shadow duration-300 ${
          isUser
            ? 'rounded-tr-md border-violet-500/35 bg-violet-950/45 text-slate-100'
            : isStageHint
              ? 'rounded-tl-md border-sky-500/45 bg-sky-950/55 text-sky-100'
              : 'rounded-tl-md border-slate-700/90 bg-slate-900/90 text-slate-200'
        }`}
      >
        {isStageHint && (stageHintMatch || manualHintMatch) ? (
          <p className="break-words text-sm leading-relaxed text-sky-100/95 whitespace-pre-wrap">
            {(stageHintMatch || manualHintMatch)![2]}
          </p>
        ) : !isUser && message.proximityFeedback ? (
          <div className="space-y-1.5">
            <p className="break-words text-sm font-medium leading-relaxed text-slate-100">
              {message.content}
            </p>
            <p className="break-words text-xs leading-relaxed text-slate-400">
              {message.proximityFeedback}
            </p>
          </div>
        ) : cachedProximity ? (
          <div className="space-y-1.5">
            <p className="break-words text-sm font-medium leading-relaxed text-slate-100">
              {cachedProximity[1]}
            </p>
            <p className="break-words text-xs leading-relaxed text-slate-400">
              {cachedProximity[2]}
            </p>
          </div>
        ) : (
          <p className="break-words text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        )}
      </div>
    </div>
  )
}
