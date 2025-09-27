import { MultipartFile } from '@fastify/multipart'

export function buildSystemPrompt() {
  return [
    'You are a receipt parser. You will receive a single receipt image.',
    'Return only minified JSON with this exact shape:',
    '{"items":[{"name":string,"amount":number|null,"unit":"ML"|"CL"|"L"|"MG"|"G"|"KG"|null,"unitPrice":number|null,"quantity":number|null}],"totals":{"paid":number|null,"change":number|null}}',
    'Rules:',
    '- Names should not include size/weight units (put those into amount+unit).',
    '- Quantities may appear as patterns like "2 x 1,50 DH" (decimal comma allowed).',
    '- For each product find how much proteins, calories in contains and if found insert them inside fileds of each item product inside items array',
    '- Use dot as decimal separator in JSON (e.g., 1.5).',
    '- If an item has no unit, set amount and unit to null.',
    '- Do not add extra fields. Do not output text outside JSON.',
    '- Arabic text can be found, translate it into French.'
  ].join('\n')
}

export function buildUserPrompt() {
  return ['Extract the structured receipt JSON for this image.'].join('\n')
}

export async function streamToBuffer(stream: MultipartFile['file']) {
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}
