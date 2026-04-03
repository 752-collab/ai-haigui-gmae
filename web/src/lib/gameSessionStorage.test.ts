import { describe, expect, it } from 'vitest'
import { messagesToChatHistory } from './gameSessionStorage'
import type { Message } from '../components/Message'

describe('messagesToChatHistory', () => {
  const thinking = '思考中...'

  it('includes stage and manual hint rows with synthetic question labels', () => {
    const messages: Message[] = [
      { role: 'user', content: '是自杀吗？' },
      { role: 'ai', content: '否' },
      { role: 'ai', content: '【阶段提示·6】多看人物关系' },
      { role: 'user', content: '有共犯吗？' },
      { role: 'ai', content: '是' },
      { role: 'ai', content: '【手动提示·10】注意时间线' },
    ]
    expect(messagesToChatHistory(messages, thinking)).toEqual([
      { question: '是自杀吗？', answer: '否' },
      { question: '（阶段提示）', answer: '【阶段提示·6】多看人物关系' },
      { question: '有共犯吗？', answer: '是' },
      { question: '（手动提示）', answer: '【手动提示·10】注意时间线' },
    ])
  })

  it('skips thinking placeholder pairs', () => {
    const messages: Message[] = [
      { role: 'user', content: 'pending' },
      { role: 'ai', content: thinking },
    ]
    expect(messagesToChatHistory(messages, thinking)).toEqual([])
  })
})
