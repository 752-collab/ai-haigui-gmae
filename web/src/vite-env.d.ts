/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  /** 别名：与 VITE_OPENAI_API_KEY 二选一 */
  readonly VITE_API_KEY?: string
  /** 别名：与 VITE_OPENAI_API_BASE_URL 二选一，如 https://api.deepseek.com */
  readonly VITE_API_BASE?: string
  /** 别名：与 VITE_OPENAI_MODEL 二选一 */
  readonly VITE_API_MODEL?: string
  /** OpenAI 兼容 API Key（仅本地/演示；生产请走后端网关） */
  readonly VITE_OPENAI_API_KEY?: string
  /** 例如 https://api.openai.com/v1 */
  readonly VITE_OPENAI_API_BASE_URL?: string
  /** 例如 gpt-4o-mini */
  readonly VITE_OPENAI_MODEL?: string
  /** 设为 true 时本机也直连 API（仅调试用，易遇 CORS） */
  readonly VITE_OPENAI_FORCE_DIRECT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
