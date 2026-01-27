import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActorBadge } from './ActorBadge'
import type { User } from '../../types'

const mockCitizen: User = {
  id: '1',
  name: 'Maria Virtanen',
  role: 'citizen',
  avatarInitials: 'MV',
  verified: true
}

const mockInstitution: User = {
  id: '2',
  name: 'City of Helsinki',
  role: 'institution',
  avatarInitials: 'CH',
  institutionType: 'municipality',
  verified: true
}

describe('ActorBadge', () => {
  it('renders citizen user with name', () => {
    render(<ActorBadge user={mockCitizen} />)

    expect(screen.getByText('Maria Virtanen')).toBeInTheDocument()
    expect(screen.getByText('MV')).toBeInTheDocument()
  })

  it('renders institution user with Official badge', () => {
    render(<ActorBadge user={mockInstitution} />)

    expect(screen.getByText('City of Helsinki')).toBeInTheDocument()
    expect(screen.getByText('Official')).toBeInTheDocument()
  })

  it('shows institution type for institutional users', () => {
    render(<ActorBadge user={mockInstitution} />)

    expect(screen.getByText('municipality')).toBeInTheDocument()
  })

  it('hides name when showName is false', () => {
    render(<ActorBadge user={mockCitizen} showName={false} />)

    expect(screen.queryByText('Maria Virtanen')).not.toBeInTheDocument()
    expect(screen.getByText('MV')).toBeInTheDocument()
  })

  it('renders different sizes', () => {
    const { container, rerender } = render(<ActorBadge user={mockCitizen} size="sm" />)

    let avatar = container.querySelector('.w-6')
    expect(avatar).toBeInTheDocument()

    rerender(<ActorBadge user={mockCitizen} size="lg" />)
    avatar = container.querySelector('.w-10')
    expect(avatar).toBeInTheDocument()
  })
})
