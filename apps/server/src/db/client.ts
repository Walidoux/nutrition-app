import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'

export interface DB {
  users: {
    id: number
    name: string
    created_at: Date
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
export const db = new Kysely<DB>({
  dialect: new PostgresDialect({ pool })
})
