
import { parseRSSFeed } from '../lib/services/rss-parser.js';
import * as fs from 'fs';
import * as path from 'path';

async function testParser() {
    console.log('Testing RSS Parser...');

    // Mock WeWorkRemotely feed
    const mockWWR = `
    <rss version="2.0">
        <channel>
            <title>We Work Remotely</title>
            <item>
                <title>Acme Corp: Senior Developer</title>
                <link>https://weworkremotely.com/jobs/123</link>
                <description>We are looking for a Senior Developer...</description>
                <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
                <region>Europe</region>
                <country>United Kingdom</country>
                <type>Full-Time</type>
                <skills>React, Node.js, TypeScript</skills>
            </item>
        </channel>
    </rss>
    `;

    const source = { name: 'WeWorkRemotely', category: 'Programming' };
    const items = parseRSSFeed(mockWWR, source);

    console.log('Parsed Items:', JSON.stringify(items, null, 2));

    if (items.length > 0) {
        const item = items[0];
        if (item.company === 'Acme Corp' && 
            item.title === 'Senior Developer' && 
            item.location === 'Europe, United Kingdom' &&
            item.skills.includes('React')) {
            console.log('✅ WeWorkRemotely Parser Test Passed');
        } else {
            console.error('❌ WeWorkRemotely Parser Test Failed');
        }
    } else {
        console.error('❌ No items parsed');
    }

    // Mock Remotive feed
    const mockRemotive = `
    <rss version="2.0">
        <channel>
            <title>Remotive</title>
            <item>
                <title>Backend Engineer</title>
                <link>https://remotive.com/jobs/456</link>
                <description>Join our backend team...</description>
                <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
                <company>Beta Inc</company>
                <location>Worldwide</location>
            </item>
        </channel>
    </rss>
    `;

    const sourceRemotive = { name: 'Remotive', category: 'Software' };
    const itemsRemotive = parseRSSFeed(mockRemotive, sourceRemotive);
    
    console.log('Parsed Remotive Items:', JSON.stringify(itemsRemotive, null, 2));

    if (itemsRemotive.length > 0) {
        const item = itemsRemotive[0];
        if (item.company === 'Beta Inc' && 
            item.remoteLocationRestriction === '全球远程') {
            console.log('✅ Remotive Parser Test Passed');
        } else {
            console.error('❌ Remotive Parser Test Failed');
        }
    }
}

testParser().catch(console.error);
