# Build stage
FROM node:20-slim AS builder
WORKDIR /usr/src/app

COPY package*.json tsconfig.json vite.config.ts ./
COPY server ./server
COPY src ./src
COPY public ./public

RUN npm install
RUN npm run build

# Production image
FROM node:20-slim AS runtime
WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 8080
CMD ["node", "dist/server/index.js"]
