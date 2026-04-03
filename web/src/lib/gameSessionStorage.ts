import type { Message } from '../components/Message'
import type { GameSessionStatus } from '../types/game'

export const GAME_SESSION_PREFIX = 'turtle-game-session:v1:'

export type PersistedGameSession = {
  status: GameSessionStatus
  messages: Message[]
  /**
   * 本局开局时锁定的汤底原文；裁判与缓存均只认此字符串，避免库内故事文案升级导致同局前后不一致。
   */
  boundSoupBottom: string
  /**
   * 问题规范化 key → 本局已确定的回答（与 boundSoupBottom + storyId 强绑定）。
   * 重复提问不再走模型，直接复用。
   */
  answerCache: Record<string, string>
  /** 本局已使用的手动提示次数（0–3，可选，缺省按 0） */
  manualHintsUsed?: number
}

export function gameSessionKey(storyId: string): string {
  return `${GAME_SESSION_PREFIX}${storyId}`
}

/** 同一「语义问题」的稳定键：去首尾空白、连续空白压成单空格 */
export function normalizeQuestionKey(question: string): string {
  return question.trim().replace(/\s+/g, ' ')
}

/** 允许写入 session 的非「是/否/无关」缓存值（失败兜底、中断修复文案等） */
function isPersistableAnswerCacheValue(v: string): boolean {
  if (v === '是' || v === '否' || v === '无关') return true
  if (
    /^((是|否|无关)\n(你已经接近真相了|方向对了，但还差关键点))$/.test(v)
  ) {
    return true
  }
  if (v.startsWith('请求中断或失败')) return true
  if (v.includes('暂时无法获取回复') || v.includes('暂时无法获取手动提示'))
    return true
  if (v.includes('AI回复出错了')) return true
  if (/^请求失败：\d+/.test(v) && v.length <= 512) return true
  if (v === '服务器返回不是有效的 JSON') return true
  if (
    v.length <= 320 &&
    /^(网络|服务|等待回复|请求未成功|暂时无法)/.test(v.trim())
  ) {
    return true
  }
  return false
}

export function loadGameSession(storyId: string): PersistedGameSession | null {
  try {
    const raw = sessionStorage.getItem(gameSessionKey(storyId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedGameSession> & {
      messages?: Message[]
    }
    if (
      !parsed ||
      (parsed.status !== 'playing' &&
        parsed.status !== 'abandoned' &&
        parsed.status !== 'revealed') ||
      !Array.isArray(parsed.messages)
    ) {
      return null
    }

    let answerCache: Record<string, string> = {}
    if (
      parsed.answerCache &&
      typeof parsed.answerCache === 'object' &&
      !Array.isArray(parsed.answerCache)
    ) {
      const rawCache = parsed.answerCache as Record<string, string>
      answerCache = Object.fromEntries(
        Object.entries(rawCache).filter(([, v]) => isPersistableAnswerCacheValue(v)),
      )
    }

    const boundSoupBottom =
      typeof parsed.boundSoupBottom === 'string' ? parsed.boundSoupBottom : ''

    const manualHintsUsed =
      typeof parsed.manualHintsUsed === 'number' &&
      Number.isInteger(parsed.manualHintsUsed) &&
      parsed.manualHintsUsed >= 0 &&
      parsed.manualHintsUsed <= 3
        ? parsed.manualHintsUsed
        : 0

    return {
      status: parsed.status,
      messages: parsed.messages,
      boundSoupBottom,
      answerCache,
      manualHintsUsed,
    }
  } catch {
    return null
  }
}

function normalizePersisted(data: PersistedGameSession): PersistedGameSession {
  return {
    ...data,
    boundSoupBottom: data.boundSoupBottom ?? '',
    answerCache: data.answerCache ?? {},
    manualHintsUsed:
      typeof data.manualHintsUsed === 'number' &&
      data.manualHintsUsed >= 0 &&
      data.manualHintsUsed <= 3
        ? data.manualHintsUsed
        : 0,
  }
}

export function saveGameSession(
  storyId: string,
  data: PersistedGameSession,
): boolean {
  try {
    sessionStorage.setItem(
      gameSessionKey(storyId),
      JSON.stringify(normalizePersisted(data)),
    )
    return true
  } catch {
    /* quota / private mode */
    return false
  }
}

export function clearGameSession(storyId: string): void {
  sessionStorage.removeItem(gameSessionKey(storyId))
}

/** 从对话列表生成「问/答」记录（含阶段/手动提示行；跳过未完成的思考占位） */
export function messagesToChatHistory(
  messages: Message[],
  thinkingPlaceholder: string,
): { question: string; answer: string }[] {
  const out: { question: string; answer: string }[] = []
  let i = 0
  while (i < messages.length) {
    const m = messages[i]
    if (m.role === 'ai') {
      const c = m.content
      if (c.startsWith('【阶段提示·') || c.startsWith('【手动提示·')) {
        const label = c.startsWith('【手动提示·')
          ? '（手动提示）'
          : '（阶段提示）'
        out.push({ question: label, answer: c })
        i += 1
        continue
      }
    }
    if (m.role !== 'user') {
      i += 1
      continue
    }
    const next = messages[i + 1]
    if (!next || next.role !== 'ai') {
      i += 1
      continue
    }
    if (next.content === thinkingPlaceholder) {
      i += 1
      continue
    }
    out.push({ question: m.content, answer: next.content })
    i += 2
  }
  return out
}
