import { Server } from 'socket.io'
import parser from 'socket.io-msgpack-parser'
import type { Server as HttpServer } from 'http'
import { prisma } from '../lib/prisma'
import { verifyToken } from '../lib/auth'
import { SUB_REALMS_PER_REALM } from '../data'

export function initSocket(http: HttpServer, origin: string) {
  const io = new Server(http, { parser, cors: { origin } })

  io.use((socket, next) => {
    const id = verifyToken(String(socket.handshake.auth?.token ?? ''))
    if (!id) return next(new Error('unauthorized'))
    socket.data.accountId = id
    next()
  })

  io.on('connection', (socket) => {
    socket.on('data:static', async (cb?: (d: unknown) => void) => {
      const [realms, maps] = await Promise.all([
        prisma.realm.findMany({ orderBy: { order: 'asc' } }),
        prisma.gameMap.findMany(),
      ])
      cb?.({ realms, subRealmsPerRealm: SUB_REALMS_PER_REALM, maps })
    })
  })

  return io
}
