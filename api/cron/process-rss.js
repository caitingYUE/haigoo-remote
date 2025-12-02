import { readAllRawItems, saveRawItems } from '../../lib/api-handlers/raw-rss.js';
import { saveAllJobs, getAllJobs } from '../../lib/api-handlers/processed-jobs.js';
import { classifyJob, determineExperienceLevel } from '../../lib/services/classification-service.js';

export default async function handler(req, res) {
  try {
    console.log('[Cron:ProcessRSS] Starting...');

    // 1. Read Raw Items
    const rawItems = await readAllRawItems();
    const newItems = rawItems.filter(i => !i.status || i.status === 'raw');
    
    console.log(`[Cron:ProcessRSS] Found ${newItems.length} raw items to process.`);

    if (newItems.length === 0) {
      return res.status(200).json({ message: 'No new items to process' });
    }

    // 2. Process Items (Classify & Tag)
    const processedJobs = newItems.map(item => {
      const category = classifyJob(item.title, item.description);
      const experienceLevel = determineExperienceLevel(item.title, item.description);
      
      // Map Raw Item to Processed Job Structure
      return {
        id: item.id, // Use same ID to link them
        title: item.title,
        company: 'Unknown Company', // RSS often misses company name, need to extract if possible or leave for enrichment
        location: 'Remote', // Default for RSS
        description: item.description,
        url: item.link,
        publishedAt: item.pubDate,
        source: item.source,
        category: category, // AI Classified
        salary: null,
        jobType: 'full-time', // Default
        experienceLevel: experienceLevel, // AI Classified
        tags: [], // Can implement Tag extraction here if needed
        requirements: [],
        benefits: [],
        isRemote: true,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        region: 'overseas', // Default for WeWorkRemotely etc.
        sourceType: 'rss',
        isTrusted: false,
        canRefer: false,
        isTranslated: false // Mark for translation
      };
    });

    // 3. Save to Processed Jobs DB
    // We need to merge with existing jobs to avoid overwriting
    const existingJobs = await getAllJobs();
    // Note: saveAllJobs handles deduplication internally
    const saved = await saveAllJobs([...existingJobs, ...processedJobs]);
    
    console.log(`[Cron:ProcessRSS] Saved ${saved.length} total jobs (processed ${processedJobs.length} new).`);

    // 4. Update Raw Items Status
    const updatedRawItems = rawItems.map(item => {
      if (!item.status || item.status === 'raw') {
        return { ...item, status: 'processed' };
      }
      return item;
    });
    
    await saveRawItems(updatedRawItems, 'replace');
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
