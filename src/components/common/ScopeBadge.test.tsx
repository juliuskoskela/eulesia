import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScopeBadge } from './ScopeBadge'

describe('ScopeBadge', () => {
  it('renders municipal scope with default label', () => {
    render(<ScopeBadge scope="municipal" />)

    expect(screen.getByText('Municipal')).toBeInTheDocument()
  })

  it('renders regional scope', () => {
    render(<ScopeBadge scope="regional" />)

    expect(screen.getByText('Regional')).toBeInTheDocument()
  })

  it('renders national scope', () => {
    render(<ScopeBadge scope="national" />)

    expect(screen.getByText('National')).toBeInTheDocument()
  })

  it('displays municipality name when provided', () => {
    render(<ScopeBadge scope="municipal" municipalityName="Helsinki" />)

    expect(screen.getByText('Helsinki')).toBeInTheDocument()
    expect(screen.queryByText('Municipal')).not.toBeInTheDocument()
  })

  it('renders the icon', () => {
    const { container } = render(<ScopeBadge scope="municipal" />)

    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})
