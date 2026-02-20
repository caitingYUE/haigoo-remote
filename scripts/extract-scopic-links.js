
import * as cheerio from 'cheerio';

async function extractLinks() {
    const url = 'https://scopicsoftware.zohorecruit.com/jobs/Careers/';
    console.log(`Fetching ${url}...`);
    
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && (href.includes('jobs') || href.includes('741923000037955058'))) {
                console.log('Link found:', href);
            }
        });

    } catch (e) {
        console.error('Fetch error:', e);
    }
}

extractLinks();
