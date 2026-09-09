"use client"

import React, { useEffect, useState } from 'react'
import ResultsTable from '../../components/ResultsTable'

export default function SearchPage() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [countries, setCountries] = useState<string[]>([])
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])
  const [levels, setLevels] = useState<string[]>([])
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)
  const [sortField, setSortField] = useState<string>('qs_rank')
  const [sortDesc, setSortDesc] = useState<boolean>(false)
  const [page, setPage] = useState<number>(1)
  const [limit, setLimit] = useState<number>(20)
  const [total, setTotal] = useState<number>(0)
  const [semantic, setSemantic] = useState<boolean>(false)

  async function fetchResults() {
    setLoading(true)
    try {
      if (semantic) {
        const body: any = { query: q, limit, countries: selectedCountries, level: selectedLevel }
        const res = await fetch('/api/llm/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' })
        if (!res.ok) throw new Error(await res.text())
        const json = await res.json()
        setResults(json.top || [])
        setTotal((json.top || []).length)
        const uniqCountries: string[] = Array.from(
          new Set((json.top || []).map((r: any) => r.country).filter((value: unknown): value is string => Boolean(value)))
        )
        setCountries(uniqCountries)
        const uniqLevels: string[] = Array.from(
          new Set((json.top || []).map((r: any) => r.course_level).filter((value: unknown): value is string => Boolean(value)))
        )
        setLevels(uniqLevels)
      } else {
        const params = new URLSearchParams()
        if (q) params.set('q', q)
        if (selectedCountries.length) params.set('countries', selectedCountries.join(','))
        if (selectedLevel) params.set('level', selectedLevel)
        params.set('sort', sortField)
        params.set('order', sortDesc ? 'desc' : 'asc')
        params.set('page', String(page))
        params.set('limit', String(limit))

        const res = await fetch(`/api/search?${params.toString()}`)
        if (!res.ok) throw new Error(await res.text())
        const json = await res.json()
        setResults(json.data || [])
        setTotal(json.count || 0)
        const uniqCountries: string[] = Array.from(
          new Set((json.data || []).map((r: any) => r.country).filter((value: unknown): value is string => Boolean(value)))
        )
        setCountries(uniqCountries)
        const uniqLevels: string[] = Array.from(
          new Set((json.data || []).map((r: any) => r.course_level).filter((value: unknown): value is string => Boolean(value)))
        )
        setLevels(uniqLevels)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchResults()
  }, [q, selectedCountries, selectedLevel, sortField, sortDesc, page, limit])

  function toggleCountry(c: string) {
    setPage(1)
    setSelectedCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  function onSort(id: string, desc?: boolean) {
    setSortField(id)
    setSortDesc(Boolean(desc))
    setPage(1)
  }

  return (
    <main className="container mx-auto p-6">
      <h1 className="text-2xl font-semibold">Search Courses</h1>
      <form onSubmit={e => { e.preventDefault(); setPage(1); fetchResults(); }} className="mt-4">
        <div className="flex gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by course, university, specialization..." className="flex-1 rounded border px-3 py-2" />
          <button className="rounded bg-blue-600 px-3 py-2 text-white">Search</button>
        </div>
        <div className="mt-2 flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={semantic} onChange={e => setSemantic(e.target.checked)} />
            <span>Semantic search (AI-assisted)</span>
          </label>
        </div>
        {semantic && (
          <div className="mt-3 rounded border-l-4 border-yellow-400 bg-yellow-50 p-3 text-sm text-yellow-800">
            <div className="font-medium">Semantic search uses Hugging Face Inference API</div>
            <div className="mt-1">This feature calls a third-party LLM and embeddings service which may incur usage costs and is subject to rate limits. Use sparingly for best results.</div>
            <div className="mt-2"><a href="https://huggingface.co/pricing" target="_blank" rel="noreferrer" className="text-yellow-900 underline">Hugging Face pricing & limits</a></div>
          </div>
        )}
      </form>

      <section className="mt-4 flex gap-4">
        <div>
          <div className="text-sm font-medium">Countries</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {countries.map(c => (
              <button key={c} onClick={() => toggleCountry(c)} className={`px-2 py-1 rounded border ${selectedCountries.includes(c) ? 'bg-blue-600 text-white' : 'bg-white'}`}>{c}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium">Level</div>
          <select value={selectedLevel ?? ''} onChange={e => { setSelectedLevel(e.target.value || null); setPage(1) }} className="mt-2 rounded border px-2 py-1">
            <option value="">Any</option>
            {levels.map(l => (<option key={l} value={l}>{l}</option>))}
          </select>
        </div>
      </section>

      <section className="mt-6">
        {loading && <p>Loading...</p>}
        <ResultsTable data={results} sorting={{ id: sortField, desc: sortDesc }} onSort={onSort} />

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">Showing {(page - 1) * limit + 1} - {Math.min(page * limit, total)} of {total}</div>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="rounded border px-3 py-1">Prev</button>
            <div>Page {page}</div>
            <button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)} className="rounded border px-3 py-1">Next</button>
            <select value={limit} onChange={e => { setLimit(parseInt(e.target.value, 10)); setPage(1) }} className="rounded border px-2 py-1">
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </section>
    </main>
  )
}
