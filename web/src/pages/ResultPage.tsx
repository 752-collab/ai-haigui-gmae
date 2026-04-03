import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { LoadingOverlay } from '../components/LoadingOverlay'
import {
  clearGameSession,
  loadGameSession,
  messagesToChatHistory,
} from '../lib/gameSessionStorage'
import { pickRandomStory, stories } from '../data/stories'

const THINKING_TEXT = '思考中...'

export type ResultLocationState = {
  storyTitle: string
  soupContent: string
  chatHistory: { question: string; answer: string }[]
}

export function ResultPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const [booting, setBooting] = useState(true)

  useEffect(() => {
    const t = window.setTimeout(() => setBooting(false), 160)
    return () => clearTimeout(t)
  }, [id])

  const fromNav = location.state as ResultLocationState | null

  const story = useMemo(
    () => (id ? stories.find((s) => s.id === id) : undefined),
    [id],
  )

  const sessionFallback = useMemo(() => {
    if (!id) return null
    return loadGameSession(id)
  }, [id])

  const storyTitle = fromNav?.storyTitle ?? story?.title ?? '未知故事'
  const soupContent =
    fromNav?.soupContent?.trim() ||
    sessionFallback?.boundSoupBottom?.trim() ||
    story?.bottom ||
    ''
  const chatHistory =
    fromNav?.chatHistory ??
    (sessionFallback
      ? messagesToChatHistory(sessionFallback.messages, THINKING_TEXT)
      : [])

  const emptySoup = !soupContent.trim()
  const invalidId = Boolean(id && !story && !fromNav?.soupContent && !sessionFallback)

  if (booting) {
    return (
      <div className="relative min-h-[100dvh] overflow-x-hidden bg-gradient-to-b from-slate-950/92 to-slate-900/92">
        <LoadingOverlay variant="fullscreen" label="载入汤底页…" />
      </div>
    )
  }

  return (
    <div className="animate-page-fade-in relative min-h-[100dvh] overflow-x-hidden bg-gradient-to-b from-slate-950/92 via-slate-950/88 to-slate-900/92 px-4 pb-36 pt-8 text-slate-100 sm:px-6 sm:pb-32 sm:pt-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 text-center sm:mb-10">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-violet-400/80">
            汤底揭晓
          </p>
          <h1 className="bg-gradient-to-r from-violet-200 via-violet-300 to-indigo-300 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl">
            汤底揭晓
          </h1>
          <p className="mt-4 break-words text-left text-sm text-slate-400 sm:text-base">
            <span className="text-slate-500">故事：</span>
            <span className="font-medium text-slate-200">{storyTitle}</span>
          </p>
        </header>

        {invalidId ? (
          <p className="mb-6 rounded-xl border border-rose-500/30 bg-rose-950/35 px-4 py-3 text-center text-sm text-rose-100">
            无法还原本局数据，请从大厅重新选择故事进入。
          </p>
        ) : null}

        <section
          className="mb-8 rounded-2xl border border-violet-500/25 bg-slate-900/70 p-5 shadow-[0_0_48px_-12px_rgba(109,40,217,0.35)] backdrop-blur-sm sm:p-8"
          aria-labelledby="soup-heading"
        >
          <h2
            id="soup-heading"
            className="mb-4 text-center text-lg font-semibold text-rose-300/95 sm:text-left"
          >
            汤底
          </h2>
          {emptySoup ? (
            <div className="rounded-xl border border-dashed border-slate-700/80 bg-slate-900/50 px-4 py-8 text-center">
              <p className="text-sm text-slate-400">
                这里没有可展示的汤底。
              </p>
              <p className="mt-2 text-xs text-slate-500">
                请从对局页点击「查看汤底」进入，或确认链接中的故事 ID 是否正确。
              </p>
            </div>
          ) : (
            <div className="animate-soup-reveal rounded-xl border border-violet-400/25 bg-violet-950/25 px-4 py-4 text-left text-base font-medium leading-relaxed text-violet-50 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.12)] sm:text-lg">
              <p className="break-words">{soupContent}</p>
            </div>
          )}
        </section>

        <section
          className="mb-8 rounded-2xl border border-slate-800/90 bg-slate-950/60 p-5 sm:p-6"
          aria-labelledby="history-heading"
        >
          <h3
            id="history-heading"
            className="mb-4 text-base font-semibold text-slate-200"
          >
            你的推理记录
          </h3>
          {chatHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700/80 bg-slate-900/40 px-4 py-8 text-center">
              <p className="text-sm text-slate-400">本局还没有形成有效问答</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                若你直接打开本页，历史可能未同步；可从大厅重新开一局再试。
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {chatHistory.map((item, index) => (
                <li
                  key={`${index}-${item.question.slice(0, 12)}`}
                  className="animate-history-item border-b border-slate-800/90 pb-4 last:border-b-0 last:pb-0"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <p className="break-words text-sm text-violet-200/95">
                    <span className="font-medium text-violet-400/90">问：</span>
                    {item.question}
                  </p>
                  <p className="mt-1.5 break-words text-sm text-slate-300">
                    <span className="font-medium text-slate-500">答：</span>
                    {item.answer}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/"
            className="active-press order-2 inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-600/70 bg-slate-900/80 px-4 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800/80 sm:order-1 sm:min-w-[10rem]"
          >
            返回大厅
          </Link>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          if (!id) {
            navigate('/', { replace: true })
            return
          }
          clearGameSession(id)
          const next = pickRandomStory(id)
          clearGameSession(next.id)
          navigate(`/game/${next.id}`, {
            replace: true,
            state: { fromLobby: true },
          })
        }}
        className="active-press fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-20 flex min-h-[52px] w-[min(90%,20rem)] -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-r from-rose-600 to-rose-500 px-6 text-sm font-semibold text-white shadow-[0_8px_32px_-8px_rgba(225,29,72,0.55)] transition hover:from-rose-500 hover:to-rose-400 active:scale-[0.98] sm:min-h-14 sm:text-base"
      >
        再来一局
      </button>
    </div>
  )
}
