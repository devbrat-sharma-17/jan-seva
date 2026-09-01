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
    'app.serving': 'Serving {city}, {state}',
    'app.copyright': '© {year} JAN-SEVA. A civic grievance platform for {city}.',

    // Navigation & Header
    'nav.home': 'Home',
    'nav.howItWorks': 'How It Works',
    'nav.report': 'Report an issue',
    'nav.track': 'Track complaint',
    'nav.initiatives': 'Initiatives',
    'nav.about': 'About Us',
    'nav.help': 'Help & Support',
    'nav.privacy': 'Privacy Policy',
    'nav.terms': 'Terms of Service',
    'nav.contact': 'Contact Us',
    'nav.admin': 'Admin',
    'nav.adminLogin': 'Admin Login',
    'nav.department': 'Department',
    'nav.departmentLogin': 'Department Login',
    'nav.portalAccess': 'Portal Access',
    'nav.language': 'Language',
    'nav.quickLinks': 'Quick Links',
    'nav.important': 'Important',
    'nav.more': 'More',
    'nav.reportCtaSub': 'Click. Describe. Submit in 60s.',

    // Common Actions
    'action.continue': 'Continue',
    'action.back': 'Back',
    'action.cancel': 'Cancel',
    'action.submit': 'Submit',
    'action.retry': 'Try again',
    'action.edit': 'Edit',
    'action.leave': 'Leave',
    'action.keepEditing': 'Keep Editing',
    'action.close': 'Close',
    'lang.change': 'Change language',

    // Hero Section
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

    // Portal Access
    'portal.admin.title': 'Admin Login',
    'portal.admin.subtitle': 'Secure Admin Portal',
    'portal.dept.title': 'Department Login',
    'portal.dept.subtitle': 'Department Operations Portal',

    // Common Civic Issues / Categories
    'categories.heading': 'Common Civic Issues',
    'categories.subtitle': "Select a category to report an issue. Don't worry — we'll route it to the right department.",
    'category.roads': 'Roads & Potholes',
    'category.garbage': 'Garbage & Sanitation',
    'category.water': 'Water Leakage',
    'category.streetlights': 'Street Lights',
    'category.infrastructure': 'Public Infrastructure',
    'category.others': 'Others',

    // How It Works
    'howItWorks.heading': 'How JAN-SEVA Works',
    'howItWorks.subtitle': 'From reporting to resolution — a simple, transparent 5-step process.',
    'howItWorks.step1.title': 'Report',
    'howItWorks.step1.desc': 'Click a photo & describe the issue',
    'howItWorks.step2.title': 'We Match',
    'howItWorks.step2.desc': 'Your description is matched to a category and department — you confirm it before submitting',
    'howItWorks.step3.title': 'We Route',
    'howItWorks.step3.desc': 'Sent to the right department',
    'howItWorks.step4.title': 'Track',
    'howItWorks.step4.desc': 'Real-time status updates',
    'howItWorks.step5.title': 'Resolve',
    'howItWorks.step5.desc': 'Issue resolved & verified',

    // Report Wizard Header & Dialog
    'report.header.title': 'Report an Issue',
    'report.dialog.leaveTitle': 'Leave report?',
    'report.dialog.leaveDesc': 'Your photos and report draft will be saved temporarily on this device.',
    'report.bottom.continue': 'Continue →',
    'report.bottom.confirmLocation': 'CONFIRM LOCATION & CONTINUE →',
    'report.bottom.submit': 'SUBMIT COMPLAINT',
    'report.bottom.supportNote': 'Your report will be sent to JAN-SEVA.',

    // Step 1: Photos
    'report.photo.title': 'Show us the problem',
    'report.photo.subtitle': 'Take up to 3 photos of the issue. Clear photos help us understand the problem better.',
    'report.photo.takePhoto': 'TAKE PHOTO',
    'report.photo.chooseGallery': 'Choose from Gallery',
    'report.photo.addAnother': '+ Add Photo',
    'report.photo.optimising': 'Optimising photo…',
    'report.photo.tip': 'Capture the issue clearly and include some surroundings so the repair team can easily find it.',
    'report.photo.photoCount': 'Photo {current} of {total}',
    'report.photo.replace': 'Replace photo',
    'report.photo.delete': 'Delete photo',

    // Step 2: Description
    'report.desc.title': 'Tell us what happened',
    'report.desc.subtitle': 'Describe the problem briefly.',
    'report.desc.placeholder': 'Example: Large pothole near City Centre is causing traffic problems and hazard for two-wheelers.',
    'report.desc.counter': '{count} / 500 characters',
    'report.desc.suggestions': 'Quick Suggestions',
    'report.voice.start': 'Speak instead',
    'report.voice.listening': 'Listening — speak now',
    'report.voice.requesting': 'Waiting for microphone permission',
    'report.voice.stop': 'Stop',
    'report.voice.unsupported': "Voice input isn't supported in this browser.",
    // Dictation recognises the language the page is in, and only that
    // one. Promising that "Hindi or English, either is understood" was a
    // claim the browser's recogniser does not make.
    'report.voice.note': 'Dictation follows the page language — currently English. Switch to हिन्दी to speak in Hindi.',
    'report.voice.truncated': 'The description is now at its 500-character limit, so the rest was not added.',

    // Voice failures. One message per cause: a recogniser that cannot
    // reach its service is NOT the same as a phone with no connection,
    // and telling a citizen on working mobile data that they need
    // internet sends them to fix something that is not broken.
    'report.voice.error.unsupported': "Voice input isn't supported in this browser. You can still type your complaint.",
    'report.voice.error.insecure': 'Voice input needs a secure (https) connection. You can still type your complaint.',
    'report.voice.error.permission': 'Microphone permission was denied. Allow microphone access or type your complaint.',
    'report.voice.error.service': 'Voice recognition is temporarily unavailable. Please try again or type your complaint.',
    'report.voice.error.network': "Voice recognition couldn't connect. Please check your connection and try again.",
    'report.voice.error.offline': 'You are offline, so voice input cannot run. You can still type your complaint.',
    'report.voice.error.noSpeech': 'No speech was detected. Please try speaking again.',
    'report.voice.error.audioCapture': "Microphone couldn't be accessed. Check your microphone permission and try again.",
    'report.voice.error.language': 'This browser cannot recognise the selected language. You can still type your complaint.',
    'report.voice.error.unknown': "Voice input couldn't start. You can still type your complaint.",

    // Step 3: Identity
    'report.identity.title': "Let's verify you",
    'report.identity.subtitle': 'We need a verified identity so you can track your complaint.',
    'report.identity.tabAadhaar': 'Aadhaar',
    'report.identity.tabMobile': 'Mobile Number',
    'report.identity.aadhaarLabel': 'Aadhaar Number',
    'report.identity.mobileLabel': 'Mobile Number',
    'report.identity.nameLabel': 'Your Full Name',
    'report.identity.namePlaceholder': 'Enter your full name',
    'report.identity.sendOtp': 'SEND OTP',
    'report.identity.sendingOtp': 'Sending code...',
    'report.identity.enterOtp': 'Enter OTP',
    'report.identity.otpSubtitleAadhaar': 'We sent a 6-digit verification code to your registered Aadhaar mobile.',
    'report.identity.otpSubtitleMobile': 'We sent a 6-digit verification code to your mobile number.',
    'report.identity.resendOtp': 'Resend OTP',
    'report.identity.codeSentTo': 'Code sent to {target}',
    'report.identity.verifyBtn': 'VERIFY & CONTINUE',
    'report.identity.verifying': 'Verifying...',
    'report.identity.verifiedTitle': '✓ Identity Verified',
    'report.identity.changeMethod': 'Change Verification Method',
    'report.identity.privacy': 'Your identity is encrypted and used solely to verify and track your civic complaints.',

    // Step 4: Location
    'report.loc.title': 'Where is the issue?',
    'report.loc.subtitle': 'We’ll detect your current location and let you confirm where the issue actually is.',
    'report.loc.detecting': 'Detecting your location...',
    'report.loc.fetchingGps': 'Fetching GPS coordinates for {city}',
    'report.loc.deniedTitle': 'LOCATION ACCESS UNAVAILABLE',
    'report.loc.deniedDesc': "We couldn't access your current location. You can try again or easily select your locality manually.",
    'report.loc.tryAgain': 'TRY AGAIN',
    'report.loc.enterManually': 'ENTER MANUALLY',
    'report.loc.detectedTag': 'LOCATION DETECTED',
    'report.loc.accuracy': 'Accuracy: {accuracy}',
    'report.loc.lowAccuracy': '⚠ Location accuracy is low. We recommend confirming or adjusting the locality below.',
    'report.loc.whereExact': 'WHERE EXACTLY IS THE ISSUE?',
    'report.loc.adjustHint': 'You can adjust the location if the issue is not exactly where you are standing.',
    'report.loc.useDetected': 'USE DETECTED LOCATION',
    'report.loc.changeLocation': 'CHANGE / ENTER LOCATION',
    'report.loc.confirmedTag': 'LOCATION CONFIRMED',
    'report.loc.sourceGps': 'GPS DETECTED',
    'report.loc.sourceManual': 'MANUALLY SELECTED',
    'report.loc.coords': 'Issue Coordinates:',
    'report.loc.searchTitle': 'SEARCH LOCATION',
    'report.loc.searchPlaceholder': 'Search area, landmark or address (e.g. City Centre, Phool Bagh...)',
    'report.loc.selectOnMap': 'Select on map or tap a landmark:',
    'report.loc.useGps': 'Use Current GPS Location',

    // Step 5: Review
    'report.review.title': 'Review your report',
    'report.review.subtitle': 'Make sure everything looks right before submitting.',
    'report.review.photos': 'Photos',
    'report.review.description': 'Description',
    'report.review.identity': 'Citizen Identity',
    'report.review.location': 'Location',
    'report.review.noDesc': 'No description provided.',
    'report.review.verifiedVia': '✓ Verified via {target}',
    'report.review.routingPromise': 'JAN-SEVA Routing: Our system will automatically classify this issue, calculate priority, and route it to the responsible municipal department.',

    // Success Screen
    'success.title': 'Report submitted',
    'success.joinedTitle': 'Confirmation added',
    'success.subtitleSingle': 'Thank you for helping make {city} a cleaner and safer city.',
    'success.subtitleJoined': 'Others had already reported this issue, so it is being worked as one job. You keep your own ticket and your own say in whether it is fixed — it cannot be closed on your behalf.',
    'success.ticket': 'Complaint ticket',
    'success.copy': 'Copy ID',
    'success.copied': 'Ticket ID copied.',
    'success.filedOn': 'Filed on',
    'success.location': 'Location',
    'success.classifiedIssue': 'Classified issue',
    'success.department': 'Routed department',
    'success.note': 'Save this ticket ID. You will need it to check progress, and it is the reference the department will use when they contact you.',
    'success.guaranteeTitle': 'This cannot be closed without you.',
    'success.guaranteeDesc': 'The department can submit a repair, but only you can accept it. Their photo must be taken live at this location and must not have been used anywhere before. We will ask you again in 30 days whether it is still fixed.',
    'success.track': 'TRACK COMPLAINT',
    'success.home': 'BACK TO HOME',
    'success.notSavedTitle': 'Report not saved',
    'success.notSavedSubtitle': 'Your report could not be stored on this device, so no ticket number was issued. Please go back and submit it again — your details are still filled in.',

    // Track Complaint
    'track.title': 'Track your complaint',
    'track.subtitle': 'Enter your Complaint ID to see its current status.',
    'track.idLabel': 'Complaint ID',
    'track.idHint': 'Find this on your acknowledgement slip or confirmation message.',
    'track.btn': 'TRACK COMPLAINT',
    'track.forgot': 'Forgot your Complaint ID?',
    'track.signedInAs': 'Signed in as {name}',
    'track.findMine': 'FIND MY COMPLAINTS',
    'track.ticketHeading': 'Ticket {id}',
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
    'app.serving': '{city}, {state} की सेवा में',
    'app.copyright': '© {year} जन-सेवा। {city} के लिए नागरिक शिकायत निवारण मंच।',

    // Navigation & Header
    'nav.home': 'होम',
    'nav.howItWorks': 'यह कैसे काम करता है',
    'nav.report': 'शिकायत दर्ज करें',
    'nav.track': 'शिकायत ट्रैक करें',
    'nav.initiatives': 'पहल',
    'nav.about': 'हमारे बारे में',
    'nav.help': 'सहायता एवं संपर्क',
    'nav.privacy': 'गोपनीयता नीति',
    'nav.terms': 'सेवा की शर्तें',
    'nav.contact': 'संपर्क करें',
    'nav.admin': 'प्रशासक',
    'nav.adminLogin': 'प्रशासक लॉगिन',
    'nav.department': 'विभाग',
    'nav.departmentLogin': 'विभागीय लॉगिन',
    'nav.portalAccess': 'पोर्टल पहुंच',
    'nav.language': 'भाषा',
    'nav.quickLinks': 'त्वरित लिंक',
    'nav.important': 'महत्वपूर्ण',
    'nav.more': 'अन्य',
    'nav.reportCtaSub': 'फोटो खींचें। विवरण दें। 60 सेकंड में भेजें।',

    // Common Actions
    'action.continue': 'आगे बढ़ें',
    'action.back': 'पीछे',
    'action.cancel': 'रद्द करें',
    'action.submit': 'जमा करें',
    'action.retry': 'फिर कोशिश करें',
    'action.edit': 'संपादित करें',
    'action.leave': 'छोड़ें',
    'action.keepEditing': 'संपादन जारी रखें',
    'action.close': 'बंद करें',
    'lang.change': 'भाषा बदलें',

    // Hero Section
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

    // Portal Access
    'portal.admin.title': 'प्रशासक लॉगिन',
    'portal.admin.subtitle': 'सुरक्षित प्रशासनिक पोर्टल',
    'portal.dept.title': 'विभागीय लॉगिन',
    'portal.dept.subtitle': 'विभागीय परिचालन पोर्टल',

    // Common Civic Issues / Categories
    'categories.heading': 'प्रमुख नागरिक समस्याएँ',
    'categories.subtitle': 'समस्या दर्ज करने के लिए श्रेणी चुनें। चिंता न करें — हम इसे संबंधित विभाग तक पहुँचाएंगे।',
    'category.roads': 'सड़कें और गड्ढे',
    'category.garbage': 'कचरा और स्वच्छता',
    'category.water': 'पानी का रिसाव',
    'category.streetlights': 'स्ट्रीट लाइट',
    'category.infrastructure': 'सार्वजनिक अवसंरचना',
    'category.others': 'अन्य समस्याएँ',

    // How It Works
    'howItWorks.heading': 'जन-सेवा कैसे काम करता है',
    'howItWorks.subtitle': 'शिकायत दर्ज करने से लेकर समाधान तक — एक सरल, पारदर्शी 5-चरणीय प्रक्रिया।',
    'howItWorks.step1.title': 'दर्ज करें',
    'howItWorks.step1.desc': 'फ़ोटो लें और समस्या का विवरण लिखें',
    'howItWorks.step2.title': 'मिलान',
    'howItWorks.step2.desc': 'आपके विवरण से श्रेणी और विभाग का मिलान होता है — जमा करने से पहले आप पुष्टि करते हैं',
    'howItWorks.step3.title': 'मार्गदर्शन',
    'howItWorks.step3.desc': 'सही विभाग को भेजी जाती है',
    'howItWorks.step4.title': 'ट्रैकिंग',
    'howItWorks.step4.desc': 'वास्तविक समय में स्थिति अपडेट',
    'howItWorks.step5.title': 'समाधान',
    'howItWorks.step5.desc': 'समस्या का समाधान और नागरिक सत्यापन',

    // Report Wizard Header & Dialog
    'report.header.title': 'समस्या दर्ज करें',
    'report.dialog.leaveTitle': 'शिकायत छोड़ें?',
    'report.dialog.leaveDesc': 'आपकी फ़ोटो और ड्राफ़्ट इस डिवाइस पर अस्थायी रूप से सुरक्षित रहेंगे।',
    'report.bottom.continue': 'आगे बढ़ें →',
    'report.bottom.confirmLocation': 'स्थान की पुष्टि करें और आगे बढ़ें →',
    'report.bottom.submit': 'शिकायत जमा करें',
    'report.bottom.supportNote': 'आपकी शिकायत जन-सेवा को भेजी जाएगी।',

    // Step 1: Photos
    'report.photo.title': 'समस्या दिखाएं',
    'report.photo.subtitle': 'समस्या की अधिकतम 3 फ़ोटो लें। स्पष्ट फ़ोटो से समस्या जल्दी समझ आती है।',
    'report.photo.takePhoto': 'फ़ोटो खींचें',
    'report.photo.chooseGallery': 'गैलरी से चुनें',
    'report.photo.addAnother': '+ फ़ोटो जोड़ें',
    'report.photo.optimising': 'फ़ोटो तैयार की जा रही है…',
    'report.photo.tip': 'समस्या की स्पष्ट फ़ोटो लें और आसपास का स्थान भी दिखाएं ताकि मरम्मत टीम आसानी से पहुँच सके।',
    'report.photo.photoCount': 'फ़ोटो {current} / {total}',
    'report.photo.replace': 'फ़ोटो बदलें',
    'report.photo.delete': 'फ़ोटो हटाएं',

    // Step 2: Description
    'report.desc.title': 'समस्या का विवरण दें',
    'report.desc.subtitle': 'समस्या के बारे में संक्षेप में बताएं।',
    'report.desc.placeholder': 'उदाहरण: सिटी सेंटर के पास सड़क पर बड़ा गड्ढा है, जिससे यातायात और दोपहिया वाहनों को खतरा हो रहा है।',
    'report.desc.counter': '{count} / 500 अक्षर',
    'report.desc.suggestions': 'सुझाव',
    'report.voice.start': 'बोलकर बताएं',
    'report.voice.listening': 'सुन रहे हैं — अब बोलिए',
    'report.voice.requesting': 'माइक्रोफ़ोन की अनुमति का इंतज़ार है',
    'report.voice.stop': 'रोकें',
    'report.voice.unsupported': 'इस ब्राउज़र में आवाज़ से लिखने की सुविधा नहीं है।',
    'report.voice.note': 'आवाज़ पहचान पेज की भाषा में होती है — अभी हिंदी। अंग्रेज़ी में बोलने के लिए भाषा बदलें।',
    'report.voice.truncated': 'विवरण 500 अक्षरों की सीमा तक पहुँच गया है, इसलिए बाकी हिस्सा नहीं जोड़ा गया।',

    // आवाज़ से जुड़ी गड़बड़ियाँ — हर कारण के लिए अलग संदेश।
    'report.voice.error.unsupported': 'इस ब्राउज़र में आवाज़ से लिखने की सुविधा नहीं है। आप टाइप करके शिकायत दर्ज कर सकते हैं।',
    'report.voice.error.insecure': 'आवाज़ इनपुट के लिए सुरक्षित (https) कनेक्शन चाहिए। आप टाइप करके शिकायत दर्ज कर सकते हैं।',
    'report.voice.error.permission': 'माइक्रोफ़ोन की अनुमति नहीं मिली। अनुमति दें या टाइप करके शिकायत दर्ज करें।',
    'report.voice.error.service': 'आवाज़ पहचान सेवा फ़िलहाल उपलब्ध नहीं है। दोबारा कोशिश करें या टाइप करके बताएं।',
    'report.voice.error.network': 'आवाज़ पहचान सेवा से संपर्क नहीं हो सका। कनेक्शन जाँचकर दोबारा कोशिश करें।',
    'report.voice.error.offline': 'आप ऑफ़लाइन हैं, इसलिए आवाज़ इनपुट काम नहीं करेगा। आप टाइप करके शिकायत दर्ज कर सकते हैं।',
    'report.voice.error.noSpeech': 'कोई आवाज़ सुनाई नहीं दी। कृपया दोबारा बोलकर देखें।',
    'report.voice.error.audioCapture': 'माइक्रोफ़ोन तक पहुँच नहीं हो सकी। माइक्रोफ़ोन की अनुमति जाँचकर दोबारा कोशिश करें।',
    'report.voice.error.language': 'यह ब्राउज़र चुनी गई भाषा नहीं पहचान पा रहा। आप टाइप करके शिकायत दर्ज कर सकते हैं।',
    'report.voice.error.unknown': 'आवाज़ इनपुट शुरू नहीं हो सका। आप टाइप करके शिकायत दर्ज कर सकते हैं।',

    // Step 3: Identity
    'report.identity.title': 'पहचान सत्यापित करें',
    'report.identity.subtitle': 'शिकायत ट्रैक करने और अपडेट पाने के लिए सत्यापन आवश्यक है।',
    'report.identity.tabAadhaar': 'आधार',
    'report.identity.tabMobile': 'मोबाइल नंबर',
    'report.identity.aadhaarLabel': 'आधार नंबर',
    'report.identity.mobileLabel': 'मोबाइल नंबर',
    'report.identity.nameLabel': 'आपका पूरा नाम',
    'report.identity.namePlaceholder': 'अपना पूरा नाम दर्ज करें',
    'report.identity.sendOtp': 'ओटीपी (OTP) भेजें',
    'report.identity.sendingOtp': 'कोड भेजा जा रहा है...',
    'report.identity.enterOtp': 'ओटीपी दर्ज करें',
    'report.identity.otpSubtitleAadhaar': 'हमने आपके आधार से जुड़े मोबाइल नंबर पर 6 अंकों का कोड भेजा है।',
    'report.identity.otpSubtitleMobile': 'हमने आपके मोबाइल नंबर पर 6 अंकों का सत्यापन कोड भेजा है।',
    'report.identity.resendOtp': 'ओटीपी दोबारा भेजें',
    'report.identity.codeSentTo': 'कोड {target} पर भेजा गया',
    'report.identity.verifyBtn': 'सत्यापित करें और आगे बढ़ें',
    'report.identity.verifying': 'सत्यापन हो रहा है...',
    'report.identity.verifiedTitle': '✓ पहचान सत्यापित',
    'report.identity.changeMethod': 'सत्यापन विधि बदलें',
    'report.identity.privacy': 'आपकी जानकारी सुरक्षित है और केवल आपकी शिकायतों के निवारण के लिए उपयोग की जाती है।',

    // Step 4: Location
    'report.loc.title': 'समस्या कहाँ है?',
    'report.loc.subtitle': 'हम आपके वर्तमान स्थान का पता लगाएंगे और आपको सही स्थान चुनने की सुविधा देंगे।',
    'report.loc.detecting': 'स्थान का पता लगाया जा रहा है...',
    'report.loc.fetchingGps': '{city} के लिए जीपीएस (GPS) निर्देशांक प्राप्त हो रहे हैं',
    'report.loc.deniedTitle': 'स्थान की अनुमति नहीं मिली',
    'report.loc.deniedDesc': 'वर्तमान स्थान नहीं मिल सका। आप पुनः प्रयास कर सकते हैं या स्वयं स्थान दर्ज कर सकते हैं।',
    'report.loc.tryAgain': 'पुनः प्रयास करें',
    'report.loc.enterManually': 'स्वयं दर्ज करें',
    'report.loc.detectedTag': 'स्थान मिला',
    'report.loc.accuracy': 'सटीकता: {accuracy}',
    'report.loc.lowAccuracy': '⚠ स्थान की सटीकता कम है। हम नीचे दिए गए क्षेत्र की पुष्टि करने का सुझाव देते हैं।',
    'report.loc.whereExact': 'समस्या ठीक कहाँ पर है?',
    'report.loc.adjustHint': 'यदि समस्या आपके खड़े होने के स्थान से थोड़ी दूर है, तो आप स्थान समायोजित कर सकते हैं।',
    'report.loc.useDetected': 'इस स्थान का उपयोग करें',
    'report.loc.changeLocation': 'स्थान बदलें / खोजें',
    'report.loc.confirmedTag': 'स्थान की पुष्टि हो गई',
    'report.loc.sourceGps': 'जीपीएस से प्राप्त',
    'report.loc.sourceManual': 'स्वयं चुना गया',
    'report.loc.coords': 'समस्या निर्देशांक:',
    'report.loc.searchTitle': 'स्थान खोजें',
    'report.loc.searchPlaceholder': 'क्षेत्र, लैंडमार्क या पता खोजें (जैसे सिटी सेंटर, फूल बाग...)',
    'report.loc.selectOnMap': 'मानचित्र पर चुनें या लैंडमार्क पर टैप करें:',
    'report.loc.useGps': 'वर्तमान जीपीएस स्थान का उपयोग करें',

    // Step 5: Review
    'report.review.title': 'शिकायत की समीक्षा करें',
    'report.review.subtitle': 'जमा करने से पहले सुनिश्चित करें कि सभी विवरण सही हैं।',
    'report.review.photos': 'फ़ोटो',
    'report.review.description': 'विवरण',
    'report.review.identity': 'नागरिक पहचान',
    'report.review.location': 'स्थान',
    'report.review.noDesc': 'कोई विवरण नहीं दिया गया।',
    'report.review.verifiedVia': '✓ {target} द्वारा सत्यापित',
    'report.review.routingPromise': 'जन-सेवा मार्ग: हमारा सिस्टम इस समस्या को स्वचालित रूप से वर्गीकृत करेगा और जिम्मेदार नगर निगम विभाग को सौंपेगा।',

    // Success Screen
    'success.title': 'शिकायत दर्ज हो गई',
    'success.joinedTitle': 'पुष्टि जोड़ी गई',
    'success.subtitleSingle': '{city} को स्वच्छ और सुरक्षित बनाने में सहयोग के लिए धन्यवाद।',
    'success.subtitleJoined': 'अन्य नागरिकों ने भी यह समस्या दर्ज की थी, अतः इसे एक कार्य के रूप में किया जा रहा है। आपका अपना टिकट और सत्यापन का पूरा अधिकार सुरक्षित है।',
    'success.ticket': 'शिकायत टिकट',
    'success.copy': 'आईडी कॉपी करें',
    'success.copied': 'टिकट आईडी कॉपी हो गई।',
    'success.filedOn': 'दर्ज करने की तिथि',
    'success.location': 'स्थान',
    'success.classifiedIssue': 'वर्गीकृत समस्या',
    'success.department': 'संबंधित विभाग',
    'success.note': 'इस टिकट आईडी को सुरक्षित रखें। प्रगति जानने और विभागीय संपर्क के लिए इसकी आवश्यकता होगी।',
    'success.guaranteeTitle': 'आपकी सहमति के बिना इसे बंद नहीं किया जा सकता।',
    'success.guaranteeDesc': 'विभाग मरम्मत की रिपोर्ट दे सकता है, लेकिन केवल आप इसे स्वीकार कर सकते हैं। मरम्मत की लाइव फ़ोटो इसी स्थान से ली जानी अनिवार्य है। हम 30 दिनों बाद दोबारा पूछेंगे कि क्या यह अब भी ठीक है।',
    'success.track': 'शिकायत ट्रैक करें',
    'success.home': 'होम पर जाएं',
    'success.notSavedTitle': 'शिकायत सुरक्षित नहीं हुई',
    'success.notSavedSubtitle': 'शिकायत इस डिवाइस पर सुरक्षित नहीं हो सकी। कृपया वापस जाकर पुनः जमा करें — आपका विवरण सुरक्षित है।',

    // Track Complaint
    'track.title': 'अपनी शिकायत ट्रैक करें',
    'track.subtitle': 'वर्तमान स्थिति देखने के लिए अपनी शिकायत आईडी दर्ज करें।',
    'track.idLabel': 'शिकायत आईडी',
    'track.idHint': 'यह आपकी रसीद या पुष्टिकरण संदेश में उपलब्ध होगी।',
    'track.btn': 'शिकायत ट्रैक करें',
    'track.forgot': 'शिकायत आईडी भूल गए?',
    'track.signedInAs': '{name} के रूप में लॉग इन',
    'track.findMine': 'मेरी शिकायतें खोजें',
    'track.ticketHeading': 'टिकट {id}',
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
