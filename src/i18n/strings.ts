// ============================================================
// Translation strings — English & Hindi
// ============================================================
//
// The product targets Gwalior — a Tier-2 Madhya Pradesh city — and until
// now shipped an English-only interface with a language button that did
// nothing (`useState('EN')`, no handler). That is a dead control on the
// one surface a Hindi-speaking citizen meets first.
//
//   THIS IS HYGIENE, NOT INNOVATION, AND IT IS NOT PITCHED AS ONE.
//   CPGRAMS NextGen already has voice-to-text and multilingual filing,
//   and DARPG launched the Samadhan Didi voice chatbot in May 2026.
//   Bhashini has been used for native-language complaint registration at
//   Mahakumbh in eleven languages. Filing in Hindi is table stakes for
//   credibility with an Indian jury. It is not a differentiator, and
//   calling it one would invite the obvious reply.
//
// Coverage is deliberate rather than total: the citizen journey — the
// landing page, the report wizard and complaint tracking — is
// translated. The department and admin portals stay in English, which
// matches how municipal staff in MP actually work; machine-translated
// administrative vocabulary no officer would use is worse than none.

export type Locale = 'en' | 'hi';

export const LOCALES: Array<{ id: Locale; label: string; nativeLabel: string }> = [
  { id: 'en', label: 'English', nativeLabel: 'English' },
  { id: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
];

/**
 * One flat dictionary keyed by dotted path.
 *
 * Flat rather than nested because a missing key must fail loudly and
 * findably. A `t('report.step.photos')` with no entry renders the key
 * itself, which is visible in review; a nested lookup returning
 * undefined renders nothing and ships silently.
 */
export const STRINGS: Record<Locale, Record<string, string>> = {
  en: {
    'app.name': 'JAN-SEVA',
    'app.tagline': 'Report civic issues. Track every fix.',
    'nav.report': 'Report an issue',
    'nav.track': 'Track complaint',
    'nav.initiatives': 'Initiatives',
    'nav.about': 'About',
    'nav.help': 'Help',
    'action.continue': 'Continue',
    'action.back': 'Back',
    'action.cancel': 'Cancel',
    'action.submit': 'Submit',
    'action.retry': 'Try again',
    'lang.change': 'Change language',

    'hero.line1': 'YOUR CITY.',
    'hero.line2': 'YOUR VOICE.',
    'hero.line3': 'OUR',
    'hero.title': 'Your city, your voice',
    'hero.subtitle':
      'Report a civic issue with a photo and location. Track it until it is verified fixed.',
    'hero.cta.report': 'REPORT AN ISSUE',
    'hero.cta.report.sub': 'Click a photo & submit in 60 seconds',
    'hero.cta.track': 'TRACK COMPLAINT',
    'hero.cta.track.sub': 'Check your complaint status',
    'hero.description': 'Report civic issues in {city} — potholes, garbage, water leaks, broken streetlights — and follow them until the fix is verified.',
    'hero.trust.note': 'Live from this system. Verified means the citizen who reported it confirmed the fix — not that a department closed the ticket.',
    'hero.stat.reported': 'Issues tracked',
    'hero.stat.resolved': 'Citizen-verified fixes',
    'hero.stat.initiatives': 'Repeat failures caught',
    'hero.stat.illustrative': 'Illustrative programme figures',

    'report.title': 'Report a civic issue',
    'report.step.photos': 'Photos',
    'report.step.description': 'Description',
    'report.step.identity': 'Identity',
    'report.step.location': 'Location',
    'report.step.review': 'Review',
    'report.photos.hint': 'Take a clear photo of the issue. Live camera preferred.',
    'report.description.label': 'Describe the issue',
    'report.description.placeholder':
      'What is wrong, and where exactly? Hindi or English is fine.',
    'report.voice.start': 'Speak instead',
    'report.voice.listening': 'Listening — speak now',
    'report.voice.stop': 'Stop',
    'report.voice.unsupported': 'Voice input is not available in this browser.',
    'report.location.label': 'Confirm the location',
    'report.review.title': 'Check before you submit',

    'classify.heading': 'Suggested classification',
    'classify.confirm': 'Is this right?',
    'classify.change': 'Change category',
    'classify.method':
      'Matched from your description by keyword. Photos are not analysed.',

    'success.title': 'Report submitted',
    'success.joined.title': 'Added to an existing issue',
    'success.ticket': 'Complaint ticket',
    'success.copy': 'Copy ID',
    'success.track': 'Track complaint',
    'success.home': 'Back to home',

    'track.title': 'Track your complaint',
    'track.search': 'Track',
    'track.verify': 'Verify to see full details',
    'track.confirm': 'Yes, this is fixed',
    'track.dispute': 'No, still broken',
    'track.proof.heading': 'Proof of repair',
    'track.durability.title': 'Is it still fixed?',
    'track.durability.yes': 'Still fixed',
    'track.durability.no': 'It has failed again',
  },

  hi: {
    'app.name': 'जन-सेवा',
    'app.tagline': 'नागरिक समस्या दर्ज करें। हर समाधान पर नज़र रखें।',
    'nav.report': 'शिकायत दर्ज करें',
    'nav.track': 'शिकायत ट्रैक करें',
    'nav.initiatives': 'पहल',
    'nav.about': 'हमारे बारे में',
    'nav.help': 'सहायता',
    'action.continue': 'आगे बढ़ें',
    'action.back': 'पीछे',
    'action.cancel': 'रद्द करें',
    'action.submit': 'जमा करें',
    'action.retry': 'फिर कोशिश करें',
    'lang.change': 'भाषा बदलें',

    'hero.line1': 'आपका शहर।',
    'hero.line2': 'आपकी आवाज़।',
    'hero.line3': 'हमारा',
    'hero.title': 'आपका शहर, आपकी आवाज़',
    'hero.subtitle':
      'फ़ोटो और स्थान के साथ नागरिक समस्या दर्ज करें। समाधान की पुष्टि होने तक नज़र रखें।',
    'hero.cta.report': 'शिकायत दर्ज करें',
    'hero.cta.report.sub': 'फ़ोटो खींचें और 60 सेकंड में भेजें',
    'hero.cta.track': 'शिकायत ट्रैक करें',
    'hero.cta.track.sub': 'अपनी शिकायत की स्थिति देखें',
    'hero.description': '{city} में नागरिक समस्याएँ दर्ज करें — गड्ढे, कचरा, पानी का रिसाव, खराब स्ट्रीटलाइट — और समाधान की पुष्टि होने तक नज़र रखें।',
    'hero.trust.note': 'इस सिस्टम से सीधे लिया गया। "सत्यापित" का अर्थ है कि शिकायतकर्ता नागरिक ने स्वयं पुष्टि की — केवल विभाग द्वारा टिकट बंद करना नहीं।',
    'hero.stat.reported': 'दर्ज शिकायतें',
    'hero.stat.resolved': 'नागरिक-सत्यापित समाधान',
    'hero.stat.initiatives': 'दोबारा खराबी पकड़ी गई',
    'hero.stat.illustrative': 'उदाहरणात्मक कार्यक्रम आंकड़े',

    'report.title': 'नागरिक समस्या दर्ज करें',
    'report.step.photos': 'फ़ोटो',
    'report.step.description': 'विवरण',
    'report.step.identity': 'पहचान',
    'report.step.location': 'स्थान',
    'report.step.review': 'समीक्षा',
    'report.photos.hint': 'समस्या की स्पष्ट फ़ोटो लें। लाइव कैमरा बेहतर है।',
    'report.description.label': 'समस्या का विवरण दें',
    'report.description.placeholder':
      'क्या समस्या है और कहाँ? हिंदी या अंग्रेज़ी दोनों ठीक हैं।',
    'report.voice.start': 'बोलकर बताएं',
    'report.voice.listening': 'सुन रहे हैं — अब बोलिए',
    'report.voice.stop': 'रोकें',
    'report.voice.unsupported': 'इस ब्राउज़र में आवाज़ से लिखने की सुविधा नहीं है।',
    'report.location.label': 'स्थान की पुष्टि करें',
    'report.review.title': 'जमा करने से पहले जांच लें',

    'classify.heading': 'सुझाई गई श्रेणी',
    'classify.confirm': 'क्या यह सही है?',
    'classify.change': 'श्रेणी बदलें',
    'classify.method':
      'आपके विवरण के शब्दों से मिलान किया गया। फ़ोटो का विश्लेषण नहीं होता।',

    'success.title': 'शिकायत दर्ज हो गई',
    'success.joined.title': 'मौजूदा समस्या में जोड़ी गई',
    'success.ticket': 'शिकायत टिकट',
    'success.copy': 'आईडी कॉपी करें',
    'success.track': 'शिकायत ट्रैक करें',
    'success.home': 'होम पर जाएं',

    'track.title': 'अपनी शिकायत ट्रैक करें',
    'track.search': 'ट्रैक करें',
    'track.verify': 'पूरी जानकारी के लिए सत्यापन करें',
    'track.confirm': 'हाँ, यह ठीक हो गया',
    'track.dispute': 'नहीं, अब भी खराब है',
    'track.proof.heading': 'मरम्मत का प्रमाण',
    'track.durability.title': 'क्या यह अब भी ठीक है?',
    'track.durability.yes': 'अब भी ठीक है',
    'track.durability.no': 'फिर से खराब हो गया',
  },
};
