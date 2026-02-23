import * as cheerio from 'cheerio';
import fs from 'fs';

const filename = process.argv[2] || 'yandex_dump.html';
const html = fs.readFileSync(filename, 'utf8');
const $ = cheerio.load(html);

console.log('Scripts found:', $('script').length);

$('script').each((i, el) => {
    const content = $(el).text(); // Use text() to avoid HTML entity encoding
    if (content && content.includes('window.__GLOBAL_STATE__')) {
        const startMarker = 'window.__GLOBAL_STATE__ = ';
        const start = content.indexOf(startMarker);
        if (start !== -1) {
            const jsonStr = content.substring(start + startMarker.length).trim();
            // Remove trailing semicolon if present
            const cleanJsonStr = jsonStr.endsWith(';') ? jsonStr.slice(0, -1) : jsonStr;

            try {
                const json = JSON.parse(cleanJsonStr);
                console.log('Successfully parsed GLOBAL_STATE');
                fs.writeFileSync('yandex_state.json', JSON.stringify(json, null, 2));
                console.log('Saved to yandex_state.json (Size: ' + cleanJsonStr.length + ' chars)');
            } catch (e) {
                console.error('Error parsing JSON:', e.message);
                console.log('Snippet where error might be:', cleanJsonStr.substring(0, 100));
            }
        }
    }
});
