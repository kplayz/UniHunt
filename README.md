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
- **AI search**: uses Hugging Face Inference API to recommend matching universities and courses
- **Sortable & filterable results**: QS World Ranking (default sort), tuition, location, admission requirements, http(s) URLs
- **Shortlist**: save from search or add manually — per user in Supabase, with notes plus duration, language, intake, scholarships
- **Authentication**: email/password, Google, Microsoft via Supabase Auth

## Tech Stack

- Next.js 16 (App Router)
- Tailwind CSS 4 + shadcn/ui
- Supabase (Auth + PostgreSQL)
- Hugging Face Inference API

## Environment variables

| Variable | Where it is read | Local | Hugging Face Space |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | `.env.local` | **Variable** (needed at Docker **build**) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | `.env.local` | **Variable** (needed at Docker **build**) |
| `HUGGINGFACE_API_KEY` | Server only (`/api/search`) | `.env.local` | **Secret** (runtime only) |
| `HF_MODEL` | Server only, optional | `.env.local` | **Variable** or **Secret**, optional |

`NEXT_PUBLIC_*` is inlined into the JS bundle at `next build`. On Spaces, Variables are passed as Docker `ARG`s — that is why they must be Variables, not Secrets. `HUGGINGFACE_API_KEY` must stay a Secret so it is not baked into the image.

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

Supabase Auth URL config for local:

- Site URL: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/auth/callback`

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

Replace `<hf-user>` and `<space-name>` everywhere below. Example: if your
Hugging Face username is `ashnhash` and the Space is `university-course-finder`,
the app URL is `https://ashnhash-university-course-finder.hf.space`.

### 0. Prerequisites

- A [Hugging Face](https://huggingface.co/join) account
- This repo building locally (`npm run build`)
- Values from `.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable or anon key — never `service_role`)
  - `HUGGINGFACE_API_KEY` (token from [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) with Inference permission)
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

Pick **one** of the two methods.

#### Option A — Git remote (recommended for this repo)

From the project root (PowerShell or bash):

```bash
git remote add space https://huggingface.co/spaces/<hf-user>/<space-name>
git push space HEAD:main
```

If the Space was created with a README already, the first push may be rejected.
Pull with allow-unrelated-histories, or force-push only if you are sure the
Space has nothing you need:

```bash
git pull space main --allow-unrelated-histories
# resolve the README if Git asks, then:
git push space HEAD:main
```

The Space remote uses your HF username and a token as the password when Git
prompts. After a successful push, the Space page shows a building log.

#### Option B — Connect GitHub

1. Push this project to a GitHub repository
2. On the Space: **Settings → Storage and repository → Linked GitHub repository**
3. Select the repo and the branch (`main`)
4. Save. Hugging Face clones that branch and builds on every push to it

Use A **or** B, not both, or you will fight two sources of truth.

### 3. Add Variables and Secrets **before** the first successful build

Open the Space → **Settings → Variables and secrets**.

`NEXT_PUBLIC_*` is compiled into the client bundle during `docker build`. On
Spaces, only **Variables** are passed as Docker `ARG`s. If you store them as
Secrets, the image builds with empty Supabase URLs and login will fail.

**Variables** (visible in the UI, available at build and runtime):

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://qnzkuskdkyqyeglvacqx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key from Supabase → Project Settings → API |
| `HF_MODEL` | `Qwen/Qwen2.5-72B-Instruct` (optional; omit to use the default) |

**Secrets** (hidden, injected only at **runtime**):

| Name | Value |
| --- | --- |
| `HUGGINGFACE_API_KEY` | `hf_…` token with Inference access |

Do **not** add Google or Azure client secrets here. Those stay in the Supabase
provider forms.

After saving Variables, open the Space **Logs** tab and click **Factory reboot**
(or **Rebuild**) so Docker runs again with the new build-args. A plain
**Restart** reuses the old image and will not pick up `NEXT_PUBLIC_*` changes.

### 4. Confirm the build

1. **Logs** should show `npm ci`, `npm run build`, then `node server.js`
2. Status becomes **Running**
3. Open `https://<hf-user>-<space-name>.hf.space` — you should see the login page

If the build fails:

| Symptom | Likely cause |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` empty / Supabase client error at build | Variables missing, or stored as Secrets instead of Variables |
| Permission denied / cannot write | Dockerfile user is not UID 1000 (already fixed in this repo) |
| `npm run build` TypeScript errors | Push a commit that `npm run build`s locally first |
| App runs but search says API key not configured | `HUGGINGFACE_API_KEY` Secret missing; **Restart** is enough for Secrets |
| 401 on `/search` after login | Space URL not in Supabase redirect allow-list (next step) |

### 5. Point Supabase Auth at the Space

1. Open [URL Configuration](https://supabase.com/dashboard/project/qnzkuskdkyqyeglvacqx/auth/url-configuration)
2. Keep `http://localhost:3000` if you still develop locally
3. **Additional Redirect URLs** — add:

   `https://<hf-user>-<space-name>.hf.space/auth/callback`

4. When the Space is the real front door, set **Site URL** to:

   `https://<hf-user>-<space-name>.hf.space`

OAuth providers still redirect to Supabase first, not to the Space:

```
https://qnzkuskdkyqyeglvacqx.supabase.co/auth/v1/callback
```

That URI should already be on the Google and Azure apps from local setup.

### 6. Allow the Space origin on Google (and Azure if needed)

**Google Cloud → APIs & Services → Credentials → your Web client**

- Authorized JavaScript origins: add `https://<hf-user>-<space-name>.hf.space`
- Authorized redirect URIs: leave the Supabase callback (do not add the Space `/auth/callback` here)

**Azure Entra → App registration → Authentication**

- Web redirect URIs: same Supabase callback only
- No extra Space URL is required on Azure unless you added a different reply URL yourself

### 7. Smoke-test the live app

1. Open `https://<hf-user>-<space-name>.hf.space`
2. Sign in with email, or Google / Microsoft
3. You should land on `/search` (last session restored if you already searched)
4. Run a search — this proves `HUGGINGFACE_API_KEY` at runtime
5. Shortlist a course and open `/shortlist` — this proves Supabase + cookies on the Space host

### 8. Later updates

```bash
git push space HEAD:main
```

Or push to the linked GitHub branch if you used Option B.

- Code-only change → Spaces rebuilds automatically
- `NEXT_PUBLIC_*` Variable change → **Factory reboot**
- `HUGGINGFACE_API_KEY` Secret change → **Restart** is enough
- Space URL change (rename) → update Supabase redirect URLs and Google origins again

## Project Structure

```
src/
  app/
    api/search/       # AI search endpoint
    api/shortlist/    # Shortlist CRUD + notes PATCH
    auth/callback/    # OAuth / email code exchange
    login/            # Auth page
    search/           # Search route (restores last session)
    shortlist/        # Saved courses
  proxy.ts            # Session refresh + route protection
supabase/schema.sql   # Database setup (safe to re-run)
Dockerfile            # HF Spaces / local Docker
.env.example          # Local env template
```

`/search` and `/shortlist` load the user on the server, then hand off to client views. `/search` restores the latest `search_sessions` row.

## License

MIT

