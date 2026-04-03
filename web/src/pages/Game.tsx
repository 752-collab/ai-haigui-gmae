import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  CHAT_JUDGE_FALLBACK_HINT,
  requestHint,
  sendGameQuestion,
} from '../api'
import { ChatBox } from '../components/ChatBox'
import { LoadingOverlay } from '../components/LoadingOverlay'
import type { Message } from '../components/Message'
import { getChatErrorCopy } from '../lib/chatErrors'
import {
  clearGameSession,
  loadGameSession,
  messagesToChatHistory,
  normalizeQuestionKey,
  saveGameSession,
} from '../lib/gameSessionStorage'
import { pickRandomStory, stories, type TurtleStory } from '../data/stories'
import type { GameSessionStatus } from '../types/game'
import type { ResultLocationState } from './ResultPage'

const THINKING_TEXT = '思考中...'
const AI_ERROR_TEXT = 'AI回复出错了，请稍后再试'

/** 与 backend/app.js 中 ABUSIVE_SNIPPETS 保持一致：辱骂句不走 answerCache，避免旧「无关」缓存挡住 moderationNotice。 */
const ABUSIVE_SNIPPETS_FOR_CACHE = [
  '傻逼',
  '傻b',
  '白痴',
  '弱智',
  '去死',
  '操你',
  '草你',
  '操你妈',
  '草你妈',
  'nmsl',
  '尼玛币',
]

function containsAbusiveLanguageForCacheBypass(text: string): boolean {
  const raw = String(text || '')
  if (!raw.trim()) return false
  for (let i = 0; i < ABUSIVE_SNIPPETS_FOR_CACHE.length; i++) {
    if (raw.includes(ABUSIVE_SNIPPETS_FOR_CACHE[i])) return true
  }
  return false
}

function countCompletedJudgeTurns(
  msgs: Message[],
  thinkingText: string,
): number {
  let n = 0
  for (let i = 0; i < msgs.length; i++) {
    if (msgs[i].role !== 'user') continue
    const next = msgs[i + 1]
    if (!next || next.role !== 'ai') continue
    if (next.content === thinkingText) continue
    if (next.content.startsWith('【阶段提示')) continue
    if (next.content.startsWith('【手动提示')) continue
    n++
  }
  return n
}

/**
 * 手动提示共 3 次，依次对应后端 tier 6 / 10 / 15。
 * 若用「已完成问答数」当作 questionCount，在提问很少时会一直落在 6 档且 hintCache 键相同，三次文案会完全一样。
 */
function manualHintTierAsQuestionCount(manualHintsUsed: number): number {
  if (manualHintsUsed <= 0) return 6
  if (manualHintsUsed === 1) return 10
  return 15
}

/** 是否已插入过某档阶段提示（与 Message 中「【阶段提示·n】」前缀一致） */
function hasStageHintForTier(msgs: Message[], tier: number): boolean {
  const prefix = `【阶段提示·${tier}】`
  return msgs.some(
    (m) => m.role === 'ai' && m.content.startsWith(prefix),
  )
}

type GameRouteParams = {
  id: string
}

type NoticeState = {
  text: string
  kind: 'error' | 'info'
}

function GameLoadingShell() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-x-hidden bg-gradient-to-b from-slate-950/95 to-slate-900/95 px-6 text-slate-200">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-400"
        aria-hidden
      />
      <p className="mt-4 text-sm text-slate-400">载入对局与存档…</p>
      <p className="sr-only" role="status">
        加载中
      </p>
    </div>
  )
}

export function Game() {
  const { id } = useParams<GameRouteParams>()
  const location = useLocation()
  const navigate = useNavigate()

  const [messages, setMessages] = useState<Message[]>([])
  /** 本局锁定的汤底（与 storyId 绑定，写入 session，刷新不丢） */
  const [boundSoupBottom, setBoundSoupBottom] = useState('')
  /** 规范化问题 → 本局唯一答案，重复提问不走模型 */
  const [answerCache, setAnswerCache] = useState<Record<string, string>>({})
  const [sessionStatus, setSessionStatus] =
    useState<GameSessionStatus>('playing')
  const [awaitingAi, setAwaitingAi] = useState(false)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState<NoticeState | null>(null)
  const [navBusy, setNavBusy] = useState(false)
  const [showEndGameModal, setShowEndGameModal] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [manualHintsUsed, setManualHintsUsed] = useState(0)
  const [newRoundTransition, setNewRoundTransition] = useState(false)

  const awaitingAiRef = useRef(false)
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navTimerRef = useRef<number | null>(null)
  const storageWarnedRef = useRef(false)

  const story = useMemo((): TurtleStory | undefined => {
    if (id == null || id === '') return undefined
    return stories.find((s) => s.id === id)
  }, [id])

  const showNotice = useCallback(
    (text: string, kind: 'error' | 'info' = 'error') => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
      setNotice({ text, kind })
      const ms = kind === 'error' ? 5200 : 3800
      noticeTimerRef.current = setTimeout(() => {
        setNotice(null)
        noticeTimerRef.current = null
      }, ms)
    },
    [],
  )

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
      if (navTimerRef.current) clearTimeout(navTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!showEndGameModal) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setShowEndGameModal(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showEndGameModal])

  /** 首次进入：从大厅清空会话；刷新则恢复 sessionStorage */
  useEffect(() => {
    if (!id) {
      setReady(true)
      return
    }

    if (!story) {
      setReady(true)
      return
    }

    const fromLobby = Boolean(
      (location.state as { fromLobby?: boolean } | null)?.fromLobby,
    )

    if (fromLobby) {
      clearGameSession(story.id)
      setMessages([])
      setSessionStatus('playing')
      setAnswerCache({})
      setManualHintsUsed(0)
      setBoundSoupBottom(story.bottom)
      navigate(`/game/${story.id}`, { replace: true, state: {} })
      setReady(true)
      return
    }

    const saved = loadGameSession(story.id)
    if (saved) {
      let nextMessages = saved.messages
      let nextAnswerCache = { ...(saved.answerCache ?? {}) }
      const lastIdx = nextMessages.length - 1
      const last = nextMessages[lastIdx]
      if (last?.role === 'ai' && last.content === THINKING_TEXT) {
        const repairMsg = '请求中断或失败，请重新发送该问题'
        nextMessages = [
          ...nextMessages.slice(0, lastIdx),
          { role: 'ai', content: repairMsg },
        ]
        const u = nextMessages[lastIdx - 1]
        if (u?.role === 'user') {
          nextAnswerCache[normalizeQuestionKey(u.content)] = repairMsg
        }
      }
      setMessages(nextMessages)
      setSessionStatus(saved.status)
      setAnswerCache(nextAnswerCache)
      setManualHintsUsed(
        typeof saved.manualHintsUsed === 'number' &&
          saved.manualHintsUsed >= 0 &&
          saved.manualHintsUsed <= 3
          ? saved.manualHintsUsed
          : 0,
      )
      setBoundSoupBottom(
        saved.boundSoupBottom?.trim() ? saved.boundSoupBottom : story.bottom,
      )
    } else {
      setBoundSoupBottom(story.bottom)
      setAnswerCache({})
    }
    setReady(true)
  }, [id, story, location.state, navigate])

  useEffect(() => {
    if (!ready || !story) return
    const ok = saveGameSession(story.id, {
      status: sessionStatus,
      messages,
      boundSoupBottom: boundSoupBottom || story.bottom,
      answerCache,
      manualHintsUsed,
    })
    if (!ok && !storageWarnedRef.current) {
      storageWarnedRef.current = true
      showNotice(
        '本地存档写入失败（可能为隐私模式或存储已满），刷新后可能丢失进度。',
        'info',
      )
    }
  }, [
    ready,
    story,
    sessionStatus,
    messages,
    boundSoupBottom,
    answerCache,
    manualHintsUsed,
    showNotice,
  ])

  const canAsk = sessionStatus === 'playing'
  const lockReason = '游戏已结束'

  const handleSendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) {
        showNotice('请先输入问题，再发送哦。', 'info')
        return
      }
      if (/^\d+$/.test(trimmed.replace(/\s+/g, ''))) {
        showNotice(
          '输入框只接收对汤面的提问（如「是不是……」），不能把数字当成选档。需要由浅到深的提示请点底部「提示」按钮。',
          'info',
        )
        return
      }
      if (/^[\p{P}\p{S}]+$/u.test(trimmed.replace(/\s+/g, ''))) {
        showNotice(
          '请输入对汤面的完整问题，不要只发送标点或符号。',
          'info',
        )
        return
      }
      if (!canAsk) {
        showNotice('游戏已结束，无法继续提问。', 'info')
        return
      }
      if (awaitingAiRef.current) return

      if (story == null) {
        showNotice('故事数据缺失，请返回大厅重试。', 'error')
        return
      }

      const qKey = normalizeQuestionKey(trimmed)
      const soupThisSession = boundSoupBottom.trim() || story.bottom
      const questionIndex = countCompletedJudgeTurns(messages, THINKING_TEXT) + 1

      let cached: string | undefined = answerCache[qKey]
      if (containsAbusiveLanguageForCacheBypass(trimmed)) {
        cached = undefined
      }
      const needsMilestoneHint =
        (questionIndex === 6 ||
          questionIndex === 10 ||
          questionIndex === 15) &&
        !hasStageHintForTier(messages, questionIndex)
      if (cached !== undefined && !needsMilestoneHint) {
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: trimmed },
          { role: 'ai', content: cached },
        ])
        return
      }

      awaitingAiRef.current = true
      setAwaitingAi(true)

      setMessages((prev) => [
        ...prev,
        { role: 'user', content: trimmed },
        { role: 'ai', content: THINKING_TEXT },
      ])

      try {
        const data = await sendGameQuestion({
          question: trimmed,
          story: {
            title: story.title,
            surface: story.surface,
            bottom: soupThisSession,
          },
          questionIndex,
        })
        const answer =
          data.proximityFeedback
            ? `${data.answer}\n${data.proximityFeedback}`
            : data.answer
        const displayAnswer = data.moderationNotice?.trim()
          ? data.moderationNotice.trim()
          : typeof answer === 'string' && answer.trim()
            ? answer.trim()
            : AI_ERROR_TEXT
        if (data.answerQuality !== 'fallback') {
          setAnswerCache((prev) => ({ ...prev, [qKey]: displayAnswer }))
        }
        if (data.answerQuality === 'fallback') {
          showNotice(
            data.reaskHint?.trim() || CHAT_JUDGE_FALLBACK_HINT,
            'info',
          )
        }
        if (data.moderationNotice?.trim()) {
          showNotice(data.moderationNotice.trim(), 'info')
        }
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (
            last?.role === 'ai' &&
            last.content === THINKING_TEXT
          ) {
            next[next.length - 1] =
              displayAnswer === AI_ERROR_TEXT
                ? { role: 'ai', content: AI_ERROR_TEXT }
                : {
                    role: 'ai',
                    content: data.moderationNotice?.trim() || data.answer,
                    ...(data.proximityFeedback && !data.moderationNotice?.trim()
                      ? { proximityFeedback: data.proximityFeedback }
                      : {}),
                  }
          }
          if (
            displayAnswer !== AI_ERROR_TEXT &&
            typeof data.stageHint === 'string' &&
            data.stageHint.trim() &&
            (data.stageTier === 6 ||
              data.stageTier === 10 ||
              data.stageTier === 15)
          ) {
            return [
              ...next,
              {
                role: 'ai',
                content: `【阶段提示·${data.stageTier}】\n${data.stageHint.trim()}`,
              },
            ]
          }
          return next
        })
      } catch (e) {
        console.error('[Game] sendGameQuestion 失败', e)
        const { notice: errNotice, bubble: errBubble } = getChatErrorCopy(e)
        setAnswerCache((prev) => ({ ...prev, [qKey]: errBubble }))
        showNotice(errNotice, 'error')
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (
            last?.role === 'ai' &&
            last.content === THINKING_TEXT
          ) {
            next[next.length - 1] = { role: 'ai', content: errBubble }
          }
          return next
        })
      } finally {
        awaitingAiRef.current = false
        setAwaitingAi(false)
      }
    },
    [
      canAsk,
      story,
      boundSoupBottom,
      answerCache,
      messages,
      showNotice,
    ],
  )

  const handleFooterManualHint = useCallback(async () => {
    if (story == null || sessionStatus !== 'playing') return
    if (!canAsk || manualHintsUsed >= 3 || navBusy || awaitingAiRef.current)
      return
    awaitingAiRef.current = true
    setAwaitingAi(true)
    try {
      const data = await requestHint({
        story: {
          title: story.title,
          surface: story.surface,
          bottom: boundSoupBottom.trim() || story.bottom,
        },
        questionCount: manualHintTierAsQuestionCount(manualHintsUsed),
      })
      const ok =
        data.code === 200 &&
        typeof data.hint === 'string' &&
        data.hint.length > 0 &&
        (data.tier === 6 || data.tier === 10 || data.tier === 15)
      if (!ok) {
        showNotice(data.msg ?? '生成失败', 'error')
        return
      }
      const tier = data.tier
      const hintText = data.hint
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: `【手动提示·${tier}】\n${hintText}` },
      ])
      setManualHintsUsed((n) => n + 1)
    } catch (e) {
      console.error('[Game] requestHint 失败', e)
      showNotice(getChatErrorCopy(e).notice, 'error')
    } finally {
      awaitingAiRef.current = false
      setAwaitingAi(false)
    }
  }, [
    story,
    sessionStatus,
    canAsk,
    manualHintsUsed,
    navBusy,
    boundSoupBottom,
    showNotice,
  ])

  const goToResult = useCallback(() => {
    if (!story || navBusy) return
    setNavBusy(true)
    const soupReveal = boundSoupBottom.trim() || story.bottom
    if (navTimerRef.current != null) {
      clearTimeout(navTimerRef.current)
      navTimerRef.current = null
    }
    navTimerRef.current = window.setTimeout(() => {
      const chatHistory = messagesToChatHistory(messages, THINKING_TEXT)
      const nextStatus: GameSessionStatus = 'revealed'
      saveGameSession(story.id, {
        status: nextStatus,
        messages,
        boundSoupBottom: soupReveal,
        answerCache,
        manualHintsUsed,
      })
      const state: ResultLocationState = {
        storyTitle: story.title,
        soupContent: soupReveal,
        chatHistory,
      }
      navigate(`/result/${story.id}`, { state })
    }, 220)
  }, [story, messages, navigate, navBusy, boundSoupBottom, answerCache, manualHintsUsed])

  /** 放弃本局并跳转汤底揭晓页（状态 abandoned，与「查看汤底」的 revealed 区分） */
  const confirmAbandonAndViewResult = useCallback(() => {
    if (!story || navBusy) return
    setShowEndGameModal(false)
    setNavBusy(true)
    const soupSave = boundSoupBottom.trim() || story.bottom
    if (navTimerRef.current != null) {
      clearTimeout(navTimerRef.current)
      navTimerRef.current = null
    }
    navTimerRef.current = window.setTimeout(() => {
      const chatHistory = messagesToChatHistory(messages, THINKING_TEXT)
      const nextStatus: GameSessionStatus = 'abandoned'
      saveGameSession(story.id, {
        status: nextStatus,
        messages,
        boundSoupBottom: soupSave,
        answerCache,
        manualHintsUsed,
      })
      const state: ResultLocationState = {
        storyTitle: story.title,
        soupContent: soupSave,
        chatHistory,
      }
      navigate(`/result/${story.id}`, { state })
    }, 220)
  }, [story, messages, navigate, navBusy, boundSoupBottom, answerCache, manualHintsUsed])

  const handlePlayAgain = useCallback(() => {
    if (!story || navBusy || awaitingAiRef.current) return
    const next = pickRandomStory(story.id)
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current)
      noticeTimerRef.current = null
    }
    setNotice(null)
    clearGameSession(story.id)
    clearGameSession(next.id)
    setNewRoundTransition(true)
    setMessages([])
    setSessionStatus('playing')
    setAnswerCache({})
    setManualHintsUsed(0)
    setBoundSoupBottom(next.bottom)
    setAwaitingAi(false)
    awaitingAiRef.current = false
    setShowEndGameModal(false)
    setShowMoreMenu(false)
    setNavBusy(false)
    if (navTimerRef.current != null) {
      clearTimeout(navTimerRef.current)
      navTimerRef.current = null
    }
    navigate(`/game/${next.id}`, { replace: true, state: { fromLobby: true } })
    window.setTimeout(() => setNewRoundTransition(false), 320)
  }, [story, navigate])

  const noticeClass =
    notice?.kind === 'info'
      ? 'border-amber-500/40 bg-amber-950/90 text-amber-50'
      : 'border-rose-500/35 bg-rose-950/90 text-rose-50'

  if (id == null || id === '') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center overflow-x-hidden px-4 text-slate-200">
        <p className="text-center text-slate-400">链接里没有故事编号，无法开局。</p>
        <Link
          to="/"
          className="mt-6 min-h-[44px] text-sm font-medium text-violet-400 underline-offset-4 hover:text-violet-300 hover:underline"
        >
          返回大厅
        </Link>
      </div>
    )
  }

  if (story == null) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center overflow-x-hidden bg-slate-950/85 px-4 text-slate-200">
        <p className="max-w-sm text-center text-slate-400">
          找不到这个故事，可能卡片已更新或链接已过期。
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex min-h-[44px] items-center rounded-xl border border-violet-500/40 bg-violet-950/40 px-5 text-sm font-medium text-violet-200 transition hover:bg-violet-900/50"
        >
          返回大厅
        </Link>
      </div>
    )
  }

  if (!ready) {
    return <GameLoadingShell />
  }

  return (
    <div className="animate-page-fade-in flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col overflow-x-hidden overflow-hidden bg-gradient-to-b from-slate-950/90 via-slate-950/85 to-slate-900/90 text-slate-100">
      {navBusy ? (
        <LoadingOverlay variant="fullscreen" label="页面切换中…" />
      ) : null}

      {notice ? (
        <div
          role="status"
          className={`animate-notice-in fixed bottom-[max(5.5rem,env(safe-area-inset-bottom))] left-1/2 z-30 max-w-[min(90%,24rem)] -translate-x-1/2 rounded-xl border px-4 py-2.5 text-center text-sm shadow-lg backdrop-blur-sm ${noticeClass}`}
        >
          {notice.text}
        </div>
      ) : null}

      {showEndGameModal ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
          role="presentation"
        >
          <button
            type="button"
            aria-label="关闭"
            className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
            onClick={() => setShowEndGameModal(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="end-game-modal-title"
            className="relative z-10 w-full max-w-md animate-notice-in rounded-2xl border border-slate-700/90 bg-slate-900/98 p-5 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.65)] sm:p-6"
          >
            <h2
              id="end-game-modal-title"
              className="text-lg font-semibold tracking-tight text-violet-100"
            >
              结束本局？
            </h2>
            <p className="mt-3 break-words text-sm leading-relaxed text-slate-400">
              确定要结束本局并查看汤底吗？未完成的对局将标记为放弃。
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowEndGameModal(false)}
                className="active-press min-h-[48px] rounded-xl border border-slate-600/70 bg-slate-950/80 px-4 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/80 active:scale-[0.98] sm:min-w-[7rem]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  handlePlayAgain()
                }}
                disabled={navBusy || awaitingAi}
                className="active-press min-h-[48px] rounded-xl border border-emerald-600/40 bg-emerald-950/35 px-4 text-sm font-medium text-emerald-100 transition hover:border-emerald-500/50 hover:bg-emerald-950/45 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[7rem]"
              >
                再来一局
              </button>
              <button
                type="button"
                onClick={confirmAbandonAndViewResult}
                className="active-press min-h-[48px] rounded-xl border border-violet-500/45 bg-violet-950/70 px-4 text-sm font-medium text-violet-100 transition hover:border-violet-400/55 hover:bg-violet-900/65 active:scale-[0.98] sm:min-w-[7rem]"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden transition duration-300 ease-out motion-reduce:transition-none motion-reduce:transform-none ${newRoundTransition ? 'scale-[0.99] opacity-[0.88]' : 'scale-100 opacity-100'}`}
      >
      <header className="shrink-0 border-b border-slate-800/80 bg-slate-950/95 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 gap-y-2">
              <h1 className="min-w-0 max-w-full break-words text-xl font-semibold tracking-tight text-violet-100 sm:text-2xl">
                {story.title}
              </h1>
              <span className="rounded-full border border-violet-500/40 bg-violet-950/40 px-2.5 py-0.5 text-xs font-medium text-violet-200">
                {story.difficulty}
              </span>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  sessionStatus === 'playing'
                    ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-200'
                    : 'border-slate-500/40 bg-slate-900/80 text-slate-400'
                }`}
              >
                {sessionStatus === 'playing' ? '进行中' : '已结束'}
              </span>
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                aria-label="更多"
                onClick={() => setShowMoreMenu((v) => !v)}
                className="active-press inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-700/70 bg-slate-950/70 text-slate-200 transition hover:border-slate-600 hover:bg-slate-900/70"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <circle cx="5" cy="12" r="1.8" fill="currentColor" />
                  <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                  <circle cx="19" cy="12" r="1.8" fill="currentColor" />
                </svg>
              </button>
              <div
                className={`absolute right-0 mt-2 w-44 origin-top-right overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/95 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.7)] backdrop-blur-sm transition duration-200 ${
                  showMoreMenu
                    ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
                    : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
                }`}
                role="menu"
                aria-hidden={!showMoreMenu}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false)
                    setShowEndGameModal(true)
                  }}
                  disabled={!canAsk || navBusy}
                  className="active-press w-full px-4 py-3 text-left text-sm font-medium text-slate-100 transition hover:bg-slate-800/70 disabled:cursor-not-allowed disabled:opacity-40"
                  role="menuitem"
                >
                  结束游戏
                </button>
              </div>
            </div>
          </div>
          <p className="break-words text-sm leading-relaxed text-slate-300 sm:text-base">
            {story.surface}
          </p>
          {sessionStatus !== 'playing' ? (
            <p
              className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/35 px-3 py-2 text-xs text-amber-100/95 sm:text-sm"
              role="status"
            >
              <span className="font-semibold text-amber-50">游戏已结束</span>
              <span className="text-amber-100/85">
                {sessionStatus === 'abandoned'
                  ? '（本局已放弃）输入已锁定。可点击下方「查看汤底」前往揭晓页，或使用底部链接返回大厅。'
                  : '（汤底已揭晓）无法继续提问，可查看汤底详情或返回大厅。'}
              </span>
            </p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden px-4 py-4 pb-2">
        <ChatBox
          key={story.id}
          messages={messages}
          busy={awaitingAi}
          locked={!canAsk}
          lockReason={lockReason}
          onEmptySubmit={() =>
            showNotice('提问不能为空，请完整输入后再发送。', 'info')
          }
          onSendMessage={(msg) => {
            void handleSendMessage(msg)
          }}
          hintAction={
            story && sessionStatus === 'playing'
              ? {
                  label: awaitingAi
                    ? '生成中…'
                    : `提示×${Math.max(0, 3 - manualHintsUsed)}`,
                  disabled:
                    !canAsk ||
                    manualHintsUsed >= 3 ||
                    navBusy ||
                    awaitingAi,
                  onClick: () => {
                    void handleFooterManualHint()
                  },
                }
              : undefined
          }
        />
      </main>
      </div>

      <footer className="shrink-0 border-t border-slate-800/80 bg-slate-950/95 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-3xl gap-3">
          <button
            type="button"
            onClick={() => {
              handlePlayAgain()
            }}
            disabled={navBusy || awaitingAi}
            className="active-press min-h-[52px] min-w-0 flex-1 rounded-xl border border-slate-600/70 bg-slate-900/85 px-4 py-3 text-sm font-semibold text-slate-100 transition-colors duration-200 hover:border-slate-500 hover:bg-slate-800/85 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            再来一局
          </button>
          <button
            type="button"
            onClick={goToResult}
            disabled={navBusy}
            className="active-press min-h-[52px] min-w-0 flex-1 rounded-xl border border-violet-500/45 bg-violet-950/70 px-4 py-3 text-sm font-semibold text-violet-50 transition-colors duration-200 hover:border-violet-400/55 hover:bg-violet-900/65 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            查看汤底
          </button>
        </div>
        {!canAsk ? (
          <div className="mx-auto mt-3 flex max-w-3xl justify-center sm:justify-end">
            <Link
              to="/"
              className="inline-flex min-h-[44px] items-center text-sm font-medium text-violet-400/95 underline-offset-4 hover:text-violet-300 hover:underline"
            >
              返回大厅
            </Link>
          </div>
        ) : null}
      </footer>
    </div>
  )
}
