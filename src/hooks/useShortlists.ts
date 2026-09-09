import { useState, useEffect } from 'react'

type Shortlist = {
  id: string
  user_id?: string
  name: string
  is_public: boolean
  created_at?: string
}

export function useShortlists() {
  const [shortlists, setShortlists] = useState<Shortlist[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchShortlists() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/shortlists')
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setShortlists(json.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchShortlists()
  }, [])

  async function createShortlist(name: string) {
    const res = await fetch('/api/shortlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    if (!res.ok) throw new Error(await res.text())
    const json = await res.json()
    setShortlists(prev => [json.data, ...prev])
    return json.data
  }

  async function addItem(shortlistId: string, university_id: string | null, course_id: string | null, note?: string) {
    const res = await fetch(`/api/shortlists/${shortlistId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ university_id, course_id, note })
    })
    if (!res.ok) throw new Error(await res.text())
    const json = await res.json()
    return json.data
  }

  async function removeItem(itemId: string) {
    const res = await fetch(`/api/shortlists/items/${itemId}`, {
      method: 'DELETE'
    })
    if (!res.ok) throw new Error(await res.text())
    return true
  }

  async function fetchItems(shortlistId: string) {
    const res = await fetch(`/api/shortlists/${shortlistId}/items`)
    if (!res.ok) throw new Error(await res.text())
    const json = await res.json()
    return json.data || []
  }

  return { shortlists, loading, error, fetchShortlists, createShortlist }
}
