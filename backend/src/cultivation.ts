import { prisma } from './lib/prisma'
import { SUB_REALMS_PER_REALM, expNeeded } from './data'


// Đột phá lên tiểu cảnh kế tiếp; hết 10 tiểu cảnh thì sang cảnh giới mới
export function breakthrough(accountId: number) {
  return prisma.$transaction(async (tx) => {
    const c = await tx.character.findUnique({ where: { accountId }, include: { realm: true } })
    if (!c) return { error: 'Chưa có nhân vật' }
    const need = expNeeded(c.realm.order, c.subRealm)
    if (c.exp < need) return { error: 'Chưa đủ tu vi' }
    let realmId = c.realmId
    let realmOrder = c.realm.order
    let subRealm = c.subRealm + 1
    if (subRealm > SUB_REALMS_PER_REALM) {
      const next = await tx.realm.findUnique({ where: { order: realmOrder + 1 } })
      if (!next) return { error: 'Đã đạt cảnh giới tối đa' }
      realmId = next.id
      realmOrder = next.order
      subRealm = 1
    }
    await tx.character.update({ where: { id: c.id }, data: { realmId, subRealm, exp: c.exp - need } })
    return { realmOrder, subRealm }
  })
}
