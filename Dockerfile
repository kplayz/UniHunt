## Multi-stage Dockerfile optimized for production
## - builder installs dev deps and builds app
## - runner installs only production deps for smaller image

FROM node:18-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# copy lockfiles first for better layer caching
COPY package.json package-lock.json* ./

FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# copy package files and install only production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --production

# copy build output and static assets
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js

# create a non-root user for runtime
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000
ENV PORT=3000
CMD ["npm", "start"]
