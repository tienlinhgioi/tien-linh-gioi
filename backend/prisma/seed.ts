import { PrismaClient } from '@prisma/client'
import { REALMS, MAPS } from '../src/data'

const prisma = new PrismaClient()

async function main() {
  for (const [i, name] of REALMS.entries()) {
    await prisma.realm.upsert({ where: { order: i + 1 }, update: { name }, create: { order: i + 1, name } })
  }
  for (const m of MAPS) {
    await prisma.gameMap.upsert({ where: { name: m.name }, update: { kind: m.kind }, create: m })
  }
}

main().finally(() => prisma.$disconnect())
