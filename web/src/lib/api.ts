import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Transform Prisma Decimal objects ({ s, e, d }) to plain numbers
function transformDecimal(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(transformDecimal)
  if (typeof obj === 'object') {
    const o = obj as Record<string, unknown>
    if ('s' in o && 'e' in o && 'd' in o && Array.isArray(o.d)) {
      const d = o.d as number[]
      const e = o.e as number
      const s = o.s as number
      let sum = 0
      const firstGroupLength = d[0].toString().length
      for (let i = 0; i < d.length; i++) {
        sum += d[i] * Math.pow(10, e - (firstGroupLength - 1) - 7 * i)
      }
      return s * sum
    }
    const res: Record<string, unknown> = {}
    for (const key of Object.keys(o)) res[key] = transformDecimal(o[key])
    return res
  }
  return obj
}

api.interceptors.response.use(
  (response) => {
    if (response.data) response.data = transformDecimal(response.data)
    return response
  },
  (error) => Promise.reject(error),
)

export default api
