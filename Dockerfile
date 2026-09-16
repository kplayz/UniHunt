# Hugging Face Spaces (Docker SDK). The platform runs the container as UID 1000.
# NEXT_PUBLIC_* values are inlined at `next build`, so they must be Space
# Variables (build-time ARGs). HUGGINGFACE_API_KEY and BRAVE_SEARCH_API_KEY
# are runtime-only — never ARG them.
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Space Settings → Variables (not Secrets). HF passes Variables as Docker build-args.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM base AS runner
# node:20-alpine already has UID 1000 as `node`. Creating another user
# with that UID fails on Hugging Face Spaces (`adduser: uid '1000' in use`).
ENV HOME=/home/node
WORKDIR $HOME/app

ENV NODE_ENV=production
ENV PORT=7860
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 7860

CMD ["node", "server.js"]
