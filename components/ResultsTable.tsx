import React from 'react'
import AddToShortlist from './AddToShortlist'

export default function ResultsTable({ data, sorting, onSort }: { data: any[]; sorting?: { id: string; desc?: boolean } | null; onSort?: (id: string, desc?: boolean) => void }) {
  function renderReq(req: any) {
    if (!req) return '—'
    try {
      if (typeof req === 'string') req = JSON.parse(req)
    } catch (e) {}
    const gpa = req?.gpa ?? req?.GPA
    const deadline = req?.deadline
    if (!gpa && !deadline) return 'See course page'
    return (
      <div className="text-sm">
        {gpa ? <div>GPA: {gpa}</div> : null}
        {deadline ? <div>Deadline: {deadline}</div> : null}
      </div>
    )
  }

  function headerClick(id: string) {
    if (!onSort) return
    const current = sorting?.id === id ? sorting : null
    const desc = current ? !current.desc : false
    onSort(id, desc)
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr>
              <th className="border-b p-2 text-left cursor-pointer" onClick={() => headerClick('university_name')}>University {sorting?.id === 'university_name' ? (sorting.desc ? ' 🔽' : ' 🔼') : ''}</th>
              <th className="border-b p-2 text-left">Location</th>
              <th className="border-b p-2 text-left cursor-pointer" onClick={() => headerClick('course_name')}>Course {sorting?.id === 'course_name' ? (sorting.desc ? ' 🔽' : ' 🔼') : ''}</th>
              <th className="border-b p-2 text-left">Level</th>
              <th className="border-b p-2 text-left cursor-pointer" onClick={() => headerClick('qs_rank')}>QS Rank {sorting?.id === 'qs_rank' ? (sorting.desc ? ' 🔽' : ' 🔼') : ''}</th>
              <th className="border-b p-2 text-left cursor-pointer" onClick={() => headerClick('tuition_estimate')}>Tuition {sorting?.id === 'tuition_estimate' ? (sorting.desc ? ' 🔽' : ' 🔼') : ''}</th>
              <th className="border-b p-2 text-left">Admission Req</th>
              <th className="border-b p-2 text-left">Link</th>
              <th className="border-b p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, idx) => (
              <tr key={r.course_id || idx} className="hover:bg-gray-50">
                <td className="p-2 align-top">{r.university_name}</td>
                <td className="p-2 align-top">{(r.city ? r.city + ', ' : '') + (r.country || '')}</td>
                <td className="p-2 align-top">{r.course_name}</td>
                <td className="p-2 align-top">{r.course_level}</td>
                <td className="p-2 align-top">{r.qs_rank ?? '—'}</td>
                <td className="p-2 align-top">{r.tuition_estimate ? `$${r.tuition_estimate}` : '—'}</td>
                <td className="p-2 align-top">{renderReq(r.requirements)}</td>
                <td className="p-2 align-top"><a href={r.university_website} target="_blank" rel="noreferrer" className="text-blue-600">View</a></td>
                <td className="p-2 align-top"><AddToShortlist course={r} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
