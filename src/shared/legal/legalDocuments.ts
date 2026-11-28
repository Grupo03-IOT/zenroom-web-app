import type { Language } from '../i18n/i18n'
// Single source of the legal texts. The mobile app ships an identical copy in assets/legal/legal.json.
import documents from './legal.json'

export type LegalKind = 'terms' | 'privacy'

export interface LegalSection {
  id: string
  heading: string
  /** A string is a paragraph and an array is a bulleted list. */
  body: (string | string[])[]
}

export interface LegalDocument {
  title: string
  effective: string
  intro: string
  sections: LegalSection[]
}

export function legalDocument(kind: LegalKind, language: Language): LegalDocument {
  return documents[kind][language]
}
