
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

// Dynamic import to ensure env vars are loaded first
const { default: neonHelper } = await import('../server-utils/dal/neon-helper.js');

// Copy of the improved classifyRegion function
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

    // 亚洲其他(明确海外)
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
    'kuwait', // 科威特

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

  // 优先级分类逻辑
  
  // 1. 中国/大中华区 - 绝对的国内可申
  // 如果同时包含海外关键词(如 "US or China")，则视为 'both'，否则 'domestic'
  if (isMainland || isGreaterChina) {
    // 如果同时有海外或全球属性，标记为 both 以便在海外列表也能看到
    if (isOverseas || isGlobal || isAPAC) {
      return 'both'
    }
    return 'domestic'
  }

  // 2. APAC/亚太时区 - 用户指定归为"中国可申"
  // 通常亚太也包含海外属性，所以归为 'both' (既在中国可申列表，也在海外列表)
  if (isAPAC) {
    return 'both'
  }

  // 3. 明确的海外地点 - 归为海外
  // 必须放在 APAC 之后，因为 APAC 即使包含 Singapore (Overseas) 也要算作可申
  // 必须放在 Global 之前，因为 "Remote - US" 应该算 Overseas 而不是 Both
  if (isOverseas) {
    return 'overseas'
  }

  // 4. Global/Remote/Anywhere - 归为"中国可申" (Both)
  if (isGlobal) {
    return 'both' 
  }

  // 默认: 如果完全无法判断，归为海外
  return 'overseas'
}

async function cleanAndFix() {
  console.log('🚀 Starting Job Maintenance...');

  try {
    // 1. Fetch all jobs
    console.log('📥 Fetching all jobs...');
    const result = await neonHelper.query('SELECT job_id, title, company, location, region, published_at, can_refer, is_trusted, source_type, url FROM jobs ORDER BY published_at DESC');
    const jobs = result || [];
    console.log(`✅ Fetched ${jobs.length} jobs.`);

    // 2. Identify Duplicates (Same Title + Same Company)
    console.log('🔍 Identifying duplicates...');
    const uniqueMap = new Map();
    const duplicates = [];

    // Also build company stats
    const companyStats = new Map();

    for (const job of jobs) {
      // Create a key based on normalized title and company
      const key = `${(job.title || '').toLowerCase().trim()}|${(job.company || '').toLowerCase().trim()}`;
      
      if (uniqueMap.has(key)) {
        duplicates.push(job.job_id);
      } else {
        uniqueMap.set(key, job);
        
        // Update company stats
        if (job.company) {
            const companyKey = job.company.toLowerCase().trim();
            const current = companyStats.get(companyKey) || { isTrusted: false, canRefer: false };
            companyStats.set(companyKey, {
                isTrusted: current.isTrusted || job.is_trusted,
                canRefer: current.canRefer || job.can_refer
            });
        }
      }
    }
    
    // Explicitly set Bluente as Trusted + Referral
    companyStats.set('bluente', { isTrusted: true, canRefer: true });

    console.log(`Found ${duplicates.length} duplicate jobs to delete.`);

    // 3. Delete Duplicates
    if (duplicates.length > 0) {
      console.log('🗑️ Deleting duplicates...');
      // Process in batches of 50
      const batchSize = 50;
      for (let i = 0; i < duplicates.length; i += batchSize) {
        const batch = duplicates.slice(i, i + batchSize);
        const placeholders = batch.map((_, idx) => `$${idx + 1}`).join(',');
        await neonHelper.query(`DELETE FROM jobs WHERE job_id IN (${placeholders})`, batch);
        console.log(`   Deleted batch ${i/batchSize + 1} (${batch.length} jobs)`);
      }
      console.log('✅ Duplicates deleted.');
    }

    // 4. Re-classify Regions & Update SourceType
    console.log('🌍 Re-classifying regions & Backfilling SourceType...');
    let updatedCount = 0;
    const updates = [];

    // Use the remaining unique jobs
    const uniqueJobs = Array.from(uniqueMap.values());

    for (const job of uniqueJobs) {
      const newRegion = classifyRegion(job.location);
      
      // Determine SourceType
      let newSourceType = job.source_type;
      
      const isOfficialLink = (url, company) => {
         if (!url || !company) return false;
         const cleanCompany = company.toLowerCase().replace(/\s+/g, '');
         try {
            const domain = new URL(url).hostname.toLowerCase();
            // Simple heuristic: domain contains company name, or is a known ATS (greenhouse, lever, ashby)
            // If it's a known aggregator (indeed, linkedin, glassdoor), it's third-party.
            const aggregators = ['indeed', 'linkedin', 'glassdoor', 'simplyhired', 'ziprecruiter', 'seek', 'remoteok', 'weworkremotely'];
            if (aggregators.some(agg => domain.includes(agg))) return false;
            
            // Known ATS are considered "Official" for the company
            const ats = ['greenhouse', 'lever', 'ashby', 'workable', 'breezy', 'recruitee', 'smartrecruiters', 'myworkdayjobs', 'icims', 'jobvite'];
            if (ats.some(platform => domain.includes(platform))) return true;

            // Direct domain match
            if (domain.includes(cleanCompany)) return true;
            
            return false; 
         } catch (e) {
            return false;
         }
      }

      const isUrlOfficial = isOfficialLink(job.url, job.company);
      
      // Get company trusted status from map
      const companyKey = (job.company || '').toLowerCase().trim();
      const companyInfo = companyStats.get(companyKey) || { isTrusted: false, canRefer: false };
      const isCompanyTrusted = companyInfo.isTrusted;
      const isCompanyReferral = companyInfo.canRefer;

      // Rule Implementation
      if (newSourceType === 'rss' || newSourceType === 'third-party' || !newSourceType) {
         // If it's a Trusted Company AND the link is Official (not an aggregator), we promote it!
         if (isCompanyTrusted && isUrlOfficial) {
            if (isCompanyReferral) {
               newSourceType = 'club-referral';
            } else {
               newSourceType = 'trusted';
            }
         } else {
            // If explicitly RSS/Third-party or unknown, and NOT official trusted link -> Third-party
            newSourceType = 'third-party';
         }
      } else {
         // Existing type is likely club-referral or trusted
         // Re-verify based on current company status + URL
         if (isCompanyReferral) {
             newSourceType = 'club-referral';
         } else if (isCompanyTrusted) {
             if (isUrlOfficial) {
                 newSourceType = 'trusted';
             } else {
                 newSourceType = 'third-party'; 
             }
         }
      }

      // Enforce exclusivity for third-party logic and update flags based on sourceType
      let newIsTrusted = job.is_trusted;
      let newCanRefer = job.can_refer;
      
      if (newSourceType === 'third-party') {
         newIsTrusted = false;
         newCanRefer = false;
      } else if (newSourceType === 'club-referral') {
         newCanRefer = true;
         newIsTrusted = true;
      } else if (newSourceType === 'trusted') {
         newIsTrusted = true;
         newCanRefer = false;
      }

      // Check if update is needed
      if (newRegion !== job.region || newSourceType !== job.source_type || newIsTrusted !== job.is_trusted || newCanRefer !== job.can_refer) {
        updates.push({ 
          id: job.job_id, 
          region: newRegion, 
          sourceType: newSourceType,
          isTrusted: newIsTrusted,
          canRefer: newCanRefer,
          oldRegion: job.region,
          oldSourceType: job.source_type
        });
      }
    }

    console.log(`Found ${updates.length} jobs requiring update.`);

    if (updates.length > 0) {
      console.log('💾 Updating database...');
      let processed = 0;
      for (const update of updates) {
        await neonHelper.query(
          'UPDATE jobs SET region = $1, source_type = $2, is_trusted = $3, can_refer = $4 WHERE job_id = $5', 
          [update.region, update.sourceType, update.isTrusted, update.canRefer, update.id]
        );
        processed++;
        if (processed % 50 === 0) process.stdout.write('.');
      }
      console.log('\n✅ Jobs updated.');
    }

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    process.exit();
  }
}

cleanAndFix();
