import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import { DB } from './types.js'

const connectionString = process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/app'

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString })
  })
})
