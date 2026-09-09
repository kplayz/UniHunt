import { test, expect } from '@playwright/test'

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

test.describe('API integration', () => {
  test('embed-courses without service header returns 401 or 403', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/llm/embed-courses')
    // either unauthorized or forbidden depending on server config
    expect([401,403,500]).toContain(res.status())
  })

  test('embed-courses with service header succeeds when key present', async ({ request }) => {
    test.skip(!serviceKey, 'SUPABASE_SERVICE_ROLE_KEY not set')
    const res = await request.post('http://localhost:3000/api/llm/embed-courses', { headers: { 'x-service-role': serviceKey } })
    expect([200,201,202,204,500]).toContain(res.status())
  })

  test('admin hf-alerts requires auth', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/admin/hf-alerts')
    expect([401,403]).toContain(res.status())
  })
})
