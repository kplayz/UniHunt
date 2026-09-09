import { NextResponse } from 'next/server'
import { supabaseServer } from '../../../lib/supabaseServer'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const qp = url.searchParams
    const q = qp.get('q') || ''
    const countriesParam = qp.get('countries') || ''
    const countries = countriesParam ? countriesParam.split(',').map(s => s.trim()).filter(Boolean) : null
    const level = qp.get('level') || null
    const specialization = qp.get('specialization') || null
    const candidateType = qp.get('candidateType') || null
    const minGPA = qp.get('minGPA') ? parseFloat(qp.get('minGPA') as string) : null
    const maxTuition = qp.get('maxTuition') ? parseFloat(qp.get('maxTuition') as string) : null
    const sort = qp.get('sort') || 'qs_rank'
    const order = qp.get('order') === 'asc' ? true : false
    const page = qp.get('page') ? Math.max(1, parseInt(qp.get('page') as string, 10)) : 1
    const limit = qp.get('limit') ? Math.min(100, parseInt(qp.get('limit') as string, 10)) : 20
    const offset = (page - 1) * limit

    let query = supabaseServer
      .from('course_search')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)

    // Full-text-ish matching across course and university fields
    if (q) {
      const like = `%${q.replace(/%/g, '\\%')}%`
      query = query.or(`course_name.ilike.${like},overview.ilike.${like},university_name.ilike.${like}`)
    }

    if (countries && countries.length > 0) {
      query = query.in('country', countries)
    }

    if (level) {
      query = query.eq('course_level', level)
    }

    if (specialization) {
      const likeSpec = `%${specialization.replace(/%/g, '\\%')}%`
      query = query.or(`course_name.ilike.${likeSpec},overview.ilike.${likeSpec}`)
    }

    if (minGPA) {
      // requirements JSON contains gpa field in sample seed; filter where requirements->>'gpa' >= minGPA
      // Supabase/PostgREST doesn't support JSON numeric comparisons directly via client helpers; use filter on text and cast
      query = query.filter("(requirements->>\'gpa\')::numeric", 'gte', minGPA)
    }

    if (maxTuition) {
      query = query.lte('tuition_estimate', maxTuition)
    }

    // Ordering
    const allowedSorts = ['qs_rank', 'tuition_estimate', 'course_name']
    const sortField = allowedSorts.includes(sort) ? sort : 'qs_rank'
    query = query.order(sortField, { ascending: order })

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, count, page, limit })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
