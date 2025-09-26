import { promises as fs } from 'node:fs'
import path from 'node:path'
import { FileMigrationProvider, Migrator } from 'kysely'
import { db } from './client'

async function migrate() {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(process.cwd(), 'src/db/migrations')
    })
  })

  const { error, results } = await migrator.migrateToLatest()
  results?.forEach((it) => {
    if (it.status === 'Success') console.log(`migrated ${it.migrationName}`)
    else if (it.status === 'Error') console.error(`failed ${it.migrationName}`)
  })
  if (error) {
    console.error(error)
    process.exit(1)
  }
  await db.destroy()
}
migrate()
