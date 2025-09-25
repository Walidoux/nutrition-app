import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { db } from './db.js'
import { sql } from 'kysely'

const app = Fastify({ logger: true })

await app.register(cors, { origin: true })

// Minimal schema bootstrap
await sql`
  CREATE TABLE IF NOT EXISTS notes (
    id serial primary key,
    title text not null,
    created_at timestamptz not null default now()
  )
`.execute(db)

app.get('/health', async () => ({ ok: true }))

app.get('/notes', async () => {
  const rows = await db.selectFrom('notes').selectAll().orderBy('created_at', 'desc').execute()
  return rows
})

app.post('/notes', async (req, reply) => {
  const body = (req.body ?? {}) as { title?: string }
  const title = (body.title ?? '').trim()
  if (!title) {
    return reply.code(400).send({ error: 'title required' })
  }
  const inserted = await db.insertInto('notes').values({ title }).returningAll().executeTakeFirstOrThrow()
  return inserted
})

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '0.0.0.0'
app.listen({ port, host }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
