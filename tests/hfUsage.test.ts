import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/mail', () => ({
  sendEmail: vi.fn(async () => true),
  getAdminAlertEmail: vi.fn(() => 'admin@example.com')
}))

// mock supabaseServer
const mockFrom = (table: string) => {
  if (table === 'profiles') {
    return {
      select: () => ({ eq: () => ({ single: async () => ({ data: { hf_daily_limit: 10, hf_soft_limit: 8 }, error: null }) }) })
    }
  }
  if (table === 'hf_usage') {
    return {
      select: () => ({ eq: () => ({ single: async () => ({ data: { calls: 7 }, error: null }) }), order: () => ({ limit: () => ({ then: () => ({}) }) }) }),
      upsert: async () => ({ error: null }),
      insert: async () => ({ error: null })
    }
  }
  if (table === 'hf_alerts') {
    return { insert: async () => ({ error: null }) }
  }
  return { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { code: 'PGRST116' } }) }) }) }
}

vi.mock('../lib/supabaseServer', () => ({ from: (table: string) => mockFrom(table) }))

import { checkAndIncrement } from '../lib/hfUsage'
import { sendEmail } from '../lib/mail'

describe('hfUsage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('throws when hard limit exceeded', async () => {
    // override profiles to return limit 2
    vi.mocked(require('../lib/supabaseServer').from).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { hf_daily_limit: 2, hf_soft_limit: 1 }, error: null }) }) }) }
      }
      if (table === 'hf_usage') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { calls: 2 }, error: null }) }) }), upsert: async () => ({ error: null }) }
      }
      return mockFrom(table)
    })

    await expect(checkAndIncrement('user-1', 1)).rejects.toThrow('HF daily limit reached')
  })

  it('inserts alert and sends email when crossing soft threshold', async () => {
    // use default mocks: limit 10, soft 8, current 7, delta 2 => newCalls 9 crosses soft
    const res = await checkAndIncrement('user-2', 2)
    expect(res.now).toBe(9)
    expect(sendEmail).toHaveBeenCalled()
  })
})
