
import * as cheerio from 'cheerio';

/**
 * RSS Parser Service
 * Migrated from frontend src/services/rss-service.ts to backend
 */

/**
 * Clean HTML description
 */
function cleanDescription(html) {
  if (!html) return '';
  // Remove script and style tags
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!\[CDATA\[/gi, '')
    .replace(/\]\]>/gi, '');

  // Remove event handlers
  cleaned = cleaned.replace(/ on\w+="[^"]*"/g, '');

  // Simple tag stripping for text extraction if needed, but we usually keep HTML for description
  // cleaned = cleaned.replace(/<[^>]+>/g, ' '); 

  return cleaned.trim();
}

/**
 * Extract company name from title/description/url
 */
function extractCompany(title, description, url) {
  // 1. Try URL Extraction (Himalayas) - Most Reliable for this source
  if (url && url.includes('himalayas.app/companies/')) {
    const himalayasUrlPattern = /himalayas\.app\/companies\/([^\/]+)/;
    const urlMatch = url.match(himalayasUrlPattern);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }

  // 2. Common patterns: "Role at Company", "Company: Role", "Role - Company"
  const atPattern = /\s+at\s+([^(\-|,)]+)/i;
  const colonPattern = /^([^:]+):\s/;
  const dashPattern = /\s+-\s+([^-]+)$/;

  // Try extracting from Title first (most reliable)
  const atMatch = title.match(atPattern);
  if (atMatch && atMatch[1].length < 50) return atMatch[1].trim();

  const colonMatch = title.match(colonPattern);
  if (colonMatch && colonMatch[1].length < 50) return colonMatch[1].trim();

  const dashMatch = title.match(dashPattern);
  if (dashMatch && dashMatch[1].length < 50) return dashMatch[1].trim();

  // 3. Fallback: Check description for "About [Company]" pattern
  if (description) {
    // HTML Pattern (Himalayas uses this consistently)
    const aboutLinkPattern = /About\s*<a[^>]*>([^<]+)<\/a>/i;
    const aboutLinkMatch = description.match(aboutLinkPattern);
    if (aboutLinkMatch && aboutLinkMatch[1].length < 100) return aboutLinkMatch[1].trim();

    // Plain Text Pattern
    const aboutTextPattern = /About\s+([A-Z][a-zA-Z0-9 &,.]{1,50})(?:\s+is|\s+was|\n|\.|:)/;
    const aboutTextMatch = description.match(aboutTextPattern);
    if (aboutTextMatch && aboutTextMatch[1] && !aboutTextMatch[1].toLowerCase().includes('the role')) {
      return aboutTextMatch[1].trim();
    }
  }

  return '';
}

/**
 * Extract location from text
 */
function extractLocation(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  
  if (text.includes('remote') || text.includes('work from home') || text.includes('wfh')) {
    return 'Remote';
  }
  
  // Basic location extraction regex (simplified)
  const locPattern = /(?:location|based in|remote from):\s*([^<.,]+)/i;
  const match = description.match(locPattern);
  if (match && match[1]) {
    return match[1].trim();
  }

  return 'Remote'; // Default to Remote for this niche
}

/**
 * Extract Job Type
 */
function extractJobType(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  if (text.includes('contract') || text.includes('freelance')) return 'Contract';
  if (text.includes('part-time') || text.includes('part time')) return 'Part-time';
  if (text.includes('internship') || text.includes('intern')) return 'Internship';
  return 'Full-time'; // Default
}

/**
 * Extract Experience Level
 */
function extractExperienceLevel(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  if (text.includes('senior') || text.includes('sr.') || text.includes('lead') || text.includes('principal')) return 'Senior';
  if (text.includes('junior') || text.includes('jr.') || text.includes('entry level') || text.includes('intern')) return 'Entry';
  if (text.includes('mid') || text.includes('intermediate')) return 'Mid';
  if (text.includes('executive') || text.includes('vp') || text.includes('director') || text.includes('head of')) return 'Executive';
  return 'Mid'; // Default
}

/**
 * Parse WeWorkRemotely item
 */
function parseWeWorkRemotely($, item, title, description) {
  const $item = $(item);
  const region = $item.find('region').text().trim();
  const country = $item.find('country').text().trim();
  const state = $item.find('state').text().trim();
  const type = $item.find('type').text().trim();
  const skillsText = $item.find('skills').text().trim();
  
  const skills = skillsText 
    ? skillsText.split(/[\,\|\/]\s*/).map(s => s.trim()).filter(s => s.length > 0)
    : [];

  let company = '';
  let cleanTitle = title;
  const titleMatch = title.match(/^([^:]+):\s*(.+)$/);
  if (titleMatch) {
    company = titleMatch[1].trim();
    cleanTitle = titleMatch[2].trim();
  }

  let location = '';
  if (region && country) {
    location = `${region}, ${country}`;
  } else if (country) {
    location = country.replace(/🇺🇸|🇬🇧|🇨🇦|🇦🇺|🇩🇪|🇫🇷|🇪🇸|🇮🇹|🇳🇱|🇸🇪|🇳🇴|🇩🇰|🇫🇮/g, '').trim();
  }
  if (state) {
    location = location ? `${location}, ${state}` : state;
  }

  let jobType = '';
  if (type) {
    jobType = type.toLowerCase().includes('full') ? 'Full-time' :
      type.toLowerCase().includes('part') ? 'Part-time' :
        type.toLowerCase().includes('contract') ? 'Contract' : type;
  }

  let remoteLocationRestriction = '';
  if (country) {
    const countryName = country.replace(/🇺🇸|🇬🇧|🇨🇦|🇦🇺|🇩🇪|🇫🇷|🇪🇸|🇮🇹|🇳🇱|🇸🇪|🇳🇴|🇩🇰|🇫🇮/g, '').trim();
    if (countryName && countryName !== 'Worldwide') {
      remoteLocationRestriction = `仅限${countryName}`;
    } else if (countryName === 'Worldwide') {
      remoteLocationRestriction = '全球远程';
    }
  }

  return {
    title: cleanTitle,
    company: company || extractCompany(title, description, ''),
    location: location || extractLocation(title, description),
    jobType: jobType || extractJobType(title, description),
    workType: 'remote',
    skills,
    remoteLocationRestriction
  };
}

/**
 * Parse Remotive item
 */
function parseRemotive($, item, title, description) {
  const $item = $(item);
  const company = $item.find('company').text().trim();
  const location = $item.find('location').text().trim(); // Remotive often puts "Worldwide" or "USA" here

  let remoteLocationRestriction = '';
  if (location) {
    if (location.toLowerCase().includes('worldwide') || location.toLowerCase().includes('global')) {
      remoteLocationRestriction = '全球远程';
    } else if (location.toLowerCase().includes('usa') || location.toLowerCase().includes('united states')) {
      remoteLocationRestriction = '仅限美国';
    } else if (location.toLowerCase().includes('europe') || location.toLowerCase().includes('eu')) {
      remoteLocationRestriction = '仅限欧盟';
    } else if (location.length > 0 && location !== 'Remote') {
      remoteLocationRestriction = `仅限${location}`;
    }
  }

  return {
    company: company || extractCompany(title, description, ''),
    location: location || extractLocation(title, description),
    jobType: extractJobType(title, description),
    workType: 'remote',
    remoteLocationRestriction
  };
}

/**
 * Parse Himalayas item
 */
function parseHimalayas($, item, title, description) {
  const $item = $(item);
  
  // Himalayas namespaces: himalayasJobs:companyName, himalayasJobs:locationIso
  // In cheerio xmlMode, colons in tag names might be preserved or handled differently
  // Try direct tag name first
  let company = $item.find('himalayasJobs\\:companyName').text().trim();
  let locationIso = $item.find('himalayasJobs\\:locationIso').text().trim();
  
  // Fallback if namespace escaping doesn't work directly
  if (!company) company = $item.find('companyName').text().trim();
  
  // Himalayas title format: Job Title at Company (Location)
  const himalayasMatch = title.match(/^(.+?)\s+at\s+(.+?)(?:\s+\((.+?)\))?$/);
  let cleanTitle = title;
  let location = '';

  if (himalayasMatch) {
    cleanTitle = himalayasMatch[1].trim();
    if (!company) company = himalayasMatch[2].trim();
    if (himalayasMatch[3]) {
      location = himalayasMatch[3].trim();
    }
  }

  let remoteLocationRestriction = '';
  if (locationIso) {
    remoteLocationRestriction = `仅限${locationIso}`;
  } else if (location) {
    if (location.toLowerCase().includes('worldwide') || location.toLowerCase().includes('global')) {
      remoteLocationRestriction = '全球远程';
    } else {
      remoteLocationRestriction = `仅限${location}`;
    }
  }

  return {
    title: cleanTitle,
    company: company || extractCompany(title, description, ''),
    location: location || extractLocation(title, description),
    jobType: extractJobType(title, description),
    workType: 'remote',
    remoteLocationRestriction
  };
}

/**
 * Parse JobsCollider item
 */
function parseJobsCollider($, item, title, description) {
    // JobsCollider uses standard RSS but puts "Company: Title" or similar
    const titleMatch = title.match(/^(.+?)\s+-\s+(.+)$/);
    let cleanTitle = title;
    let company = '';
    
    if (titleMatch) {
        cleanTitle = titleMatch[1].trim();
        company = titleMatch[2].trim();
    }
    
    return {
        title: cleanTitle,
        company: company || extractCompany(title, description, ''),
        location: extractLocation(title, description),
        jobType: extractJobType(title, description),
        workType: 'remote'
    };
}


/**
 * Main Parse Function
 */
export function parseRSSFeed(xmlData, source) {
  try {
    const $ = cheerio.load(xmlData, { xmlMode: true });
    const items = [];
    
    const sourceName = (source.name || '').toLowerCase();

    $('item').each((i, elem) => {
      const $item = $(elem);
      const title = $item.find('title').text().trim();
      let link = $item.find('link').text().trim();
      
      // Fallback for Atom style or empty link
      if (!link) {
          link = $item.find('link').attr('href') || '';
      }
      
      const guid = $item.find('guid').text().trim();
      // Fallback: Use GUID as link if link is still empty and GUID is a URL
      if (!link && guid && (guid.startsWith('http') || guid.startsWith('https'))) {
          link = guid;
      }

      let description = $item.find('description').text().trim();
      // If description is empty or very short, try content:encoded
      const contentEncoded = $item.find('content\\:encoded').text().trim() || $item.find('encoded').text().trim();
      if (!description || (description.length < 100 && contentEncoded.length > description.length)) {
          description = contentEncoded || description;
      }
      
      const pubDate = $item.find('pubDate').text().trim();
      const category = $item.find('category').text().trim() || source.category;

      if (title && link) {
        const cleanedDesc = cleanDescription(description);
        let parsedData = {};

        if (sourceName.includes('weworkremotely')) {
          parsedData = parseWeWorkRemotely($, elem, title, description);
        } else if (sourceName.includes('remotive')) {
          parsedData = parseRemotive($, elem, title, description);
        } else if (sourceName.includes('himalayas')) {
          parsedData = parseHimalayas($, elem, title, description);
        } else if (sourceName.includes('jobscollider')) {
          parsedData = parseJobsCollider($, elem, title, description);
        } else {
            // Generic fallback
            parsedData = {
                title,
                company: extractCompany(title, description, link),
                location: extractLocation(title, description),
                jobType: extractJobType(title, description),
                workType: 'remote'
            };
        }

        items.push({
          title: parsedData.title || title,
          link,
          url: link, // Ensure URL is set for deduplication
          description: cleanedDesc,
          pubDate,
          guid: guid || link,
          source: source.name,
          category: category,
          
          // Rich fields
          company: parsedData.company,
          location: parsedData.location,
          salary: parsedData.salary,
          jobType: parsedData.jobType,
          workType: parsedData.workType,
          experienceLevel: extractExperienceLevel(title, description),
          skills: parsedData.skills || [],
          remoteLocationRestriction: parsedData.remoteLocationRestriction,
          
          fetchedAt: new Date().toISOString()
        });
      }
    });

    return items;
  } catch (error) {
    console.error(`[RSSParser] Error parsing ${source.name}:`, error);
    return [];
  }
}
