import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin, ProxyOptions } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 仓库根目录与 web/ 下的 .env 合并（后者覆盖前者） */
function mergeEnv(mode: string) {
  const webRoot = __dirname
  const repoRoot = path.resolve(webRoot, '..')
  return { ...loadEnv(mode, repoRoot, ''), ...loadEnv(mode, webRoot, '') }
}

/**
 * 从 .env 行中提取可用的 API Key（合并误粘贴的文案、取最长 sk- 片段）。
 * 勿在日志中打印返回值。
 */
function pickApiKey(raw: string | undefined): string {
  if (!raw) return ''
  const matches = raw.match(/sk-[A-Za-z0-9_-]+/g)
  if (matches?.length) {
    return matches.reduce((a, b) => (b.length >= a.length ? b : a))
  }
  return raw.trim()
}

/** 与 api.ts / 代理共用的解析结果（支持 VITE_OPENAI_* 与简短别名 VITE_API_*） */
type ResolvedAiEnv = {
  apiKey: string
  baseUrl: string
  model: string
}

function resolveAiEnv(env: Record<string, string>): ResolvedAiEnv {
  const apiKey =
    pickApiKey(env.VITE_OPENAI_API_KEY) || pickApiKey(env.VITE_API_KEY)

  let baseUrl =
    env.VITE_OPENAI_API_BASE_URL?.trim() ||
    env.VITE_API_BASE?.trim() ||
    env.VITE_API_BASE_URL?.trim() ||
    ''
  if (!baseUrl) baseUrl = 'https://api.openai.com/v1'

  let model =
    env.VITE_OPENAI_MODEL?.trim() || env.VITE_API_MODEL?.trim() || ''
  if (!model) {
    try {
      const href = baseUrl.includes('://') ? baseUrl : `https://${baseUrl}`
      const u = new URL(href)
      model = /deepseek\.com/i.test(u.hostname) ? 'deepseek-chat' : 'gpt-4o-mini'
    } catch {
      model = 'gpt-4o-mini'
    }
  }

  return { apiKey, baseUrl, model }
}

function openAiClientEnvDefine(ai: ResolvedAiEnv): Record<string, string> {
  return {
    'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(ai.apiKey),
    'import.meta.env.VITE_OPENAI_API_BASE_URL': JSON.stringify(ai.baseUrl),
    'import.meta.env.VITE_OPENAI_MODEL': JSON.stringify(ai.model),
  }
}

function openAiEnvRestartHintPlugin(): Plugin {
  const line =
    '\n\x1b[33m[海龟汤]\x1b[0m 已加载 .env：若你\x1b[1m修改\x1b[0m了 Key / BASE / MODEL，请\x1b[1m重启\x1b[0m \x1b[36mnpm run dev\x1b[0m 或 \x1b[36mnpm run preview\x1b[0m 后生效。\n' +
    '\x1b[90m（支持 VITE_OPENAI_* 或别名 VITE_API_KEY、VITE_API_BASE、VITE_API_MODEL）\x1b[0m\n'

  return {
    name: 'openai-env-restart-hint',
    configureServer() {
      console.info(line)
    },
    configurePreviewServer() {
      console.info(line)
    },
  }
}

function buildOpenAiProxy(ai: ResolvedAiEnv): Record<string, string | ProxyOptions> {
  const normalized = ai.baseUrl.replace(/\/$/, '')
  let target = 'https://api.openai.com'
  let prefix = '/v1'
  try {
    const href = normalized.includes('://') ? normalized : `https://${normalized}`
    const u = new URL(href)
    target = `${u.protocol}//${u.host}`
    const p = u.pathname.replace(/\/$/, '')
    prefix = p && p !== '' ? p : '/v1'
  } catch {
    /* 使用默认 OpenAI */
  }

  return {
    '/api': {
      target: 'http://127.0.0.1:3000',
      changeOrigin: true,
      configure: (proxy) => {
        proxy.on('error', (err) => {
          console.error('[vite /api proxy]', err.message)
        })
      },
    },
    '/openai': {
      target,
      changeOrigin: true,
      secure: true,
      rewrite: (p) => p.replace(/^\/openai/, prefix),
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          if (ai.apiKey) {
            proxyReq.setHeader('Authorization', `Bearer ${ai.apiKey}`)
          }
        })
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = mergeEnv(mode)
  const ai = resolveAiEnv(env)
  const proxy = buildOpenAiProxy(ai)

  return {
    envDir: path.resolve(__dirname, '..'),
    plugins: [
      react(),
      tailwindcss(),
      openAiEnvRestartHintPlugin(),
    ],
    define: openAiClientEnvDefine(ai),
    server: { host: true, proxy },
    preview: { host: true, proxy },
  }
})
