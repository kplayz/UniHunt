import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <header className="mb-12 flex items-center justify-between gap-4">
          <div className="text-2xl font-bold tracking-tight">UniHunt</div>
          <nav className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <Link href="/search" className="rounded-full border border-slate-200 bg-white px-4 py-2 transition hover:border-slate-300 hover:bg-slate-100">
              Search
            </Link>
            <Link href="/shortlists" className="rounded-full border border-slate-200 bg-white px-4 py-2 transition hover:border-slate-300 hover:bg-slate-100">
              Shortlists
            </Link>
          </nav>
        </header>

        <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
              AI course discovery
            </span>
            <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
              Find the right university course for your profile.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              UniHunt helps students compare universities, discover relevant courses, and shortlist options with matching academic goals and budget fit.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/search" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                Start searching
              </Link>
              <Link href="/shortlists" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100">
                View shortlists
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
              Product snapshot
            </div>
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-100 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Profiles matched</div>
                <div className="mt-2 text-3xl font-bold">1,240</div>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4">
                <div className="text-xs uppercase tracking-wide text-emerald-700">Shortlists created</div>
                <div className="mt-2 text-3xl font-bold text-emerald-800">436</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Top filters</div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-slate-700">
                  <span className="rounded-full bg-slate-100 px-2 py-1">Country</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">Level</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">Tuition</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">AI match</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-lg font-semibold">Smart search</div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Search by program, university, country, and study level while filtering to the most relevant courses.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-lg font-semibold">Shortlists</div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Save promising universities and courses for later comparison without losing context from your search.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-lg font-semibold">AI-assisted discovery</div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Explore semantic search and recommendations to find courses aligned with academic goals and preferences.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
