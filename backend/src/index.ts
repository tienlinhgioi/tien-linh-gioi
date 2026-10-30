import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import http from 'http'
import { authRouter } from './routes/auth'
import { initSocket } from './socket'
import { saveAll } from './socket/world'

const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
const app = express()
app.use(cors({ origin }))
app.use(express.json())
app.get('/health', (_req, res) => res.send('ok'))
app.use('/api', authRouter)

const server = http.createServer(app)
const port = Number(process.env.PORT) || 3000

initSocket(server, origin).then(() => {
  server.listen(port, () => console.log(`Backend chạy ở cổng ${port}`))
})

// Thoát êm: ghi vị trí mọi người chơi trước khi tắt
const shutdown = () => saveAll().finally(() => process.exit(0))
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
