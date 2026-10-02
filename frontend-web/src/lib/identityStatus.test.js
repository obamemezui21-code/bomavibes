import { describe, expect, it } from 'vitest'
import { identityStatus } from './identityStatus.js'

describe('identityStatus', () => {
  it('lets verified and legacy members in', () => {
    expect(identityStatus({ verified: true }, null)).toBe('ok')
    expect(identityStatus({ legacyMember: true }, null)).toBe('ok')
  })

  it('asks new members to verify, and follows their request', () => {
    expect(identityStatus({}, null)).toBe('todo')
    expect(identityStatus({}, { status: 'awaiting_selfie' })).toBe('todo')
    expect(identityStatus({}, { status: 'pending' })).toBe('pending')
    expect(identityStatus({}, { status: 'rejected' })).toBe('rejected')
  })

  it('waits while the profile or the request is still loading', () => {
    expect(identityStatus(null, null)).toBe('loading')
    expect(identityStatus({}, undefined)).toBe('loading')
  })
})
