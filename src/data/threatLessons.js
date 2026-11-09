import publicParkMapImg from '@/assets/maps/public-park.png'
import phishingHomeEmailImg from '@/assets/threat-lessons/phishing-home-email.webp'
import smishingHomeGcashImg from '@/assets/threat-lessons/smishing-home-gcash.webp'
import vishingOfficeCallImg from '@/assets/threat-lessons/vishing-office-call.webp'
import socialEngineeringOfficeHelpdeskImg from '@/assets/threat-lessons/social-engineering-office-helpdesk.webp'
import credentialTheftCafeHelpdeskImg from '@/assets/threat-lessons/credential-theft-cafe-helpdesk.webp'
import malwareParkModZipImg from '@/assets/threat-lessons/malware-park-mod-zip.webp'

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
        'Do not click the verification button or type your password on the linked page. Check account activity by opening a new browser tab and signing in directly on the official service website.',
      whatToDo:
        'In the game, select Block / Report. In real life, never follow login links inside unexpected security alerts; open a new browser tab and visit the official website or app directly to check your account status.',
      whyItMatters:
        'Lookalike domains and third-party verification pages exist to capture your username, password, and verification codes the moment you submit the form.',
    },
    preventionTips: [
      'Check the exact domain after the @ symbol and in the link preview bar before trusting a security alert.',
      'Watch for hyphenated brand names such as security-google.com or unrelated domains such as account-verification-service.net.',
      'Review recent sign-in activity directly inside your official account settings rather than through email buttons.',
    ],
    keyTakeaway:
      'Always verify the sender domain and actual link destination before acting on an urgent account alert.',
  },
  {
    slug: 'smishing',
    threatName: 'Smishing',
    code: '02',
    mapName: 'Home',
    summary:
      'Smishing (SMS phishing) uses text messages that claim your wallet, bank, or delivery account is restricted so you will tap a fraudulent verification link on your phone.',
    gameScenario: {
      setting: 'Home — Fake GCash account-blocked text message',
      description:
        'While checking the phone in the Home map, you receive a text message labeled GCash (0917-123-4567). It claims your account was temporarily blocked due to unusual login attempts and tells you to re-verify within 24 hours at an external web link to avoid permanent deactivation.',
      warningSigns: [
        'Regular mobile number: the alert arrives from a standard 11-digit number (0917-123-4567) while pretending to be an official wallet notice.',
        'External verification domain: the message and link bar direct you to https://gcash-verification-portal.net.',
        '24-hour permanent deactivation threat intended to make you tap the link instead of checking the official app.',
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
        'Do not tap links inside SMS account alerts. Close the text message and open the official GCash or banking app from your home screen to check your real account status.',
      whatToDo:
        'In the game, select Block / Report. In real life, never open account-verification links sent by SMS; check notifications inside the official mobile app instead.',
      whyItMatters:
        'HTTPS only means the connection to that domain is encrypted—it does not mean the domain belongs to GCash. Entering your MPIN or one-time password on a fake portal hands full wallet access to the attacker.',
    },
    preventionTips: [
      'Treat any SMS that includes a web link for wallet or bank re-verification as fraudulent.',
      'Remember that a padlock or https:// on a domain like gcash-verification-portal.net does not prove the site is legitimate.',
      'Never enter your MPIN, password, or six-digit OTP on a web page reached from a text message.',
    ],
    keyTakeaway:
      'Legitimate wallet and banking services do not ask you to unlock your account through a text-message link.',
  },
  {
    slug: 'vishing',
    threatName: 'Vishing',
    code: '03',
    mapName: 'Office',
    summary:
      'Vishing (voice phishing) uses live or recorded phone calls where an impostor claims to be from IT security, a bank, or a courier to pressure you into approving a sign-in or reading out a code.',
    gameScenario: {
      setting: 'Office — Impostor IT security phone call requesting sign-in approval',
      description:
        'In the Office map, an incoming call from UNKNOWN (Hidden number) claims to be from Reyes Logistics IT. The caller says someone tried to sign in to your account from abroad, claims to be resetting your account right now, and asks you to tap Approve on a sign-in prompt appearing on your phone.',
      warningSigns: [
        'Unverified caller identity: the caller ID shows UNKNOWN and Hidden number while claiming to be Reyes Logistics IT.',
        'Unsolicited MFA approval request: the "They ask for" panel highlights "Tap Approve on a sign-in prompt you did not start."',
        'False urgency: the caller uses a foreign sign-in story so you will approve the prompt before realizing the caller triggered that sign-in attempt.',
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
        'Deny any sign-in notification you did not initiate yourself, hang up immediately, and contact your IT service desk through an internal directory number to report the attempt.',
      whatToDo:
        'In the game, select Hang up / Report. In real life, never approve a multi-factor authentication prompt triggered during an incoming phone call; deny the prompt, hang up, and change your password if prompts continue.',
      whyItMatters:
        'When an attacker already has your password, they trigger a sign-in and call you so you will tap Approve on your phone—granting them immediate access to your work account.',
    },
    preventionTips: [
      'Only approve a sign-in prompt when you personally just signed in on your own device.',
      'Do not trust spoken claims of identity or caller ID labels on unexpected support calls.',
      'Verify urgent IT requests by hanging up and calling back on a known internal number.',
    ],
    keyTakeaway:
      'Never approve a sign-in prompt or share a verification code because a caller tells you they are fixing your account.',
  },
  {
    slug: 'social-engineering',
    threatName: 'Social Engineering',
    code: '04',
    mapName: 'Office',
    summary:
      'Social engineering manipulates trust, authority, or helpfulness under a believable pretext—such as a routine IT upgrade—so you willingly hand over access or sensitive information.',
    gameScenario: {
      setting: 'Office — IT Helpdesk laptop upgrade pretext requesting credentials',
      description:
        'In the Office map, an email from IT Helpdesk (<helpdesk@reyeslogistics.ph>) with the subject "Laptop security upgrade tonight: action needed" tells Juan that all laptops are being upgraded tonight and asks him to reply with his username and current password before 6 PM so his profile and files can be backed up.',
      warningSigns: [
        'Direct request for your current password: the message asks you to reply with your username and current password in plain text.',
        'Authority and helpfulness pretext: the sender poses as internal IT Helpdesk performing a routine laptop security upgrade and profile backup.',
        'End-of-day deadline ("before 6 PM" / "avoid losing your files") designed to make you comply without checking IT policy.',
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
        'Select Block / Report to reject the credential request.',
      realWorldAction:
        'Never send your password, PIN, or verification code by email or chat—even to someone claiming to be internal IT support. Confirm maintenance announcements through official internal channels.',
      whatToDo:
        'In the game, select Block / Report. In real life, refuse any request for your password or PIN and report the message to your security or helpdesk team.',
      whyItMatters:
        'Real IT administrators have management tools to deploy updates and backups without ever knowing or asking for a user’s password.',
    },
    preventionTips: [
      'Remember that legitimate IT staff will never ask for your password, PIN, or MFA code to run updates or back up files.',
      'Evaluate what a message is asking you to hand over, even if the sender address or internal branding looks familiar.',
      'Confirm unusual maintenance requests with your supervisor or IT team on a separate, verified channel.',
    ],
    keyTakeaway:
      'No legitimate IT upgrade or backup requires you to reply with your password.',
  },
  {
    slug: 'credential-theft',
    threatName: 'Credential Theft',
    code: '05',
    mapName: 'Internet Cafe',
    summary:
      'Credential theft targets your login username and password using fake expiration warnings, spoofed webmail portals, or shared-terminal traps so an attacker can take over your accounts.',
    gameScenario: {
      setting: 'Internet Cafe — Fake School IT Helpdesk mailbox-full password prompt',
      description:
        'At the Internet Cafe map, an inbox message from School IT Helpdesk (<it.helpdesk.support@gmail.com>) warns "ATTENTION: Mailbox 98% FULL, password expires TODAY" and threatens that your account will be deleted and your emails lost unless you click KEEP MY ACCOUNT and enter your current password at http://school-mail-upgrade.work/webmail.',
      warningSigns: [
        'Free webmail sender address: a message claiming to come from School IT Helpdesk is sent from <it.helpdesk.support@gmail.com> instead of an official school domain.',
        'External credential-harvesting URL: the KEEP MY ACCOUNT button leads to http://school-mail-upgrade.work/webmail over unencrypted HTTP.',
        'Combined quota and deletion scare ("Mailbox 98% FULL, password expires TODAY") pressuring you to enter your current password immediately.',
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
        'Do not enter your school or work password on an external link. Manage your password only through your institution’s official portal, and avoid signing into primary accounts on shared cafe computers.',
      whatToDo:
        'In the game, select Block / Report. In real life, never type your password into a page linked from a mailbox-full warning, and always sign out and clear sessions when using shared computers.',
      whyItMatters:
        'Entering your current password on a harvesting page gives attackers direct access to your school email, linked cloud storage, and password-reset messages for other services.',
    },
    preventionTips: [
      'Check whether an institutional notice actually comes from your school’s official domain rather than a free @gmail.com or @yahoo.com address.',
      'Inspect the full domain before entering credentials—domains ending in .work, .top, or .xyz are not school webmail portals.',
      'Use unique passphrases for every account and enable multi-factor authentication so a stolen password alone cannot unlock your account.',
    ],
    keyTakeaway:
      'Schools and organizations do not use free Gmail addresses or external HTTP links to collect your current password.',
  },
  {
    slug: 'public-wi-fi-attack',
    threatName: 'Public Wi-Fi Attack',
    code: '06',
    mapName: 'Public Park',
    summary:
      'Public Wi-Fi attacks occur when an untrusted or lookalike hotspot in a shared space intercepts unencrypted traffic or redirects users to spoofed login portals.',
    gameScenario: {
      setting: 'Public Park — Untrusted open hotspot and network-login risks',
      description:
        'In the Public Park map, visitors connect portable devices while away from home or office networks. Connecting to an open or lookalike park hotspot without verifying the network allows an attacker on the same wireless connection to observe unencrypted HTTP traffic or present fake captive-portal login screens.',
      warningSigns: [
        'Open wireless networks that require no Wi-Fi password or use generic names like Free_Park_WiFi.',
        'Captive-portal pages that ask for your email, social media, or banking password just to get internet access.',
        'Browser certificate warnings or sites unexpectedly dropping from https:// to http:// while on a public hotspot.',
      ],
      suspiciousExamples: [
        'Free_Park_WiFi_NoPassword',
        'http://park-wifi-login.local/verify-account',
      ],
    },
    screenshot: {
      image: publicParkMapImg,
      kind: 'Map context',
      mapLabel: 'Public Park map (Map context)',
      clue: 'Map context showing the Public Park setting; this overview illustrates the location rather than a live Wi-Fi attack screen',
      alt: 'Map context overview of the Public Park environment with benches, pathways, and a fountain where players encounter mobile and public network scenarios.',
      caption:
        'Public Park map (Map context) — Environment overview for the Public Park stage. Shown as map context rather than a specific network-interception screenshot.',
      sourcePdf: null,
      sourcePage: null,
    },
    recommendedAction: {
      inGameAction:
        'Inspect sender domains, HTTPS indicators, and login requests carefully during Public Park encounters, and select Block / Report on spoofed prompts.',
      realWorldAction:
        'Avoid logging into banking, wallet, or school accounts over open public Wi-Fi; switch to mobile data or a trusted VPN, and disconnect immediately if a hotspot shows a certificate warning.',
      whatToDo:
        'In the game, verify URLs and reject suspicious login prompts in the Public Park stage. In real life, use mobile data or a trusted VPN for sensitive accounts and turn off automatic Wi-Fi joining.',
      whyItMatters:
        'Anyone running a rogue hotspot can inspect unencrypted traffic and redirect domains to fake login pages.',
    },
    preventionTips: [
      'Disable automatic connection to open Wi-Fi networks in your phone and laptop settings.',
      'Use your mobile data connection instead of public Wi-Fi when checking financial or work accounts.',
      'Never enter social media or email passwords into a public Wi-Fi splash page.',
    ],
    keyTakeaway:
      'Treat open public Wi-Fi networks as untrusted and keep sensitive sign-ins on mobile data or a trusted encrypted connection.',
  },
  {
    slug: 'malware-infection',
    threatName: 'Malware Infection',
    code: '07',
    mapName: 'Public Park',
    summary:
      'Malware often spreads through unofficial downloads—such as "unlocked" game mods, cracked software, or unexpected attachments—shared in group chats and third-party file hosts.',
    gameScenario: {
      setting: 'Public Park — Untrusted game-mod ZIP download from a gaming group chat',
      description:
        'In the Public Park map, the Downloads window shows SuperRacer_Mod_Unlocked.zip (212 MB, Publisher: Unknown) downloaded from https://modshare-ph.net/dl/superracer. The "What happened" note explains that a friend shared the link in a gaming group chat claiming it unlocks every car in the game for free. While the screenshot shows a download prompt rather than an active infection, keeping and opening an unverified archive from a third-party mod site risks running hidden malware.',
      warningSigns: [
        'Unofficial third-party download host: the file comes from https://modshare-ph.net/dl/superracer rather than an official game store.',
        'Unverified archive and publisher: SuperRacer_Mod_Unlocked.zip (212 MB) lists "Publisher: Unknown".',
        '"Too good to be true" lure: a chat link promising to unlock every paid car for free is a common way to bundle trojans or password-stealing scripts inside a ZIP file.',
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
        'Public Park map — Inspect the third-party download URL (https://modshare-ph.net/dl/superracer), the archive name (SuperRacer_Mod_Unlocked.zip), and the "Publisher: Unknown" label before deciding between Delete file and Keep and open.',
      sourcePdf: 'Public-Park-Scenario-Gameplay.pdf',
      sourcePage: 19,
    },
    recommendedAction: {
      inGameAction:
        'Select Delete file instead of Keep and open.',
      realWorldAction:
        'Delete unverified mod archives or installers downloaded from chat links, and only install games, updates, or add-ons from verified official stores.',
      whatToDo:
        'In the game, select Delete file. In real life, do not extract or run "unlocked" mods or cracked archives even when shared by a friend in a group chat, as their account may be compromised or they may not know what is inside the ZIP.',
      whyItMatters:
        'A screenshot of a ZIP file does not by itself prove malware is running, but opening executable files or scripts packed inside untrusted game mods is one of the most common ways spyware and info-stealers infect personal devices.',
    },
    preventionTips: [
      'Download games, apps, and updates only from official stores and verified publishers.',
      'Be skeptical of "unlocked" mods, cheat tools, or free-currency archives shared in gaming group chats.',
      'Keep your operating system and built-in security scanner active so suspicious archives are flagged before execution.',
    ],
    keyTakeaway:
      'Delete untrusted mod archives and unknown downloads before opening them—even when the link was shared in a friend’s group chat.',
  },
  {
    slug: 'ransomware',
    threatName: 'Ransomware',
    code: '08',
    mapName: 'Public Park',
    summary:
      'Ransomware is malicious software that locks or encrypts your files and demands payment for a decryption key, often arriving through macro-enabled attachments or untrusted downloads.',
    gameScenario: {
      setting: 'Public Park — High-risk attachments and file-encryption threats',
      description:
        'As you progress through advanced scenarios in the Public Park stage, you encounter suspicious file downloads and password-protected macro spreadsheets (such as fake payroll `.xlsm` files). Allowing untrusted attachments or archives to run is how ransomware gains the access needed to encrypt personal and shared documents.',
      warningSigns: [
        'Unexpected attachments using macro-enabled or executable formats (such as .xlsm, .zip, or .exe) accompanied by a password in the email body.',
        'Programs that suddenly rename files with unfamiliar extensions or display a ransom note demanding payment.',
        'Urgent instructions to enable macros or bypass security warnings to view a document.',
      ],
      suspiciousExamples: [
        'November_Payroll_2024.xlsm (Password to open: company2024)',
        'YOUR_FILES_ARE_ENCRYPTED.txt',
      ],
    },
    screenshot: {
      image: publicParkMapImg,
      kind: 'Map context',
      mapLabel: 'Public Park map (Map context)',
      clue: 'Map context showing the Public Park setting; this overview illustrates the location rather than a confirmed ransomware screen',
      alt: 'Map context overview of the Public Park environment where players complete advanced threat-detection scenarios.',
      caption:
        'Public Park map (Map context) — Environment overview for the Public Park stage. Shown as map context rather than a confirmed ransomware lock screen.',
      sourcePdf: null,
      sourcePage: null,
    },
    recommendedAction: {
      inGameAction:
        'Select Block / Report or Delete file when confronted with suspicious macro spreadsheets or unverified downloads.',
      realWorldAction:
        'Never open unexpected macro-enabled attachments. If ransomware ever strikes a device, disconnect it from Wi-Fi and wired networks immediately, do not pay the ransom, and restore files from a clean offline backup.',
      whatToDo:
        'In the game, block or delete suspicious attachments and downloads before they can run. In real life, isolate an affected device from the network right away, report the incident, and recover data from offline backups.',
      whyItMatters:
        'Stopping a malicious attachment or download before execution prevents encryption altogether, and isolating an infected device stops ransomware from spreading to shared folders.',
    },
    preventionTips: [
      'Maintain regular backups on an external drive or cloud version history that stays disconnected during normal use.',
      'Never enable macros in documents received from unverified or unexpected emails.',
      'Keep your operating system and software patched so ransomware cannot exploit known vulnerabilities.',
    ],
    keyTakeaway:
      'Reject suspicious attachments before they run, and keep offline backups so you never have to rely on an attacker to recover your files.',
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
