import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import 'dotenv/config'
import Fastify from 'fastify'

import { db } from './db/client'
import { API } from './lib'
import { buildSystemPrompt, buildUserPrompt, streamToBuffer } from './parser'

const app = Fastify()

await app.register(cors, { origin: true, credentials: true })
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } })

app.get('/health', async () => ({ ok: true }))

app.get('/users', async () => {
  const users = await db.selectFrom('users').selectAll().execute()
  return { users }
})

app.post(API.SCAN_RECEIPT, async (req, reply) => {
  let now = Date.now()

  const file = (await req.file({ limits: { fileSize: 20 * 1024 * 1024 } }))!
  const buf = await streamToBuffer(file.file)
  const base64 = buf.toString('base64')

  console.log('Reading file took', Date.now() - now, 'ms')
  now = Date.now()

  const imageUrl = `data:${file.mimetype};base64,${base64}`
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL,
      max_tokens: 2048,
      temperature: 0.2,
      top_p: 1,
      stream: false,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        {
          role: 'user',
          content: [
            { type: 'text', text: buildUserPrompt() },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ]
    })
  })

  const result = await response.text()
  const json = JSON.parse(result.replaceAll('```', '')) // sometimes the model returns code blocks, we need to remove them
  const fullContent = json.choices[0].message.content

  console.log('Processing took', Date.now() - now, 'ms')
  console.log(fullContent)

  return reply.send(fullContent)
})

const port = Number(process.env.PORT ?? 3000)
app.listen({ port, host: '0.0.0.0' }).then(() => {
  console.log(`server on http://localhost:${port}`)
})
