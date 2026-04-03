import type { TurtleStory } from './data/stories'

function mergeRequestIdHeader(
  headers: Record<string, string>,
): Record<string, string> {
  let id: string
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    id = crypto.randomUUID()
  } else {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }
  return { ...headers, 'X-Request-Id': id }
}

export type TurtleSoupAnswer = '是' | '否' | '无关'

/** 与后端兜底提示文案保持一致（直连 OpenAI 路径复用） */
export const CHAT_JUDGE_FALLBACK_HINT =
  '本次模型回答格式不规范，已按「无关」处理且不记入缓存。请改用更短的是非问句（如「是不是……」「有没有……」）重新提问。'

export type ChatQuestionPayload = {
  question: string
  story: {
    title: string
    surface: string
    bottom: string
  }
  questionIndex?: number
}
export type ChatJudgeResponse = {
  answer: TurtleSoupAnswer
  proximityFeedback?: string
  stageHint?: string
  stageTier?: 6 | 10 | 15
  /** 后端严格 JSON 校验失败时为 fallback，此时 answer 已兜底为「无关」 */
  answerQuality?: 'ok' | 'fallback'
  reaskHint?: string
  /** 辱骂等合规拦截时由后端返回，仅用于提示条，不写入气泡剧透 */
  moderationNotice?: string
}

export type AskAIResult = {
  answer: TurtleSoupAnswer
  answerQuality: 'ok' | 'fallback'
  reaskHint?: string
}

/**
 * 本地 dev / 本机 preview 时走 Vite `/openai` 代理（无 CORS、密钥由 dev server 注入）。
 * 部署到公网静态站时需直连或另行配置网关；本地可设 VITE_OPENAI_FORCE_DIRECT=true 强制直连调试。
 */
export function shouldUseOpenAiProxy(): boolean {
  if (import.meta.env.VITE_OPENAI_FORCE_DIRECT === 'true') return false
  if (import.meta.env.DEV) return true
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return true
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true
  return false
}

/**
 * 将模型输出规范为「是 / 否 / 无关」（与 AGENTS.md：答案仅允许此三语义一致）。
 * 顺序：先剥壳 →「不是」早于「是」→ 英文 → 仍无法识别则「无关」兜底（不中断对局）。
 */
export function normalizeAnswer(rawInput: string): TurtleSoupAnswer {
  let t = rawInput.trim()
  if (!t) return '无关'

  t = t.replace(/^\s*(?:答|答案|回复)[:：]?\s*/i, '')
  t = t.replace(/^["'`「」『』]|["'`「」『』]$/g, '')
  t = t.replace(/^[.\s:：\-—]+/, '').replace(/[。\s,，]+$/g, '')
  t = t.trim()
  if (!t) return '无关'

  const lower = t.toLowerCase()

  if (
    /\b(irrelevant|unrelated|n\/a|n\.a\.|none|not\s+applicable)\b/i.test(t) ||
    /无关|不相干|没关系|不适用|与题|跑题/.test(t)
  ) {
    return '无关'
  }

  if (
    /\b(no|nope|false|negative)\b/.test(lower) ||
    /不是|不算|没有|否|不正确|错误|不可能/.test(t)
  ) {
    return '否'
  }

  if (
    /\b(yes|yep|yeah|true|positive|affirmative|correct)\b/.test(lower) ||
    /^(是|对|正确|可以|有过|曾经)([。！!…])?$/.test(t) ||
    (/是/.test(t) && !/不是/.test(t))
  ) {
    return '是'
  }

  return '无关'
}

/**
 * 向兼容 OpenAI Chat Completions 的接口提问；返回答案始终为「是 / 否 / 无关」之一。
 * 若模型未严格单字输出，则 answer 固定为「无关」并附带 reaskHint。
 */
export async function askAI(
  question: string,
  story: TurtleStory,
): Promise<AskAIResult> {
  const useProxy = shouldUseOpenAiProxy()
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY?.trim() ?? ''
  const apiBase =
    import.meta.env.VITE_OPENAI_API_BASE_URL?.trim() ||
    'https://api.openai.com/v1'
  const model =
    import.meta.env.VITE_OPENAI_MODEL?.trim() || 'gpt-4o-mini'

  if (!useProxy && (!apiKey || !apiBase)) {
    throw new Error(
      '未配置 AI：请在项目根目录或 web/.env.local 中设置 VITE_OPENAI_API_KEY 与 VITE_OPENAI_API_BASE_URL，保存后重启 npm run dev',
    )
  }

  const base = useProxy ? '/openai' : apiBase.replace(/\/$/, '')

  const prompt = [
    '你是「海龟汤」裁判。只根据「汤底」判断玩家命题真假，不得臆造汤底未写明的事实。',
    '',
    '【硬性输出（整段回复只能是一个词，多一字都错）】',
    '仅允许输出以下三者之一，且不得带引号、标点、空格、换行、英文或任何其它字符：是、否、无关',
    '- 是：命题与汤底一致或为真',
    '- 否：命题与汤底矛盾或为假',
    '- 无关：汤底无法判断真伪、问题与推理无关、或无法当作是非题判定',
    '- 复合问句：须全真才是「是」；任一子命题与汤底矛盾则为「否」；关键信息汤底未给出则为「无关」',
    '',
    '【正例（左为玩家问，右为且仅为你的输出）】',
    '死者是自杀吗？→是',
    '现场还有第二个人吗？→否',
    '今天天气好吗？→无关',
    '钥匙是铜的吗？→无关',
    '他是不是先锁门再离开且无人协助？→否',
    '',
    '【本题材料】',
    `标题：${story.title}`,
    `汤面：${story.surface}`,
    `汤底：${story.bottom}`,
    '',
    '【玩家问句】',
    question,
    '',
    '请只输出一个词（是、否、无关），不要其它任何内容：',
  ].join('\n')

  const headers = mergeRequestIdHeader({
    'Content-Type': 'application/json',
  })
  if (!useProxy && apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  let res: Response
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 32,
      }),
    })
  } catch (e) {
    console.error('[askAI] 网络请求失败', e)
    throw new Error(
      '无法连接 AI 服务。请确认网络正常，并已 npm run dev（本机走 Vite 代理可避免 CORS）。',
    )
  }

  if (!res.ok) {
    let detail = ''
    try {
      const raw = await res.text()
      const parsed = JSON.parse(raw) as { error?: { message?: string } }
      detail = parsed.error?.message ?? raw.slice(0, 200)
    } catch {
      /* ignore */
    }
    console.error('[askAI] HTTP', res.status, detail)

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        'API Key 无效或未配置：请在项目根或 web/.env.local 中设置 VITE_OPENAI_API_KEY 或别名 VITE_API_KEY，BASE 用 VITE_OPENAI_API_BASE_URL 或 VITE_API_BASE；勿在同一行混入其它文字。保存后重启 npm run dev',
      )
    }
    throw new Error(`AI 服务返回错误（HTTP ${res.status}），请稍后再试`)
  }

  let data: {
    choices?: Array<{ message?: { content?: string | null } }>
  }
  try {
    data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>
    }
  } catch (e) {
    console.error('[askAI] JSON 解析失败', e)
    throw new Error('AI 返回数据格式异常，请稍后再试')
  }

  const raw = String(data.choices?.[0]?.message?.content ?? '')
  const stripped = raw
    .trim()
    .replace(/^["'`「」『』]|["'`「」『』]$/g, '')
    .trim()
  if (/^(是|否|无关)$/.test(stripped)) {
    return {
      answer: stripped as TurtleSoupAnswer,
      answerQuality: 'ok',
    }
  }
  return {
    answer: '无关',
    answerQuality: 'fallback',
    reaskHint: CHAT_JUDGE_FALLBACK_HINT,
  }
}

/**
 * 生产环境 VITE_API_BASE 必须填写自有海龟汤后端域名（与浏览器同源或已配置 CORS），
 * 禁止直接填写模型商 API 地址，否则浏览器会跨域失败。
 */
function resolveTurtleGameApiPath(
  rest: 'chat' | 'manual-hint' | 'hint',
): string {
  const raw = import.meta.env.VITE_API_BASE?.trim() ?? ''
  if (!raw) return `/api/${rest}`
  const lower = raw.toLowerCase()
  if (
    lower.includes('deepseek.com') ||
    lower.includes('openai.com') ||
    lower.includes('anthropic.com')
  ) {
    return `/api/${rest}`
  }
  let base = raw
  while (base.endsWith('/')) {
    base = base.replace(/\/$/, '')
  }
  return `${base}/api/${rest}`
}

function resolveChatApiUrl(): string {
  return resolveTurtleGameApiPath('chat')
}

function resolveManualHintApiUrl(): string {
  return resolveTurtleGameApiPath('manual-hint')
}

function resolveHintApiUrl(): string {
  return resolveTurtleGameApiPath('hint')
}

export type ManualHintPayload = {
  story: {
    title: string
    surface: string
    bottom: string
  }
  questionCount: number
}

export type ManualHintResponse = {
  code: number
  hint?: string
  tier?: 6 | 10 | 15
  msg?: string
}

function parseManualHintTier(
  raw: number | string | undefined,
): 6 | 10 | 15 | undefined {
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number.parseInt(raw, 10)
        : Number.NaN
  if (n === 6 || n === 10 || n === 15) return n
  return undefined
}

const DEV_MANUAL_HINT_FALLBACK =
  'http://127.0.0.1:3000/api/manual-hint'

const DEV_HINT_FALLBACK = 'http://127.0.0.1:3000/api/hint'

async function postStageHintRequest(
  url: string,
  payload: ManualHintPayload,
): Promise<{ res: Response; text: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: mergeRequestIdHeader({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  return { res, text }
}

type StageHintPath = 'manual-hint' | 'hint'

function retryManualHintIfHint404(
  pathSeg: StageHintPath,
  res: Response,
  payload: ManualHintPayload,
): Promise<ManualHintResponse> | null {
  if (pathSeg !== 'hint' || res.ok || res.status !== 404) return null
  return requestStageHintByPath(
    'manual-hint',
    resolveManualHintApiUrl,
    DEV_MANUAL_HINT_FALLBACK,
    payload,
  )
}

async function requestStageHintByPath(
  pathSeg: StageHintPath,
  resolvePrimaryUrl: () => string,
  devFallback: string,
  payload: ManualHintPayload,
): Promise<ManualHintResponse> {
  try {
    const primaryUrl = resolvePrimaryUrl()
    let { res, text } = await postStageHintRequest(primaryUrl, payload)

    const trimmed = text.trimStart()
    const responseLooksHtml = /<!DOCTYPE|<html[\s>]/i.test(trimmed)
    const shouldUseDevDirect =
      import.meta.env.DEV &&
      primaryUrl.startsWith('/') &&
      (!res.ok || responseLooksHtml)

    if (shouldUseDevDirect) {
      const second = await postStageHintRequest(devFallback, payload)
      res = second.res
      text = second.text
    }
    let data: {
      code?: number | string
      hint?: string
      tier?: number | string
      msg?: string
    } = {}

    if (text) {
      try {
        data = JSON.parse(text) as typeof data
      } catch {
        const looksHtml = /<!DOCTYPE|<html[\s>]/i.test(text)
        if (!res.ok && res.status === 404) {
          const retry = await retryManualHintIfHint404(pathSeg, res, payload)
          if (retry != null) return retry
          throw new Error(
            `手动提示失败（404）：未找到 /api/${pathSeg}。请在仓库根目录执行 npm run start:backend（或 cd backend 后 npm start），然后浏览器打开 http://127.0.0.1:3000/api/capabilities 应看到包含 manual-hint 的 JSON；若仍 404，说明 3000 端口上是别的程序，请先关闭再启动本仓库 backend。`,
          )
        }
        if (looksHtml) {
          throw new Error(
            '手动提示失败：接口返回了网页而非数据，多为后端未启动或 Vite 代理未转发。请先启动 backend（npm start），前端保持 npm run dev。',
          )
        }
        throw new Error(
          res.ok
            ? '服务器返回不是有效的 JSON'
            : `请求失败：${res.status}`,
        )
      }
    } else if (!res.ok) {
      const retry = await retryManualHintIfHint404(pathSeg, res, payload)
      if (retry != null) return retry
      throw new Error(`请求失败：${res.status}`)
    }

    const codeRaw = data.code
    const codeNum =
      typeof codeRaw === 'number'
        ? codeRaw
        : typeof codeRaw === 'string'
          ? Number.parseInt(codeRaw, 10)
          : Number.NaN
    const code = Number.isFinite(codeNum) ? codeNum : 500

    const tier = parseManualHintTier(data.tier)
    const hint =
      typeof data.hint === 'string' && data.hint.trim()
        ? data.hint.trim()
        : undefined
    const msg =
      typeof data.msg === 'string' && data.msg.trim()
        ? data.msg.trim()
        : undefined

    if (!res.ok) {
      const retry = await retryManualHintIfHint404(pathSeg, res, payload)
      if (retry != null) return retry
      throw new Error(msg || `请求失败：${res.status}`)
    }

    return { code, hint, tier, msg }
  } catch (error) {
    console.error('网络错误：', error)
    throw error
  }
}

export async function requestManualHint(
  payload: ManualHintPayload,
): Promise<ManualHintResponse> {
  return requestStageHintByPath(
    'manual-hint',
    resolveManualHintApiUrl,
    DEV_MANUAL_HINT_FALLBACK,
    payload,
  )
}

/** ChatBox 手动提示：与 {@link requestManualHint} 同源逻辑，请求 `POST /api/hint`。 */
export async function requestHint(
  payload: ManualHintPayload,
): Promise<ManualHintResponse> {
  return requestStageHintByPath(
    'hint',
    resolveHintApiUrl,
    DEV_HINT_FALLBACK,
    payload,
  )
}

export async function sendMessage(message: string) {
  try {
    const res = await fetch(resolveChatApiUrl(), {
      method: 'POST',
      headers: mergeRequestIdHeader({
        'Content-Type': 'application/json', // 必须加，告诉后端是JSON格式
      }),
      body: JSON.stringify({ message }), // 必须用JSON.stringify序列化
    })

    if (!res.ok) throw new Error(`请求失败：${res.status}`)
    const data = (await res.json()) as {
      answer?: string
      proximityFeedback?: string
    }
    const proximity =
      data.proximityFeedback === '你已经接近真相了' ||
      data.proximityFeedback === '方向对了，但还差关键点'
        ? data.proximityFeedback
        : undefined
    return {
      answer: normalizeAnswer(data.answer ?? ''),
      proximityFeedback: proximity,
    } satisfies ChatJudgeResponse
  } catch (error) {
    console.error('网络错误：', error)
    throw error
  }
}

/**
 * 海龟汤联调入口：同时发送「题目+提问」给后端 /api/chat。
 * 返回结构：{ answer: '是' | '否' | '无关' }。
 */
export async function sendGameQuestion(payload: ChatQuestionPayload) {
  try {
    const res = await fetch(resolveChatApiUrl(), {
      method: 'POST',
      headers: mergeRequestIdHeader({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(payload),
    })

    const raw = await res.text()
    if (!res.ok) {
      let extra = ''
      try {
        const parsed = JSON.parse(raw) as {
          message?: string
          error?: { message?: string }
        }
        extra = (parsed.message ?? parsed.error?.message ?? '').trim()
      } catch {
        /* 非 JSON 时不要求解析 */
      }
      throw new Error(
        extra ? `请求失败：${res.status} ${extra}` : `请求失败：${res.status}`,
      )
    }

    let data: {
      answer?: string
      proximityFeedback?: string
      stageHint?: string
      stageTier?: number
      answerQuality?: string
      reaskHint?: string
      moderationNotice?: string
    }
    try {
      data = JSON.parse(raw) as typeof data
    } catch {
      throw new Error('服务器返回不是有效的 JSON')
    }
    const proximity =
      data.proximityFeedback === '你已经接近真相了' ||
      data.proximityFeedback === '方向对了，但还差关键点'
        ? data.proximityFeedback
        : undefined
    const stageTier =
      data.stageTier === 6 || data.stageTier === 10 || data.stageTier === 15
        ? data.stageTier
        : undefined
    const answerQuality =
      data.answerQuality === 'fallback' ? 'fallback' : 'ok'
    const out: ChatJudgeResponse = {
      answer: normalizeAnswer(data.answer ?? ''),
      proximityFeedback: proximity,
      answerQuality,
    }
    if (answerQuality === 'fallback' && data.reaskHint?.trim()) {
      out.reaskHint = data.reaskHint.trim()
    } else if (answerQuality === 'fallback') {
      out.reaskHint = CHAT_JUDGE_FALLBACK_HINT
    }
    if (data.moderationNotice?.trim()) {
      out.moderationNotice = data.moderationNotice.trim()
    }
    if (stageTier != null && typeof data.stageHint === 'string') {
      out.stageHint = data.stageHint
      out.stageTier = stageTier
    }
    return out
  } catch (error) {
    console.error('网络错误：', error)
    throw error
  }
}
