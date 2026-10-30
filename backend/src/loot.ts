import { prisma } from './lib/prisma'

export interface Loot {
  exp: number
  currencies: { code: string; name: string; amount: number }[]
  items: { code: string; name: string; quality: string; count: number }[]
}

// Phần thưởng khi hạ quái: tu vi, tiền tệ, vật phẩm rơi theo tỉ lệ
export async function giveLoot(characterId: number, monsterTypeId: number): Promise<Loot> {
  const t = await prisma.monsterType.findUniqueOrThrow({
    where: { id: monsterTypeId },
    include: { drops: { include: { item: true } } },
  })
  const loot: Loot = { exp: t.exp, currencies: [], items: [] }

  await prisma.character.update({ where: { id: characterId }, data: { exp: { increment: t.exp } } })

  if (t.dropCurrencyId && t.dropMax > 0) {
    const amount = t.dropMin + Math.floor(Math.random() * (t.dropMax - t.dropMin + 1))
    const cur = await prisma.currency.findUniqueOrThrow({ where: { id: t.dropCurrencyId } })
    await prisma.characterCurrency.upsert({
      where: { characterId_currencyId: { characterId, currencyId: cur.id } },
      update: { amount: { increment: amount } },
      create: { characterId, currencyId: cur.id, amount },
    })
    loot.currencies.push({ code: cur.code, name: cur.name, amount })
  }

  for (const d of t.drops) {
    if (Math.random() >= d.chance) continue
    await prisma.inventoryItem.upsert({
      where: { characterId_itemId: { characterId, itemId: d.itemId } },
      update: { count: { increment: 1 } },
      create: { characterId, itemId: d.itemId, count: 1 },
    })
    loot.items.push({ code: d.item.code, name: d.item.name, quality: d.item.quality, count: 1 })
  }
  return loot
}
