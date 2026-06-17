// Currency formatting
export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
}

/** Parse DB / API timestamps (ISO, or "YYYY-MM-DD HH:mm:ss[.fff]") without Invalid Date. */
export function parseFlexibleDate(input: unknown): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const s = String(input).trim();
  if (!s) return null;
  let normalized = s;
  if (!normalized.includes('T') && /^\d{4}-\d{2}-\d{2} \d/.test(normalized)) {
    normalized = normalized.replace(' ', 'T');
  }
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

// Date formatting
export function formatDate(dateInput: string | Date | null | undefined, locale = 'vi-VN'): string {
  const d =
    dateInput instanceof Date
      ? isNaN(dateInput.getTime())
        ? null
        : dateInput
      : parseFlexibleDate(dateInput);
  if (!d) return '—';
  return d.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Date and time formatting
export function formatDateTime(dateInput: string | Date | null | undefined, locale = 'vi-VN'): string {
  const d =
    typeof dateInput === 'string' || dateInput == null
      ? parseFlexibleDate(dateInput)
      : dateInput instanceof Date && !isNaN(dateInput.getTime())
        ? dateInput
        : null;
  if (!d) return '—';
  return d.toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Chỉ giờ:phút — dùng trong giỏ / đơn ngắn */
export function formatTimeShort(dateInput: unknown, locale = 'vi-VN'): string {
  const d = parseFlexibleDate(dateInput);
  if (!d) return '—';
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

// Truncate text
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// Generate unique ID (simple version)
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}