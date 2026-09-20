# ---------- Stage 1: build the React client ----------
FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---------- Stage 2: install server production deps ----------
FROM node:22-alpine AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# ---------- Stage 3: runtime ----------
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=server-deps /app/server/node_modules server/node_modules
COPY server/ server/
COPY --from=client-build /app/client/dist client/dist
EXPOSE 3001
# Env expected at runtime: DATABASE_URL, JWT_SECRET (PORT optional, default 3001)
CMD ["node", "server/src/index.js"]
