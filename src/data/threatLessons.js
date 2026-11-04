import homeMapImg from '../assets/maps/home.png'
import officeMapImg from '../assets/maps/office.png'
import internetCafeMapImg from '../assets/maps/internet-cafe.png'
import publicParkMapImg from '../assets/maps/public-park.png'

/**
 * Educational game-based lesson content for CyberMorph's 8 canonical threat categories.
 * Grounded in game encounters across Home, Office, Internet Cafe, and Public Park maps.
 *
 * URLs and phone numbers in examples are inert code snippets for educational analysis only.
 */
export const THREAT_LESSONS = Object.freeze({
  phishing: Object.freeze({
    slug: 'phishing',
    threatName: 'Phishing',
    number: '01',
    mapName: 'Home',
    summary:
      'Deceptive email messages and fraudulent login pages designed to trick people into surrendering usernames and passwords.',
    gameScenario: {
      setting: 'Home Living Room',
      description:
        'While monitoring family members in the Home living room map, a threat alert appears above an NPC working on a desktop computer. Opening the threat card reveals an urgent email claiming their online banking account will be suspended within 24 hours unless they verify their identity through an embedded link.',
      warningSigns: [
        'Artificial urgency pressuring the recipient to act before thinking.',
        'Sender display name mimics a known bank, but the actual email address uses an unrelated domain.',
        'Generic greeting instead of personalized account information.',
        'The link address leads to an unfamiliar web domain designed to mimic the genuine login portal.',
      ],
      suspiciousExamples: [
        'Subject: Urgent Notice: Confirm your account credentials within 24 hours',
        'Sender: Security Support <support@secure-banking-alert.com>',
        'Link address: https://accounts-update.login-portal-auth.com/verify',
      ],
    },
    recommendedAction: {
      whatToDo:
        'Reject the threat card in the game. In real life, close the message without clicking any links or opening attachments, and report the message through your email provider.',
      whyItMatters:
        'Phishing sites look almost identical to genuine login screens. Entering your credentials sends your username and password directly to the attacker, giving them immediate unauthorized access.',
    },
    preventionTips: [
      'Type official website addresses directly into your browser bookmark bar rather than following links in unsolicited messages.',
      'Always inspect the sender address and domain carefully, not just the displayed friendly name.',
      'Remember that an HTTPS padlock icon indicates the connection is encrypted, but it does not guarantee that the website owner is legitimate or safe.',
      'Enable two-factor authentication on all accounts to protect your login even if a password is leaked.',
    ],
    keyTakeaway:
      'Verify unexpected account alerts directly through official websites or bookmarks before acting.',
    screenshot: Object.freeze({
      image: homeMapImg,
      alt: 'Home living room scene where family members use personal computers and mobile devices.',
      caption:
        'Home map: Players observe family members on personal workstations and intercept deceptive emails before credentials are submitted.',
    }),
  }),

  smishing: Object.freeze({
    slug: 'smishing',
    threatName: 'Smishing',
    number: '02',
    mapName: 'Home',
    summary:
      'SMS-based text message scams using fake package delivery notices or urgent account suspensions to induce clicks.',
    gameScenario: {
      setting: 'Home Living Room',
      description:
        'A mobile phone alert bubble triggers on an NPC resting on the living room sofa. Opening the card shows a text message stating that an incoming package cannot be delivered due to an incorrect address and asks the recipient to tap a tracking link immediately.',
      warningSigns: [
        'Text received from an unrecognized number or unverified alphanumeric sender ID.',
        'Vague parcel reference with no details of what was ordered or who sent it.',
        'Shortened or obscured web link that hides the true destination server.',
        'Threat of parcel return or penalty fee if action is not taken within hours.',
      ],
      suspiciousExamples: [
        'SMS: Parcel Ref #94821 is on hold due to missing unit number. Confirm details within 12 hours: https://delivery-tracking-update.info/p=94821',
      ],
    },
    recommendedAction: {
      whatToDo:
        'Block the message in the game interface. On a mobile phone, delete the message, do not open the link, and block the sender number.',
      whyItMatters:
        'Smishing links frequently download malicious mobile applications or open credential-harvesting forms formatted specifically for mobile screens.',
    },
    preventionTips: [
      'Check package statuses directly within the official delivery app or merchant website where you placed the order.',
      'Be aware that sender IDs and caller names on mobile phones can be spoofed by attackers using automated SMS gateways.',
      'Never reply to suspicious texts, even with keywords like "STOP", as this confirms your phone number is active.',
    ],
    keyTakeaway:
      'Never open links in unexpected delivery or account text messages; check original apps instead.',
    screenshot: Object.freeze({
      image: homeMapImg,
      alt: 'Home living room setting in CyberMorph where mobile device alerts are monitored.',
      caption:
        'Home map: Mobile device notifications are analyzed to prevent deceptive text message scams from compromising household devices.',
    }),
  }),

  vishing: Object.freeze({
    slug: 'vishing',
    threatName: 'Vishing',
    number: '03',
    mapName: 'Office',
    summary:
      'Voice calls where attackers impersonate bank agents, technical support personnel, or government agencies.',
    gameScenario: {
      setting: 'Workplace Office',
      description:
        'At an employee desk in the Office map, a desk phone icon rings urgently. The threat card displays a caller claiming to be an internal IT administrator demanding the employee read aloud a one-time verification passcode to resolve a critical server outage.',
      warningSigns: [
        'High-pressure tone insisting on immediate cooperation to avoid workplace disciplinary action.',
        'Request for sensitive information such as one-time passcodes, passwords, or employee ID numbers.',
        'Unscheduled call regarding an alleged emergency you were never notified about in advance.',
      ],
      suspiciousExamples: [
        'Caller audio prompt: "This is Central IT. Your workstation is transmitting abnormal packets. Provide your MFA code immediately so we can reset your session."',
      ],
    },
    recommendedAction: {
      whatToDo:
        'Reject the threat card in the game. In an office setting, decline to provide information, disconnect the call, and report the attempt to your security team.',
      whyItMatters:
        'Voice social engineering relies on conversational pressure and verbal authority to bypass logical checks that people normally perform when reading text.',
    },
    preventionTips: [
      'Remember that caller ID numbers can be easily spoofed to show your company helpdesk or bank phone number.',
      'Legitimate support departments and banks will never call and ask you to disclose your password or one-time passcode.',
      'When in doubt, hang up and call back using a known internal directory number or the phone number printed on the back of your card.',
    ],
    keyTakeaway:
      'Legitimate technical support and financial institutions will never ask for your password or verification code over the phone.',
    screenshot: Object.freeze({
      image: officeMapImg,
      alt: 'Corporate office workplace with employee desks, computer workstations, and meeting rooms.',
      caption:
        'Office map: Workstation phone and communications channels are monitored to intercept impersonation calls targeting personnel.',
    }),
  }),

  'social-engineering': Object.freeze({
    slug: 'social-engineering',
    threatName: 'Social Engineering',
    number: '04',
    mapName: 'Office',
    summary:
      'Psychological manipulation techniques that exploit urgency, trust, or authority to bypass security procedures.',
    gameScenario: {
      setting: 'Workplace Office',
      description:
        'Near the reception counter and secure glass entrance of the Office map, an unfamiliar visitor approaches an employee holding the secure door. The threat card reveals a visitor claiming to have an urgent meeting with an executive while asking the employee to bypass badge scanning.',
      warningSigns: [
        'Exploiting politeness and social discomfort to prevent people from enforcing standard door access rules.',
        'Name-dropping executive personnel or claiming urgent deadlines to bypass identity verification.',
        'Absence of an official visitor badge or escort.',
      ],
      suspiciousExamples: [
        'Visitor prompt: "I am late for a briefing with the Director. My visitor badge is still printing at reception—could you hold the door for me?"',
      ],
    },
    recommendedAction: {
      whatToDo:
        'Reject the threat card in the game. In physical workplace environments, politely direct visitors back to the reception counter for official badging.',
      whyItMatters:
        'Tailgating and physical intrusion allow unauthorized individuals into private office areas where they can plant unauthorized devices or view sensitive screen content.',
    },
    preventionTips: [
      'Do not hold secure doors open for unbadged individuals, regardless of perceived urgency.',
      'Follow workplace visitor protocols consistently, even when interacting with people who claim authority.',
      'Report unescorted individuals in restricted areas to building security promptly.',
    ],
    keyTakeaway:
      'Follow established verification procedures every time, regardless of urgency or who the person claims to be.',
    screenshot: Object.freeze({
      image: officeMapImg,
      alt: 'Office entry area with security desk, glass doors, and reception counter.',
      caption:
        'Office map: Players safeguard physical access points and prevent unauthorized individuals from bypassing badging policies.',
    }),
  }),

  'credential-theft': Object.freeze({
    slug: 'credential-theft',
    threatName: 'Credential Theft',
    number: '05',
    mapName: 'Internet Cafe',
    summary:
      'Attacks targeting login credentials, including password reuse, keylogging, and weak password choices.',
    gameScenario: {
      setting: 'Internet Cafe',
      description:
        'In the Internet Cafe map, an NPC leaves a shared terminal. The active threat card shows a web browser prompt asking to "Save password for this computer" with the previous user\'s personal email session left signed in.',
      warningSigns: [
        'Web browser offering to save credentials on a public terminal accessible to subsequent patrons.',
        'Failure to log out of private accounts before ending a shared computer session.',
        'Unfamiliar USB devices or background processes running on shared workstations.',
      ],
      suspiciousExamples: [
        'Terminal dialogue: "Save password for user@example.ph on this device? [Save] [Never]"',
        'Active session tab: "Webmail Inbox (3 Unread Messages) - Session active"',
      ],
    },
    recommendedAction: {
      whatToDo:
        'Select the defensive action to clear stored session data and decline credential caching on shared equipment.',
      whyItMatters:
        'Subsequent users on public terminals can easily reopen cached browser sessions or view saved passwords in plain text through browser settings.',
    },
    preventionTips: [
      'Never select "Remember me" or allow browsers to save passwords on computers you do not personally own.',
      'Always log out of your accounts explicitly and close the browser completely before leaving a public terminal.',
      'Use multi-factor authentication so compromised passwords alone cannot unlock your accounts.',
      'Avoid entering sensitive financial credentials on public or shared computers entirely.',
    ],
    keyTakeaway:
      'Always log out of shared computers and never save login credentials on public devices.',
    screenshot: Object.freeze({
      image: internetCafeMapImg,
      alt: 'Internet cafe with rows of public computer workstations and gaming terminals.',
      caption:
        'Internet Cafe map: Players enforce terminal hygiene, prevent credential caching, and ensure public sessions are properly terminated.',
    }),
  }),

  'public-wi-fi-attack': Object.freeze({
    slug: 'public-wi-fi-attack',
    threatName: 'Public Wi-Fi Attack',
    number: '06',
    mapName: 'Public Park',
    summary:
      'Rogue access points, "evil twin" networks, and packet interception on unencrypted public Wi-Fi connections.',
    gameScenario: {
      setting: 'Public Park Hotspot Area',
      description:
        'In the Public Park map, a park visitor connects a laptop near the public benches. The threat card displays a Wi-Fi connection prompt listing an open network named "Public_Park_Free_WiFi" without encryption or official captive portal validation.',
      warningSigns: [
        'Open Wi-Fi network requiring no password or encryption credentials.',
        'Slight variation in network SSID names designed to mimic official municipal or venue networks.',
        'Browser displaying SSL/TLS certificate warnings immediately upon connecting to the hotspot.',
      ],
      suspiciousExamples: [
        'Available network: "Public_Park_Free_WiFi" (Open / Unsecured)',
        'Official network: "City_Park_Official_Guest" (Secured with Portal)',
      ],
    },
    recommendedAction: {
      whatToDo:
        'Reject the threat card in the game. In public settings, disconnect from unverified hotspots and switch to cellular data or an encrypted VPN.',
      whyItMatters:
        'Attackers create rogue access points ("evil twins") that route all your internet traffic through their device, allowing them to capture unencrypted data and spoof websites.',
    },
    preventionTips: [
      'Treat open public Wi-Fi networks as untrusted by default.',
      'Use a trusted Virtual Private Network (VPN) or your mobile cellular hotspot for sensitive browsing.',
      'Disable automatic Wi-Fi connection settings on your smartphone and laptop so devices do not connect without your consent.',
      'Never ignore browser certificate warnings when connected to public networks.',
    ],
    keyTakeaway:
      'Treat open public Wi-Fi networks as untrusted and use cellular data or a VPN for sensitive activities.',
    screenshot: Object.freeze({
      image: publicParkMapImg,
      alt: 'Public park with open walkways, park benches, trees, and public recreational areas.',
      caption:
        'Public Park map: Open wireless environments require vigilance against rogue access points set up to intercept mobile traffic.',
    }),
  }),

  'malware-infection': Object.freeze({
    slug: 'malware-infection',
    threatName: 'Malware Infection',
    number: '07',
    mapName: 'Public Park',
    summary:
      'Dangerous email attachments, malicious installers, and compromised download links that deploy harmful software.',
    gameScenario: {
      setting: 'Public Park Community Area',
      description:
        'Near the park pavilion, a device screen card pops up showing an online download dialog offering a "Free Media Player Update" bundled as an archive containing a disguised executable file.',
      warningSigns: [
        'Software updates offered from third-party websites rather than official application stores or vendor sites.',
        'Files using double extensions (such as document.pdf.exe) to disguise executable program code.',
        'Prompts asking to disable operating system security protections or antivirus scanners before running.',
      ],
      suspiciousExamples: [
        'File download: "Software_Update_Patch_v2.1.zip"',
        'Extracted file: "Player_Setup.pdf.exe" (Application / Executable)',
      ],
    },
    recommendedAction: {
      whatToDo:
        'Block the threat card in the game. On personal devices, cancel the download, delete the file without opening it, and run a security scan.',
      whyItMatters:
        'Executing malicious files can install keyloggers, spyware, or remote access trojans that give attackers continuous background control over your device.',
    },
    preventionTips: [
      'Only download software from official vendor websites or authorized app stores.',
      'Configure your operating system file manager to show full file extensions so disguised executables are easily spotted.',
      'Keep operating system patches and antivirus definitions up to date to detect known threat signatures.',
      'Understand that antivirus is a helpful safety net, but cannot detect every newly created or custom malware file.',
    ],
    keyTakeaway:
      'Only download software from official verified sources and inspect file extensions before opening files.',
    screenshot: Object.freeze({
      image: publicParkMapImg,
      alt: 'Public park community pavilion where visitors browse digital content on mobile equipment.',
      caption:
        'Public Park map: Identifying suspicious download prompts prevents malicious software from gaining footholds on user devices.',
    }),
  }),

  ransomware: Object.freeze({
    slug: 'ransomware',
    threatName: 'Ransomware',
    number: '08',
    mapName: 'Public Park',
    summary:
      'Malicious programs that lock or encrypt files, along with essential backup strategies and defensive habits.',
    gameScenario: {
      setting: 'Public Park Operations Terminal',
      description:
        'A maintenance terminal in the park operations shed displays a high-priority threat card: the screen has turned into an extortion notice warning that files are encrypted and demanding payment within 48 hours.',
      warningSigns: [
        'Sudden file renaming with unfamiliar extensions (such as .locked or .crypted).',
        'Text file instructions placed in folders demanding payment in cryptocurrency for decryption keys.',
        'High disk activity and loss of access to documents and pictures.',
      ],
      suspiciousExamples: [
        'Ransom note: "All your documents and databases have been encrypted. Pay 0.5 BTC to restore access. Countdown: 47:59:12"',
      ],
    },
    recommendedAction: {
      whatToDo:
        'Take defensive containment action in the game. In real environments, immediately disconnect the infected machine from all networks (unplug Ethernet, disable Wi-Fi) to stop lateral spread.',
      whyItMatters:
        'Ransomware spreads across local networks to encrypt shared drives and backup servers. Isolating the machine halts further encryption across the organization.',
    },
    preventionTips: [
      'Maintain regular, automated backups stored offline or on immutable cloud storage that cannot be altered from the primary workstation.',
      'Do not pay ransoms; payment provides no guarantee that decryption keys will be provided and directly funds criminal syndicates.',
      'Keep systems updated with the latest security patches to close vulnerabilities exploited by automated ransomware worms.',
      'Segment networks so a compromised guest or workstation device cannot communicate directly with critical file storage.',
    ],
    keyTakeaway:
      'Maintain isolated offline backups so systems can be restored safely without submitting to extortion.',
    screenshot: Object.freeze({
      image: publicParkMapImg,
      alt: 'Park operations setting where digital terminals and connected infrastructure are defended.',
      caption:
        'Public Park map: Understanding containment and backup strategies ensures recovery without submitting to extortion.',
    }),
  }),
})

/**
 * Retrieves a lesson object by its URL slug.
 *
 * @param {string} slug
 * @returns {typeof THREAT_LESSONS[keyof typeof THREAT_LESSONS] | null}
 */
export const getThreatLessonBySlug = (slug) => {
  if (typeof slug !== 'string') return null
  const normalized = slug.toLowerCase().trim()
  return THREAT_LESSONS[normalized] || null
}

/**
 * Returns all threat lessons in canonical order.
 */
export const getAllThreatLessons = () => {
  return [
    THREAT_LESSONS.phishing,
    THREAT_LESSONS.smishing,
    THREAT_LESSONS.vishing,
    THREAT_LESSONS['social-engineering'],
    THREAT_LESSONS['credential-theft'],
    THREAT_LESSONS['public-wi-fi-attack'],
    THREAT_LESSONS['malware-infection'],
    THREAT_LESSONS.ransomware,
  ]
}
