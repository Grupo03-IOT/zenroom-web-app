import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { legalDocument } from '../../shared/legal/legalDocuments'
import type { LegalKind } from '../../shared/legal/legalDocuments'
import { tr, useLanguage } from '../../shared/i18n/i18n'
import { LanguageToggle } from '../components/LanguageToggle'
import brandIcon from '../../shared/assets/logo-isotype.svg'
import './LegalScreen.css'

interface DocumentProps {
  kind: LegalKind
  onOpen: (kind: LegalKind) => void
}

/** Turns the web addresses written in the legal text into links. */
function linked(text: string): ReactNode {
  return text.split(/(https:\/\/\S*[^\s.,;:)])/).map((part, index) => index % 2
    ? <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
    : <Fragment key={index}>{part}</Fragment>)
}

export function Legal({ kind, onOpen }: DocumentProps) {
  const { language } = useLanguage()
  const { title, effective, intro, sections } = legalDocument(kind, language)
  const other: LegalKind = kind === 'terms' ? 'privacy' : 'terms'
  return <article className="card legal" aria-labelledby="legal-title">
    <header>
      <h1 id="legal-title">{title}</h1>
      <p className="muted">{effective}</p>
      <p>{linked(intro)}</p>
    </header>
    <nav className="legal-contents" aria-label={tr('Contents')}>
      <strong>{tr('Contents')}</strong>
      <ol>{sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.heading}</a></li>)}</ol>
    </nav>
    {sections.map(section => <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`}>
      <h2 id={`${section.id}-heading`}>{section.heading}</h2>
      {section.body.map((block, index) => Array.isArray(block)
        ? <ul key={index}>{block.map(item => <li key={item}>{linked(item)}</li>)}</ul>
        : <p key={index}>{linked(block)}</p>)}
    </section>)}
    <footer>
      <button type="button" className="button outline" onClick={() => onOpen(other)}>{legalDocument(other, language).title}</button>
    </footer>
  </article>
}

/** The same documents for visitors without a session. */
export function PublicLegalPage({ kind, onOpen, onBack }: DocumentProps & { onBack: () => void }) {
  return <div className="legal-page">
    <header className="legal-page-header">
      <span className="legal-page-brand"><img src={brandIcon} alt=""/><strong>Sense<span>Work</span></strong></span>
      <div>
        <button type="button" className="button outline small" onClick={onBack}>{tr('Back to sign in')}</button>
        <LanguageToggle />
      </div>
    </header>
    <main><Legal kind={kind} onOpen={onOpen}/></main>
  </div>
}
