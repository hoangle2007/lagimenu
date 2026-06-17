/** Converts a snake_case string to camelCase */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/** Converts a camelCase string to snake_case */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** Deep-converts all keys of an object from snake_case to camelCase */
export function snakeToCamelObj<T>(obj: unknown): T {
  if (obj === null || typeof obj !== 'object') return obj as T;
  if (Array.isArray(obj)) return obj.map((item) => snakeToCamelObj(item)) as T;

  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
      snakeToCamel(k),
      v !== null && typeof v === 'object' ? snakeToCamelObj(v) : v,
    ]),
  ) as T;
}

/** Deep-converts all keys of an object from camelCase to snake_case */
export function camelToSnakeObj<T>(obj: unknown): T {
  if (obj === null || typeof obj !== 'object') return obj as T;
  if (Array.isArray(obj)) return obj.map((item) => camelToSnakeObj(item)) as T;

  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
      camelToSnake(k),
      v !== null && typeof v === 'object' ? camelToSnakeObj(v) : v,
    ]),
  ) as T;
}
