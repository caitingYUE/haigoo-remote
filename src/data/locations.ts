export interface LocationData {
    name: string
    country: string
    timezone: string
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
        lat: 0,
        lng: 0,
        description: '远程工作,可在任何地点工作。通常需要在特定时区内保持工作时间,具体要求因公司而异。',
        aliases: ['anywhere', 'worldwide', 'global', 'work from anywhere']
    },

    // United States - Major Tech Hubs
    'california': {
        name: 'California',
        country: 'United States',
        timezone: 'UTC-8 (PST)',
        lat: 36.7783,
        lng: -119.4179,
        description: '美国西海岸最大的州,全球科技产业中心。包括硅谷、旧金山、洛杉矶等主要城市,是众多科技巨头和创业公司的总部所在地。',
        aliases: ['ca', 'calif']
    },

    'san francisco': {
        name: 'San Francisco',
        country: 'United States',
        timezone: 'UTC-8 (PST)',
        lat: 37.7749,
        lng: -122.4194,
        description: '美国西海岸重要城市,硅谷核心区域。众多科技公司总部所在地,创新创业氛围浓厚,生活成本较高。',
        aliases: ['sf', 'san fran', 'frisco']
    },

    'new york': {
        name: 'New York',
        country: 'United States',
        timezone: 'UTC-5 (EST)',
        lat: 40.7128,
        lng: -74.0060,
        description: '美国最大城市,全球金融中心。科技、金融、媒体等行业发达,生活节奏快,机会众多。',
        aliases: ['ny', 'nyc', 'new york city']
    },

    'seattle': {
        name: 'Seattle',
        country: 'United States',
        timezone: 'UTC-8 (PST)',
        lat: 47.6062,
        lng: -122.3321,
        description: '美国西北部重要城市,亚马逊和微软总部所在地。科技产业发达,生活质量高,气候温和多雨。',
        aliases: ['sea']
    },

    'austin': {
        name: 'Austin',
        country: 'United States',
        timezone: 'UTC-6 (CST)',
        lat: 30.2672,
        lng: -97.7431,
        description: '德克萨斯州首府,新兴科技中心。生活成本相对较低,创业氛围活跃,音乐文化丰富。',
        aliases: ['atx']
    },

    'boston': {
        name: 'Boston',
        country: 'United States',
        timezone: 'UTC-5 (EST)',
        lat: 42.3601,
        lng: -71.0589,
        description: '美国东北部重要城市,教育和科技中心。拥有哈佛、MIT等顶尖大学,生物科技和软件产业发达。',
        aliases: ['bos']
    },

    // Europe
    'london': {
        name: 'London',
        country: 'United Kingdom',
        timezone: 'UTC+0 (GMT)',
        lat: 51.5074,
        lng: -0.1278,
        description: '英国首都,欧洲金融和科技中心。国际化程度高,科技创业生态系统成熟,生活成本较高。',
        aliases: ['ldn', 'uk']
    },

    'berlin': {
        name: 'Berlin',
        country: 'Germany',
        timezone: 'UTC+1 (CET)',
        lat: 52.5200,
        lng: 13.4050,
        description: '德国首都,欧洲创业之都。生活成本相对较低,文化多元,创业氛围活跃,吸引大量国际人才。',
        aliases: ['ber']
    },

    'amsterdam': {
        name: 'Amsterdam',
        country: 'Netherlands',
        timezone: 'UTC+1 (CET)',
        lat: 52.3676,
        lng: 4.9041,
        description: '荷兰首都,欧洲科技中心之一。英语普及率高,生活质量优秀,对国际人才友好,自行车文化盛行。',
        aliases: ['ams']
    },

    'paris': {
        name: 'Paris',
        country: 'France',
        timezone: 'UTC+1 (CET)',
        lat: 48.8566,
        lng: 2.3522,
        description: '法国首都,欧洲重要科技中心。文化底蕴深厚,科技创业生态不断发展,生活成本较高。',
        aliases: ['par']
    },

    'dublin': {
        name: 'Dublin',
        country: 'Ireland',
        timezone: 'UTC+0 (GMT)',
        lat: 53.3498,
        lng: -6.2603,
        description: '爱尔兰首都,欧洲科技公司欧洲总部首选地。税收优惠,英语环境,众多科技巨头设有欧洲总部。',
        aliases: ['dub']
    },

    // Asia-Pacific
    'singapore': {
        name: 'Singapore',
        country: 'Singapore',
        timezone: 'UTC+8 (SGT)',
        lat: 1.3521,
        lng: 103.8198,
        description: '亚洲金融和科技中心,国际化程度极高。政治稳定,基础设施完善,税收优惠,是众多跨国公司亚太总部所在地。',
        aliases: ['sg', 'sgp']
    },

    'hong kong': {
        name: 'Hong Kong',
        country: 'China',
        timezone: 'UTC+8 (HKT)',
        lat: 22.3193,
        lng: 114.1694,
        description: '中国特别行政区,国际金融中心。东西方文化交汇,金融和科技产业发达,生活成本高。',
        aliases: ['hk', 'hongkong']
    },

    'tokyo': {
        name: 'Tokyo',
        country: 'Japan',
        timezone: 'UTC+9 (JST)',
        lat: 35.6762,
        lng: 139.6503,
        description: '日本首都,亚洲最大城市之一。科技产业发达,生活质量高,但生活成本较高,语言可能是挑战。',
        aliases: ['tyo']
    },

    'sydney': {
        name: 'Sydney',
        country: 'Australia',
        timezone: 'UTC+10 (AEST)',
        lat: -33.8688,
        lng: 151.2093,
        description: '澳大利亚最大城市,科技和金融中心。生活质量高,气候宜人,但与其他时区时差较大。',
        aliases: ['syd']
    },

    'beijing': {
        name: 'Beijing',
        country: 'China',
        timezone: 'UTC+8 (CST)',
        lat: 39.9042,
        lng: 116.4074,
        description: '中国首都,政治和文化中心。科技产业快速发展,众多互联网公司总部所在地,生活成本逐年上升。',
        aliases: ['bj', '北京']
    },

    'shanghai': {
        name: 'Shanghai',
        country: 'China',
        timezone: 'UTC+8 (CST)',
        lat: 31.2304,
        lng: 121.4737,
        description: '中国最大城市,国际金融中心。经济发达,国际化程度高,科技和金融产业蓬勃发展。',
        aliases: ['sh', '上海']
    },

    'shenzhen': {
        name: 'Shenzhen',
        country: 'China',
        timezone: 'UTC+8 (CST)',
        lat: 22.5431,
        lng: 114.0579,
        description: '中国科技创新中心,硅谷之称。众多科技公司总部,创业氛围浓厚,年轻化程度高。',
        aliases: ['sz', '深圳']
    },

    'bangalore': {
        name: 'Bangalore',
        country: 'India',
        timezone: 'UTC+5:30 (IST)',
        lat: 12.9716,
        lng: 77.5946,
        description: '印度硅谷,IT产业中心。众多跨国公司研发中心,生活成本相对较低,科技人才丰富。',
        aliases: ['bengaluru', 'blr']
    },

    // Canada
    'toronto': {
        name: 'Toronto',
        country: 'Canada',
        timezone: 'UTC-5 (EST)',
        lat: 43.6532,
        lng: -79.3832,
        description: '加拿大最大城市,金融和科技中心。多元文化,生活质量高,对移民友好,科技产业快速发展。',
        aliases: ['yyz', 'to']
    },

    'vancouver': {
        name: 'Vancouver',
        country: 'Canada',
        timezone: 'UTC-8 (PST)',
        lat: 49.2827,
        lng: -123.1207,
        description: '加拿大西海岸城市,科技和影视产业中心。自然环境优美,生活质量高,亚洲移民较多。',
        aliases: ['yvr']
    },

    // Latin America
    'sao paulo': {
        name: 'São Paulo',
        country: 'Brazil',
        timezone: 'UTC-3 (BRT)',
        lat: -23.5505,
        lng: -46.6333,
        description: '巴西最大城市,拉丁美洲金融和科技中心。经济发达,创业生态活跃,葡萄牙语为主要语言。',
        aliases: ['sao', 'sp']
    },

    'mexico city': {
        name: 'Mexico City',
        country: 'Mexico',
        timezone: 'UTC-6 (CST)',
        lat: 19.4326,
        lng: -99.1332,
        description: '墨西哥首都,拉丁美洲重要城市。科技产业发展迅速,生活成本相对较低,靠近美国市场。',
        aliases: ['cdmx', 'mexico']
    },

    // Middle East
    'dubai': {
        name: 'Dubai',
        country: 'United Arab Emirates',
        timezone: 'UTC+4 (GST)',
        lat: 25.2048,
        lng: 55.2708,
        description: '阿联酋最大城市,中东金融和科技中心。免税政策,基础设施先进,国际化程度高,气候炎热。',
        aliases: ['dxb']
    },

    'tel aviv': {
        name: 'Tel Aviv',
        country: 'Israel',
        timezone: 'UTC+2 (IST)',
        lat: 32.0853,
        lng: 34.7818,
        description: '以色列科技之都,创业国度核心。创新创业氛围浓厚,网络安全和人工智能产业领先。',
        aliases: ['tlv']
    },
    // South America
    'argentina': {
        name: 'Argentina',
        country: 'Argentina',
        timezone: 'UTC-3 (ART)',
        lat: -34.6037,
        lng: -58.3816,
        description: '南美洲第二大国，拥有高素质的科技人才库。时区与美国接近，英语普及率较高，是远程工作的热门选择。',
        aliases: ['ar', 'arg']
    },

    'colombia': {
        name: 'Colombia',
        country: 'Colombia',
        timezone: 'UTC-5 (COT)',
        lat: 4.7110,
        lng: -74.0721,
        description: '南美洲西北部国家，科技产业发展迅速。麦德林和波哥大是主要的科技中心，与美国东部时区相同。',
        aliases: ['co', 'col']
    },

    'brazil': {
        name: 'Brazil',
        country: 'Brazil',
        timezone: 'UTC-3 (BRT)',
        lat: -14.2350,
        lng: -51.9253,
        description: '南美洲最大国家，拥有庞大的开发者社区。科技生态系统成熟，众多独角兽企业诞生于此。',
        aliases: ['br', 'brasil']
    },

    // Asia
    'philippines': {
        name: 'Philippines',
        country: 'Philippines',
        timezone: 'UTC+8 (PHT)',
        lat: 12.8797,
        lng: 121.7740,
        description: '东南亚群岛国家，英语为官方语言之一。BPO产业极度发达，拥有大量优秀的虚拟助理和远程支持人才。',
        aliases: ['ph', 'phil']
    },

    'india': {
        name: 'India',
        country: 'India',
        timezone: 'UTC+5:30 (IST)',
        lat: 20.5937,
        lng: 78.9629,
        description: '全球最大的IT外包和软件开发中心之一。拥有庞大的工程人才库，班加罗尔被誉为"亚洲硅谷"。',
        aliases: ['in', 'ind']
    },

    // Europe
    'germany': {
        name: 'Germany',
        country: 'Germany',
        timezone: 'UTC+1 (CET)',
        lat: 51.1657,
        lng: 10.4515,
        description: '欧洲最大经济体，工程和制造业强国。柏林是欧洲主要的初创企业中心，吸引了全球科技人才。',
        aliases: ['de', 'deu', 'deutschland']
    },

    'united kingdom': {
        name: 'United Kingdom',
        country: 'United Kingdom',
        timezone: 'UTC+0 (GMT)',
        lat: 55.3781,
        lng: -3.4360,
        description: '全球金融和科技中心之一。伦敦拥有世界级的科技生态系统，金融科技(FinTech)尤为发达。',
        aliases: ['uk', 'gb', 'britain']
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

    // 别名匹配
    for (const [key, data] of Object.entries(LOCATION_DATABASE)) {
        if (data.aliases.some(alias => normalized.includes(alias) || alias.includes(normalized))) {
            return data
        }
    }

    // 模糊匹配(包含关系)
    for (const [key, data] of Object.entries(LOCATION_DATABASE)) {
        if (normalized.includes(key) || key.includes(normalized)) {
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
