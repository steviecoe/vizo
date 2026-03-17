import type { SupportedLocale } from '@vizo/shared';

export interface TranslationKeys {
  // Navigation
  'nav.dashboard': string;
  'nav.generate': string;
  'nav.quickGen': string;
  'nav.photoshoot': string;
  'nav.shopify': string;
  'nav.products': string;
  'nav.repository': string;
  'nav.artDirection': string;
  'nav.models': string;
  'nav.backgrounds': string;
  'nav.credits': string;
  'nav.settings': string;
  'nav.support': string;

  // Dashboard
  'dashboard.title': string;
  'dashboard.creativeOverview': string;
  'dashboard.newProject': string;
  'dashboard.whatsNew': string;
  'dashboard.trending': string;
  'dashboard.creditBalance': string;
  'dashboard.totalGenerated': string;
  'dashboard.approved': string;
  'dashboard.pending': string;

  // Generation
  'gen.studio': string;
  'gen.productSelection': string;
  'gen.modelPersona': string;
  'gen.environment': string;
  'gen.creativeDirection': string;
  'gen.generate': string;
  'gen.generating': string;
  'gen.status': string;
  'gen.noGenerations': string;
  'gen.complete': string;
  'gen.failed': string;
  'gen.resolution': string;
  'gen.aspectRatio': string;
  'gen.variants': string;

  // Credits
  'credits.title': string;
  'credits.purchase': string;
  'credits.balance': string;
  'credits.history': string;
  'credits.perCredit': string;
  'credits.total': string;
  'credits.payNow': string;
  'credits.processing': string;

  // Repository
  'repo.title': string;
  'repo.approve': string;
  'repo.reject': string;
  'repo.download': string;
  'repo.downloading': string;
  'repo.export': string;
  'repo.noImages': string;
  'repo.makeVideo': string;

  // Settings
  'settings.title': string;
  'settings.language': string;
  'settings.autoDetect': string;
  'settings.defaultLanguage': string;
  'settings.save': string;
  'settings.saved': string;

  // Auth
  'auth.signIn': string;
  'auth.signingIn': string;
  'auth.signInSuccess': string;
  'auth.continueWithGoogle': string;
  'auth.orEmail': string;
  'auth.email': string;
  'auth.password': string;
  'auth.invalidCredentials': string;
  'auth.tooManyAttempts': string;

  // Common
  'common.loading': string;
  'common.error': string;
  'common.retry': string;
  'common.cancel': string;
  'common.save': string;
  'common.delete': string;
  'common.edit': string;
  'common.create': string;
  'common.search': string;
  'common.noResults': string;
}

type Translations = Record<SupportedLocale, TranslationKeys>;

const en: TranslationKeys = {
  'nav.dashboard': 'Dashboard',
  'nav.generate': 'Generate',
  'nav.quickGen': 'Quick Generate',
  'nav.photoshoot': 'Photoshoot',
  'nav.shopify': 'Shopify',
  'nav.products': 'Products',
  'nav.repository': 'Repository',
  'nav.artDirection': 'Art Direction',
  'nav.models': 'Models',
  'nav.backgrounds': 'Backgrounds',
  'nav.credits': 'Credits',
  'nav.settings': 'Settings',
  'nav.support': 'Support',

  'dashboard.title': 'Dashboard',
  'dashboard.creativeOverview': 'Creative Overview',
  'dashboard.newProject': 'New Project',
  'dashboard.whatsNew': "What's New",
  'dashboard.trending': 'Trending',
  'dashboard.creditBalance': 'Credit Balance',
  'dashboard.totalGenerated': 'Total Generated',
  'dashboard.approved': 'Approved',
  'dashboard.pending': 'Pending',

  'gen.studio': 'AI Generation Studio',
  'gen.productSelection': '1. Product Selection',
  'gen.modelPersona': '2. Model Persona',
  'gen.environment': '3. Environment',
  'gen.creativeDirection': '4. Creative Direction',
  'gen.generate': 'Generate',
  'gen.generating': 'Generating...',
  'gen.status': 'Generation Status',
  'gen.noGenerations': 'No generations yet',
  'gen.complete': 'Complete',
  'gen.failed': 'Generation Failed',
  'gen.resolution': 'Resolution',
  'gen.aspectRatio': 'Aspect Ratio',
  'gen.variants': 'Variants',

  'credits.title': 'Credits',
  'credits.purchase': 'Purchase Credits',
  'credits.balance': 'Current Balance',
  'credits.history': 'Transaction History',
  'credits.perCredit': 'per credit',
  'credits.total': 'Total',
  'credits.payNow': 'Pay Now',
  'credits.processing': 'Processing...',

  'repo.title': 'Image Repository',
  'repo.approve': 'Approve',
  'repo.reject': 'Reject',
  'repo.download': 'Download',
  'repo.downloading': 'Downloading...',
  'repo.export': 'Export to Shopify',
  'repo.noImages': 'No images yet',
  'repo.makeVideo': 'Make Video',

  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.autoDetect': 'Auto-detect language',
  'settings.defaultLanguage': 'Default Language',
  'settings.save': 'Save Settings',
  'settings.saved': 'Settings saved',

  'auth.signIn': 'Sign In',
  'auth.signingIn': 'Signing in...',
  'auth.signInSuccess': 'Sign-in successful',
  'auth.continueWithGoogle': 'Continue with Google',
  'auth.orEmail': 'or sign in with email',
  'auth.email': 'Email address',
  'auth.password': 'Password',
  'auth.invalidCredentials': 'Invalid email or password.',
  'auth.tooManyAttempts': 'Too many attempts. Please try again later.',

  'common.loading': 'Loading...',
  'common.error': 'An error occurred',
  'common.retry': 'Retry',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.create': 'Create',
  'common.search': 'Search',
  'common.noResults': 'No results found',
};

const pl: TranslationKeys = {
  'nav.dashboard': 'Panel',
  'nav.generate': 'Generuj',
  'nav.quickGen': 'Szybkie generowanie',
  'nav.photoshoot': 'Sesja zdjęciowa',
  'nav.shopify': 'Shopify',
  'nav.products': 'Produkty',
  'nav.repository': 'Repozytorium',
  'nav.artDirection': 'Kierunek artystyczny',
  'nav.models': 'Modele',
  'nav.backgrounds': 'Tła',
  'nav.credits': 'Kredyty',
  'nav.settings': 'Ustawienia',
  'nav.support': 'Wsparcie',

  'dashboard.title': 'Panel',
  'dashboard.creativeOverview': 'Przegląd kreatywny',
  'dashboard.newProject': 'Nowy projekt',
  'dashboard.whatsNew': 'Co nowego',
  'dashboard.trending': 'Popularne',
  'dashboard.creditBalance': 'Saldo kredytów',
  'dashboard.totalGenerated': 'Łącznie wygenerowano',
  'dashboard.approved': 'Zatwierdzone',
  'dashboard.pending': 'Oczekujące',

  'gen.studio': 'Studio generowania AI',
  'gen.productSelection': '1. Wybór produktu',
  'gen.modelPersona': '2. Persona modela',
  'gen.environment': '3. Środowisko',
  'gen.creativeDirection': '4. Kierunek kreatywny',
  'gen.generate': 'Generuj',
  'gen.generating': 'Generowanie...',
  'gen.status': 'Status generowania',
  'gen.noGenerations': 'Brak generacji',
  'gen.complete': 'Ukończono',
  'gen.failed': 'Generowanie nie powiodło się',
  'gen.resolution': 'Rozdzielczość',
  'gen.aspectRatio': 'Proporcje',
  'gen.variants': 'Warianty',

  'credits.title': 'Kredyty',
  'credits.purchase': 'Kup kredyty',
  'credits.balance': 'Aktualne saldo',
  'credits.history': 'Historia transakcji',
  'credits.perCredit': 'za kredyt',
  'credits.total': 'Razem',
  'credits.payNow': 'Zapłać teraz',
  'credits.processing': 'Przetwarzanie...',

  'repo.title': 'Repozytorium obrazów',
  'repo.approve': 'Zatwierdź',
  'repo.reject': 'Odrzuć',
  'repo.download': 'Pobierz',
  'repo.downloading': 'Pobieranie...',
  'repo.export': 'Eksportuj do Shopify',
  'repo.noImages': 'Brak obrazów',
  'repo.makeVideo': 'Utwórz wideo',

  'settings.title': 'Ustawienia',
  'settings.language': 'Język',
  'settings.autoDetect': 'Automatyczne wykrywanie języka',
  'settings.defaultLanguage': 'Domyślny język',
  'settings.save': 'Zapisz ustawienia',
  'settings.saved': 'Ustawienia zapisane',

  'auth.signIn': 'Zaloguj się',
  'auth.signingIn': 'Logowanie...',
  'auth.signInSuccess': 'Logowanie pomyślne',
  'auth.continueWithGoogle': 'Kontynuuj z Google',
  'auth.orEmail': 'lub zaloguj się przez email',
  'auth.email': 'Adres email',
  'auth.password': 'Hasło',
  'auth.invalidCredentials': 'Nieprawidłowy email lub hasło.',
  'auth.tooManyAttempts': 'Za dużo prób. Spróbuj ponownie później.',

  'common.loading': 'Ładowanie...',
  'common.error': 'Wystąpił błąd',
  'common.retry': 'Ponów',
  'common.cancel': 'Anuluj',
  'common.save': 'Zapisz',
  'common.delete': 'Usuń',
  'common.edit': 'Edytuj',
  'common.create': 'Utwórz',
  'common.search': 'Szukaj',
  'common.noResults': 'Brak wyników',
};

const de: TranslationKeys = {
  'nav.dashboard': 'Dashboard',
  'nav.generate': 'Generieren',
  'nav.quickGen': 'Schnelle Generierung',
  'nav.photoshoot': 'Fotoshooting',
  'nav.shopify': 'Shopify',
  'nav.products': 'Produkte',
  'nav.repository': 'Repository',
  'nav.artDirection': 'Art Direction',
  'nav.models': 'Modelle',
  'nav.backgrounds': 'Hintergründe',
  'nav.credits': 'Credits',
  'nav.settings': 'Einstellungen',
  'nav.support': 'Support',

  'dashboard.title': 'Dashboard',
  'dashboard.creativeOverview': 'Kreativübersicht',
  'dashboard.newProject': 'Neues Projekt',
  'dashboard.whatsNew': 'Neuigkeiten',
  'dashboard.trending': 'Trending',
  'dashboard.creditBalance': 'Credit-Guthaben',
  'dashboard.totalGenerated': 'Gesamt generiert',
  'dashboard.approved': 'Genehmigt',
  'dashboard.pending': 'Ausstehend',

  'gen.studio': 'KI-Generierungsstudio',
  'gen.productSelection': '1. Produktauswahl',
  'gen.modelPersona': '2. Model-Persona',
  'gen.environment': '3. Umgebung',
  'gen.creativeDirection': '4. Kreative Richtung',
  'gen.generate': 'Generieren',
  'gen.generating': 'Generierung...',
  'gen.status': 'Generierungsstatus',
  'gen.noGenerations': 'Keine Generierungen',
  'gen.complete': 'Abgeschlossen',
  'gen.failed': 'Generierung fehlgeschlagen',
  'gen.resolution': 'Auflösung',
  'gen.aspectRatio': 'Seitenverhältnis',
  'gen.variants': 'Varianten',

  'credits.title': 'Credits',
  'credits.purchase': 'Credits kaufen',
  'credits.balance': 'Aktuelles Guthaben',
  'credits.history': 'Transaktionsverlauf',
  'credits.perCredit': 'pro Credit',
  'credits.total': 'Gesamt',
  'credits.payNow': 'Jetzt bezahlen',
  'credits.processing': 'Verarbeitung...',

  'repo.title': 'Bild-Repository',
  'repo.approve': 'Genehmigen',
  'repo.reject': 'Ablehnen',
  'repo.download': 'Herunterladen',
  'repo.downloading': 'Herunterladen...',
  'repo.export': 'Zu Shopify exportieren',
  'repo.noImages': 'Keine Bilder',
  'repo.makeVideo': 'Video erstellen',

  'settings.title': 'Einstellungen',
  'settings.language': 'Sprache',
  'settings.autoDetect': 'Sprache automatisch erkennen',
  'settings.defaultLanguage': 'Standardsprache',
  'settings.save': 'Einstellungen speichern',
  'settings.saved': 'Einstellungen gespeichert',

  'auth.signIn': 'Anmelden',
  'auth.signingIn': 'Anmeldung...',
  'auth.signInSuccess': 'Anmeldung erfolgreich',
  'auth.continueWithGoogle': 'Weiter mit Google',
  'auth.orEmail': 'oder mit E-Mail anmelden',
  'auth.email': 'E-Mail-Adresse',
  'auth.password': 'Passwort',
  'auth.invalidCredentials': 'Ungültige E-Mail oder Passwort.',
  'auth.tooManyAttempts': 'Zu viele Versuche. Bitte versuchen Sie es später erneut.',

  'common.loading': 'Laden...',
  'common.error': 'Ein Fehler ist aufgetreten',
  'common.retry': 'Erneut versuchen',
  'common.cancel': 'Abbrechen',
  'common.save': 'Speichern',
  'common.delete': 'Löschen',
  'common.edit': 'Bearbeiten',
  'common.create': 'Erstellen',
  'common.search': 'Suchen',
  'common.noResults': 'Keine Ergebnisse gefunden',
};

// For remaining locales, fall back to English (can be filled in later)
function createFallbackLocale(): TranslationKeys {
  return { ...en };
}

export const translations: Translations = {
  en,
  pl,
  de,
  fr: createFallbackLocale(),
  es: createFallbackLocale(),
  it: createFallbackLocale(),
  pt: createFallbackLocale(),
  nl: createFallbackLocale(),
  ja: createFallbackLocale(),
  ko: createFallbackLocale(),
  zh: createFallbackLocale(),
};
