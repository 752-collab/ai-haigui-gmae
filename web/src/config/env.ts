/** Public env only; Vite exposes `import.meta.env.VITE_*`. */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
} as const
