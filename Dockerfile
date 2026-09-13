# Hugging Face Spaces (Docker SDK). The platform runs the container as UID 1000.
# NEXT_PUBLIC_* values are inlined at `next build`, so they must be Space
# Variables (build-time ARGs). HUGGINGFACE_API_KEY is runtime-only — never ARG it.
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
# HF Spaces requires UID 1000. Creating this user before COPY avoids permission errors.
RUN adduser -D -u 1000 user
ENV HOME=/home/user
WORKDIR $HOME/app

ENV NODE_ENV=production
ENV PORT=7860
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=user:user /app/public ./public
COPY --from=builder --chown=user:user /app/.next/standalone ./
COPY --from=builder --chown=user:user /app/.next/static ./.next/static

USER user

EXPOSE 7860

CMD ["node", "server.js"]
