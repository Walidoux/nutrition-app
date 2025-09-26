import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import 'dotenv/config'
import Fastify from 'fastify'
import sharp from 'sharp'
import { db } from './db/client'
import { callPaddleOcr } from './ocr'
import { parseReceiptFromOcr } from './parser'

const app = Fastify()
await app.register(cors, { origin: true, credentials: true })
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } })

app.get('/health', async () => ({ ok: true }))

app.get('/users', async () => {
  const users = await db.selectFrom('users').selectAll().execute()
  return { users }
})

app.post('/ocr/receipt', async (req, reply) => {
  let now = Date.now()
  const file = (await req.file())!
  const buf = await file.toBuffer()

  console.log('File buffer finished in', Date.now() - now, 'ms')
  now = Date.now()

  const prepped = await sharp(buf) // paddle’s angle classifier already helps with rotation
    .rotate()
    .resize({ width: 2000, withoutEnlargement: true })
    .grayscale()
    .normalize()
    .median(1)
    .sharpen()
    .toFormat('png')
    .toBuffer()

  console.log('Sharp finished in', Date.now() - now, 'ms')
  now = Date.now()

  const ocr = await callPaddleOcr(prepped)
  console.log('OCR finished in', Date.now() - now, 'ms')
  console.log(ocr)
  now = Date.now()
  const parsed = parseReceiptFromOcr(ocr)
  console.log('Parse finished in', Date.now() - now, 'ms')

  console.log(parsed)

  return { parsed, ocr }
})

const port = Number(process.env.PORT ?? 3000)
app.listen({ port, host: '0.0.0.0' }).then(() => {
  console.log(`server on http://localhost:${port}`)
})
