/**
 * Đọc văn bản bằng giọng tiếng Việt (Web Speech API).
 * Ưu tiên giọng lang vi*; lưu voiceURI vào localStorage; cảnh báo khi không có giọng VI.
 */

export const SPEECH_VOICE_STORAGE_KEY = 'speech_voice_uri'

let missingVoiceNotified = false

function safeStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignore storage errors (private mode / restricted storage).
  }
}

function safeStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore storage errors (private mode / restricted storage).
  }
}

function normalizeLang(lang: string): string {
  return (lang || '').toLowerCase().replace('_', '-')
}

function isVietnameseVoice(v: SpeechSynthesisVoice): boolean {
  const lang = normalizeLang(v.lang)
  if (lang === 'vi' || lang === 'vi-vn' || lang.startsWith('vi-')) return true
  const name = `${v.name} ${v.voiceURI}`.toLowerCase()
  return (
    name.includes('vietnam') ||
    name.includes('vietnamese') ||
    name.includes('tiếng việt') ||
    name.includes('hoài') ||
    name.includes('nam minh') ||
    name.includes('lê yến') ||
    name.includes('vi-vn') ||
    name.includes('google vi') ||
    (name.includes('microsoft') && name.includes('viet'))
  )
}

/** Giọng “chắc chắn” tiếng Việt: ưu tiên lang bắt đầu bằng vi */
function strictlyVietnameseVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const byLang = voices.filter((v) => {
    const l = normalizeLang(v.lang)
    return l === 'vi' || l.startsWith('vi-')
  })
  if (byLang.length) return byLang
  return voices.filter(isVietnameseVoice)
}

export function warmUpVietnameseSpeech(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  void window.speechSynthesis.getVoices()
}

export function getStoredVoiceUri(): string | null {
  if (typeof localStorage === 'undefined') return null
  return safeStorageGet(SPEECH_VOICE_STORAGE_KEY)
}

export function setPreferredSpeechVoice(voice: SpeechSynthesisVoice | null): void {
  if (!voice || typeof localStorage === 'undefined') return
  safeStorageSet(SPEECH_VOICE_STORAGE_KEY, voice.voiceURI)
}

export function clearPreferredSpeechVoice(): void {
  if (typeof localStorage === 'undefined') return
  safeStorageRemove(SPEECH_VOICE_STORAGE_KEY)
}

export function listVietnameseVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
  return strictlyVietnameseVoices(window.speechSynthesis.getVoices())
}

export function hasVietnameseVoice(): boolean {
  return listVietnameseVoices().length > 0
}

export function pickVietnameseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  // Prefer exact vi-VN voice first, matching browser voice.lang directly.
  const exactViVn = voices.find((v) => normalizeLang(v.lang) === 'vi-vn')
  if (exactViVn) return exactViVn

  const vi = strictlyVietnameseVoices(voices)
  if (!vi.length) return null

  const stored = getStoredVoiceUri()
  if (stored) {
    const match = vi.find((v) => v.voiceURI === stored)
    if (match) return match
  }

  const local = vi.find((v) => v.localService)
  return local ?? vi[0] ?? null
}

export interface SpeakOptions {
  /** Gọi khi không tìm thấy giọng tiếng Việt (tối đa một lần mỗi phiên trang cho đến khi reload) */
  onMissingVietnameseVoice?: () => void
}

export function speakVietnamese(text: string, options?: SpeakOptions): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const trimmed = text.trim()
  if (!trimmed) return

  window.speechSynthesis.cancel()

  const run = () => {
    const voice = pickVietnameseVoice()
    if (!voice) {
      if (!missingVoiceNotified) {
        missingVoiceNotified = true
        options?.onMissingVietnameseVoice?.()
      }
    }

    const utterance = new SpeechSynthesisUtterance(trimmed)
    utterance.lang = 'vi-VN'
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang || 'vi-VN'
    }
    utterance.rate = 0.92
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  }

  const voices = window.speechSynthesis.getVoices()
  if (voices.length > 0) {
    run()
    return
  }

  const onVoices = () => {
    window.speechSynthesis.removeEventListener('voiceschanged', onVoices)
    run()
  }
  window.speechSynthesis.addEventListener('voiceschanged', onVoices)
  window.speechSynthesis.getVoices()

  window.setTimeout(() => {
    window.speechSynthesis.removeEventListener('voiceschanged', onVoices)
    run()
  }, 800)
}

/** Reset cờ cảnh báo (ví dụ sau khi user cài giọng và tải lại). */
export function resetSpeechVoiceNotificationFlag(): void {
  missingVoiceNotified = false
}
