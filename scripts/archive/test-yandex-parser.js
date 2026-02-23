
import fs from 'fs';
import * as cheerio from 'cheerio';

async function testParser() {
    console.log('Reading yandex_vacancies.html...');
    try {
        const html = fs.readFileSync('yandex_vacancies.html', 'utf8');
        const $ = cheerio.load(html);

        // Look for vacancy cards
        const cards = $('[class*="vacancy-card"]');
        console.log(`Found ${cards.length} elements with "vacancy-card" in class`);

        cards.each((i, el) => {
            if (i > 5) return;
            const card = $(el);
            console.log(`\n--- Card ${i} ---`);
            const title = card.find('.lc-styled-text__text').first().text();
            console.log('Title:', title);
            let link = card.attr('href') || card.find('a').attr('href') || card.closest('a').attr('href');
            console.log('Link:', link);
        });

        // Search for JSON
        console.log('\n--- Searching for JSON data ---');
        $('script').each((i, el) => {
            const content = $(el).html();
            if (content && content.includes('initialReduxState')) {
                console.log(`Found data in Script ${i}`);
                try {
                    // Regex to find "vacancies":{ ... }
                    // Note: content is likely inside a string inside a list push: self.__next_f.push([..., "...JSON..."])

                    // First try to find explicit vacancies key
                    // We need to be careful about escaped quotes

                    // Let's print the context around "vacancies"
                    const match = content.match(/\\"vacancies\\":\{.*?\}/); // Escaped quote?
                    if (match) {
                        console.log('Found escaped vacancies JSON:', match[0].substring(0, 200));
                    } else {
                        const match2 = content.match(/"vacancies":\{.*?\}/);
                        if (match2) {
                            console.log('Found unescaped vacancies JSON:', match2[0].substring(0, 200));
                        }
                    }
                } catch (e) {
                    console.log('Error regexing:', e);
                }
            }
        });

    } catch (e) {
        console.error('Error:', e);
    }
}

testParser();
