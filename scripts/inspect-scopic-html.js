
import * as cheerio from 'cheerio';

async function inspectHtmlStructure() {
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
        
        // Find element containing specific job title
        const titleText = "Remote Marketing Specialist";
        const element = $(`*:contains("${titleText}")`).last(); // Get the most specific element
        
        if (element.length > 0) {
            console.log('Found title element:', element.prop('tagName'));
            console.log('Class:', element.attr('class'));
            console.log('Parent structure:');
            
            let current = element;
            for (let i = 0; i < 5; i++) {
                current = current.parent();
                console.log(`Level ${i+1}: ${current.prop('tagName')} class="${current.attr('class')}" id="${current.attr('id')}"`);
            }
            
            // Try to identify the list item container
            const listContainer = element.closest('li') || element.closest('.rec-job-info'); // Guessing class names
            if (listContainer.length > 0) {
                console.log('Potential list container found:', listContainer.prop('tagName'), listContainer.attr('class'));
            }
        } else {
            console.log(`Title "${titleText}" not found in visible HTML. It might be rendered client-side only.`);
        }

    } catch (e) {
        console.error('Fetch error:', e);
    }
}

inspectHtmlStructure();
