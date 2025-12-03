import { readAllRawItems, saveRawItems } from '../api-handlers/raw-rss.js';
import { saveAllJobs, writeJobsToNeon, NEON_CONFIGURED } from '../api-handlers/processed-jobs.js';
import { classifyJob, determineExperienceLevel, determineJobType, determineRegion, extractJobTags, extractRequirements } from '../services/classification-service.js';

export default async function handler(req, res) {
  try {
    console.log('[Cron:ProcessRSS] Starting...');

    // 1. Read Raw Items (Fetch only 'raw' items, increase limit to handle backlog)
    const rawItems = await readAllRawItems({ status: 'raw', limit: 500 });
    const newItems = rawItems; // Already filtered by DB query
    
    console.log(`[Cron:ProcessRSS] Found ${newItems.length} raw items to process.`);

    if (newItems.length === 0) {
      return res.status(200).json({ message: 'No new items to process' });
    }

    // 2. Process Items (Classify & Tag)
    const processedJobs = newItems.map(item => {
      const category = classifyJob(item.title, item.description);
      const experienceLevel = determineExperienceLevel(item.title, item.description);
      const jobType = determineJobType(item.title, item.description);
      const tags = extractJobTags(item.title, item.description);
      const requirements = extractRequirements(item.description);
      // Default location to Remote for RSS, but check title/desc in region determination
      const region = determineRegion('Remote', item.title, item.description);
      
      // Extract Company (Fallback if not in raw item)
      let company = item.company || 'Unknown Company';
      if (company === 'Unknown Company' || !company) {
          // Try to extract from title if not already done
          if (item.title.includes(':')) {
             company = item.title.split(':')[0].trim();
          } else if (item.title.includes(' at ')) {
             const parts = item.title.split(' at ');
             if (parts.length > 1) company = parts[parts.length - 1].trim();
          } else if (item.title.includes(' | ')) {
             const parts = item.title.split(' | ');
             if (parts.length > 1) company = parts[parts.length - 1].trim();
          }
      }

      // Map Raw Item to Processed Job Structure
      return {
        id: item.id, // Use same ID to link them
        title: item.title,
        company: company, 
        location: 'Remote', // Default for RSS
        description: item.description,
        url: item.link,
        publishedAt: item.pubDate,
        source: item.source,
        category: category, // AI Classified
        salary: null,
        jobType: jobType,
        experienceLevel: experienceLevel, // AI Classified
        tags: tags, 
        requirements: requirements,
        benefits: [],
        isRemote: true,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        region: region,
        sourceType: 'rss',
        isTrusted: false,
        canRefer: false,
        isTranslated: false // Mark for translation
      };
    });

    // 3. Save to Processed Jobs DB
    // Use upsert mode (append) instead of read-all-and-replace to avoid data loss due to pagination limits
    let saved = [];
    if (NEON_CONFIGURED) {
        saved = await writeJobsToNeon(processedJobs, 'upsert');
    } else {
        // Fallback for other storage methods
        saved = await saveAllJobs(processedJobs);
    }
    
    console.log(`[Cron:ProcessRSS] Saved ${saved.length} new jobs.`);

    // 4. Update Raw Items Status
    const updatedRawItems = rawItems.map(item => {
      if (!item.status || item.status === 'raw') {
        return { ...item, status: 'processed' };
      }
      return item;
    });
    
    await saveRawItems(updatedRawItems, 'append');
    console.log('[Cron:ProcessRSS] Updated raw items status.');

    return res.status(200).json({ 
      success: true, 
      processed: processedJobs.length 
    });

  } catch (error) {
    console.error('[Cron:ProcessRSS] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
