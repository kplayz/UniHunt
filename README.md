---
title: UniHunt
emoji: 🎓
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Web app to search for courses and universities across world
---

# University Course Finder

AI-powered web app to discover and shortlist university courses based on your academic profile, preferences, and budget. Works on desktop (Windows, macOS), tablets, and mobile phones.

## Status

All build and backend steps below are **done**. Remaining work is only what you do in external dashboards (OAuth consoles, Space secrets, a push to a Space).

| Step | Status |
| --- | --- |
| Next.js app (search, shortlist, notes, last-search restore) | Done |
| TanStack Table v9 + Next 16 `proxy.ts` | Done |
| Supabase project `university-course-finder` (`qnzkuskdkyqyeglvacqx`, Mumbai) | Done |
| Schema, RLS, unique index `(user_id, university_name, course_name)` | Done |
| Typed clients (`src/lib/supabase/database.types.ts`) | Done |
| Email/password auth (tested) | Done |
| Google OAuth in app (`signInWithOAuth`) | Done — paste Client ID/secret in [Supabase Google provider](https://supabase.com/dashboard/project/qnzkuskdkyqyeglvacqx/auth/providers) if not already |
| Microsoft OAuth in app (`provider: "azure"`, `email` scope) | Done — needs an Entra **directory** first, then Azure app + [Supabase Azure provider](https://supabase.com/dashboard/project/qnzkuskdkyqyeglvacqx/auth/providers) |
| Local env template (`.env.example`) | Done |
| Hugging Face Spaces Docker config | Done (this file’s YAML + `Dockerfile`) |

## Features

- **Smart search criteria**: course level, type, specialization, multi-country selection, candidate type (in-state / out-of-state / out-of-country)
- **Candidate profile**: last qualification, school, curriculum, subjects, grades/GPA, budget
- **AI search**: Brave Search finds live official course pages, then Hugging Face structures matching recommendations with verified URLs
- **Sortable & filterable results**: QS World Ranking (default sort), tuition, location, admission requirements, http(s) URLs
- **Shortlist**: save from search or add manually — per user in Supabase, with notes plus duration, language, intake, scholarships
- **Authentication**: email/password, Google, Microsoft via Supabase Auth

## Tech Stack

- Next.js 16 (App Router)
- Tailwind CSS 4 + shadcn/ui
- Supabase (Auth + PostgreSQL)
- Hugging Face Inference API
- Brave Search API (verified course page URLs)

## Environment variables

| Variable | Where it is read | Local | Hugging Face Space |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | `.env.local` | **Variable** (needed at Docker **build**) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | `.env.local` | **Variable** (needed at Docker **build**) |
| `HUGGINGFACE_API_KEY` | Server only (`/api/search`) | `.env.local` | **Secret** (runtime only) |
| `BRAVE_SEARCH_API_KEY` | Server only (`/api/search`) | `.env.local` | **Secret** (runtime only) |
| `HF_MODEL` | Server only, optional | `.env.local` | **Variable** or **Secret**, optional |

`NEXT_PUBLIC_*` is inlined into the JS bundle at `next build`. On Spaces, Variables are passed as Docker `ARG`s — that is why they must be Variables, not Secrets. `HUGGINGFACE_API_KEY` and `BRAVE_SEARCH_API_KEY` must stay Secrets so they are not baked into the image.

Never put a Supabase `service_role` key, a Google client secret, or an Azure client secret in this repo or in Space Variables. OAuth secrets belong only in the Supabase provider forms.

```bash
cp .env.example .env.local
```

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Supabase Auth URL config:

- Site URL (production): `https://ashnhash-unihunt.hf.space`
- Redirect URLs (need wildcards — `?next=` is part of the callback):
  - `http://localhost:3000/**`
  - `https://ashnhash-unihunt.hf.space/**`

OAuth apps use the **Supabase** callback, not the Next.js one:

```
https://qnzkuskdkyqyeglvacqx.supabase.co/auth/v1/callback
```

Microsoft: creating an app under a personal account with no Entra directory is deprecated. Create or switch into a directory first ([Entra admin center](https://entra.microsoft.com)), then **App registrations → New registration**. Details are in the [Supabase Azure guide](https://supabase.com/docs/guides/auth/social-login/auth-azure).

Optional: enable [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) on the Email provider.

## Deploy to Hugging Face Spaces

Spaces builds this repo with the `Dockerfile` and serves the Next.js standalone
server on port **7860**. The YAML block at the top of this file (`sdk: docker`,
`app_port: 7860`) is what the platform reads — do not remove it.

This repo is already wired to **[ashnhash/UniHunt](https://huggingface.co/spaces/ashnhash/UniHunt)**.
The live app URL is **https://ashnhash-unihunt.hf.space**.

### 0. Prerequisites

- A [Hugging Face](https://huggingface.co/join) account
- This repo building locally (`npm run build`)
- Values from `.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable or anon key — never `service_role`)
  - `HUGGINGFACE_API_KEY` (token from [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) with Inference permission)
  - `BRAVE_SEARCH_API_KEY` (key from [Brave Search API](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started) with Web Search access)
- Git, plus either:
  - the [Hugging Face CLI](https://huggingface.co/docs/huggingface_hub/guides/cli) (`pip install huggingface_hub`), or
  - a connected GitHub repo (Spaces can pull from GitHub)

Log the CLI in once:

```bash
huggingface-cli login
```

Create a **Write** token if the CLI asks for one.

### 1. Create the Space

1. Open [huggingface.co/new-space](https://huggingface.co/new-space)
2. **Space name:** e.g. `university-course-finder` (lowercase, hyphens only)
3. **License:** MIT
4. **SDK:** **Docker** — not Gradio or Streamlit. A Gradio Space cannot run this Next.js app.
5. **Hardware:** CPU basic is enough
6. **Visibility:** Public or Private. Private Spaces still get a public-looking `*.hf.space` URL; anyone with the link can open the app unless you add Space authentication later.
7. Create the Space and wait until the empty repo page loads

Do not paste a custom Dockerfile in the website form. This repo already has one.

### 2. Put the code on the Space

This is **already done** for UniHunt (`git remote space` → `main` at
`cbb11bf` and earlier). You only need this section again when you change code.

Confirm the remote, then push any new commits:

```powershell
cd C:\Users\User\Projects\university-course-finder
git remote -v
# should show:  space  https://huggingface.co/spaces/ashnhash/UniHunt
git push space HEAD:main
```

If Git asks for a password, use a Hugging Face **Write** token from
[huggingface.co/settings/tokens](https://huggingface.co/settings/tokens), not
your account password.

After the push, open [the Space](https://huggingface.co/spaces/ashnhash/UniHunt).
The status pill at the top (Building / Running / Error) and the **Logs** tab
show Docker output. You do **not** need to click anything for a code push —
Spaces starts a new build by itself.

### 3. Add Variables and Secrets

Open **[Space Settings](https://huggingface.co/spaces/ashnhash/UniHunt/settings)**
while logged in as `ashnhash`.

Scroll until you see **Variables and secrets** (sometimes titled
**Repository secrets** / **App secrets**). There are two add buttons:

- **New variable** — visible in the UI, passed into `docker build` as `ARG`
- **New secret** — hidden, available to the running container only

`NEXT_PUBLIC_*` is compiled into the browser bundle during `docker build`.
If you save those as Secrets, the image builds with empty Supabase URLs and
login will fail.

Click **New variable** for each of these (names must match exactly):

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://qnzkuskdkyqyeglvacqx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key from [Supabase API settings](https://supabase.com/dashboard/project/qnzkuskdkyqyeglvacqx/settings/api) |
| `HF_MODEL` | `meta-llama/Llama-3.3-70B-Instruct` (optional; this is the default) |

Click **New secret** for:

| Name | Value |
| --- | --- |
| `HUGGINGFACE_API_KEY` | `hf_…` token with Inference access |
| `BRAVE_SEARCH_API_KEY` | Brave Search API key with Web Search access |

Do **not** add Google or Azure client secrets here.

### 3b. Rebuild after changing Variables (there is no “Factory reboot” on Logs)

The button is **not** on the Logs tab. Hugging Face has renamed it several
times. Look on **Settings**, in the **Danger zone** / **Runtime** block near
the bottom of
[https://huggingface.co/spaces/ashnhash/UniHunt/settings](https://huggingface.co/spaces/ashnhash/UniHunt/settings).

You want the control that **rebuilds the Docker image**, not the one that only
restarts the existing container. Current labels you may see:

| Label | What it does | Use when |
| --- | --- | --- |
| **Factory rebuild** / **Factory reset** / **Factory reboot** | Deletes the old image and runs `docker build` again | You changed a **Variable** (`NEXT_PUBLIC_*`) |
| **Restart this Space** | Starts the **same** image again | You only changed a **Secret** (`HUGGINGFACE_API_KEY`, `BRAVE_SEARCH_API_KEY`) |
| **Pause** | Stops the Space (saves CPU) | You are done for the day |

A **Restart** will not pick up new `NEXT_PUBLIC_*` values.

If you cannot see Factory rebuild:

1. Confirm you are the Space **owner** (`ashnhash`) and not viewing as a guest
2. Scroll past Hardware, Sleep time, and Variables — the rebuild control is
   usually under **Danger Zone**
3. Skip the button entirely: make any tiny commit and `git push space HEAD:main`.
   A new commit always triggers a full Docker rebuild
4. Or from a terminal (after `huggingface-cli login`):

   ```powershell
   hf spaces restart ashnhash/UniHunt --factory-reboot
   ```

   Older CLI: `huggingface-cli` does not always have this flag; the `hf` CLI does.

Then open **Logs** (top of the Space page, next to App / Files / Community).
You should see a new `===== Build Queued` line and `npm run build`.

### 4. Confirm the build

1. Status pill becomes **Running** (green)
2. Open https://ashnhash-unihunt.hf.space — you should see the login page
3. In Logs, a healthy boot ends with something like `Ready` / `Listening` /
   `node server.js` (Next standalone)

If the build fails:

| Symptom | Likely cause |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` empty / Supabase client error | Variables missing, or stored as Secrets |
| `adduser: uid '1000' in use` | Fixed in `cbb11bf` — Spaces should be past this |
| `npm run build` TypeScript errors | Push a commit that builds locally first |
| App runs but search says API key not configured | Add `HUGGINGFACE_API_KEY` and `BRAVE_SEARCH_API_KEY`, then **Restart** (not Factory rebuild) |
| 401 on `/search` after login | Space URL missing from Supabase redirects (step 5) |
| Lands on `https://0.0.0.0:7860/search` after Google | Space is still on a build that used the container bind address. Push the auth callback fix and wait for **Running**. |

### 5. Point Supabase Auth at the Space

1. Open [URL Configuration](https://supabase.com/dashboard/project/qnzkuskdkyqyeglvacqx/auth/url-configuration)
2. Set **Site URL** to `https://ashnhash-unihunt.hf.space`
   (this is the fallback when a `redirectTo` is rejected — if it stays
   `http://localhost:3000`, Space logins bounce back to localhost)
3. Under **Redirect URLs** add both wildcards (exact `/auth/callback` is not
   enough, because the app sends `?next=/search`):

   `http://localhost:3000/**`

   `https://ashnhash-unihunt.hf.space/**`

4. Save. Local `npm run dev` still works; Google/Microsoft logins from the
   Space stay on the Space.

OAuth still uses the **Supabase** callback (already on the Google/Azure apps):

```
https://qnzkuskdkyqyeglvacqx.supabase.co/auth/v1/callback
```

### 6. Allow the Space origin on Google (and Azure if needed)

**Google Cloud → APIs & Services → Credentials → your Web client**

- Authorized JavaScript origins: add `https://ashnhash-unihunt.hf.space`
- Authorized redirect URIs: keep only the Supabase callback above

**Azure Entra → App registration → Authentication**

- Web redirect URIs: same Supabase callback only

### 7. Smoke-test the live app

1. Open https://ashnhash-unihunt.hf.space
2. Sign in with email, or Google / Microsoft
3. You should land on `/search`
4. Run a search — proves `HUGGINGFACE_API_KEY` and `BRAVE_SEARCH_API_KEY`
5. Shortlist a course and open `/shortlist` — proves Supabase cookies on the Space host

### 8. Later updates

```powershell
git push space HEAD:main
```

- Code-only change → Spaces rebuilds automatically (no button)
- `NEXT_PUBLIC_*` Variable change → **Factory rebuild** on Settings, or push any new commit
- `HUGGINGFACE_API_KEY` or `BRAVE_SEARCH_API_KEY` Secret change → **Restart this Space**
- Space rename → update the Supabase redirect and the Google JS origin again

## Project Structure

```
src/
  app/
    api/search/       # Brave-grounded AI search endpoint
    api/shortlist/    # Shortlist CRUD + notes PATCH
    auth/callback/    # OAuth / email code exchange
    login/            # Auth page
    search/           # Search route (restores last session)
    shortlist/        # Saved courses
  lib/
    brave.ts          # Brave Search API + official URL matching
  proxy.ts            # Session refresh + route protection
supabase/schema.sql   # Database setup (safe to re-run)
Dockerfile            # HF Spaces / local Docker
.env.example          # Local env template
```

`/search` and `/shortlist` load the user on the server, then hand off to client views. `/search` restores the latest `search_sessions` row.

## License

MIT

