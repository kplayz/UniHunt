import React from 'react'

type Item = {
  id: string
  university_id?: string
  course_id?: string
  note?: string
}

export default function ShortlistModal({ open, onClose, shortlist, items, refresh }: { open: boolean; onClose: () => void; shortlist: any; items: Item[]; refresh: () => void }) {
  const [note, setNote] = React.useState('')
  const [adding, setAdding] = React.useState(false)

  if (!open) return null

  async function handleAddManual() {
    if (!shortlist) return
    setAdding(true)
    try {
      await fetch(`/api/shortlists/${shortlist.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ university_id: null, course_id: null, note })
      })
      setNote('')
      refresh()
      window.dispatchEvent(new CustomEvent('shortlistUpdated', { detail: { shortlistId: shortlist.id } }))
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Manual item added', type: 'success' } }))
    } catch (err) {
      console.error(err)
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(itemId: string) {
    try {
      await fetch(`/api/shortlists/items/${itemId}`, { method: 'DELETE' })
      refresh()
      window.dispatchEvent(new CustomEvent('shortlistUpdated'))
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Item removed', type: 'info' } }))
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-11/12 max-w-3xl rounded bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">{shortlist?.name}</h3>
          <button onClick={onClose} className="text-sm text-gray-600">Close</button>
        </div>
        <div className="mt-4">
          <div className="mb-4">
            <label className="block text-sm font-medium">Add manual entry</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" placeholder="Paste university/course details or notes" />
            <div className="mt-2 flex justify-end">
              <button onClick={handleAddManual} disabled={adding} className="rounded bg-green-600 px-3 py-1 text-white text-sm">Add</button>
            </div>
          </div>

          {items.length === 0 && <p className="text-sm text-gray-500">No items in this shortlist.</p>}
          <ul className="space-y-3">
            {items.map(it => (
              <li key={it.id} className="rounded border p-3 flex justify-between">
                <div>
                  <div className="text-sm">{it.university_id ? `University ID: ${it.university_id}` : 'Manual entry'}</div>
                  <div className="text-sm">{it.course_id ? `Course ID: ${it.course_id}` : ''}</div>
                  <div className="text-sm text-gray-600">{it.note}</div>
                </div>
                <div>
                  <button onClick={() => handleRemove(it.id)} className="rounded bg-red-500 px-3 py-1 text-white text-sm">Remove</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
