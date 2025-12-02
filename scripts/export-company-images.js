import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Production API endpoint
const API_URL = 'https://haigoo.vercel.app/api/data/trusted-companies';

async function fetchCompaniesFromAPI() {
    try {
        console.log(`Fetching companies from: ${API_URL}`);
        const response = await fetch(API_URL);

        if (response.ok) {
            const data = await response.json();
            const companies = data.companies || data;
            const count = Array.isArray(companies) ? companies.length : 0;
            console.log(`✓ Success! Got ${count} companies\n`);
            return Array.isArray(companies) ? companies : [];
        }

        console.log(`✗ Failed: ${response.status} ${response.statusText}`);
        return [];
    } catch (error) {
        console.error(`✗ Error: ${error.message}`);
        return [];
    }
}

function isBase64DataURL(url) {
    return url && url.startsWith('data:');
}

function isHttpURL(url) {
    return url && (url.startsWith('http://') || url.startsWith('https://'));
}

function saveBase64Image(dataURL, filepath) {
    try {
        // Extract base64 data
        const matches = dataURL.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            throw new Error('Invalid data URL format');
        }

        const mimeType = matches[1];
        const base64Data = matches[2];

        // Convert base64 to buffer
        const buffer = Buffer.from(base64Data, 'base64');

        // Save to file
        fs.writeFileSync(filepath, buffer);

        return true;
    } catch (error) {
        console.error(`Failed to save base64 image: ${error.message}`);
        return false;
    }
}

function getFileExtensionFromMimeType(dataURL) {
    const mimeMatch = dataURL.match(/^data:([A-Za-z-+\/]+);/);
    if (!mimeMatch) return '.png';

    const mimeType = mimeMatch[1];
    const mimeToExt = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/gif': '.gif',
        'image/svg+xml': '.svg',
        'image/webp': '.webp',
        'image/x-icon': '.ico',
        'image/vnd.microsoft.icon': '.ico'
    };

    return mimeToExt[mimeType] || '.png';
}

async function exportImages() {
    console.log('Starting image export...\n');

    const companies = await fetchCompaniesFromAPI();

    if (!Array.isArray(companies) || companies.length === 0) {
        console.log('No companies found!');
        return;
    }

    console.log(`Processing ${companies.length} companies\n`);

    // Create output directory
    const docsDir = path.join(__dirname, '../docs');
    const imagesDir = path.join(docsDir, 'trusted-companies-images');

    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
        console.log(`Created directory: ${imagesDir}\n`);
    }

    let stats = {
        totalCompanies: companies.length,
        companiesWithLogo: 0,
        companiesWithCover: 0,
        base64Logos: 0,
        base64Covers: 0,
        httpLogos: 0,
        httpCovers: 0,
        savedLogos: 0,
        savedCovers: 0,
        failedLogos: 0,
        failedCovers: 0
    };

    // Process each company
    for (let i = 0; i < companies.length; i++) {
        const company = companies[i];
        const progress = `[${i + 1}/${companies.length}]`;

        console.log(`${progress} ${company.name}`);

        // Process logo
        if (company.logo) {
            stats.companiesWithLogo++;

            if (isBase64DataURL(company.logo)) {
                stats.base64Logos++;
                const ext = getFileExtensionFromMimeType(company.logo);
                const filename = `${company.id}_logo${ext}`;
                const filepath = path.join(imagesDir, filename);

                if (saveBase64Image(company.logo, filepath)) {
                    console.log(`  ✓ Saved logo (base64)`);
                    stats.savedLogos++;
                } else {
                    console.log(`  ✗ Failed to save logo (base64)`);
                    stats.failedLogos++;
                }
            } else if (isHttpURL(company.logo)) {
                stats.httpLogos++;
                console.log(`  → Logo is HTTP URL (skipped, already handled)`);
            }
        }

        // Process cover image
        if (company.coverImage) {
            stats.companiesWithCover++;

            if (isBase64DataURL(company.coverImage)) {
                stats.base64Covers++;
                const ext = getFileExtensionFromMimeType(company.coverImage);
                const filename = `${company.id}_cover${ext}`;
                const filepath = path.join(imagesDir, filename);

                if (saveBase64Image(company.coverImage, filepath)) {
                    console.log(`  ✓ Saved cover (base64)`);
                    stats.savedCovers++;
                } else {
                    console.log(`  ✗ Failed to save cover (base64)`);
                    stats.failedCovers++;
                }
            } else if (isHttpURL(company.coverImage)) {
                stats.httpCovers++;
                console.log(`  → Cover is HTTP URL (skipped, already handled)`);
            }
        }
    }

    // Print summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ Image export complete!');
    console.log(`${'='.repeat(60)}`);
    console.log(`📊 Statistics:`);
    console.log(`   Total companies: ${stats.totalCompanies}`);
    console.log(`   Companies with logo: ${stats.companiesWithLogo}`);
    console.log(`   Companies with cover: ${stats.companiesWithCover}`);
    console.log(``);
    console.log(`📷 Logo images:`);
    console.log(`   Base64 logos: ${stats.base64Logos}`);
    console.log(`   HTTP logos: ${stats.httpLogos}`);
    console.log(`   ✓ Saved: ${stats.savedLogos}`);
    console.log(`   ✗ Failed: ${stats.failedLogos}`);
    console.log(``);
    console.log(`🖼️  Cover images:`);
    console.log(`   Base64 covers: ${stats.base64Covers}`);
    console.log(`   HTTP covers: ${stats.httpCovers}`);
    console.log(`   ✓ Saved: ${stats.savedCovers}`);
    console.log(`   ✗ Failed: ${stats.failedCovers}`);
    console.log(``);
    console.log(`📁 Output directory: ${imagesDir}`);
    console.log(`${'='.repeat(60)}\n`);
}

exportImages().catch(console.error);
