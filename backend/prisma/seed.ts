import { PrismaClient } from '@prisma/client'
import { REALMS, MAPS, CURRENCIES, ITEMS, MONSTER_TYPES } from '../src/data'

const prisma = new PrismaClient()

async function main() {
  for (const [i, name] of REALMS.entries()) {
    await prisma.realm.upsert({ where: { order: i + 1 }, update: { name }, create: { order: i + 1, name } })
  }
  for (const m of MAPS) {
    await prisma.gameMap.upsert({ where: { name: m.name }, update: { kind: m.kind }, create: m })
  }
  for (const c of CURRENCIES) {
    await prisma.currency.upsert({ where: { code: c.code }, update: { name: c.name }, create: c })
  }
  for (const it of ITEMS) {
    await prisma.item.upsert({ where: { code: it.code }, update: it, create: it })
  }
  for (const t of MONSTER_TYPES) {
    const cur = await prisma.currency.findUnique({ where: { code: t.currency } })
    const data = { name: t.name, hp: t.hp, atk: t.atk, speed: t.speed, exp: t.exp, dropCurrencyId: cur?.id ?? null, dropMin: t.dropMin, dropMax: t.dropMax }
    const mt = await prisma.monsterType.upsert({ where: { code: t.code }, update: data, create: { code: t.code, ...data } })
    for (const d of t.drops) {
      const item = await prisma.item.findUniqueOrThrow({ where: { code: d.item } })
      await prisma.monsterDrop.upsert({
        where: { monsterTypeId_itemId: { monsterTypeId: mt.id, itemId: item.id } },
        update: { chance: d.chance },
        create: { monsterTypeId: mt.id, itemId: item.id, chance: d.chance },
      })
    }
  }
}

main().finally(() => prisma.$disconnect())
