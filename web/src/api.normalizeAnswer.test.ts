import { describe, expect, it } from 'vitest'
import { normalizeAnswer } from './api'

describe('normalizeAnswer', () => {
  it('maps 是', () => {
    expect(normalizeAnswer('是')).toBe('是')
    expect(normalizeAnswer(' 是。 ')).toBe('是')
  })

  it('maps 否', () => {
    expect(normalizeAnswer('否')).toBe('否')
    expect(normalizeAnswer('不是')).toBe('否')
  })

  it('maps 无关', () => {
    expect(normalizeAnswer('无关')).toBe('无关')
    expect(normalizeAnswer('')).toBe('无关')
  })

  it('english', () => {
    expect(normalizeAnswer('yes')).toBe('是')
    expect(normalizeAnswer('no')).toBe('否')
    expect(normalizeAnswer('irrelevant')).toBe('无关')
  })

  it('not before 是: 不是 → 否', () => {
    expect(normalizeAnswer('是不是自杀')).toBe('否')
  })
})
