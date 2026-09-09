import React, { useEffect, useState } from 'react'

export default function AddToShortlist({ course }: { course: any }) {
  const [shortlists, setShortlists] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/shortlists').then(async res => {
      if (res.ok) {
        const json = await res.json()
        setShortlists(json.data || [])
      }
    })
  }, [])

  async function handleAdd(shortlistId: string) {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch(`/api/shortlists/${shortlistId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ university_id: course.university_id, course_id: course.course_id, note: course.overview })
      })
      if (!res.ok) throw new Error(await res.text())
      setMessage('Added')
      // notify other parts of app to refresh
      window.dispatchEvent(new CustomEvent('shortlistUpdated', { detail: { shortlistId } }))
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Added to shortlist', type: 'success' } }))
    } catch (err: any) {
      setMessage('Error')
      console.error(err)
    } finally {
      setLoading(false)
      setTimeout(() => setMessage(''), 2000)
    }
  }

  return (
    <div className="relative inline-block text-left">
      <button onClick={() => setOpen(v => !v)} className="rounded bg-blue-600 px-2 py-1 text-white text-sm">Add</button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded border bg-white p-2 shadow">
          <div className="text-sm font-medium">Select shortlist</div>
          <div className="mt-2 space-y-2">
            {shortlists.map(s => (
              <div key={s.id} className="flex items-center justify-between">
                <div className="text-sm">{s.name}</div>
                <button onClick={() => handleAdd(s.id)} disabled={loading} className="ml-2 rounded bg-green-600 px-2 py-1 text-white text-xs">Add</button>
              </div>
            ))}
          </div>
          <div className="mt-2 text-sm text-gray-500">{message}</div>
        </div>
      )}
    </div>
  )
}
