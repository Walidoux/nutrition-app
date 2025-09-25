import { ColumnType, Generated } from 'kysely'

export interface NotesTable {
  id: Generated<number>
  title: string
  created_at: ColumnType<Date, string | undefined, never>
}

export interface DB {
  notes: NotesTable
}
