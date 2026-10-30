import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import http from 'http'
import { authRouter } from './routes/auth'
import { initSocket } from './socket'

const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
const app = express()
app.use(cors({ origin }))
app.use(express.json())
app.use('/api', authRouter)

const server = http.createServer(app)
initSocket(server, origin)

const port = Number(process.env.PORT) || 3000
server.listen(port, () => console.log(`Backend chạy ở cổng ${port}`))
