import { MultipartFile } from '@fastify/multipart'

export function buildSystemPrompt() {
  return [
    'You are a receipt parser. You will receive a single receipt image.',
    'Return only minified JSON with this exact shape:',
    '{"items":[{"name":string,"amount":number|null,"unit":"ML"|"CL"|"L"|"MG"|"G"|"KG"|null,"unitPrice":number|null,"quantity":number|null}],"totals":{"itemsTotal":number,"paid":number|null,"change":number|null}}',
    'Rules:',
    '- Names should not include size/weight units (put those into amount+unit).',
    '- Quantities may appear as patterns like "2 x 1,50 DH" (decimal comma allowed).',
    '- Use dot as decimal separator in JSON (e.g., 1.5).',
    '- If an item has no unit, set amount and unit to null.',
    '- totals.itemsTotal is the sum of item quantities.',
    '- Do not add extra fields. Do not output text outside JSON.'
  ].join('\n')
}

export async function streamToBuffer(stream: MultipartFile['file']) {
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}
