import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { stories } from '../data/stories'
import { GameCard } from './GameCard'

describe('GameCard', () => {
  it('links to game route by story id', () => {
    const story = stories[0]
    render(
      <MemoryRouter>
        <GameCard story={story} />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: new RegExp(story.title) })
    expect(link).toHaveAttribute('href', `/game/${story.id}`)
  })
})
