import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { stories } from '../data/stories'
import { Home } from './Home'

describe('Home', () => {
  it('shows title and story cards', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /AI海龟汤/ })).toBeTruthy()
    for (const s of stories) {
      expect(screen.getByRole('link', { name: new RegExp(s.title) })).toBeTruthy()
    }
  })
})
