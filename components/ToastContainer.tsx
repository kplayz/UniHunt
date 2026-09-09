'use client'

import React from 'react'

type Toast = { id: number; message: string; type?: 'info' | 'success' | 'error' }

export default function ToastContainer() {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  React.useEffect(() => {
    function onToast(e: any) {
      const msg = e.detail?.message || 'Message'
      const type = e.detail?.type || 'info'
      const id = Date.now() + Math.floor(Math.random() * 1000)
      setToasts(t => [...t, { id, message: msg, type }])
      setTimeout(() => {
        setToasts(t => t.filter(x => x.id !== id))
      }, 4000)
    }
    window.addEventListener('toast', onToast as EventListener)
    return () => window.removeEventListener('toast', onToast as EventListener)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id} className={`rounded px-3 py-2 text-sm ${t.type === 'success' ? 'bg-green-600 text-white' : t.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'}`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}

export function showToast(message: string, type: 'info' | 'success' | 'error' = 'info') {
  window.dispatchEvent(new CustomEvent('toast', { detail: { message, type } }))
}
