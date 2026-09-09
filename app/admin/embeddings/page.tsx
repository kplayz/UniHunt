"use client"
import React, { useEffect, useState, useMemo } from 'react'

export default function AdminEmbeddingsPage() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  async function fetchAlerts() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/hf-alerts', { credentials: 'same-origin' })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setAlerts(json.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function fetchUsage() {
    try {
      const res = await fetch('/api/admin/usage', { credentials: 'same-origin' })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      return json.data || []
    "use client"
    import React, { useEffect, useState, useMemo } from 'react'

    export default function AdminEmbeddingsPage() {
      const [alerts, setAlerts] = useState<any[]>([])
      const [loading, setLoading] = useState(false)
      const [status, setStatus] = useState<string | null>(null)
      const [usage, setUsage] = useState<any[]>([])

      async function fetchAlerts() {
        setLoading(true)
        try {
          const res = await fetch('/api/admin/hf-alerts', { credentials: 'same-origin' })
          if (!res.ok) throw new Error(await res.text())
          const json = await res.json()
          setAlerts(json.data || [])
        } catch (e) {
          console.error(e)
        } finally {
          setLoading(false)
        }
      }

      async function fetchUsage() {
        try {
          const res = await fetch('/api/admin/usage', { credentials: 'same-origin' })
          if (!res.ok) throw new Error(await res.text())
          const json = await res.json()
          setUsage(json.data || [])
        } catch (e) {
          console.error('fetchUsage error', e)
        }
      }

      async function resolveAlert(id: string) {
        try {
          const res = await fetch('/api/admin/hf-alerts/resolve', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
          if (!res.ok) throw new Error(await res.text())
          await refreshAll()
        } catch (e) {
          console.error('resolve error', e)
        }
      }

      async function toggleNotify(id: string, notify: boolean) {
        try {
          const res = await fetch('/api/admin/hf-alerts/notify', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, notify }) })
          if (!res.ok) throw new Error(await res.text())
          await refreshAll()
        } catch (e) {
          console.error('toggleNotify error', e)
        }
      }

      async function resetUsage(userId: string) {
        try {
          const res = await fetch('/api/admin/usage/reset', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) })
          if (!res.ok) throw new Error(await res.text())
          setStatus('Usage reset')
          await refreshAll()
        } catch (e) {
          console.error('reset error', e)
        }
      }

      async function refreshAll() {
        setLoading(true)
        try {
          await fetchAlerts()
          await fetchUsage()
        } finally {
          setLoading(false)
        }
      }

      async function triggerEmbeddings() {
        setStatus('Triggering embeddings...')
        try {
          const res = await fetch('/api/llm/embed-courses', { method: 'POST', credentials: 'same-origin' })
          const json = await res.json()
          if (!res.ok) setStatus(`Error: ${json.error || JSON.stringify(json)}`)
          else setStatus(`Imported ${json.imported || 0} embeddings`)
        } catch (e: any) {
          setStatus(`Error: ${e.message}`)
        }
        await refreshAll()
      }

      function exportCSV(rows: any[]) {
        if (!rows || rows.length === 0) return
        const keys = ['created_at','alert_type','message','email_to','email_sent','notify','resolved']
        const csv = [keys.join(',')].concat(rows.map(r => keys.map(k => { const v = r[k]; return '"' + (v === null || v === undefined ? '' : String(v).replace(/"/g,'""')) + '"' }).join(','))).join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `hf_alerts_${new Date().toISOString().slice(0,10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }

      const [typeFilter, setTypeFilter] = useState<string>('')
      const [resolvedFilter, setResolvedFilter] = useState<string>('')
      const [emailFilter, setEmailFilter] = useState<string>('')
      const [notifyFilter, setNotifyFilter] = useState<string>('')
      const [searchText, setSearchText] = useState<string>('')

      const filteredAlerts = useMemo(() => {
        return alerts.filter(a => {
          if (typeFilter && a.alert_type !== typeFilter) return false
          if (resolvedFilter) {
            const want = resolvedFilter === 'resolved'
            if ((a.resolved || false) !== want) return false
          }
          if (emailFilter) {
            const want = emailFilter === 'sent'
            if ((a.email_sent || false) !== want) return false
          }
          if (notifyFilter) {
            const want = notifyFilter === 'yes'
            if ((a.notify || false) !== want) return false
          }
          if (searchText) {
            const s = searchText.toLowerCase()
            if (!((a.message||'').toLowerCase().includes(s) || (a.alert_type||'').toLowerCase().includes(s) || (a.email_to||'').toLowerCase().includes(s))) return false
          }
          return true
        })
      }, [alerts, typeFilter, resolvedFilter, emailFilter, notifyFilter, searchText])

      useEffect(() => { refreshAll() }, [])

      return (
        <main className="container mx-auto p-6">
          <h1 className="text-2xl font-semibold">Admin — Embeddings & HF Alerts</h1>
          <div className="mt-4 flex gap-2">
            <button onClick={triggerEmbeddings} className="rounded bg-green-600 px-3 py-2 text-white">Trigger Embeddings</button>
            <button onClick={refreshAll} className="rounded border px-3 py-2">Refresh</button>
            {status && <div className="ml-4 text-sm text-gray-700">{status}</div>}
          </div>

          <section className="mt-6">
            <h2 className="text-lg font-medium">HF Alerts</h2>
            <div className="mt-2 flex gap-2 items-center">
              <input placeholder="Search" value={searchText} onChange={e => setSearchText(e.target.value)} className="rounded border px-2 py-1" />
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="rounded border px-2 py-1">
                <option value="">All types</option>
                {Array.from(new Set(alerts.map(a => a.alert_type))).map(t => (<option key={t} value={t}>{t}</option>))}
              </select>
              <select value={resolvedFilter} onChange={e => setResolvedFilter(e.target.value)} className="rounded border px-2 py-1">
                <option value="">All</option>
                <option value="resolved">Resolved</option>
                <option value="unresolved">Unresolved</option>
              </select>
              <select value={emailFilter} onChange={e => setEmailFilter(e.target.value)} className="rounded border px-2 py-1">
                <option value="">Email</option>
                <option value="sent">Sent</option>
                <option value="unsent">Unsent</option>
              </select>
              <select value={notifyFilter} onChange={e => setNotifyFilter(e.target.value)} className="rounded border px-2 py-1">
                <option value="">Notify</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              <button onClick={() => exportCSV(filteredAlerts)} className="rounded border px-3 py-1">Export CSV</button>
            </div>

            {loading && <p>Loading...</p>}
            {!loading && filteredAlerts.length === 0 && <p className="text-sm text-gray-600">No alerts</p>}
            {filteredAlerts.length > 0 && (
              <div className="mt-2 overflow-auto">
                <table className="w-full table-auto border-collapse">
                  <thead>
                    <tr className="text-left">
                      <th className="border px-2 py-1">Time</th>
                      <th className="border px-2 py-1">Type</th>
                      <th className="border px-2 py-1">Message</th>
                      <th className="border px-2 py-1">Email Sent</th>
                      <th className="border px-2 py-1">Notify</th>
                      <th className="border px-2 py-1">Resolved</th>
                      <th className="border px-2 py-1">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts.map(a => (
                      <tr key={a.id}>
                        <td className="border px-2 py-1">{new Date(a.created_at).toLocaleString()}</td>
                        <td className="border px-2 py-1">{a.alert_type}</td>
                        <td className="border px-2 py-1">{a.message}</td>
                        <td className="border px-2 py-1">{a.email_sent ? 'Yes' : 'No'}</td>
                        <td className="border px-2 py-1">{a.notify ? 'Yes' : 'No'}</td>
                        <td className="border px-2 py-1">{a.resolved ? 'Yes' : 'No'}</td>
                        <td className="border px-2 py-1 flex gap-2">
                          <button onClick={() => resolveAlert(a.id)} className="rounded bg-blue-600 px-2 py-1 text-white text-sm">Resolve</button>
                          <button onClick={() => toggleNotify(a.id, !a.notify)} className="rounded bg-indigo-600 px-2 py-1 text-white text-sm">{a.notify ? 'Unmark' : 'Notify'}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mt-6">
            <h2 className="text-lg font-medium">HF Usage (Today)</h2>
            {loading && <p>Loading...</p>}
            {!loading && usage.length === 0 && <p className="text-sm text-gray-600">No usage data</p>}
            {usage.length > 0 && (
              <div className="mt-2 overflow-auto">
                <table className="w-full table-auto border-collapse">
                  <thead>
                    <tr className="text-left">
                      <th className="border px-2 py-1">User</th>
                      <th className="border px-2 py-1">Calls</th>
                      <th className="border px-2 py-1">Soft</th>
                      <th className="border px-2 py-1">Limit</th>
                      <th className="border px-2 py-1">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map(u => (
                      <tr key={u.user_id}>
                        <td className="border px-2 py-1">{u.full_name || u.username || u.user_id}</td>
                        <td className="border px-2 py-1">{u.calls}</td>
                        <td className="border px-2 py-1">{u.hf_soft_limit ?? '-'}</td>
                        <td className="border px-2 py-1">{u.hf_daily_limit ?? '-'}</td>
                        <td className="border px-2 py-1"><button onClick={() => resetUsage(u.user_id)} className="rounded bg-yellow-600 px-2 py-1 text-white text-sm">Reset</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      )
    }
