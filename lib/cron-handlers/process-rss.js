import { readAllRawItems, saveRawItems } from '../api-handlers/raw-rss.js';
import { saveAllJobs } from '../api-handlers/processed-jobs.js';
import { classifyJob, determineExperienceLevel } from '../services/classification-service.js';

// Helper to clean company name
function extractCompany(title, description) {
  // Common patterns: "Role at Company", "Company: Role", "Role - Company"
  const atPattern = /\s+at\s+([^(\-|,)]+)/i;
  const colonPattern = /^([^:]+):\s/;
  const dashPattern = /\s+-\s+([^-]+)$/;

  let company = 'Unknown Company';
  
  // Try extracting from Title first (most reliable)
  const atMatch = title.match(atPattern);
  if (atMatch && atMatch[1].length < 50) return atMatch[1].trim();

  const colonMatch = title.match(colonPattern);
  if (colonMatch && colonMatch[1].length < 50) return colonMatch[1].trim();

  const dashMatch = title.match(dashPattern);
  if (dashMatch && dashMatch[1].length < 50) return dashMatch[1].trim();

  return company;
}

export default async function handler(req, res) {
  try {
    console.log('[Cron:ProcessRSS] Starting...');

    // 1. Read Raw Items (Only unprocessed)
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
      const company = extractCompany(item.title, item.description);
      
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

    // 3. Save to Processed Jobs DB (UPSERT MODE)
    // Optimized: Only send new items, let DB handle upsert
    const saved = await saveAllJobs(processedJobs, 'upsert');
    
    console.log(`[Cron:ProcessRSS] Saved ${saved.length} jobs (processed ${processedJobs.length} new).`);

    // 4. Update Raw Items Status
    const updatedRawItems = newItems.map(item => ({
      ...item,
      status: 'processed'
    }));
    
    // Only update the items we processed
    if (updatedRawItems.length > 0) {
      await saveRawItems(updatedRawItems, 'append'); // 'append' maps to upsert in raw-rss logic
      console.log('[Cron:ProcessRSS] Updated raw items status.');
    }

    return res.status(200).json({ 
      success: true, 
      processed: processedJobs.length 
    });

  } catch (error) {
    console.error('[Cron:ProcessRSS] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
