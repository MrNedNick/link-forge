# Build the dashboard and install production dependencies in one throwaway stage,
# then copy only what the server needs into the image that actually ships.
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/server ./server
COPY --from=build /app/package.json ./package.json

EXPOSE 8787
# Migrations run on boot, so a fresh database needs no extra release command.
CMD ["npx", "tsx", "server/index.ts"]
