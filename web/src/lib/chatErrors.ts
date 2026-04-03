/**
 * 将对话请求异常映射为对用户友好的提示（不暴露敏感细节）。
 */
export function getChatErrorCopy(error: unknown): {
  notice: string
  bubble: string
} {
  const fallback = {
    notice: '暂时无法完成请求，请稍后再试。',
    bubble: '暂时无法获取回复，请检查网络后重试。',
  }

  if (error instanceof TypeError) {
    return {
      notice: '网络异常，请检查网络或确认后端服务已启动。',
      bubble: '网络连接失败，请稍后重试。',
    }
  }

  if (error instanceof Error) {
    if (
      error.message.startsWith('手动提示失败') ||
      error.message.includes('/api/manual-hint') ||
      error.message.includes('/api/hint')
    ) {
      return {
        notice: error.message,
        bubble: '暂时无法获取手动提示，请按顶部说明检查后重试。',
      }
    }
    const m = error.message.match(/请求失败：(\d+)/)
    if (m) {
      const code = Number(m[1])
      if (code === 404) {
        return {
          notice: '找不到对话服务（404），请确认后端已启动且前端代理配置正确。',
          bubble: '服务暂不可用，请稍后重试。',
        }
      }
      if (code === 401 || code === 403) {
        return {
          notice: '服务鉴权失败，请检查后端或环境配置。',
          bubble: '服务拒绝访问，请稍后再试。',
        }
      }
      if (code === 504 || code === 408) {
        return {
          notice: '请求超时，请稍后再试。',
          bubble: '等待回复超时，请重试。',
        }
      }
      if (code >= 500) {
        return {
          notice: '服务端繁忙或异常，请稍后再试。',
          bubble: '服务暂时不可用，请稍后重试。',
        }
      }
      if (code >= 400) {
        return {
          notice: `请求未能完成（${code}），请稍后再试。`,
          bubble: '请求未成功，请稍后再试。',
        }
      }
    }
    if (/fetch|网络|Failed to fetch|NetworkError/i.test(error.message)) {
      return {
        notice: '网络异常，请检查连接后重试。',
        bubble: '网络异常，请稍后重试。',
      }
    }
  }

  return fallback
}
