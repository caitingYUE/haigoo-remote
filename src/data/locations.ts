export interface LocationData {
    name: string
    country: string
    timezone: string
    ianaTimezone: string // IANA timezone identifier for real-time clock
    lat: number
    lng: number
    description: string
    aliases: string[]
}

export const LOCATION_DATABASE: Record<string, LocationData> = {
    // Special cases
    'remote': {
        name: 'Remote',
        country: 'Global',
        timezone: 'Flexible',
        ianaTimezone: 'UTC',
        lat: 0,
        lng: 0,
        description: '远程工作,可在任何地点工作。通常需要在特定时区内保持工作时间,具体要求因公司而异。',
        aliases: ['anywhere', 'worldwide', 'global', 'work from anywhere']
    },

    // North America
    'united states': {
        name: 'United States',
        country: 'United States',
        timezone: 'Multiple Timezones',
        ianaTimezone: 'America/New_York', // Default to EST
        lat: 37.0902,
        lng: -95.7129,
        description: '全球最大的科技市场，拥有硅谷、纽约、西雅图等多个科技中心。远程工作文化成熟，机会众多。',
        aliases: ['usa', 'us', 'america']
    },

    'california': {
        name: 'California',
        country: 'United States',
        timezone: 'UTC-8 (PST)',
        ianaTimezone: 'America/Los_Angeles',
        lat: 36.7783,
        lng: -119.4179,
        description: '美国西海岸最大的州,全球科技产业中心。包括硅谷、旧金山、洛杉矶等主要城市,是众多科技巨头和创业公司的总部所在地。',
        aliases: ['ca', 'calif']
    },

    'san francisco': {
        name: 'San Francisco',
        country: 'United States',
        timezone: 'UTC-8 (PST)',
        ianaTimezone: 'America/Los_Angeles',
        lat: 37.7749,
        lng: -122.4194,
        description: '美国西海岸重要城市,硅谷核心区域。众多科技公司总部所在地,创新创业氛围浓厚,生活成本较高。',
        aliases: ['sf', 'san fran', 'frisco']
    },

    'new york': {
        name: 'New York',
        country: 'United States',
        timezone: 'UTC-5 (EST)',
        ianaTimezone: 'America/New_York',
        lat: 40.7128,
        lng: -74.0060,
        description: '美国最大城市,全球金融中心。科技、金融、媒体等行业发达,生活节奏快,机会众多。',
        aliases: ['ny', 'nyc', 'new york city']
    },

    'canada': {
        name: 'Canada',
        country: 'Canada',
        timezone: 'Multiple Timezones',
        ianaTimezone: 'America/Toronto',
        lat: 56.1304,
        lng: -106.3468,
        description: '北美科技强国，多伦多、温哥华和蒙特利尔是主要科技中心。对技术移民友好，生活质量高。',
        aliases: ['ca', 'can']
    },

    'mexico': {
        name: 'Mexico',
        country: 'Mexico',
        timezone: 'UTC-6 (CST)',
        ianaTimezone: 'America/Mexico_City',
        lat: 23.6345,
        lng: -102.5528,
        description: '拉丁美洲第二大经济体，靠近美国市场。墨西哥城和瓜达拉哈拉是主要科技中心，生活成本较低。',
        aliases: ['mx', 'mex']
    },

    // South America
    'argentina': {
        name: 'Argentina',
        country: 'Argentina',
        timezone: 'UTC-3 (ART)',
        ianaTimezone: 'America/Argentina/Buenos_Aires',
        lat: -34.6037,
        lng: -58.3816,
        description: '南美洲第二大国，拥有高素质的科技人才库。时区与美国接近，英语普及率较高，是远程工作的热门选择。',
        aliases: ['ar', 'arg']
    },

    'brazil': {
        name: 'Brazil',
        country: 'Brazil',
        timezone: 'UTC-3 (BRT)',
        ianaTimezone: 'America/Sao_Paulo',
        lat: -14.2350,
        lng: -51.9253,
        description: '南美洲最大国家，拥有庞大的开发者社区。科技生态系统成熟，众多独角兽企业诞生于此。',
        aliases: ['br', 'brasil']
    },

    'colombia': {
        name: 'Colombia',
        country: 'Colombia',
        timezone: 'UTC-5 (COT)',
        ianaTimezone: 'America/Bogota',
        lat: 4.7110,
        lng: -74.0721,
        description: '南美洲西北部国家，科技产业发展迅速。麦德林和波哥大是主要的科技中心，与美国东部时区相同。',
        aliases: ['co', 'col']
    },

    'chile': {
        name: 'Chile',
        country: 'Chile',
        timezone: 'UTC-4 (CLT)',
        ianaTimezone: 'America/Santiago',
        lat: -35.6751,
        lng: -71.5430,
        description: '南美洲最稳定的经济体之一，拥有"Chilecon Valley"。创业生态活跃，政府大力支持科技创新。',
        aliases: ['cl']
    },

    'uruguay': {
        name: 'Uruguay',
        country: 'Uruguay',
        timezone: 'UTC-3 (UYT)',
        ianaTimezone: 'America/Montevideo',
        lat: -32.5228,
        lng: -55.7658,
        description: '南美洲人均软件出口额最高的国家。政治稳定，网络基础设施完善，享有"南美硅谷"的美誉。',
        aliases: ['uy']
    },

    // Europe
    'united kingdom': {
        name: 'United Kingdom',
        country: 'United Kingdom',
        timezone: 'UTC+0 (GMT)',
        ianaTimezone: 'Europe/London',
        lat: 55.3781,
        lng: -3.4360,
        description: '全球金融和科技中心之一。伦敦拥有世界级的科技生态系统，金融科技(FinTech)尤为发达。',
        aliases: ['uk', 'gb', 'britain', 'england']
    },

    'germany': {
        name: 'Germany',
        country: 'Germany',
        timezone: 'UTC+1 (CET)',
        ianaTimezone: 'Europe/Berlin',
        lat: 51.1657,
        lng: 10.4515,
        description: '欧洲最大经济体，工程和制造业强国。柏林是欧洲主要的初创企业中心，吸引了全球科技人才。',
        aliases: ['de', 'deu', 'deutschland']
    },

    'france': {
        name: 'France',
        country: 'France',
        timezone: 'UTC+1 (CET)',
        ianaTimezone: 'Europe/Paris',
        lat: 46.2276,
        lng: 2.2137,
        description: '欧洲主要科技中心之一，拥有"La French Tech"生态系统。巴黎是人工智能和初创企业的重要枢纽。',
        aliases: ['fr', 'fra']
    },

    'netherlands': {
        name: 'Netherlands',
        country: 'Netherlands',
        timezone: 'UTC+1 (CET)',
        ianaTimezone: 'Europe/Amsterdam',
        lat: 52.1326,
        lng: 5.2913,
        description: '欧洲数字化程度最高的国家之一。英语普及率极高，阿姆斯特丹是连接欧洲和全球的重要科技枢纽。',
        aliases: ['nl', 'nld', 'holland']
    },

    'spain': {
        name: 'Spain',
        country: 'Spain',
        timezone: 'UTC+1 (CET)',
        ianaTimezone: 'Europe/Madrid',
        lat: 40.4637,
        lng: -3.7492,
        description: '深受数字游民喜爱的国家。巴塞罗那和马德里拥有活跃的科技社区，生活质量高，气候宜人。',
        aliases: ['es', 'esp']
    },

    'portugal': {
        name: 'Portugal',
        country: 'Portugal',
        timezone: 'UTC+0 (WET)',
        ianaTimezone: 'Europe/Lisbon',
        lat: 39.3999,
        lng: -8.2245,
        description: '欧洲最热门的数字游民目的地之一。里斯本和波尔图拥有蓬勃发展的科技场景，生活成本相对较低。',
        aliases: ['pt', 'prt']
    },

    'poland': {
        name: 'Poland',
        country: 'Poland',
        timezone: 'UTC+1 (CET)',
        ianaTimezone: 'Europe/Warsaw',
        lat: 51.9194,
        lng: 19.1451,
        description: '中东欧最大的科技中心，拥有大量高素质的工程师。华沙和克拉科夫是主要的技术外包和研发中心。',
        aliases: ['pl', 'pol']
    },

    'ukraine': {
        name: 'Ukraine',
        country: 'Ukraine',
        timezone: 'UTC+2 (EET)',
        ianaTimezone: 'Europe/Kiev',
        lat: 48.3794,
        lng: 31.1656,
        description: '拥有强大的IT人才库，是全球重要的软件开发外包目的地。尽管面临挑战，科技行业依然保持韧性。',
        aliases: ['ua', 'ukr']
    },

    'romania': {
        name: 'Romania',
        country: 'Romania',
        timezone: 'UTC+2 (EET)',
        ianaTimezone: 'Europe/Bucharest',
        lat: 45.9432,
        lng: 24.9668,
        description: '东欧新兴的科技中心，网速全球领先。拥有大量技术人才，是许多跨国公司的研发基地。',
        aliases: ['ro', 'rou']
    },

    'sweden': {
        name: 'Sweden',
        country: 'Sweden',
        timezone: 'UTC+1 (CET)',
        ianaTimezone: 'Europe/Stockholm',
        lat: 60.1282,
        lng: 18.6435,
        description: '北欧创新强国，诞生了Spotify、Skype等知名科技公司。斯德哥尔摩被誉为"独角兽工厂"。',
        aliases: ['se', 'swe']
    },

    // Asia-Pacific
    'australia': {
        name: 'Australia',
        country: 'Australia',
        timezone: 'UTC+10 (AEST)',
        ianaTimezone: 'Australia/Sydney',
        lat: -25.2744,
        lng: 133.7751,
        description: '亚太地区重要的科技市场。悉尼和墨尔本拥有成熟的创业生态，生活质量极高，但时差较大。',
        aliases: ['au', 'aus']
    },

    'new zealand': {
        name: 'New Zealand',
        country: 'New Zealand',
        timezone: 'UTC+12 (NZST)',
        ianaTimezone: 'Pacific/Auckland',
        lat: -40.9006,
        lng: 174.8860,
        description: '拥有独特的创新环境和极高的生活质量。惠灵顿和奥克兰是主要科技中心，政府积极吸引全球科技人才。',
        aliases: ['nz', 'nzl']
    },

    'japan': {
        name: 'Japan',
        country: 'Japan',
        timezone: 'UTC+9 (JST)',
        ianaTimezone: 'Asia/Tokyo',
        lat: 36.2048,
        lng: 138.2529,
        description: '世界第三大经济体，科技实力雄厚。东京是全球最大的都市圈之一，机器人和精密制造领域领先。',
        aliases: ['jp', 'jpn']
    },

    'singapore': {
        name: 'Singapore',
        country: 'Singapore',
        timezone: 'UTC+8 (SGT)',
        ianaTimezone: 'Asia/Singapore',
        lat: 1.3521,
        lng: 103.8198,
        description: '亚洲金融和科技中心,国际化程度极高。政治稳定,基础设施完善,税收优惠,是众多跨国公司亚太总部所在地。',
        aliases: ['sg', 'sgp']
    },

    'philippines': {
        name: 'Philippines',
        country: 'Philippines',
        timezone: 'UTC+8 (PHT)',
        ianaTimezone: 'Asia/Manila',
        lat: 12.8797,
        lng: 121.7740,
        description: '东南亚群岛国家，英语为官方语言之一。BPO产业极度发达，拥有大量优秀的虚拟助理和远程支持人才。',
        aliases: ['ph', 'phil']
    },

    'india': {
        name: 'India',
        country: 'India',
        timezone: 'UTC+5:30 (IST)',
        ianaTimezone: 'Asia/Kolkata',
        lat: 20.5937,
        lng: 78.9629,
        description: '全球最大的IT外包和软件开发中心之一。拥有庞大的工程人才库，班加罗尔被誉为"亚洲硅谷"。',
        aliases: ['in', 'ind']
    },

    'vietnam': {
        name: 'Vietnam',
        country: 'Vietnam',
        timezone: 'UTC+7 (ICT)',
        ianaTimezone: 'Asia/Ho_Chi_Minh',
        lat: 14.0583,
        lng: 108.2772,
        description: '东南亚增长最快的数字经济体之一。拥有大量年轻的工程师，胡志明市和河内是新兴的软件外包中心。',
        aliases: ['vn', 'vnm']
    },

    'thailand': {
        name: 'Thailand',
        country: 'Thailand',
        timezone: 'UTC+7 (ICT)',
        ianaTimezone: 'Asia/Bangkok',
        lat: 15.8700,
        lng: 100.9925,
        description: '全球最受欢迎的数字游民目的地之一。曼谷和清迈拥有完善的基础设施和低廉的生活成本。',
        aliases: ['th', 'tha']
    },

    'indonesia': {
        name: 'Indonesia',
        country: 'Indonesia',
        timezone: 'UTC+7 (WIB)',
        ianaTimezone: 'Asia/Jakarta',
        lat: -0.7893,
        lng: 113.9213,
        description: '东南亚最大经济体。雅加达拥有众多独角兽企业，巴厘岛则是全球知名的数字游民天堂。',
        aliases: ['id', 'idn']
    },

    // Middle East & Africa
    'israel': {
        name: 'Israel',
        country: 'Israel',
        timezone: 'UTC+2 (IST)',
        ianaTimezone: 'Asia/Jerusalem',
        lat: 31.0461,
        lng: 34.8516,
        description: '拥有"创业国度"之称，人均创业公司数量全球领先。特拉维夫是全球顶尖的科技创新中心。',
        aliases: ['il', 'isr']
    },

    'united arab emirates': {
        name: 'United Arab Emirates',
        country: 'United Arab Emirates',
        timezone: 'UTC+4 (GST)',
        ianaTimezone: 'Asia/Dubai',
        lat: 23.4241,
        lng: 53.8478,
        description: '中东地区的商业和科技枢纽。迪拜和阿布扎比积极推动数字化转型，吸引全球人才和投资。',
        aliases: ['uae', 'ae']
    },

    'south africa': {
        name: 'South Africa',
        country: 'South Africa',
        timezone: 'UTC+2 (SAST)',
        ianaTimezone: 'Africa/Johannesburg',
        lat: -30.5595,
        lng: 22.9375,
        description: '非洲最发达的经济体之一。开普敦拥有蓬勃发展的科技生态系统，被称为"Silicon Cape"。',
        aliases: ['za', 'zaf']
    },

    'nigeria': {
        name: 'Nigeria',
        country: 'Nigeria',
        timezone: 'UTC+1 (WAT)',
        ianaTimezone: 'Africa/Lagos',
        lat: 9.0820,
        lng: 8.6753,
        description: '非洲最大经济体，拥有活跃的创业场景。拉各斯是西非的科技中心，诞生了多家知名的金融科技公司。',
        aliases: ['ng', 'nga']
    },

    // Cities (Legacy support, updated with ianaTimezone)
    'london': {
        name: 'London',
        country: 'United Kingdom',
        timezone: 'UTC+0 (GMT)',
        ianaTimezone: 'Europe/London',
        lat: 51.5074,
        lng: -0.1278,
        description: '英国首都,欧洲金融和科技中心。国际化程度高,科技创业生态系统成熟,生活成本较高。',
        aliases: ['ldn']
    },

    'berlin': {
        name: 'Berlin',
        country: 'Germany',
        timezone: 'UTC+1 (CET)',
        ianaTimezone: 'Europe/Berlin',
        lat: 52.5200,
        lng: 13.4050,
        description: '德国首都,欧洲创业之都。生活成本相对较低,文化多元,创业氛围活跃,吸引大量国际人才。',
        aliases: ['ber']
    },

    'amsterdam': {
        name: 'Amsterdam',
        country: 'Netherlands',
        timezone: 'UTC+1 (CET)',
        ianaTimezone: 'Europe/Amsterdam',
        lat: 52.3676,
        lng: 4.9041,
        description: '荷兰首都,欧洲科技中心之一。英语普及率高,生活质量优秀,对国际人才友好,自行车文化盛行。',
        aliases: ['ams']
    },

    'paris': {
        name: 'Paris',
        country: 'France',
        timezone: 'UTC+1 (CET)',
        ianaTimezone: 'Europe/Paris',
        lat: 48.8566,
        lng: 2.3522,
        description: '法国首都,欧洲重要科技中心。文化底蕴深厚,科技创业生态不断发展,生活成本较高。',
        aliases: ['par']
    },

    'dublin': {
        name: 'Dublin',
        country: 'Ireland',
        timezone: 'UTC+0 (GMT)',
        ianaTimezone: 'Europe/Dublin',
        lat: 53.3498,
        lng: -6.2603,
        description: '爱尔兰首都,欧洲科技公司欧洲总部首选地。税收优惠,英语环境,众多科技巨头设有欧洲总部。',
        aliases: ['dub']
    },

    'hong kong': {
        name: 'Hong Kong',
        country: 'China',
        timezone: 'UTC+8 (HKT)',
        ianaTimezone: 'Asia/Hong_Kong',
        lat: 22.3193,
        lng: 114.1694,
        description: '中国特别行政区,国际金融中心。东西方文化交汇,金融和科技产业发达,生活成本高。',
        aliases: ['hk', 'hongkong']
    },

    'tokyo': {
        name: 'Tokyo',
        country: 'Japan',
        timezone: 'UTC+9 (JST)',
        ianaTimezone: 'Asia/Tokyo',
        lat: 35.6762,
        lng: 139.6503,
        description: '日本首都,亚洲最大城市之一。科技产业发达,生活质量高,但生活成本较高,语言可能是挑战。',
        aliases: ['tyo']
    },

    'sydney': {
        name: 'Sydney',
        country: 'Australia',
        timezone: 'UTC+10 (AEST)',
        ianaTimezone: 'Australia/Sydney',
        lat: -33.8688,
        lng: 151.2093,
        description: '澳大利亚最大城市,科技和金融中心。生活质量高,气候宜人,但与其他时区时差较大。',
        aliases: ['syd']
    },

    'beijing': {
        name: 'Beijing',
        country: 'China',
        timezone: 'UTC+8 (CST)',
        ianaTimezone: 'Asia/Shanghai',
        lat: 39.9042,
        lng: 116.4074,
        description: '中国首都,政治和文化中心。科技产业快速发展,众多互联网公司总部所在地,生活成本逐年上升。',
        aliases: ['bj', '北京']
    },

    'shanghai': {
        name: 'Shanghai',
        country: 'China',
        timezone: 'UTC+8 (CST)',
        ianaTimezone: 'Asia/Shanghai',
        lat: 31.2304,
        lng: 121.4737,
        description: '中国最大城市,国际金融中心。经济发达,国际化程度高,科技和金融产业蓬勃发展。',
        aliases: ['sh', '上海']
    },

    'shenzhen': {
        name: 'Shenzhen',
        country: 'China',
        timezone: 'UTC+8 (CST)',
        ianaTimezone: 'Asia/Shanghai',
        lat: 22.5431,
        lng: 114.0579,
        description: '中国科技创新中心,硅谷之称。众多科技公司总部,创业氛围浓厚,年轻化程度高。',
        aliases: ['sz', '深圳']
    },

    'bangalore': {
        name: 'Bangalore',
        country: 'India',
        timezone: 'UTC+5:30 (IST)',
        ianaTimezone: 'Asia/Kolkata',
        lat: 12.9716,
        lng: 77.5946,
        description: '印度硅谷,IT产业中心。众多跨国公司研发中心,生活成本相对较低,科技人才丰富。',
        aliases: ['bengaluru', 'blr']
    },

    'toronto': {
        name: 'Toronto',
        country: 'Canada',
        timezone: 'UTC-5 (EST)',
        ianaTimezone: 'America/Toronto',
        lat: 43.6532,
        lng: -79.3832,
        description: '加拿大最大城市,金融和科技中心。多元文化,生活质量高,对移民友好,科技产业快速发展。',
        aliases: ['yyz', 'to']
    },

    'vancouver': {
        name: 'Vancouver',
        country: 'Canada',
        timezone: 'UTC-8 (PST)',
        ianaTimezone: 'America/Vancouver',
        lat: 49.2827,
        lng: -123.1207,
        description: '加拿大西海岸城市,科技和影视产业中心。自然环境优美,生活质量高,亚洲移民较多。',
        aliases: ['yvr']
    },

    'sao paulo': {
        name: 'São Paulo',
        country: 'Brazil',
        timezone: 'UTC-3 (BRT)',
        ianaTimezone: 'America/Sao_Paulo',
        lat: -23.5505,
        lng: -46.6333,
        description: '巴西最大城市,拉丁美洲金融和科技中心。经济发达,创业生态活跃,葡萄牙语为主要语言。',
        aliases: ['sao', 'sp']
    },

    'mexico city': {
        name: 'Mexico City',
        country: 'Mexico',
        timezone: 'UTC-6 (CST)',
        ianaTimezone: 'America/Mexico_City',
        lat: 19.4326,
        lng: -99.1332,
        description: '墨西哥首都,拉丁美洲重要城市。科技产业发展迅速,生活成本相对较低,靠近美国市场。',
        aliases: ['cdmx', 'mexico']
    },

    'dubai': {
        name: 'Dubai',
        country: 'United Arab Emirates',
        timezone: 'UTC+4 (GST)',
        ianaTimezone: 'Asia/Dubai',
        lat: 25.2048,
        lng: 55.2708,
        description: '阿联酋最大城市,中东金融和科技中心。免税政策,基础设施先进,国际化程度高,气候炎热。',
        aliases: ['dxb']
    },

    'tel aviv': {
        name: 'Tel Aviv',
        country: 'Israel',
        timezone: 'UTC+2 (IST)',
        ianaTimezone: 'Asia/Jerusalem',
        lat: 32.0853,
        lng: 34.7818,
        description: '以色列科技之都,创业国度核心。创新创业氛围浓厚,网络安全和人工智能产业领先。',
        aliases: ['tlv']
    },

    'seattle': {
        name: 'Seattle',
        country: 'United States',
        timezone: 'UTC-8 (PST)',
        ianaTimezone: 'America/Los_Angeles',
        lat: 47.6062,
        lng: -122.3321,
        description: '美国西北部重要城市,亚马逊和微软总部所在地。科技产业发达,生活质量高,气候温和多雨。',
        aliases: ['sea']
    },

    'austin': {
        name: 'Austin',
        country: 'United States',
        timezone: 'UTC-6 (CST)',
        ianaTimezone: 'America/Chicago',
        lat: 30.2672,
        lng: -97.7431,
        description: '德克萨斯州首府,新兴科技中心。生活成本相对较低,创业氛围活跃,音乐文化丰富。',
        aliases: ['atx']
    },

    'boston': {
        name: 'Boston',
        country: 'United States',
        timezone: 'UTC-5 (EST)',
        ianaTimezone: 'America/New_York',
        lat: 42.3601,
        lng: -71.0589,
        description: '美国东北部重要城市,教育和科技中心。拥有哈佛、MIT等顶尖大学,生物科技和软件产业发达。',
        aliases: ['bos']
    },

    'delaware': {
        name: 'Delaware',
        country: 'United States',
        timezone: 'UTC-5 (EST)',
        ianaTimezone: 'America/New_York',
        lat: 38.9108,
        lng: -75.5277,
        description: '美国东海岸州份，商业注册和金融服务发达，靠近费城、纽约和华盛顿等东部城市群。',
        aliases: ['de state']
    },

    'wilmington': {
        name: 'Wilmington',
        country: 'United States',
        timezone: 'UTC-5 (EST)',
        ianaTimezone: 'America/New_York',
        lat: 39.7391,
        lng: -75.5398,
        description: '特拉华州最大城市，金融、商业服务和企业总部资源集中，位于美国东部时区。',
        aliases: ['wilmington de', 'wilmington delaware']
    },

    'los angeles': {
        name: 'Los Angeles',
        country: 'United States',
        timezone: 'UTC-8 (PST)',
        ianaTimezone: 'America/Los_Angeles',
        lat: 34.0522,
        lng: -118.2437,
        description: '美国西海岸重要城市，媒体、娱乐、科技和消费互联网产业活跃。',
        aliases: ['la', 'lax']
    },

    'san diego': {
        name: 'San Diego',
        country: 'United States',
        timezone: 'UTC-8 (PST)',
        ianaTimezone: 'America/Los_Angeles',
        lat: 32.7157,
        lng: -117.1611,
        description: '加州南部科技和生命科学城市，气候宜人，远程和混合办公机会较多。',
        aliases: ['sd']
    },

    'san jose': {
        name: 'San Jose',
        country: 'United States',
        timezone: 'UTC-8 (PST)',
        ianaTimezone: 'America/Los_Angeles',
        lat: 37.3382,
        lng: -121.8863,
        description: '硅谷核心城市之一，软件、硬件、云计算和半导体企业密集。',
        aliases: ['sj', 'san jose ca']
    },

    'mountain view': {
        name: 'Mountain View',
        country: 'United States',
        timezone: 'UTC-8 (PST)',
        ianaTimezone: 'America/Los_Angeles',
        lat: 37.3861,
        lng: -122.0839,
        description: '硅谷核心城市之一，拥有成熟的科技公司生态和工程人才密度。',
        aliases: ['mountain view ca']
    },

    'palo alto': {
        name: 'Palo Alto',
        country: 'United States',
        timezone: 'UTC-8 (PST)',
        ianaTimezone: 'America/Los_Angeles',
        lat: 37.4419,
        lng: -122.1430,
        description: '硅谷代表性城市，靠近斯坦福大学，创业和风险投资生态成熟。',
        aliases: ['palo alto ca']
    },

    'portland': {
        name: 'Portland',
        country: 'United States',
        timezone: 'UTC-8 (PST)',
        ianaTimezone: 'America/Los_Angeles',
        lat: 45.5152,
        lng: -122.6784,
        description: '美国西北部城市，软件、设计和创意产业活跃，远程工作文化友好。',
        aliases: ['portland or', 'pdx']
    },

    'denver': {
        name: 'Denver',
        country: 'United States',
        timezone: 'UTC-7 (MST)',
        ianaTimezone: 'America/Denver',
        lat: 39.7392,
        lng: -104.9903,
        description: '美国山地时区科技中心，云服务、企业软件和户外生活方式产业活跃。',
        aliases: ['den']
    },

    'chicago': {
        name: 'Chicago',
        country: 'United States',
        timezone: 'UTC-6 (CST)',
        ianaTimezone: 'America/Chicago',
        lat: 41.8781,
        lng: -87.6298,
        description: '美国中部最大城市，金融、企业服务、物流和软件产业基础深厚。',
        aliases: ['chi']
    },

    'atlanta': {
        name: 'Atlanta',
        country: 'United States',
        timezone: 'UTC-5 (EST)',
        ianaTimezone: 'America/New_York',
        lat: 33.7490,
        lng: -84.3880,
        description: '美国东南部商业和科技中心，企业软件、金融科技和媒体产业活跃。',
        aliases: ['atl']
    },

    'miami': {
        name: 'Miami',
        country: 'United States',
        timezone: 'UTC-5 (EST)',
        ianaTimezone: 'America/New_York',
        lat: 25.7617,
        lng: -80.1918,
        description: '美国东南部国际化城市，拉美业务、金融科技和远程工作社群活跃。',
        aliases: ['mia']
    },

    'washington dc': {
        name: 'Washington, DC',
        country: 'United States',
        timezone: 'UTC-5 (EST)',
        ianaTimezone: 'America/New_York',
        lat: 38.9072,
        lng: -77.0369,
        description: '美国首都，政策、公共事务、非营利组织和政府科技生态集中。',
        aliases: ['washington d.c.', 'dc', 'washington, dc']
    },

    'raleigh': {
        name: 'Raleigh',
        country: 'United States',
        timezone: 'UTC-5 (EST)',
        ianaTimezone: 'America/New_York',
        lat: 35.7796,
        lng: -78.6382,
        description: '北卡罗来纳州研究三角区核心城市，软件、生物科技和研发岗位集中。',
        aliases: ['raleigh nc']
    },

    'minneapolis': {
        name: 'Minneapolis',
        country: 'United States',
        timezone: 'UTC-6 (CST)',
        ianaTimezone: 'America/Chicago',
        lat: 44.9778,
        lng: -93.2650,
        description: '美国中北部商业中心，医疗、零售、金融服务和企业软件岗位较多。',
        aliases: ['msp']
    },

    'salt lake city': {
        name: 'Salt Lake City',
        country: 'United States',
        timezone: 'UTC-7 (MST)',
        ianaTimezone: 'America/Denver',
        lat: 40.7608,
        lng: -111.8910,
        description: '美国山地西部新兴科技中心，SaaS 和企业服务公司聚集。',
        aliases: ['slc']
    },

    'phoenix': {
        name: 'Phoenix',
        country: 'United States',
        timezone: 'UTC-7 (MST)',
        ianaTimezone: 'America/Phoenix',
        lat: 33.4484,
        lng: -112.0740,
        description: '美国西南部重要城市，半导体、运营中心和企业服务岗位持续增长。',
        aliases: ['phx']
    },

    'montreal': {
        name: 'Montreal',
        country: 'Canada',
        timezone: 'UTC-5 (EST)',
        ianaTimezone: 'America/Toronto',
        lat: 45.5017,
        lng: -73.5673,
        description: '加拿大重要科技和人工智能中心，游戏、AI 和软件工程生态成熟。',
        aliases: ['montréal', 'yul']
    },

    'ottawa': {
        name: 'Ottawa',
        country: 'Canada',
        timezone: 'UTC-5 (EST)',
        ianaTimezone: 'America/Toronto',
        lat: 45.4215,
        lng: -75.6972,
        description: '加拿大首都，公共部门科技、通信和企业软件岗位较多。',
        aliases: ['ott']
    },

    'calgary': {
        name: 'Calgary',
        country: 'Canada',
        timezone: 'UTC-7 (MST)',
        ianaTimezone: 'America/Edmonton',
        lat: 51.0447,
        lng: -114.0719,
        description: '加拿大西部商业中心，能源科技、金融和企业软件机会增长明显。',
        aliases: ['yyc']
    },

    'madrid': {
        name: 'Madrid',
        country: 'Spain',
        timezone: 'UTC+1 (CET)',
        ianaTimezone: 'Europe/Madrid',
        lat: 40.4168,
        lng: -3.7038,
        description: '西班牙首都，金融、企业服务和科技公司欧洲岗位集中。',
        aliases: ['mad']
    },

    'barcelona': {
        name: 'Barcelona',
        country: 'Spain',
        timezone: 'UTC+1 (CET)',
        ianaTimezone: 'Europe/Madrid',
        lat: 41.3874,
        lng: 2.1686,
        description: '欧洲热门科技和数字游民城市，产品、设计和工程岗位活跃。',
        aliases: ['bcn']
    },

    'lisbon': {
        name: 'Lisbon',
        country: 'Portugal',
        timezone: 'UTC+0 (WET)',
        ianaTimezone: 'Europe/Lisbon',
        lat: 38.7223,
        lng: -9.1393,
        description: '葡萄牙首都，欧洲远程工作和创业生态热门城市。',
        aliases: ['lisboa']
    },

    'stockholm': {
        name: 'Stockholm',
        country: 'Sweden',
        timezone: 'UTC+1 (CET)',
        ianaTimezone: 'Europe/Stockholm',
        lat: 59.3293,
        lng: 18.0686,
        description: '北欧科技中心，音乐科技、金融科技、游戏和消费互联网企业活跃。',
        aliases: ['sto']
    },

    'copenhagen': {
        name: 'Copenhagen',
        country: 'Denmark',
        timezone: 'UTC+1 (CET)',
        ianaTimezone: 'Europe/Copenhagen',
        lat: 55.6761,
        lng: 12.5683,
        description: '丹麦首都，设计、可持续科技和企业软件生态成熟。',
        aliases: ['københavn', 'cph']
    },

    'oslo': {
        name: 'Oslo',
        country: 'Norway',
        timezone: 'UTC+1 (CET)',
        ianaTimezone: 'Europe/Oslo',
        lat: 59.9139,
        lng: 10.7522,
        description: '挪威首都，能源科技、金融科技和可持续产业岗位较多。',
        aliases: ['osl']
    },

    'helsinki': {
        name: 'Helsinki',
        country: 'Finland',
        timezone: 'UTC+2 (EET)',
        ianaTimezone: 'Europe/Helsinki',
        lat: 60.1699,
        lng: 24.9384,
        description: '芬兰首都，游戏、移动互联网和工程文化成熟。',
        aliases: ['hel']
    },

    'zurich': {
        name: 'Zurich',
        country: 'Switzerland',
        timezone: 'UTC+1 (CET)',
        ianaTimezone: 'Europe/Zurich',
        lat: 47.3769,
        lng: 8.5417,
        description: '瑞士金融和科技中心，AI、金融科技和高端工程岗位集中。',
        aliases: ['zürich', 'zrh']
    },

    'vienna': {
        name: 'Vienna',
        country: 'Austria',
        timezone: 'UTC+1 (CET)',
        ianaTimezone: 'Europe/Vienna',
        lat: 48.2082,
        lng: 16.3738,
        description: '奥地利首都，欧洲中部高生活质量城市，软件和国际组织岗位较多。',
        aliases: ['wien']
    },

    'warsaw': {
        name: 'Warsaw',
        country: 'Poland',
        timezone: 'UTC+1 (CET)',
        ianaTimezone: 'Europe/Warsaw',
        lat: 52.2297,
        lng: 21.0122,
        description: '波兰首都，中东欧重要软件研发和共享服务中心。',
        aliases: ['warszawa', 'waw']
    },

    'prague': {
        name: 'Prague',
        country: 'Czech Republic',
        timezone: 'UTC+1 (CET)',
        ianaTimezone: 'Europe/Prague',
        lat: 50.0755,
        lng: 14.4378,
        description: '中欧科技和共享服务中心，生活质量高，国际公司岗位较多。',
        aliases: ['praha']
    },

    'melbourne': {
        name: 'Melbourne',
        country: 'Australia',
        timezone: 'UTC+10 (AEST)',
        ianaTimezone: 'Australia/Melbourne',
        lat: -37.8136,
        lng: 144.9631,
        description: '澳大利亚重要科技和创意产业城市，产品、设计和工程岗位活跃。',
        aliases: ['mel']
    },

    'brisbane': {
        name: 'Brisbane',
        country: 'Australia',
        timezone: 'UTC+10 (AEST)',
        ianaTimezone: 'Australia/Brisbane',
        lat: -27.4698,
        lng: 153.0251,
        description: '澳大利亚东海岸城市，科技、运营和亚太协作岗位逐渐增长。',
        aliases: ['bne']
    },

    'auckland': {
        name: 'Auckland',
        country: 'New Zealand',
        timezone: 'UTC+12 (NZST)',
        ianaTimezone: 'Pacific/Auckland',
        lat: -36.8485,
        lng: 174.7633,
        description: '新西兰最大城市，科技创业、产品和工程岗位集中。',
        aliases: ['akl']
    },

    'wellington': {
        name: 'Wellington',
        country: 'New Zealand',
        timezone: 'UTC+12 (NZST)',
        ianaTimezone: 'Pacific/Auckland',
        lat: -41.2865,
        lng: 174.7762,
        description: '新西兰首都，公共部门科技、创意和软件岗位较多。',
        aliases: ['wlg']
    },

    'seoul': {
        name: 'Seoul',
        country: 'South Korea',
        timezone: 'UTC+9 (KST)',
        ianaTimezone: 'Asia/Seoul',
        lat: 37.5665,
        lng: 126.9780,
        description: '韩国首都，游戏、消费电子、内容平台和互联网产业成熟。',
        aliases: ['sel', '서울']
    },

    'taipei': {
        name: 'Taipei',
        country: 'Taiwan',
        timezone: 'UTC+8 (CST)',
        ianaTimezone: 'Asia/Taipei',
        lat: 25.0330,
        lng: 121.5654,
        description: '台湾科技和商业中心，半导体、硬件、软件和跨境岗位活跃。',
        aliases: ['tpe', '台北']
    },

    'kuala lumpur': {
        name: 'Kuala Lumpur',
        country: 'Malaysia',
        timezone: 'UTC+8 (MYT)',
        ianaTimezone: 'Asia/Kuala_Lumpur',
        lat: 3.1390,
        lng: 101.6869,
        description: '马来西亚首都，东南亚区域运营、客户支持和科技岗位集中。',
        aliases: ['kl']
    },

    'ho chi minh city': {
        name: 'Ho Chi Minh City',
        country: 'Vietnam',
        timezone: 'UTC+7 (ICT)',
        ianaTimezone: 'Asia/Ho_Chi_Minh',
        lat: 10.8231,
        lng: 106.6297,
        description: '越南最大商业城市，软件外包、产品和跨境运营岗位活跃。',
        aliases: ['ho chi minh', 'saigon', 'hcmc']
    },

    'hanoi': {
        name: 'Hanoi',
        country: 'Vietnam',
        timezone: 'UTC+7 (ICT)',
        ianaTimezone: 'Asia/Ho_Chi_Minh',
        lat: 21.0278,
        lng: 105.8342,
        description: '越南首都，工程、运营和区域协作岗位持续增长。',
        aliases: ['han']
    },

    'manila': {
        name: 'Manila',
        country: 'Philippines',
        timezone: 'UTC+8 (PHT)',
        ianaTimezone: 'Asia/Manila',
        lat: 14.5995,
        lng: 120.9842,
        description: '菲律宾首都，BPO、客户支持、运营和远程协作岗位集中。',
        aliases: ['mnl']
    },

    'jakarta': {
        name: 'Jakarta',
        country: 'Indonesia',
        timezone: 'UTC+7 (WIB)',
        ianaTimezone: 'Asia/Jakarta',
        lat: -6.2088,
        lng: 106.8456,
        description: '印度尼西亚首都，东南亚互联网、金融科技和运营岗位活跃。',
        aliases: ['jkt']
    },

    'buenos aires': {
        name: 'Buenos Aires',
        country: 'Argentina',
        timezone: 'UTC-3 (ART)',
        ianaTimezone: 'America/Argentina/Buenos_Aires',
        lat: -34.6037,
        lng: -58.3816,
        description: '阿根廷首都，拉美重要科技和创意城市，与美国工作时区重叠度较高。',
        aliases: ['ba']
    },

    'bogota': {
        name: 'Bogotá',
        country: 'Colombia',
        timezone: 'UTC-5 (COT)',
        ianaTimezone: 'America/Bogota',
        lat: 4.7110,
        lng: -74.0721,
        description: '哥伦比亚首都，拉美科技、金融科技和远程协作岗位增长明显。',
        aliases: ['bogotá', 'bog']
    },

    'santiago': {
        name: 'Santiago',
        country: 'Chile',
        timezone: 'UTC-4 (CLT)',
        ianaTimezone: 'America/Santiago',
        lat: -33.4489,
        lng: -70.6693,
        description: '智利首都，拉美稳定的商业和创业中心，科技生态持续发展。',
        aliases: ['santiago chile', 'scl']
    },

    'cape town': {
        name: 'Cape Town',
        country: 'South Africa',
        timezone: 'UTC+2 (SAST)',
        ianaTimezone: 'Africa/Johannesburg',
        lat: -33.9249,
        lng: 18.4241,
        description: '南非重要科技和创意产业城市，远程工作和国际协作岗位较多。',
        aliases: ['cpt']
    },

    'lagos': {
        name: 'Lagos',
        country: 'Nigeria',
        timezone: 'UTC+1 (WAT)',
        ianaTimezone: 'Africa/Lagos',
        lat: 6.5244,
        lng: 3.3792,
        description: '尼日利亚最大城市，非洲金融科技和创业生态中心之一。',
        aliases: ['los']
    }
}

/**
 * 查找地点信息
 * @param query 地点查询字符串
 * @returns 地点数据或null
 */
export function findLocation(query: string): LocationData | null {
    if (!query) return null

    const normalized = query.toLowerCase().trim()

    // 直接匹配
    if (LOCATION_DATABASE[normalized]) {
        return LOCATION_DATABASE[normalized]
    }

    // 优先匹配更具体的地点名称，例如 "California, San Francisco" 应命中 San Francisco。
    const keyMatches = Object.entries(LOCATION_DATABASE)
        .filter(([key]) => normalized.includes(key))
        .sort(([a], [b]) => b.length - a.length)

    if (keyMatches.length > 0) {
        return keyMatches[0][1]
    }

    // 别名匹配 (Use stricter matching)
    for (const [key, data] of Object.entries(LOCATION_DATABASE)) {
        if (data.aliases.some(alias => {
            // Short aliases (<= 3 chars) must match exactly or be a distinct word
            if (alias.length <= 3) {
                const regex = new RegExp(`\\b${alias}\\b`, 'i');
                return normalized === alias || regex.test(normalized);
            }
            // Longer aliases can use includes
            return normalized.includes(alias) || alias.includes(normalized);
        })) {
            return data
        }
    }

    return null
}

/**
 * 获取所有地点列表
 */
export function getAllLocations(): LocationData[] {
    return Object.values(LOCATION_DATABASE)
}
