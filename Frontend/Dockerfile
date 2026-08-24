# syntax=docker/dockerfile:1.7
# =============================================================================
# Driver Drowsiness Detection - TanStack Start frontend (SSR)
# =============================================================================
# This app is server-side rendered through Nitro, not a static SPA, so it needs
# a Node runtime container - nginx cannot serve it.
#
# The checked-in .output/ was built with the "cloudflare-module" preset, which
# emits a Worker bundle that `node` cannot execute. NITRO_PRESET=node-server
# below re-targets the build at a plain Node server listening on $PORT.
#
# On VITE_* build args: Vite inlines these into the browser bundle at BUILD
# time, so they cannot be supplied at run time and the image is environment-
# specific. That is inherent to Vite, not a choice made here. The values passed
# are the publishable/anon Supabase keys and a public API URL - all of them are
# already visible to anyone who opens the site. No service-role key, and no
# secret of any kind, belongs in this file or in these args.
# =============================================================================

ARG NODE_VERSION=22

# -----------------------------------------------------------------------------
# Stage 1 - builder
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS builder

WORKDIR /app

# Lockfile-only layer: dependencies reinstall only when the manifests change.
# `npm ci` (not `npm install`) so the build is reproducible and fails loudly
# if package.json and package-lock.json have drifted apart.
COPY package.json package-lock.json ./

RUN npm ci

COPY . .

# Emit a runnable Node server instead of a Cloudflare Worker.
ENV NITRO_PRESET=node-server

# Public, build-time-inlined configuration.
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY} \
    VITE_SUPABASE_PROJECT_ID=${VITE_SUPABASE_PROJECT_ID}

RUN npm run build

# Verify the preset actually took effect. Without this, a preset regression
# ships an image whose CMD cannot start, and the first sign is a crash loop.
RUN node -e "\
const n = require('./.output/nitro.json'); \
if (n.preset !== 'node-server') { throw new Error('expected node-server preset, got ' + n.preset); } \
console.log('nitro preset:', n.preset, '| entry:', n.serverEntry);" \
 && test -f .output/server/index.mjs

# -----------------------------------------------------------------------------
# Stage 2 - runtime
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app

# Only the build output. Nitro's node-server bundle is self-contained, so the
# builder's node_modules (and the whole toolchain) stay out of the image.
# `node` is the unprivileged user the official image already provides.
COPY --from=builder --chown=node:node /app/.output ./.output

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
