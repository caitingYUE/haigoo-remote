
// Mock logic from processed-jobs.js
function classifyRegion(location) {
  const loc = (location || '').toLowerCase().trim()

  if (!loc) return 'both'

  const globalKeywords = [
    'anywhere', 'everywhere', 'worldwide', 'global',
    'remote', 'work from anywhere', 'wfa',
    '不限地点', '全球', '任意地点'
  ]

  const mainlandKeywords = [
    'china', '中国', 'cn', 'chinese', 'mainland china', 'prc',
    'beijing', 'shanghai', 'shenzhen', 'guangzhou', 'hangzhou',
    'chengdu', '北京', '上海', '深圳', '广州', '杭州',
    '成都', '重庆', '南京', '武汉', '西安', '苏州',
    '天津', '大连', '青岛', '厦门', '珠海', '佛山',
    '宁波', '无锡', '长沙', '郑州', '济南', '哈尔滨',
    '沈阳', '福州', '石家庄', '合肥', '昆明', '兰州'
  ]

  const greaterChinaKeywords = [
    'hong kong', 'hongkong', 'hk', '香港',
    'macau', 'macao', '澳门',
    'taiwan', 'taipei', '台湾', '台北', '高雄'
  ]

  const apacKeywords = [
    'apac', 'asia pacific', 'east asia', 'southeast asia',
    'utc+8', 'gmt+8', 'cst', 'asia/shanghai', 'asia/hong_kong',
    '亚太', '东亚', '东南亚'
  ]

  const overseasKeywords = [
    // 北美
    'usa', 'united states', 'america', 'san francisco', 'new york',
    'seattle', 'boston', 'austin', 'los angeles', 'silicon valley', 'bay area',
    'portland', 'denver', 'chicago', 'atlanta', 'miami', 'dallas',
    'canada', 'toronto', 'vancouver', 'montreal', 'calgary',
    'mexico', 'mexico city',
    'hawaii', 'honolulu',

    // 欧洲
    'europe', 'emea', 'united kingdom', 'england', 'london',
    'germany', 'berlin', 'munich', 'frankfurt', 'hamburg',
    'france', 'paris', 'lyon',
    'spain', 'madrid', 'barcelona',
    'italy', 'rome', 'milan',
    'netherlands', 'amsterdam', 'rotterdam',
    'belgium', 'brussels',
    'sweden', 'stockholm',
    'norway', 'oslo',
    'denmark', 'copenhagen',
    'finland', 'helsinki',
    'poland', 'warsaw',
    'czech', 'prague',
    'ireland', 'dublin',
    'switzerland', 'zurich', 'geneva',
    'austria', 'vienna',
    'portugal', 'lisbon',

    // 大洋洲
    'australia', 'sydney', 'melbourne', 'brisbane', 'perth',
    'new zealand', 'auckland', 'wellington',

    // 亚洲其他
    'japan', 'tokyo', 'osaka', 'kyoto',
    'korea', 'south korea', 'seoul', 'busan',
    'singapore',
    'malaysia', 'kuala lumpur',
    'indonesia', 'jakarta', 'bali',
    'thailand', 'bangkok',
    'vietnam', 'hanoi', 'ho chi minh',
    'philippines', 'manila',
    'india', 'bangalore', 'mumbai', 'delhi', 'hyderabad', 'pune',
    'pakistan', 'karachi',
    'bangladesh', 'dhaka',
    'sri lanka', 'colombo',

    // 中东
    'uae', 'dubai', 'abu dhabi',
    'saudi', 'riyadh', 'jeddah',
    'qatar', 'doha',
    'israel', 'tel aviv', 'jerusalem',
    'turkey', 'istanbul', 'ankara',

    // 南美
    'brazil', 'sao paulo', 'rio de janeiro',
    'argentina', 'buenos aires',
    'chile', 'santiago',
    'colombia', 'bogota',
    'peru', 'lima',
    'latam', 'latin america',

    // 其他
    'russia', 'moscow', 'st petersburg',
    'africa', 'egypt', 'cairo', 'south africa', 'cape town'
  ]

  const shortOverseasKeywords = ['us', 'uk', 'eu']

  let isOverseas = overseasKeywords.some(k => loc.includes(k))
  
  if (!isOverseas) {
    isOverseas = shortOverseasKeywords.some(k => {
      const regex = new RegExp(`\\b${k}\\b`, 'i')
      return regex.test(loc)
    })
  }

  const isMainland = mainlandKeywords.some(k => loc.includes(k))
  const isGreaterChina = greaterChinaKeywords.some(k => loc.includes(k))
  const isAPAC = apacKeywords.some(k => loc.includes(k))
  const isGlobal = globalKeywords.some(k => loc.includes(k))

  if (isOverseas) {
    if (isMainland || isGreaterChina) {
      return 'both'
    }
    return 'overseas'
  }

  if (isMainland || isGreaterChina) {
    return 'domestic'
  }

  if (isAPAC) {
    return 'domestic'
  }

  if (isGlobal) {
    return 'both' 
  }

  return 'overseas'
}

const testCases = [
  'Beijing, China',
  'Shanghai',
  'Remote, China',
  'US',
  'United States',
  'Business Development (not a location)',
  'Remote (US)',
  'Singapore',
  'APAC',
  'Global',
  'Unknown',
  'Hong Kong',
  'Taiwan'
];

testCases.forEach(loc => {
  console.log(`'${loc}' -> ${classifyRegion(loc)}`);
});
