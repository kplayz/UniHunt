# UniHunt

UniHunt — university & course shortlisting assistant (MVP)

Tech stack: Next.js + Tailwind CSS + shadcn/ui (UI) + Supabase (Auth & Postgres) + Hugging Face Inference API (LLM & embeddings)

Quick start

1. Install dependencies

```bash
npm install
```

2. Create a `.env.local` with required environment variables (see below).

3. Run dev server

```bash
npm run dev
```

Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for server-side migrations / privileged ops)
- `HF_API_TOKEN` (Hugging Face token)

Deployment

- For simple deployment, host the Next.js app on Vercel and use Hugging Face Inference API for ML.
- To deploy to Hugging Face Spaces, build a Docker image (Dockerfile included) and push as a Docker Space. See `Dockerfile`.

Next steps

- Configure Supabase project and run the SQL migration in `db/migrations/001_init.sql`.
- Implement authentication flows and seed licensed dataset samples.

