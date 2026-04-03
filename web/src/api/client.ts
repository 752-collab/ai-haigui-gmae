import { env } from '../config/env'

const base = env.apiBaseUrl.replace(/\/$/, '')

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}
