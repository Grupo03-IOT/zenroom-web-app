import { useLanguage, tr } from '../../shared/i18n/i18n'

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage()
  return <div className="language-toggle" role="group" aria-label={tr('Language')}>
    <button type="button" aria-label="Español" aria-pressed={language === 'es'} className={language === 'es' ? 'active' : ''} onClick={() => setLanguage('es')}>ES</button>
    <button type="button" aria-label="English" aria-pressed={language === 'en'} className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>EN</button>
  </div>
}
