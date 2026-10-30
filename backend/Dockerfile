FROM node:22-bookworm-slim

# Prisma cần openssl
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Bản deploy dùng Supabase (Postgres): sinh client Postgres, URL giả chỉ để chọn đúng schema lúc build
RUN DATABASE_URL=postgresql://build node scripts/prisma.js generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/src/index.js"]
