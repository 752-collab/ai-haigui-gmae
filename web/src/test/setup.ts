import '@testing-library/jest-dom/vitest'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    /** 测试环境默认视为「减少动效」，跳过 FireflyCanvas 的 canvas 循环，避免 jsdom 缺实现 */
    matches: /prefers-reduced-motion:\s*reduce/.test(String(query)),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})
