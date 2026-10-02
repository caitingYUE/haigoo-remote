// Validated public boards, 2026-09-20. Disabled until an administrator confirms configuration.
const boards = {
  greenhouse: {
    Canonical: 'canonical',
    'Precision for Medicine': 'pfm',
    'Remote People': 'remotepeople',
    XapoBank: 'xapo61',
    Remote: 'remotecom',
    Udacity: 'udacity',
    'Blueprint Technologies': 'bpcs',
    Innodata: 'innodatainc',
    AG1: 'ag1',
    Furbo: 'tomofunfurbo',
    Gitlab: 'gitlab',
    Jampp: 'jampp',
    Nuitée: 'nuitee',
    RZR: 'rzr',
    Telnyx: 'telnyx54',
    Verve: 'verve'
  },
  ashby: {
    Supabase: 'supabase',
    'The Flex': 'The-Flex',
    Atria: 'atria',
    Kit: 'kit',
    LILT: 'lilt-production',
    RevenueCat: 'revenuecat',
    ClickHouse: 'clickhouse',
    Clipboard: 'clipboard',
    DeepGram: 'Deepgram',
    'Imagine art': 'imagineart',
    Stacker: 'stacker',
    Suno: 'suno',
    Worldly: 'worldly',
    Anima: 'Anima',
    'Candidate.fyi': 'candidate.fyi',
    Lovable: 'lovable',
    Mapbox: 'mapbox',
    Pointr: 'pointr',
    'Tiger Data': 'tigerdata',
    UiPath: 'uipath'
  },
  lever: {
    Metabase: 'metabase',
    'Center for AI Risk Management & Alignment': 'futureof-life',
    Wave: 'waveapps',
    Superside: 'superside',
    VRChat: 'vrchat',
    Xsolla: 'xsolla',
    Yuno: 'yuno',
    'Endpoint Clinical': 'endpointclinical',
    Lionbridge: 'lionbridge',
    RWS: 'rws',
    Welocalize: 'weloglobal',
    'Wing Assistant': 'getwingapp'
  },
  workable: {
    ShaeWellness: 'humanintelligence',
    AVOMIND: 'avomind',
    'Law Offices of Sabrina Li': 'lawofficesofsabrinali',
    Intellect: 'intellecthq',
    'Rolling Arrays': 'rolling-arrays-consulting',
    'CP Axtra (Makro)': 'joinmakropro',
    Slasify: 'slasify',
    Wati: 'wati-dot-i-o',
    'Keywords Studios': 'keywords-intl1',
    'New Energy Nexus': 'newenergynexus',
    Sleek: 'careers-at-sleek'
  }
}
const overrides = {
  无界方舟: { url: 'https://ta8b0dmi0e6.jobs.feishu.cn/index' },
  Jabra: { url: 'https://gn.wd3.myworkdayjobs.com/en-US/JabraCareers' },
  'Deluxe Media Inc.': {
    url: 'https://bydeluxe.wd5.myworkdayjobs.com/en-US/Deluxe_External'
  },
  GoPro: { url: 'https://job-boards.greenhouse.io/goprojobs' },
  Singular: { url: 'https://jobs.ashbyhq.com/singular' },
  '90 Seconds': { url: 'https://jobs.lever.co/90seconds' },
  Inspectorio: {
    url: 'https://ats.rippling.com/en-US/inspectoriocareers/jobs'
  },
  Arches: {
    url: 'https://hrmos.co/pages/arches-global/jobs',
    adapter: 'html',
    capabilities: { absence: false }
  },
  'Deutsche Bank': {
    url: 'https://db.recsolu.com/external/requisitions',
    adapter: 'html',
    capabilities: { absence: false }
  },
  'INTO University Partnerships': {
    url: 'https://cezanneondemand.intervieweb.it/intoglobal',
    adapter: 'html',
    capabilities: { absence: false }
  },
  'UNU 联合国大学': { rule: { requiresReview: true } },
  联合国大学澳门研究所: { rule: { requiresReview: true } },
  Whatnot: { adapter: 'html', capabilities: { absence: false } },
  Scalerrs: { adapter: 'manual' },
  Cosmo: { adapter: 'manual' },
  'Minuttia - AEO Agency': { adapter: 'manual' },
  'The Authentic Asian': { adapter: 'manual' },
  'I for Design Studio': { adapter: 'manual' },
  'NewPath Conveyancing': { adapter: 'manual' },
  RedMountain: { adapter: 'manual' }
}
const expansionGroups = {
  Teamtailor: [
    'Sumsub',
    'Teams Squared',
    'Yodo1 Games',
    'Crimson Education',
    'Holafly',
    'ABC Education Group',
    'Prenetics',
    'Blue Education',
    'Preferred by Nature',
    'Global University Systems',
    'SkyBlueMedia',
    'goFLUENT'
  ],
  Recruitee: [
    'Novakid',
    'TransPerfect',
    'Gain',
    'TrustFlight',
    'UNU 联合国大学',
    '联合国大学澳门研究所'
  ],
  BambooHR: ['Berlitz', 'Bragi', 'GreenTomatoMedia', 'Navitas', 'QS', 'Solace'],
  Greenhouse: ['Automattic', 'Railsware', 'GoHiring', 'GoPro', 'OpenZeppelin'],
  Ashby: ['Deel', 'Buffer', 'Overview AI', 'Singular'],
  Rippling: ['Chess.com', 'Agora', 'Ideawise Group', 'Inspectorio'],
  Pinpoint: ['Safetywing', 'The Meliore Foundation', 'Zencargo'],
  SmartRecruiters: ['Dairy Queen', 'Nagarro', '澳大利亚格里菲斯大学'],
  JazzHR: ['Codelitt', 'Kreato Global', 'Translated'],
  Breezy: ['Fuelerate', 'Social Discovery Group'],
  Lever: ['90 Seconds']
}
export function catalogSource(company) {
  const fold = (value) =>
    String(value || '')
      .trim()
      .replace(/[|｜]/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()
  const name = fold(company.name)
  for (const [adapter, entries] of Object.entries(boards))
    for (const [label, board] of Object.entries(entries))
      if (fold(label) === name) {
        const eu = label === 'Lionbridge',
          host = {
            greenhouse: 'https://job-boards.greenhouse.io',
            ashby: 'https://jobs.ashbyhq.com',
            lever: `https://jobs.${eu ? 'eu.' : ''}lever.co`,
            workable: 'https://apply.workable.com'
          }[adapter]
        return {
          adapter,
          url: `${host}/${board}`,
          config: { board, eu, rolloutTier: 'A1', platform: adapter },
          rule: board === 'futureof-life' ? { requiresReview: true } : {},
          capabilities: {
            discover: true,
            details: true,
            updates: true,
            absence: true
          }
        }
      }
  const override =
    Object.entries(overrides).find(([label]) => fold(label) === name)?.[1] || {}
  const platform = Object.entries(expansionGroups).find(([, names]) =>
    names.some((label) => fold(label) === name)
  )?.[0]
  return {
    ...override,
    config: {
      ...override.config,
      rolloutTier: platform ? 'A2' : 'B',
      ...(platform ? { platform } : {})
    }
  }
}
export { boards as VALIDATED_BOARDS }
