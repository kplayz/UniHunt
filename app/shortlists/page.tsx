import React, { useState, useEffect } from 'react'
import { useShortlists } from '../../src/hooks/useShortlists'
import ShortlistModal from '../../components/ShortlistModal'

export default function ShortlistsPage() {
  const { shortlists, loading, error, createShortlist, fetchShortlists } = useShortlists()
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<any | null>(null)
  const [items, setItems] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  async function openShortlist(s: any) {
    setSelected(s)
    setModalOpen(true)
    const res = await fetch(`/api/shortlists/${s.id}/items`)
    if (res.ok) {
      const json = await res.json()
      setItems(json.data || [])
    } else {
      setItems([])
    }
  }

  React.useEffect(() => {
    function onUpdated() {
      fetchShortlists()
      if (selected) openShortlist(selected)
    }
    window.addEventListener('shortlistUpdated', onUpdated)
    return () => window.removeEventListener('shortlistUpdated', onUpdated)
  }, [selected])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name) return
    try {
      await createShortlist(name)
      setName('')
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <main className="container mx-auto p-6">
      <h1 className="text-2xl font-semibold">My Shortlists</h1>
      <section className="mt-4">
        <form onSubmit={handleCreate} className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="New shortlist name" className="rounded border px-3 py-2" />
          <button className="rounded bg-blue-600 px-3 py-2 text-white">Create</button>
        </form>
      </section>

      <section className="mt-6">
        {loading && <p>Loading...</p>}
        {error && <p className="text-red-600">{error}</p>}
        <ul className="mt-3 space-y-3">
          {shortlists.map(s => (
            <li key={s.id} className="flex items-center justify-between rounded border p-3">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-gray-600">Created: {new Date(s.created_at).toLocaleString()}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openShortlist(s)} className="rounded bg-gray-100 px-3 py-1 text-sm">Open</button>
                <a href={`https://supabase.com/project`} target="_blank" rel="noreferrer" className="text-sm text-gray-500">Manage</a>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <ShortlistModal open={modalOpen} onClose={() => setModalOpen(false)} shortlist={selected} items={items} refresh={fetchShortlists} />
    </main>
  )
}
