import React, { useEffect, useState } from 'react'
import { addNote, getHealth, getNotes } from './api'

export default function App() {
  const [ok, setOk] = useState<boolean | null>(null)
  const [notes, setNotes] = useState<{ id: number; title: string }[]>([])
  const [text, setText] = useState('')

  useEffect(() => {
    getHealth()
      .then((h) => setOk(!!h.ok))
      .catch(() => setOk(false))
    refresh()
  }, [])

  async function refresh() {
    try {
      const n = await getNotes()
      setNotes(n)
    } catch {
      // offline or API down
    }
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    await addNote(text.trim()).catch(() => {})
    setText('')
    refresh()
  }

  return (
    <div className='p-4 max-w-xl mx-auto'>
      <h1 className='text-2xl font-semibold mb-2'>MyApp</h1>
      <p className='text-sm mb-4'>API: {ok === null ? '...' : ok ? 'reachable' : 'offline'}</p>

      <form onSubmit={onAdd} className='flex gap-2 mb-4'>
        <input
          className='flex-1 px-3 py-2 rounded bg-zinc-900 border border-zinc-800'
          placeholder='New note...'
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className='px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500'>Add</button>
      </form>

      <ul className='space-y-2'>
        {notes.map((n) => (
          <li key={n.id} className='p-3 rounded bg-zinc-900 border border-zinc-800'>
            {n.title}
          </li>
        ))}
      </ul>
    </div>
  )
}
