// Sinh prisma/postgres/schema.prisma từ prisma/schema.prisma (MySQL là nguồn gốc duy nhất)
const fs = require('fs')
const path = require('path')

const src = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8')
if (!src.includes('provider = "mysql"')) throw new Error('prisma/schema.prisma phải dùng provider mysql')
const out =
  '// FILE SINH TỰ ĐỘNG từ ../schema.prisma bằng `npm run schema:postgres`. Không sửa tay.\n' +
  src.replace('provider = "mysql"', 'provider = "postgresql"')
fs.writeFileSync(path.join(__dirname, '../prisma/postgres/schema.prisma'), out)
console.log('Đã sinh prisma/postgres/schema.prisma')
