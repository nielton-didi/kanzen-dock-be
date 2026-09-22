# ---- Build stage ----
FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
# prisma.config.ts resolves DATABASE_URL eagerly, even for `prisma generate`
# (which doesn't connect to a DB) — this placeholder only satisfies that and
# never reaches the runtime stage. tsconfig.json must be present at generate
# time too: the generator reads its nodenext moduleResolution to decide
# whether generated imports get .js or .ts extensions.
ENV DATABASE_URL="postgresql://user:password@localhost:5432/db?schema=public"
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./prisma.config.ts

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
