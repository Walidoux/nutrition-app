export type OcrLine = { text: string; score: number; box: [number, number][] }
export type OcrResponse = { lang: string | null; score: number; text: string; lines: OcrLine[] }

const OCR_URL = process.env.OCR_URL ?? 'http://localhost:8000/ocr'
const DEFAULT_LANGS = process.env.OCR_LANGS ?? 'en,french,arabic'

export async function callPaddleOcr(preppedPng: Buffer): Promise<OcrResponse> {
  // Using undici’s FormData/Blob (Node 18+). If TS complains about DOM types,
  // either cast to any or install `formdata-node` and swap it in.
  const fd = new (global as any).FormData()
  const blob = new (global as any).Blob([preppedPng], { type: 'image/png' })
  fd.append('image', blob, 'receipt.png')

  const res = await fetch(`${OCR_URL}?langs=${encodeURIComponent(DEFAULT_LANGS)}&merge=1`, {
    method: 'POST',
    body: fd as any
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`OCR service error: ${res.status} ${res.statusText} ${txt}`)
  }

  return (await res.json()) as OcrResponse
}
