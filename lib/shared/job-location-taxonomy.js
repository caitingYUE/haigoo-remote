function unique(values) {
  return [...new Set(values.map(value => String(value || '').trim().toLowerCase()).filter(Boolean))]
}

function child(value, label, labelEn, keywords, exactValues = []) {
  return { value, label, labelEn, keywords: unique(keywords), exactValues: unique(exactValues) }
}

function group(value, key, label, labelEn, keywords, children, exactValues = []) {
  return {
    value,
    key,
    label,
    labelEn,
    children,
    keywords: unique([
      ...keywords,
      ...children.flatMap(option => option.keywords)
    ]),
    exactValues: unique([
      ...exactValues,
      ...children.flatMap(option => option.exactValues)
    ])
  }
}

const CHINA_CHILDREN = [
  child('ChinaMainland', '中国大陆', 'Mainland China', [
    'china', 'mainland china', 'prc', '中国', '中国大陆', '大陆',
    'beijing', 'shanghai', 'shenzhen', 'guangzhou', 'hangzhou', 'chengdu', 'chongqing',
    'nanjing', 'wuhan', 'xian', "xi'an", 'suzhou', 'tianjin', 'dalian', 'qingdao',
    'xiamen', '北京', '上海', '深圳', '广州', '杭州', '成都', '重庆', '南京', '武汉',
    '西安', '苏州', '天津', '大连', '青岛', '厦门', '国内远程'
  ]),
  child('GreaterChina', '港澳台', 'Hong Kong, Macao & Taiwan', [
    'hong kong', 'hongkong', '香港', 'macau', 'macao', '澳门',
    'taiwan', 'taipei', 'kaohsiung', '台湾', '台北', '高雄', '港澳台'
  ])
]

const APAC_CHILDREN = [
  child('EastAsia', '东亚', 'East Asia', [
    'east asia', '东亚', 'japan', 'tokyo', 'osaka', 'kyoto', '日本', '东京', '大阪',
    'south korea', 'korea', 'seoul', 'busan', '韩国', '首尔', '釜山',
    'mongolia', 'ulaanbaatar', '蒙古'
  ]),
  child('SoutheastAsia', '东南亚', 'Southeast Asia', [
    'southeast asia', 'asean', '东南亚', 'singapore', '新加坡',
    'malaysia', 'kuala lumpur', '马来西亚', '吉隆坡',
    'indonesia', 'jakarta', 'bali', '印度尼西亚', '印尼', '雅加达',
    'thailand', 'bangkok', '泰国', '曼谷',
    'vietnam', 'hanoi', 'ho chi minh', '越南', '河内', '胡志明市',
    'philippines', 'manila', '菲律宾', '马尼拉',
    'cambodia', 'phnom penh', '柬埔寨', 'myanmar', 'yangon', '缅甸',
    'laos', '老挝', 'brunei', '文莱'
  ]),
  child('SouthAsia', '南亚', 'South Asia', [
    'south asia', '南亚', 'india', 'bangalore', 'bengaluru', 'mumbai', 'delhi',
    'hyderabad', 'pune', '印度', '班加罗尔', '孟买', '德里',
    'pakistan', 'karachi', '巴基斯坦', 'bangladesh', 'dhaka', '孟加拉国',
    'sri lanka', 'colombo', '斯里兰卡', 'nepal', 'kathmandu', '尼泊尔',
    'bhutan', '不丹', 'maldives', '马尔代夫'
  ]),
  child('Oceania', '大洋洲', 'Oceania', [
    'oceania', '大洋洲', 'australia', 'sydney', 'melbourne', 'brisbane', 'perth',
    '澳大利亚', '澳洲', '悉尼', '墨尔本',
    'new zealand', 'auckland', 'wellington', '新西兰', '奥克兰'
  ])
]

const EUROPE_AMERICAS_CHILDREN = [
  child('NorthAmerica', '北美', 'North America', [
    'north america', '北美', 'united states', 'u.s.a.', 'usa', 'us', '美国',
    'canada', '加拿大', 'toronto', 'vancouver', 'montreal', 'calgary', '多伦多', '温哥华'
  ]),
  child('UnitedStates', '美国', 'United States', [
    'united states', 'u.s.a.', 'usa', 'us', '美国', 'san francisco', 'new york', 'seattle',
    'boston', 'austin', 'los angeles', 'silicon valley', 'bay area', 'chicago', 'denver',
    'atlanta', 'miami', 'dallas', 'washington dc', 'california', 'texas', 'florida'
  ]),
  child('Canada', '加拿大', 'Canada', [
    'canada', '加拿大', 'toronto', 'vancouver', 'montreal', 'calgary', 'ottawa',
    '多伦多', '温哥华', '蒙特利尔', '卡尔加里', '渥太华'
  ]),
  child('UnitedKingdomIreland', '英国及爱尔兰', 'UK & Ireland', [
    'united kingdom', 'uk', 'great britain', 'britain', 'england', 'scotland', 'wales',
    'northern ireland', 'london', 'manchester', 'edinburgh', '英国', '英格兰', '苏格兰',
    'ireland', 'dublin', '爱尔兰', '都柏林'
  ]),
  child('WesternEurope', '西欧', 'Western Europe', [
    'western europe', '西欧', 'france', 'paris', 'lyon', '法国', '巴黎',
    'germany', 'deutschland', 'berlin', 'munich', 'frankfurt', 'hamburg', '德国', '柏林',
    'netherlands', 'amsterdam', 'rotterdam', '荷兰', '阿姆斯特丹',
    'belgium', 'brussels', '比利时', '布鲁塞尔',
    'luxembourg', '卢森堡', 'switzerland', 'zurich', 'geneva', '瑞士',
    'austria', 'vienna', '奥地利', '维也纳', 'liechtenstein', '列支敦士登', 'monaco', '摩纳哥'
  ]),
  child('NorthernEurope', '北欧', 'Northern Europe', [
    'northern europe', 'nordics', 'scandinavia', '北欧',
    'sweden', 'stockholm', '瑞典', '斯德哥尔摩', 'norway', 'oslo', '挪威', '奥斯陆',
    'denmark', 'copenhagen', '丹麦', '哥本哈根', 'finland', 'helsinki', '芬兰', '赫尔辛基',
    'iceland', '冰岛', 'estonia', 'latvia', 'lithuania', '爱沙尼亚', '拉脱维亚', '立陶宛'
  ]),
  child('SouthernEurope', '南欧', 'Southern Europe', [
    'southern europe', '南欧', 'spain', 'madrid', 'barcelona', '西班牙', '马德里',
    'portugal', 'lisbon', '葡萄牙', '里斯本', 'italy', 'rome', 'milan', '意大利', '罗马',
    'greece', 'athens', '希腊', '雅典', 'malta', '马耳他', 'cyprus', '塞浦路斯',
    'andorra', '安道尔', 'san marino', '圣马力诺', 'vatican', '梵蒂冈'
  ]),
  child('CentralEasternEurope', '中东欧', 'Central & Eastern Europe', [
    'central europe', 'eastern europe', 'cee', '中欧', '东欧', '中东欧',
    'poland', 'warsaw', '波兰', '华沙', 'czech republic', 'czechia', 'prague', '捷克', '布拉格',
    'slovakia', 'hungary', 'budapest', '匈牙利', 'romania', 'bucharest', '罗马尼亚',
    'bulgaria', '保加利亚', 'croatia', '克罗地亚', 'slovenia', '斯洛文尼亚',
    'serbia', '塞尔维亚', 'ukraine', '乌克兰', 'moldova', '摩尔多瓦',
    'albania', '阿尔巴尼亚', 'bosnia', '波斯尼亚', 'montenegro', '黑山',
    'north macedonia', '北马其顿', 'kosovo', '科索沃', 'belarus', '白俄罗斯',
    'russia', 'moscow', '俄罗斯', '莫斯科'
  ])
]

const LATIN_AMERICA_CHILDREN = [
  child('MexicoCentralAmericaCaribbean', '墨西哥、中美洲及加勒比', 'Mexico, Central America & Caribbean', [
    'latin america', 'latam', '拉丁美洲', '拉美', 'mexico', 'mexico city', '墨西哥',
    'central america', '中美洲', 'costa rica', 'panama', 'guatemala', '哥斯达黎加', '巴拿马',
    'caribbean', '加勒比', 'puerto rico', 'jamaica', 'dominican republic'
  ]),
  child('SouthAmerica', '南美洲', 'South America', [
    'south america', '南美洲', '南美', 'brazil', 'sao paulo', 'rio de janeiro', '巴西',
    'argentina', 'buenos aires', '阿根廷', 'chile', 'santiago', '智利',
    'colombia', 'bogota', '哥伦比亚', 'peru', 'lima', '秘鲁',
    'uruguay', '乌拉圭', 'ecuador', '厄瓜多尔', 'venezuela', '委内瑞拉'
  ])
]

const MIDDLE_EAST_AFRICA_CHILDREN = [
  child('MiddleEast', '中东', 'Middle East', [
    'middle east', 'mena', '中东', 'uae', 'united arab emirates', 'dubai', 'abu dhabi',
    '阿联酋', '迪拜', 'saudi arabia', 'riyadh', '沙特', 'qatar', 'doha', '卡塔尔',
    'israel', 'tel aviv', '以色列', 'turkey', 'istanbul', '土耳其',
    'kuwait', '科威特', 'bahrain', '巴林', 'oman', '阿曼', 'jordan', '约旦', 'lebanon', '黎巴嫩'
  ]),
  child('Africa', '非洲', 'Africa', [
    'africa', '非洲', 'south africa', 'cape town', 'johannesburg', '南非',
    'egypt', 'cairo', '埃及', '开罗', 'nigeria', 'lagos', '尼日利亚',
    'kenya', 'nairobi', '肯尼亚', 'morocco', '摩洛哥', 'ghana', '加纳',
    'ethiopia', '埃塞俄比亚', 'tunisia', '突尼斯'
  ])
]

const GLOBAL_CHILDREN = [
  child('GlobalUnrestricted', '不限地区', 'Location unrestricted', [
    'worldwide', 'work from anywhere', 'anywhere', 'global remote', 'globally remote',
    '全球远程', '全球', '不限地区', '不限地点', '地点不限', '任意地点'
  ], ['remote', 'remote only', 'fully remote', '远程'])
]

export const JOB_LOCATION_TAXONOMY = [
  group('China', 'china', '中国远程', 'China remote', ['中国远程', 'china remote'], CHINA_CHILDREN),
  group('APAC', 'apac', '亚太远程', 'APAC remote', ['apac', 'asia', 'asia pacific', '亚洲', '亚洲远程', '亚太', '亚太远程'], APAC_CHILDREN),
  group('EuropeAmericas', 'europeAmericas', '欧美远程', 'Europe & North America remote', ['欧美', '欧美远程', 'europe', 'emea', 'european union', 'eu remote', 'eea', '欧洲', '欧洲远程'], EUROPE_AMERICAS_CHILDREN),
  group('LatinAmerica', 'latinAmerica', '拉美远程', 'Latin America remote', ['latam', 'latin america', '拉美', '拉美远程'], LATIN_AMERICA_CHILDREN),
  group('MiddleEastAfrica', 'middleEastAfrica', '中东及非洲远程', 'Middle East & Africa remote', ['middle east and africa', 'middle east & africa', 'emea', 'mena', '中东及非洲', '中东非'], MIDDLE_EAST_AFRICA_CHILDREN),
  group('Global', 'global', '全球远程', 'Global remote', [], GLOBAL_CHILDREN)
]

export const JOB_LOCATION_FILTER_OPTIONS = JOB_LOCATION_TAXONOMY.flatMap(locationGroup => [
  locationGroup,
  ...locationGroup.children.map(option => ({ ...option, parentValue: locationGroup.value }))
])

export const JOB_LOCATION_ADMIN_QUICK_TAGS = [
  '全球远程',
  '中国远程',
  '亚太远程',
  '欧美远程',
  '北美远程',
  '美国远程',
  '加拿大远程',
  '欧洲远程',
  '英国远程',
  '拉美远程',
  '中东远程',
  '非洲远程',
  '香港远程',
  '台湾远程'
]

const FILTER_OPTION_BY_VALUE = new Map(JOB_LOCATION_FILTER_OPTIONS.map(option => [option.value, option]))
const PARENT_BY_FILTER_VALUE = new Map(
  JOB_LOCATION_TAXONOMY.flatMap(locationGroup => [
    [locationGroup.value, locationGroup.value],
    ...locationGroup.children.map(option => [option.value, locationGroup.value])
  ])
)

export function getJobLocationFilterOption(value) {
  return FILTER_OPTION_BY_VALUE.get(String(value || '').trim()) || null
}

export function getJobLocationParentValue(value) {
  return PARENT_BY_FILTER_VALUE.get(String(value || '').trim()) || null
}

function includesKeyword(text, keyword) {
  if (!keyword) return false
  if (/[^\p{ASCII}]/u.test(keyword) || keyword.length > 3) return text.includes(keyword)
  return new RegExp(`(^|[^a-z0-9])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(text)
}

export function matchesJobLocationFilter(location, filterValue) {
  const option = getJobLocationFilterOption(filterValue)
  if (!option) return false
  const normalized = String(location || '').trim().toLowerCase()
  if (!normalized) return false
  if (option.exactValues.includes(normalized)) return true
  return option.keywords.some(keyword => includesKeyword(normalized, keyword))
}

export function buildJobLocationAvailability(locations) {
  const normalizedLocations = Array.isArray(locations) ? locations : []
  return JOB_LOCATION_FILTER_OPTIONS.map(option => ({
    value: option.value,
    count: normalizedLocations.reduce(
      (count, location) => count + (matchesJobLocationFilter(location, option.value) ? 1 : 0),
      0
    )
  })).filter(option => option.count > 0)
}
