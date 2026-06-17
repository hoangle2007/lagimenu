import { vi } from './vi'

type Nested = typeof vi

function get(obj: Nested, path: string): string | undefined {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : undefined
}

/** Lấy chuỗi tiếng Việt theo path dạng `employee.nav.kitchen` */
export function t(path: string): string {
  return get(vi, path) ?? path
}
