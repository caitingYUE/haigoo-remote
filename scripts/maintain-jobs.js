
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

async function cleanAndFix() {
  console.log('🚀 Starting Job Maintenance...');

  try {
    // 1. Fetch all jobs
    console.log('📥 Fetching all jobs...');
    const result = await neonHelper.query('SELECT job_id, title, company, location, region, published_at FROM jobs ORDER BY published_at DESC');
    const jobs = result || [];
    console.log(`✅ Fetched ${jobs.length} jobs.`);

    // 2. Identify Duplicates (Same Title + Same Company)
    console.log('🔍 Identifying duplicates...');
    const uniqueMap = new Map();
    const duplicates = [];

    for (const job of jobs) {
      // Create a key based on normalized title and company
      const key = `${(job.title || '').toLowerCase().trim()}|${(job.company || '').toLowerCase().trim()}`;
      
      if (uniqueMap.has(key)) {
        duplicates.push(job.job_id);
      } else {
        uniqueMap.set(key, job);
      }
    }

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

    // 4. Re-classify Regions
    console.log('🌍 Re-classifying regions...');
    let updatedCount = 0;
    const updates = [];

    // Use the remaining unique jobs
    const uniqueJobs = Array.from(uniqueMap.values());

    for (const job of uniqueJobs) {
      const newRegion = classifyRegion(job.location);
      if (newRegion !== job.region) {
        updates.push({ id: job.job_id, region: newRegion, old: job.region, loc: job.location });
      }
    }

    console.log(`Found ${updates.length} jobs requiring region update.`);

    if (updates.length > 0) {
      console.log('💾 Updating database regions...');
      // Batch update
      // Since SQL doesn't support massive bulk updates easily without complex query construction,
      // we'll loop sequentially for simplicity in this script, or use small transactions.
      // For 400 jobs, sequential is fine.
      
      let processed = 0;
      for (const update of updates) {
        await neonHelper.query('UPDATE jobs SET region = $1 WHERE job_id = $2', [update.region, update.id]);
        processed++;
        if (processed % 50 === 0) process.stdout.write('.');
      }
      console.log('\n✅ Regions updated.');
      
      // Log some examples
      console.log('Sample updates:');
      updates.slice(0, 5).forEach(u => {
        console.log(`   Job ${u.id}: "${u.loc}" ${u.old} -> ${u.region}`);
      });
    }

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    process.exit();
  }
}

cleanAndFix();
