
import * as cheerio from 'cheerio';

async function inspectMeta() {
    const url = 'https://scopicsoftware.zohorecruit.com/jobs/Careers/';
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const html = await response.text();
        const $ = cheerio.load(html);
        const meta = $('#meta').val();
        console.log('Meta value:', meta);
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

inspectMeta();
