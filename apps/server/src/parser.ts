export type OcrLine = { text: string; score: number; box: [number, number][] }
export type OcrResponse = { lang: string | null; score: number; text: string; lines: OcrLine[] }

export type ParsedItem = {
  name: string
  quantity: number
  unitPrice?: number | null
  price: number
  unit?: string | null
}

export type ParsedReceipt = {
  currency?: string | null
  items: ParsedItem[]
  totals: {
    itemsTotal: number | null
    subtotal?: number | null
    tax?: number | null
    total?: number | null
    paid?: number | null
    change?: number | null
  }
  raw: { rows: Row[] }
}

/* ---------- helpers ---------- */
const DIGIT_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9'
}
const asciiDigits = (s: string) => s.replace(/[٠-٩۰-۹]/g, (d) => DIGIT_MAP[d] ?? d)
const stripDiacritics = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const norm = (s: string) => stripDiacritics(asciiDigits(s)).toLowerCase()

const round2 = (n: number) => Math.round(n * 100) / 100
const moneyRx = /(\d{1,5}(?:[.,]\d{2}))/ // “7,50”, “14,00”, “40,00”
const qtyXUnitRx = /(\d+)\s*[x×]\s*([0-9]+(?:[.,][0-9]{1,2})?)/i
const unitRx = /(\d+(?:[.,]\d+)?)\s*(kg|g|mg|l|ml|cl|lb|oz)\b/i
const CURRENCY_RX = /\b(?:mad|dh|د\.?م)\b/i

const KEYWORDS = {
  total: ['total', 'somme', 'montant'],
  subtotal: ['subtotal', 'sous-total', 'hors taxe', 'ht'],
  tax: ['tax', 'tva', 'vat', 'tps', 'tvq', 'total des taxes'],
  paid: ['especes', 'espèces', 'cash', 'paid', 'paiement', 'amount tendered'],
  change: ['rendu', 'change', 'monnaie', 'change due'],
  noise: ['commande', 'items', 'produits', 'products']
}

const moneyFrom = (s: string): number | null => {
  const t = asciiDigits(s)
  const m = t.match(moneyRx)
  if (!m) return null
  const val = parseFloat(m[1].replace(',', '.'))
  return Number.isFinite(val) ? round2(val) : null
}
const hasLetters = (s: string) => /[a-zA-Z\u0600-\u06FF]/.test(stripDiacritics(s))
const matchAny = (s: string, arr: string[]) => {
  const t = norm(s)
  return arr.some((w) => t.includes(norm(w)))
}

/* ---------- geometry to rows ---------- */
type Token = { text: string; score: number; x: number; y: number; w: number; h: number }
type Row = { y: number; tokens: Token[]; text: string }

function tokensFromLines(lines: OcrLine[]): Token[] {
  return lines.map((l) => {
    const xs = l.box.map((p) => p[0])
    const ys = l.box.map((p) => p[1])
    const minX = Math.min(...xs),
      maxX = Math.max(...xs)
    const minY = Math.min(...ys),
      maxY = Math.max(...ys)
    return { text: l.text, score: l.score, x: minX, y: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY }
  })
}
const median = (arr: number[]) => {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
function groupIntoRows(tokens: Token[]): Row[] {
  const toks = [...tokens].sort((a, b) => a.y - b.y)
  const medianH = median(toks.map((t) => t.h)) || 16
  const threshold = Math.max(8, medianH * 1.1) // slightly looser to keep price/name together

  const rows: Row[] = []
  let bucket: Token[] = []
  let cy = -Infinity

  for (const t of toks) {
    if (!bucket.length || Math.abs(t.y - cy) <= threshold) {
      bucket.push(t)
      const ys = bucket.map((b) => b.y)
      cy = ys.reduce((a, b) => a + b, 0) / ys.length
    } else {
      const ts = bucket.sort((a, b) => a.x - b.x)
      rows.push({ y: cy, tokens: ts, text: ts.map((t) => t.text).join(' ') })
      bucket = [t]
      cy = t.y
    }
  }
  if (bucket.length) {
    const ts = bucket.sort((a, b) => a.x - b.x)
    rows.push({ y: cy, tokens: ts, text: ts.map((t) => t.text).join(' ') })
  }
  return rows
}

/* ---------- row features ---------- */
function rightmostPrice(row: Row): { value: number; idx: number } | null {
  let best = -1,
    bestX = -Infinity,
    bestVal = 0
  row.tokens.forEach((t, i) => {
    const val = moneyFrom(t.text)
    if (val == null) return
    if (t.x > bestX) {
      best = i
      bestX = t.x
      bestVal = val
    }
  })
  return best === -1 ? null : { value: bestVal, idx: best }
}
const hasQty = (row: Row) => qtyXUnitRx.test(asciiDigits(row.text))
const isTotalsLine = (row: Row) =>
  matchAny(row.text, KEYWORDS.total) ||
  matchAny(row.text, KEYWORDS.subtotal) ||
  matchAny(row.text, KEYWORDS.tax) ||
  matchAny(row.text, KEYWORDS.paid) ||
  matchAny(row.text, KEYWORDS.change) ||
  matchAny(row.text, KEYWORDS.noise)

const currencyFromRows = (rows: Row[]): string | null => {
  for (const r of rows) {
    const m = r.text.match(CURRENCY_RX)
    if (m) return m[0].toUpperCase() === 'DH' ? 'MAD' : m[0]
  }
  return 'MAD' // default for your region
}

/* ---------- totals ---------- */
function detectTotals(rows: Row[]) {
  let subtotal: number | undefined, tax: number | undefined, total: number | undefined
  let paid: number | undefined, change: number | undefined
  const used = new Set<number>()

  rows.forEach((r, i) => {
    const price = rightmostPrice(r)?.value
    if (price == null) return
    if (matchAny(r.text, KEYWORDS.change)) {
      change = price
      used.add(i)
    } else if (matchAny(r.text, KEYWORDS.paid)) {
      paid = price
      used.add(i)
    } else if (matchAny(r.text, KEYWORDS.tax)) {
      tax = tax != null ? Math.max(tax, price) : price
      used.add(i)
    } else if (matchAny(r.text, KEYWORDS.subtotal)) {
      subtotal = price
      used.add(i)
    } else if (matchAny(r.text, KEYWORDS.total) && !/total\s*items?/i.test(r.text)) {
      total = price
      used.add(i)
    }
  })
  return { subtotal, tax, total, paid, change, used }
}

/* ---------- neighbor search ---------- */
function neighborIdx(rows: Row[], i: number, maxDy: number) {
  const y0 = rows[i].y
  const idxs: number[] = []
  for (let j = i - 3; j <= i + 3; j++) {
    if (j === i || j < 0 || j >= rows.length) continue
    if (Math.abs(rows[j].y - y0) <= maxDy) idxs.push(j)
  }
  return idxs
}

/* ---------- item parsing ---------- */
function parseItems(rows: Row[], exclude: Set<number>): ParsedItem[] {
  const items: ParsedItem[] = []
  const used = new Set<number>(exclude)
  const heights = rows.map((r) => median(r.tokens.map((t) => t.h || 16)) || 16)
  const medianH = median(heights) || 16
  const CLUSTER_DY = Math.max(10, medianH * 1.4)

  // We’ll anchor items on rows that have a price (could be a pure price, a qty row, or a normal name+price row)
  for (let i = 0; i < rows.length; i++) {
    if (used.has(i)) continue
    const r = rows[i]
    if (isTotalsLine(r)) {
      used.add(i)
      continue
    }

    const priceHere = rightmostPrice(r)
    const qtyHere = hasQty(r)

    if (!priceHere && !qtyHere) continue // likely a name-only row; we’ll attach it when we hit its price row

    // Find the best price in the local cluster (prefer the largest number; that’s the line total)
    const cluster = [i, ...neighborIdx(rows, i, CLUSTER_DY)]
    let priceIdx = -1,
      linePrice = -1
    for (const j of cluster) {
      const rp = rightmostPrice(rows[j])
      if (!rp) continue
      if (isTotalsLine(rows[j])) continue
      if (rp.value > linePrice) {
        linePrice = rp.value
        priceIdx = j
      }
    }
    if (priceIdx === -1) continue // no usable price

    // Quantity + unit price: prefer a neighbor row that has the Nx pattern (often the "4 x 3,50 DH" line)
    let quantity = 1
    let unitPrice: number | undefined
    let qtyIdx: number | undefined

    const qtySources = [priceIdx, ...cluster]
    for (const j of qtySources) {
      const m = asciiDigits(rows[j].text).match(qtyXUnitRx)
      if (m) {
        quantity = parseInt(m[1], 10)
        const u = moneyFrom(m[2])
        if (u != null) unitPrice = u
        qtyIdx = j
        break
      }
    }
    if (unitPrice == null && quantity > 1 && linePrice > 0) {
      unitPrice = round2(linePrice / quantity)
    }

    // Build name by merging nearby rows that look like descriptors (letters, not totals, not just qty)
    // Include left-of-price tokens on the price row as well.
    const nameParts: string[] = []

    // Left side of the price row (common case: "MIRINDA POMME 1.5L   7,50")
    const priceRow = rows[priceIdx]
    const rp = rightmostPrice(priceRow)!
    const leftTokens = priceRow.tokens.filter((_, k) => k !== rp.idx)
    const leftText = leftTokens
      .map((t) => t.text)
      .join(' ')
      .trim()
    if (hasLetters(leftText) && !hasQty(priceRow)) nameParts.push(leftText)

    // Nearby name rows (above/below)
    const nameIdxs: number[] = []
    for (const j of cluster) {
      if (j === priceIdx) continue
      const rj = rows[j]
      if (used.has(j)) continue
      if (isTotalsLine(rj)) continue
      if (rightmostPrice(rj)) continue // rows with a price are likely other items
      const isQtyRow = hasQty(rj)
      if (!hasLetters(rj.text)) continue
      if (isQtyRow) continue // “4 x 3,50 DH” is not part of the name
      nameIdxs.push(j)
    }
    nameIdxs.sort((a, b) => rows[a].y - rows[b].y)
    for (const j of nameIdxs) nameParts.push(rows[j].text.trim())

    const rawName = nameParts
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
    if (!rawName) continue

    // Unit from name bits (e.g. “1.5L”, “110G”, “500ML”)
    let unit: string | null = null
    const mUnit = asciiDigits(rawName).match(unitRx) || asciiDigits(leftText).match(unitRx)
    if (mUnit) unit = mUnit[2].toLowerCase()

    items.push({
      name: rawName,
      quantity,
      unitPrice,
      price: linePrice,
      unit
    })

    // Mark consumed rows so we don’t double count (price row, qty row, and the name rows we used)
    used.add(priceIdx)
    if (qtyIdx != null) used.add(qtyIdx)
    nameIdxs.forEach((j) => used.add(j))
  }

  // Dedup identical lines (OCR can double-detect)
  const seen = new Set<string>()
  return items.filter((it) => {
    const key = `${norm(it.name)}|${it.quantity}|${it.price}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/* ---------- main ---------- */
export function parseReceiptFromOcr(ocr: OcrResponse): ParsedReceipt {
  const tokens = tokensFromLines(ocr.lines.filter((l) => l.score >= 0.5))
  const rows = groupIntoRows(tokens)

  const currency = currencyFromRows(rows)

  const { subtotal, tax, total, paid, change, used } = detectTotals(rows)
  const items = parseItems(rows, used)

  const itemsTotal = items.length ? round2(items.reduce((s, it) => s + it.price, 0)) : null

  return {
    currency,
    items,
    totals: { itemsTotal, subtotal, tax, total, paid, change },
    raw: { rows }
  }
}
