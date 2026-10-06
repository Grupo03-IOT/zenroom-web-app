import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { spanish } from './translations'

export type Language = 'es' | 'en'

const storageKey = 'sensework-language'

function savedLanguage(): Language {
  try { return localStorage.getItem(storageKey) === 'en' ? 'en' : 'es' }
  catch { return 'es' }
}

let activeLanguage: Language = savedLanguage()

export function tr(value: string): string {
  if (activeLanguage === 'en') return value
  const match = value.match(/^(\s*)([\s\S]*?)(\s*)$/)
  if (!match) return value
  const [, before, core, after] = match
  const key = core.replace(/\s+/g, ' ')
  return before + (spanish[key] ?? core) + after
}

interface LanguageState {
  language: Language
  setLanguage: (language: Language) => void
}

const LanguageContext = createContext<LanguageState | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>(activeLanguage)
  function setLanguage(next: Language) {
    activeLanguage = next
    updateLanguage(next)
    try { localStorage.setItem(storageKey, next) } catch { /* Storage can be unavailable. */ }
  }
  useEffect(() => { document.documentElement.lang = language }, [language])
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('Language provider is missing')
  return value
}
