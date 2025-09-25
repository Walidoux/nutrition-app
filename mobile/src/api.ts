export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export async function getHealth() {
  const r = await fetch(`${API_URL}/health`)
  return r.json()
}

export async function getNotes() {
  const r = await fetch(`${API_URL}/notes`)
  return r.json()
}

export async function addNote(title: string) {
  const r = await fetch(`${API_URL}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  })
  if (!r.ok) throw new Error('Failed to add note')
  return r.json()
}
