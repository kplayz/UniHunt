Deployment guide — Vercel & Hugging Face Spaces (container)

This document explains how to deploy UniHunt to Vercel (recommended for Next.js) and to Hugging Face Spaces using the container runtime.

Prerequisites
- Docker (for container builds)
- GitHub account (for Vercel/GHA) or Hugging Face account
- A Postgres instance (Supabase or managed Postgres) and Supabase project (recommended)
- Environment variables (see below)

Required environment variables
- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (client)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server only)
- `DATABASE_URL` — Postgres connection for local/test/production (used in migrations)
- `HF_API_KEY` — Hugging Face Inference API key (if used)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`, `ADMIN_ALERT_EMAIL` — optional email SMTP settings
- `HF_GLOBAL_DAILY_LIMIT` — optional global daily cap for HF usage

1) Deploy to Vercel

a) Create a Vercel project and connect the GitHub repository.

b) Set Environment Variables
- In Vercel dashboard -> Project -> Settings -> Environment Variables, add the variables listed above.

c) Build & Runtime Settings
- Build Command: `npm run build`
- Output Directory: (leave default) — Vercel detects Next.js automatically.

d) Post-deploy steps
- Ensure your Supabase instance has the migrations applied (see `db/migrations/`). You can run migrations using the Supabase SQL editor or the CLI.

2) Deploy to Hugging Face Spaces (Container)

Hugging Face Spaces supports Docker containers. Use the included `Dockerfile` to build an image.

a) Build the container locally
```bash
docker build -t unihunt:latest .
```

b) Test locally (requires DATABASE_URL set to a reachable Postgres)
```bash
DATABASE_URL=postgres://user:pass@host:5432/dbname npm run start
```

c) Push container to a registry (Docker Hub/GitHub Packages)
```bash
docker tag unihunt:latest ghcr.io/<org>/unihunt:latest
docker push ghcr.io/<org>/unihunt:latest
```

d) On Hugging Face Spaces, create a new Space and choose 'Container' runtime. In the Space settings, set your environment variables (as above) and point the Space to pull your image from the registry.

3) GitHub Actions (optional)

You can add a deploy workflow that builds the Docker image and pushes to your container registry or triggers a Vercel deployment via the Vercel GitHub app.

4) Database migrations & seeds

- For production, apply `db/migrations/*.sql` in order (use your DB admin or the Supabase SQL editor).
- Seed data is optional; `db/seed/` contains development samples only.

5) Secrets & security
- Never commit `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_URL` to the repo. Use environment variables or secrets in the hosting platform.
- Limit admin APIs and embed endpoints to require service role or admin users as implemented.

6) Monitoring & cost control
- Configure HF usage caps via `HF_GLOBAL_DAILY_LIMIT` and per-profile `hf_daily_limit`.
- Monitor `hf_alerts` and `hf_usage` tables; consider adding a daily cron job to email summaries.

7) Troubleshooting
- 500 on startup: check that `DATABASE_URL` is reachable and migrations applied.
- HF errors: ensure `HF_API_KEY` is set and your HF plan supports the model/embeddings.

If you'd like, I can add a GitHub Actions deploy workflow for Vercel or an automated container build + push action for GHCR/Docker Hub.
