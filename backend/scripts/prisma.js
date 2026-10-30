// Chạy Prisma CLI với schema đúng loại database, suy ra từ DATABASE_URL (postgres... -> Postgres/Supabase, còn lại MySQL)
// Dùng: npm run prisma -- migrate deploy
require('dotenv/config')
const { spawnSync } = require('child_process')
const path = require('path')

const url = process.env.DATABASE_URL || ''
const postgres = /^postgres(ql)?:\/\//.test(url)
const schema = path.join(__dirname, '..', 'prisma', postgres ? 'postgres/schema.prisma' : 'schema.prisma')
const r = spawnSync('npx', ['prisma', ...process.argv.slice(2), '--schema', schema], { stdio: 'inherit', shell: process.platform === 'win32' })
process.exit(r.status ?? 1)
