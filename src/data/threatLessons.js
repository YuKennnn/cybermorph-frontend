import phishingHomeEmailImg from '@/assets/threat-lessons/phishing-home-email.webp'
import smishingHomeGcashImg from '@/assets/threat-lessons/smishing-home-gcash.webp'
import vishingOfficeCallImg from '@/assets/threat-lessons/vishing-office-call.webp'
import socialEngineeringOfficeHelpdeskImg from '@/assets/threat-lessons/social-engineering-office-helpdesk.webp'
import credentialTheftCafeHelpdeskImg from '@/assets/threat-lessons/credential-theft-cafe-helpdesk.webp'
import publicWifiParkCoworkImg from '@/assets/threat-lessons/public-wifi-park-cowork.jpg'
import malwareParkModZipImg from '@/assets/threat-lessons/malware-park-mod-zip.webp'
import ransomwareParkBackupImg from '@/assets/threat-lessons/ransomware-park-backup.jpg'

/**
 * Frontend-managed educational lesson content for the 8 canonical CyberMorph threat categories.
 *
 * Security & Architecture Contract:
 * - Threat unlock state (`is_unlocked`, `unlocked_at`) ALWAYS comes from the backend (`GET /v1/players/threat-index`).
 * - This module provides static educational copy and scenario screenshots keyed by URL slug and canonical `threat_name`.
 * - All suspicious URLs, domains, sender addresses, and file names must be rendered as inert `<code>` text, never live links.
 */
export const THREAT_LESSON_LIST = [
  {
    slug: 'phishing',
    threatName: 'Phishing',
    code: '01',
    mapName: 'Home',
    summary:
      'Phishing messages impersonate trusted services to trick you into opening a fake login page and entering your credentials. Inspecting the sender address and link destination exposes the impersonation before you click.',
    gameScenario: {
      setting: 'Home — Suspicious Google Support verification email',
      description:
        'In the Home map, an email claiming to come from Google Support warns of an unauthorized login attempt from a new device in Moscow, Russia, and gives you 24 hours to verify your account before deactivation. Inspecting the sender header and the Verify Identity Now button reveals a lookalike sender domain and an unrelated login address.',
      warningSigns: [
        'Lookalike sender domain: the header shows security@security-google.com rather than an official google.com address.',
        'Mismatched link destination: the Verify Identity Now button points to http://account-verification-service.net/login instead of Google.',
        'Unencrypted HTTP login link combined with a 24-hour deactivation deadline designed to rush your decision.',
      ],
      suspiciousExamples: [
        'security@security-google.com',
        'http://account-verification-service.net/login',
      ],
    },
    screenshot: {
      image: phishingHomeEmailImg,
      kind: 'Scenario screenshot',
      mapLabel: 'Home map',
      clue: 'Sender <security@security-google.com> and link preview http://account-verification-service.net/login',
      alt: 'Home map phishing scenario showing a fake Google Support email from security@security-google.com claiming a login from Moscow, Russia, with the Verify Identity Now button revealing http://account-verification-service.net/login above Block / Report and Accept / Safe buttons.',
      caption:
        'Home map — Inspect the sender domain (<security@security-google.com>) and the link preview bar (http://account-verification-service.net/login) beneath the Verify Identity Now button.',
      sourcePdf: 'Home-Scenarios-Gameplay.pdf',
      sourcePage: 2,
    },
    recommendedAction: {
      inGameAction:
        'Select Block / Report after checking the sender address and the link preview bar.',
      realWorldAction:
        'Do not click the verification button. Open a new browser tab and sign in on the official website directly to check your account.',
      whatToDo:
        'Select Block / Report in the game, and check account alerts by visiting the official website in a new browser tab.',
      whyItMatters:
        'Lookalike domains and fake verification pages capture your username, password, and security codes the moment you submit the form.',
    },
    preventionTips: [
      'Bookmark your email, banking, and school login pages so you do not rely on links inside messages.',
      'Use a password manager—it will not auto-fill your password on a lookalike domain.',
      'Turn on multi-factor authentication (MFA) with an authenticator app to protect your account even if a password is exposed.',
    ],
    keyTakeaway:
      'Verify the sender domain and link preview before acting on any urgent account alert.',
  },
  {
    slug: 'smishing',
    threatName: 'Smishing',
    code: '02',
    mapName: 'Home',
    summary:
      'Smishing (SMS phishing) uses text messages claiming your wallet, bank, or delivery account is restricted so you will tap a fake verification link on your phone.',
    gameScenario: {
      setting: 'Home — Fake GCash account-blocked text message',
      description:
        'While checking the phone in the Home map, you receive a text message labeled GCash (0917-123-4567). It claims your account was temporarily blocked due to unusual login attempts and tells you to re-verify within 24 hours at an external web link to avoid permanent deactivation.',
      warningSigns: [
        'Regular mobile number: the alert arrives from a standard 11-digit number (0917-123-4567) instead of an official sender.',
        'External verification domain: the message and link bar direct you to https://gcash-verification-portal.net.',
        '24-hour deactivation threat meant to rush you into tapping the link instead of checking the official app.',
      ],
      suspiciousExamples: [
        '0917-123-4567',
        'https://gcash-verification-portal.net',
      ],
    },
    screenshot: {
      image: smishingHomeGcashImg,
      kind: 'Scenario screenshot',
      mapLabel: 'Home map',
      clue: 'Sender header GCash (0917-123-4567) and link https://gcash-verification-portal.net',
      alt: 'Home map smishing scenario showing a phone text message from GCash (0917-123-4567) claiming the account is temporarily blocked and linking to https://gcash-verification-portal.net, with Block / Report and Accept / Safe decision buttons.',
      caption:
        'Home map — Inspect the mobile number in the sender header (0917-123-4567) and the external link destination (https://gcash-verification-portal.net).',
      sourcePdf: 'Home-Scenarios-Gameplay.pdf',
      sourcePage: 3,
    },
    recommendedAction: {
      inGameAction:
        'Select Block / Report instead of accepting the text message.',
      realWorldAction:
        'Do not tap links inside SMS account alerts. Close the message and open the official GCash or banking app from your home screen.',
      whatToDo:
        'Select Block / Report in the game, and check account alerts inside the official mobile app rather than through SMS links.',
      whyItMatters:
        'HTTPS only means the connection is encrypted—it does not mean the site belongs to GCash. Typing your MPIN or one-time code on a fake site gives attackers full wallet access.',
    },
    preventionTips: [
      'Never enter your MPIN, password, or six-digit OTP on a web page opened from a text message.',
      'Block and report spam numbers in your phone’s messaging app.',
      'Check wallet or bank notices only inside the official app from your device home screen.',
    ],
    keyTakeaway:
      'Wallet and banking services do not ask you to unlock your account through a text-message link.',
  },
  {
    slug: 'vishing',
    threatName: 'Vishing',
    code: '03',
    mapName: 'Office',
    summary:
      'Vishing (voice phishing) uses phone calls where an impostor claims to be from IT security, a bank, or a courier to pressure you into approving a sign-in or reading out a code.',
    gameScenario: {
      setting: 'Office — Impostor IT security phone call requesting sign-in approval',
      description:
        'In the Office map, an incoming call from UNKNOWN (Hidden number) claims to be from Reyes Logistics IT. The caller says someone tried to sign in to your account from abroad, claims to be resetting your account right now, and asks you to tap Approve on a sign-in prompt appearing on your phone.',
      warningSigns: [
        'Unverified caller identity: the caller ID shows UNKNOWN and Hidden number while claiming to be Reyes Logistics IT.',
        'Unexpected sign-in approval request: the "They ask for" panel highlights "Tap Approve on a sign-in prompt you did not start."',
        'False urgency: the caller uses a foreign sign-in story so you approve the prompt before realizing the caller triggered it.',
      ],
      suspiciousExamples: [
        'UNKNOWN (Hidden number) — SAYS THEY ARE FROM Reyes Logistics IT',
        'Tap Approve on a sign-in prompt you did not start',
      ],
    },
    screenshot: {
      image: vishingOfficeCallImg,
      kind: 'Scenario screenshot',
      mapLabel: 'Office map',
      clue: 'Caller ID UNKNOWN / Hidden number and the prompt "Tap Approve on a sign-in prompt you did not start"',
      alt: 'Office map vishing scenario showing a call from UNKNOWN Hidden number claiming to be Reyes Logistics IT, asking Juan to tap Approve on a sign-in prompt he did not start, with Hang up / Report and Stay on call buttons.',
      caption:
        'Office map — Inspect the UNKNOWN (Hidden number) caller header and the "They ask for" clue warning that the caller wants you to approve a sign-in prompt you did not start.',
      sourcePdf: 'Office-Scenario-Gameplay.pdf',
      sourcePage: 10,
    },
    recommendedAction: {
      inGameAction:
        'Select Hang up / Report to end the call and reject the request.',
      realWorldAction:
        'Deny any sign-in notification you did not start, hang up, and call your IT desk back using an official internal directory number.',
      whatToDo:
        'Select Hang up / Report in the game, and deny any sign-in prompt you did not start yourself.',
      whyItMatters:
        'When an attacker already has your password, they trigger a sign-in and call you so you will tap Approve—giving them immediate access to your account.',
    },
    preventionTips: [
      'Only approve a sign-in prompt when you personally just signed in on your own device.',
      'Change your password right away if you receive unexpected sign-in approval prompts.',
      'Never read out one-time verification codes to anyone over the phone.',
    ],
    keyTakeaway:
      'Never approve a sign-in prompt or share a code because a caller says they are fixing your account.',
  },
  {
    slug: 'social-engineering',
    threatName: 'Social Engineering',
    code: '04',
    mapName: 'Office',
    summary:
      'Social engineering uses authority, urgency, or a helpful excuse—such as a routine IT upgrade—so you willingly hand over passwords or sensitive information.',
    gameScenario: {
      setting: 'Office — IT Helpdesk laptop upgrade pretext requesting credentials',
      description:
        'In the Office map, an email from IT Helpdesk (<helpdesk@reyeslogistics.ph>) with the subject "Laptop security upgrade tonight: action needed" tells Juan that all laptops are being upgraded tonight and asks him to reply with his username and current password before 6 PM so his profile and files can be backed up.',
      warningSigns: [
        'Direct request for your password: the message asks you to reply with your username and current password in plain text.',
        'Routine maintenance excuse: the sender poses as internal IT Helpdesk performing an overnight laptop upgrade and backup.',
        'End-of-day deadline ("before 6 PM" / "avoid losing your files") designed to make you reply without checking IT policy.',
      ],
      suspiciousExamples: [
        'Laptop security upgrade tonight: action needed',
        'reply with your username and current password so we can back up your profile before 6 PM',
      ],
    },
    screenshot: {
      image: socialEngineeringOfficeHelpdeskImg,
      kind: 'Scenario screenshot',
      mapLabel: 'Office map',
      clue: 'Message body asking Juan to "reply with your username and current password" before 6 PM',
      alt: 'Office map social engineering scenario showing an email from IT Helpdesk claiming a laptop security upgrade tonight and asking Juan to reply with his username and current password before 6 PM, with Block / Report and Accept / Safe buttons.',
      caption:
        'Office map — Inspect the request inside the email body asking you to reply with your username and current password under a 6 PM laptop backup pretext.',
      sourcePdf: 'Office-Scenario-Gameplay.pdf',
      sourcePage: 7,
    },
    recommendedAction: {
      inGameAction:
        'Select Block / Report to reject the password request.',
      realWorldAction:
        'Never send your password, PIN, or verification code by email or chat. Confirm unusual maintenance notices with IT on a separate official channel.',
      whatToDo:
        'Select Block / Report in the game, and refuse any email or chat request asking for your password.',
      whyItMatters:
        'Real IT administrators use management tools to run updates and backups without ever needing or asking for your password.',
    },
    preventionTips: [
      'Focus on what a message asks you to hand over, even when the sender name looks internal.',
      'Pause when a message uses a tight deadline or fear of losing files to rush you.',
      'Report internal-looking password requests so IT can check for compromised colleague accounts.',
    ],
    keyTakeaway:
      'No legitimate IT upgrade or backup ever requires you to reply with your password.',
  },
  {
    slug: 'credential-theft',
    threatName: 'Credential Theft',
    code: '05',
    mapName: 'Internet Cafe',
    summary:
      'Credential theft targets your username and password using fake expiration warnings, spoofed webmail pages, or shared-computer traps to take over your accounts.',
    gameScenario: {
      setting: 'Internet Cafe — Fake School IT Helpdesk mailbox-full password prompt',
      description:
        'At the Internet Cafe map, an inbox message from School IT Helpdesk (<it.helpdesk.support@gmail.com>) warns "ATTENTION: Mailbox 98% FULL, password expires TODAY" and threatens that your account will be deleted unless you click KEEP MY ACCOUNT and enter your current password at http://school-mail-upgrade.work/webmail.',
      warningSigns: [
        'Free webmail sender address: a notice claiming to come from School IT Helpdesk is sent from <it.helpdesk.support@gmail.com> instead of an official school domain.',
        'Unencrypted external URL: the KEEP MY ACCOUNT button leads to http://school-mail-upgrade.work/webmail.',
        'Deletion scare ("Mailbox 98% FULL, password expires TODAY") pressuring you to type your current password right away.',
      ],
      suspiciousExamples: [
        'it.helpdesk.support@gmail.com',
        'http://school-mail-upgrade.work/webmail',
      ],
    },
    screenshot: {
      image: credentialTheftCafeHelpdeskImg,
      kind: 'Scenario screenshot',
      mapLabel: 'Internet Cafe map',
      clue: 'Sender <it.helpdesk.support@gmail.com> and link preview http://school-mail-upgrade.work/webmail',
      alt: 'Internet Cafe map credential theft scenario showing an email from School IT Helpdesk at it.helpdesk.support@gmail.com claiming the mailbox is 98% full and password expires today, with the KEEP MY ACCOUNT button pointing to http://school-mail-upgrade.work/webmail.',
      caption:
        'Internet Cafe map — Inspect the public Gmail sender (<it.helpdesk.support@gmail.com>) and the unencrypted external link (http://school-mail-upgrade.work/webmail) below KEEP MY ACCOUNT.',
      sourcePdf: 'Internet-Cafe-Scenarios-Gameplay.pdf',
      sourcePage: 12,
    },
    recommendedAction: {
      inGameAction:
        'Select Block / Report after spotting the Gmail sender and fake webmail URL.',
      realWorldAction:
        'Do not enter your school or work password on an external link. Change passwords only inside your school’s official portal, and sign out completely after using a shared computer.',
      whatToDo:
        'Select Block / Report in the game, and never enter school or work passwords on external links or save them on shared computers.',
      whyItMatters:
        'Entering your password on a fake webmail page gives attackers access to your school email, cloud files, and password-reset links for other accounts.',
    },
    preventionTips: [
      'Never let a shared or internet cafe browser save your passwords, and use a private browsing window when possible.',
      'Use a unique passphrase for every account so one stolen password cannot unlock your other accounts.',
      'Check that school notices come from your school’s official domain rather than @gmail.com or .work domains.',
    ],
    keyTakeaway:
      'Schools and organizations do not use free Gmail addresses or external HTTP links to collect your password.',
  },
  {
    slug: 'public-wi-fi-attack',
    threatName: 'Public Wi-Fi Attack',
    code: '06',
    mapName: 'Public Park',
    summary:
      'Public Wi-Fi attacks target unencrypted or rogue hotspots in shared spaces—such as open guest networks with no password—to intercept network traffic, harvest credentials, or redirect users to malicious pages.',
    gameScenario: {
      setting: 'Public Park — Available networks in a coworking space',
      description:
        'In the Public Park map (Sector 04), you need to connect to the internet in a shared coworking space. The Available Networks prompt asks "Members log in with their member account. Which network is yours?" and displays three choices: Cowork_Members_Guest (Open: no password), Cowork_Members (WPA2-Enterprise: asks for your member account), and Cowork-Visitors (WPA2: a shared password on the wall).',
      warningSigns: [
        'Unencrypted open network: Cowork_Members_Guest requires no password, leaving communications unencrypted and exposed to rogue hotspot interception.',
        'Mismatched security level: the prompt specifies members must log in with their member account, which requires the WPA2-Enterprise network rather than an open guest network.',
        'Deceptive lookalike network names: rogue hotspots often copy legitimate venue names (such as adding "_Guest" or "_Free") to trick users into connecting without encryption.',
      ],
      suspiciousExamples: [
        'Cowork_Members_Guest (Open: no password)',
        'Open Wi-Fi with no encryption',
      ],
    },
    screenshot: {
      image: publicWifiParkCoworkImg,
      kind: 'Scenario screenshot',
      mapLabel: 'Public Park map',
      clue: 'Open network Cowork_Members_Guest ("Open: no password") vs authenticated Cowork_Members ("WPA2-Enterprise: asks for your member account")',
      alt: 'Public Park gameplay scenario showing available Wi-Fi networks in a coworking space: an open Cowork_Members_Guest network, an authenticated Cowork_Members enterprise network, and a Cowork-Visitors network with a Continue button.',
      caption:
        'Public Park (Sector 04) — Inspect the Available Networks list: compare the unencrypted open network (Cowork_Members_Guest) with the official authenticated enterprise network (Cowork_Members).',
      sourcePdf: 'CyberMorph Gameplay — Public Park (Sector 04)',
      sourcePage: null,
    },
    recommendedAction: {
      inGameAction:
        'Select Cowork_Members (WPA2-Enterprise: asks for your member account) and click Continue instead of joining the unencrypted open guest network.',
      realWorldAction:
        'Avoid joining open, unencrypted Wi-Fi in public spaces. Use official enterprise or password-protected networks, and switch to mobile data or a trusted VPN if you must handle sensitive data.',
      whatToDo:
        'Select the authenticated WPA2-Enterprise network in the game, and avoid unencrypted open hotspots in real life by using mobile data or a trusted VPN.',
      whyItMatters:
        'Open Wi-Fi transmits data without encryption, allowing attackers on the same network to intercept unencrypted traffic, spoof DNS, or push fake login prompts.',
    },
    preventionTips: [
      'Turn off automatic connection to open Wi-Fi networks in your phone and computer settings.',
      'Verify the official network name and security requirements with venue staff before connecting.',
      'Use mobile data or a trusted VPN whenever you connect in public places or transit hubs.',
    ],
    keyTakeaway:
      'Never connect to open, password-free networks in shared spaces when an authenticated network or mobile data is available.',
  },
  {
    slug: 'malware-infection',
    threatName: 'Malware Infection',
    code: '07',
    mapName: 'Public Park',
    summary:
      'Malware often spreads through unofficial downloads—such as "unlocked" game mods, cracked installers, or unknown archives—shared in group chats and third-party file hosts.',
    gameScenario: {
      setting: 'Public Park — Untrusted game-mod ZIP download from a gaming group chat',
      description:
        'In the Public Park map, the Downloads window shows SuperRacer_Mod_Unlocked.zip (212 MB, Publisher: Unknown) downloaded from https://modshare-ph.net/dl/superracer. The "What happened" note explains that a friend shared the link in a gaming group chat claiming it unlocks every car in the game for free.',
      warningSigns: [
        'Unofficial download host: the file comes from https://modshare-ph.net/dl/superracer rather than an official game store.',
        'Unknown publisher: SuperRacer_Mod_Unlocked.zip (212 MB) lists "Publisher: Unknown".',
        '"Too good to be true" lure: a chat link promising to unlock paid items for free often hides spyware or password-stealing scripts inside a ZIP file.',
      ],
      suspiciousExamples: [
        'https://modshare-ph.net/dl/superracer',
        'SuperRacer_Mod_Unlocked.zip (Publisher: Unknown)',
      ],
    },
    screenshot: {
      image: malwareParkModZipImg,
      kind: 'Scenario screenshot',
      mapLabel: 'Public Park map',
      clue: 'URL https://modshare-ph.net/dl/superracer, file SuperRacer_Mod_Unlocked.zip, and "Publisher: Unknown"',
      alt: 'Public Park map malware risk scenario showing a Downloads window for SuperRacer_Mod_Unlocked.zip (212 MB, Publisher: Unknown) from https://modshare-ph.net/dl/superracer shared in a gaming group chat, with Delete file and Keep and open buttons.',
      caption:
        'Public Park map — Inspect the download URL (https://modshare-ph.net/dl/superracer), the archive name (SuperRacer_Mod_Unlocked.zip), and "Publisher: Unknown" before choosing Delete file.',
      sourcePdf: 'Public-Park-Scenario-Gameplay.pdf',
      sourcePage: 19,
    },
    recommendedAction: {
      inGameAction:
        'Select Delete file instead of Keep and open.',
      realWorldAction:
        'Delete unverified mod archives or installers from chat links, and install games or add-ons only from official stores.',
      whatToDo:
        'Select Delete file in the game, and never extract or run unverified game mods from chat links.',
      whyItMatters:
        'Opening scripts or installers packed inside untrusted mod archives is a common way spyware and password stealers infect phones and computers.',
    },
    preventionTips: [
      'Keep your operating system and built-in security scanner active so suspicious downloads are blocked before they run.',
      'Do not trust a download link just because it appears in a friend’s group chat—their account may be compromised.',
      'Never turn off your antivirus or device security settings to make a game mod or cracked installer work.',
    ],
    keyTakeaway:
      'Delete untrusted mod archives and unknown downloads before opening them, even when shared in a group chat.',
  },
  {
    slug: 'ransomware',
    threatName: 'Ransomware',
    code: '08',
    mapName: 'Public Park',
    summary:
      'Ransomware locks or encrypts files and demands payment for their recovery. Keeping verified backups and safely inspecting downloads protects your system from data loss without paying ransoms.',
    gameScenario: {
      setting: 'Public Park — Verifying a project backup installer download',
      description:
        'In the Public Park map (Sector 04), your teacher asks the class to back up project files. You open the maker\'s official website (https://www.safebackup.com/download) and download SafeBackup_Setup.exe (58.4 MB). Before running the file, you inspect the prompt to confirm the verified publisher ("Publisher: SafeBackup Inc (verified)") and official HTTPS source before choosing Keep and open.',
      warningSigns: [
        'Official HTTPS download source: the installer is retrieved directly from the developer\'s official domain (https://www.safebackup.com/download) rather than an untrusted third-party host.',
        'Verified publisher signature: SafeBackup_Setup.exe carries a verified digital signature ("Publisher: SafeBackup Inc (verified)") confirming the executable has not been tampered with.',
        'Ransomware defense through backups: creating authentic backups before incidents occur is the primary safeguard to restore encrypted files without paying attackers.',
      ],
      suspiciousExamples: [
        'https://www.safebackup.com/download',
        'SafeBackup_Setup.exe (Publisher: SafeBackup Inc (verified))',
      ],
    },
    screenshot: {
      image: ransomwareParkBackupImg,
      kind: 'Scenario screenshot',
      mapLabel: 'Public Park map',
      clue: 'URL https://www.safebackup.com/download, file SafeBackup_Setup.exe, and "Publisher: SafeBackup Inc (verified)"',
      alt: 'Public Park gameplay scenario showing a Downloads window for SafeBackup_Setup.exe (58.4 MB) from https://www.safebackup.com/download with Publisher: SafeBackup Inc (verified), offering Delete file and Keep and open buttons.',
      caption:
        'Public Park (Sector 04) — Inspect the download URL (https://www.safebackup.com/download), file name (SafeBackup_Setup.exe), and verified digital signature ("Publisher: SafeBackup Inc (verified)") before choosing Keep and open.',
      sourcePdf: 'CyberMorph Gameplay — Public Park (Sector 04)',
      sourcePage: null,
    },
    recommendedAction: {
      inGameAction:
        'Select Keep and open after verifying the official HTTPS maker website and verified publisher signature.',
      realWorldAction:
        'Maintain regular offline backups of important files, verify developer signatures before opening downloaded installers, and never enable macros or run unexpected executable attachments.',
      whatToDo:
        'Select Keep and open in the game once publisher and source are verified, and keep offline backups to safeguard against ransomware in real life.',
      whyItMatters:
        'Verified backups ensure you can restore encrypted files without paying ransom demands, while checking digital signatures stops tampered installers from executing malicious ransomware payloads.',
    },
    preventionTips: [
      'Keep regular backups on an offline external drive or disconnected cloud storage so ransomware cannot reach them.',
      'Verify publisher signatures and official download domains before running any .exe installer.',
      'Never run executable files (.exe) or macro-enabled documents received from unexpected emails or group chats.',
    ],
    keyTakeaway:
      'Verified offline backups and signed software downloads protect your data against ransomware without ever paying extortion demands.',
  },
]

const LESSONS_BY_SLUG = new Map(THREAT_LESSON_LIST.map((lesson) => [lesson.slug, lesson]))
const LESSONS_BY_THREAT_NAME = new Map(
  THREAT_LESSON_LIST.map((lesson) => [lesson.threatName, lesson]),
)

/**
 * Look up a threat lesson by its URL route slug (e.g. `'phishing'`).
 *
 * @param {string} slug
 * @returns {object | null}
 */
export function getThreatLessonBySlug(slug) {
  if (typeof slug !== 'string') return null
  return LESSONS_BY_SLUG.get(slug.trim().toLowerCase()) || null
}

/**
 * Look up a threat lesson by its canonical backend `threat_name` (e.g. `'Public Wi-Fi Attack'`).
 *
 * @param {string} threatName
 * @returns {object | null}
 */
export function getThreatLessonByName(threatName) {
  if (typeof threatName !== 'string') return null
  return LESSONS_BY_THREAT_NAME.get(threatName.trim()) || null
}

/**
 * Convert a canonical backend `threat_name` into its route slug, or `null` if unknown.
 *
 * @param {string} threatName
 * @returns {string | null}
 */
export function getThreatSlugByName(threatName) {
  const lesson = getThreatLessonByName(threatName)
  return lesson ? lesson.slug : null
}
