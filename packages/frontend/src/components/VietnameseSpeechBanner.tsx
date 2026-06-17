import { useEffect, useState } from 'react'
import {
  listVietnameseVoices,
  setPreferredSpeechVoice,
  getStoredVoiceUri,
  clearPreferredSpeechVoice,
} from '@/lib/speechVi'
import { vi } from '@/locales/vi'

const DISMISS_KEY = 'speech_vi_banner_dismissed'

function getDismissedFlag(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function setDismissedFlag(v: boolean): void {
  try {
    if (v) sessionStorage.setItem(DISMISS_KEY, '1')
    else sessionStorage.removeItem(DISMISS_KEY)
  } catch {
    // Ignore storage errors (private mode / restricted storage).
  }
}

export function VietnameseSpeechBanner() {
  const [showMissing, setShowMissing] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  const refresh = () => {
    const v = listVietnameseVoices()
    setVoices(v)
    const dismissed = getDismissedFlag()
    setShowMissing(!dismissed && v.length === 0)
  }

  useEffect(() => {
    queueMicrotask(() => refresh())
    const w = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    w?.addEventListener?.('voiceschanged', refresh)
    const onMissing = () => {
      setDismissedFlag(false)
      setShowMissing(true)
    }
    window.addEventListener('speech-vi-missing', onMissing)
    return () => {
      w?.removeEventListener?.('voiceschanged', refresh)
      window.removeEventListener('speech-vi-missing', onMissing)
    }
  }, [])

  if (showMissing) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm"
      >
        <p className="text-sm font-black">{vi.speech.missingVoiceTitle}</p>
        <p className="mt-1 text-xs font-medium leading-relaxed text-amber-900/90">
          {vi.speech.missingVoiceHint}
        </p>
        <button
          type="button"
          className="mt-3 text-xs font-black uppercase tracking-widest text-amber-800 underline-offset-2 hover:underline"
          onClick={() => {
            setDismissedFlag(true)
            setShowMissing(false)
          }}
        >
          {vi.speech.dismiss}
        </button>
      </div>
    )
  }

  if (voices.length > 1) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-surface px-3 py-2 text-xs shadow-sm">
        <span className="font-bold text-slate-600">{vi.speech.chooseVoice}</span>
        <select
          className="max-w-[220px] rounded-lg border border-slate-200 bg-surface-container-low px-2 py-1 font-bold text-slate-800"
          value={getStoredVoiceUri() ?? ''}
          onChange={(e) => {
            const uri = e.target.value
            if (!uri) {
              clearPreferredSpeechVoice()
              return
            }
            const voice = voices.find((x) => x.voiceURI === uri) ?? null
            setPreferredSpeechVoice(voice)
          }}
        >
          <option value="">Mặc định</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return null
}
