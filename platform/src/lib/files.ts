import { randomToken } from './util'

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'application/pdf': 'pdf',
}

/** Store an uploaded File in the private R2 bucket. Returns the key, or null when the input is empty. Throws on invalid files. */
export async function putUpload(bucket: R2Bucket, folder: string, file: unknown): Promise<{ key: string; type: string } | null> {
  if (!file || typeof file === 'string' || !(file as File).size) return null
  const f = file as File
  const type = (f.type || '').toLowerCase()
  if (!ALLOWED.has(type)) throw new Error('Please upload a photo (JPG, PNG, WEBP, HEIC) or a PDF.')
  if (f.size > MAX_BYTES) throw new Error('Each file must be under 10 MB.')
  const key = `${folder}/${Date.now()}-${randomToken(9)}.${EXT[type]}`
  await bucket.put(key, f.stream(), { httpMetadata: { contentType: type } })
  return { key, type }
}

/** Store a PNG signature sent as a data URL from the signature pad. */
export async function putSignature(bucket: R2Bucket, folder: string, dataUrl: string): Promise<string> {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!m) throw new Error('Please sign in the box before continuing.')
  const bytes = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0))
  if (bytes.length < 800) throw new Error('Please sign in the box before continuing.')
  if (bytes.length > 600_000) throw new Error('Signature image too large.')
  const key = `${folder}/signature-${Date.now()}-${randomToken(6)}.png`
  await bucket.put(key, bytes, { httpMetadata: { contentType: 'image/png' } })
  return key
}
