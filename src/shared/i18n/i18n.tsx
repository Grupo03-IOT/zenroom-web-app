import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { spanish } from './translations'

export type Language = 'es' | 'en'

const storageKey = 'sensework-language'
// Same text as the description meta tag in index.html.
const description = 'Monitor noise and thermal comfort in your coworking rooms with SenseWork.'

function savedLanguage(): Language {
  // English unless the user explicitly chose Spanish; the browser locale is ignored.
  try { return localStorage.getItem(storageKey) === 'es' ? 'es' : 'en' }
  catch { return 'en' }
}

let activeLanguage: Language = savedLanguage()

/** Locale tag of the active language, for the document and date formatting. */
export function localeTag(language: Language = activeLanguage): string {
  return language === 'es' ? 'es-419' : 'en-US'
}

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
  useEffect(() => {
    document.documentElement.lang = localeTag(language)
    document.querySelector('meta[name="description"]')?.setAttribute('content', tr(description))
  }, [language])
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('Language provider is missing')
  return value
}
