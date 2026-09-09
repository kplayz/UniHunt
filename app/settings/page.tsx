"use client"

import React, { useEffect, useState } from 'react'

export default function SettingsPage() {
  const [semanticDefault, setSemanticDefault] = useState(false)
  const [hfLimit, setHfLimit] = useState<number>(50)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setSemanticDefault(Boolean(json.semantic_default))
      setHfLimit(Number(json.hf_daily_limit ?? 50))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function save(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semantic_default: semanticDefault, hf_daily_limit: hfLimit })
      })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setMessage('Settings saved')
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      console.error(err)
      setMessage('Save failed')
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container mx-auto p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <form onSubmit={save} className="mt-4 max-w-lg">
        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={semanticDefault} onChange={e => setSemanticDefault(e.target.checked)} />
            <span>Enable Semantic Search by default</span>
          </label>
          <p className="text-sm text-gray-500 mt-1">If enabled, Semantic Search toggles will default to on when you visit the Search page.</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium">Hugging Face daily API call limit</label>
          <input type="number" value={hfLimit} min={0} onChange={e => setHfLimit(parseInt(e.target.value || '0', 10))} className="mt-1 rounded border px-2 py-1 w-32" />
          <p className="text-sm text-gray-500 mt-1">Use this to express a soft cap for daily HF calls; enforcement requires server-side usage tracking (not yet implemented).</p>
        </div>

        <div className="flex items-center gap-2">
          <button disabled={loading} className="rounded bg-blue-600 px-3 py-2 text-white">Save</button>
          {message && <div className="text-sm text-gray-600">{message}</div>}
        </div>
      </form>
    </main>
  )
}
