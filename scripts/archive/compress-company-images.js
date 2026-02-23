import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

console.log('DEBUG: DATABASE_URL exists?', !!process.env.DATABASE_URL);
console.log('DEBUG: POSTGRES_URL exists?', !!process.env.POSTGRES_URL);

import sharp from 'sharp';

async function compressImage(base64Str) {
    if (!base64Str || !base64Str.startsWith('data:image')) return null;

    try {
        const buffer = Buffer.from(base64Str.split(',')[1], 'base64');
        const compressedBuffer = await sharp(buffer)
            .resize({ width: 1200, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();
        
        return `data:image/webp;base64,${compressedBuffer.toString('base64')}`;
    } catch (error) {
        console.error('Compression failed:', error.message);
        return null;
    }
}

async function run() {
    const { default: neonHelper } = await import('../server-utils/dal/neon-helper.js');

    if (!neonHelper.isConfigured) {
        console.error('Neon DB not configured');
        process.exit(1);
    }

    try {
        console.log('Fetching companies with large cover images...');
        // Only fetch companies that have a cover image.
        const companies = await neonHelper.query('SELECT company_id, name, cover_image FROM trusted_companies WHERE cover_image IS NOT NULL AND cover_image != \'\'');
        
        console.log(`Found ${companies.length} companies with cover images.`);

        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const company of companies) {
            const originalSize = company.cover_image.length;
            
            // Skip if not base64 (e.g. URL)
            if (!company.cover_image.startsWith('data:image')) {
                // console.log(`Skipping ${company.name} (not base64)`);
                skippedCount++;
                continue;
            }

            // Only compress if larger than 100KB to save time, or if not webp
            const isWebP = company.cover_image.startsWith('data:image/webp');
            if (originalSize < 100 * 1024 && isWebP) {
                 skippedCount++;
                 continue;
            }

            const compressed = await compressImage(company.cover_image);
            
            if (compressed) {
                const newSize = compressed.length;
                const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(2);
                
                // Update if size is reduced OR if we converted format (even if size is same, webp is preferred)
                // But usually webp is smaller.
                if (newSize < originalSize || !isWebP) {
                    console.log(`Updating ${company.name}: ${Math.round(originalSize/1024)}KB -> ${Math.round(newSize/1024)}KB (-${reduction}%)`);
                    
                    await neonHelper.query(
                        'UPDATE trusted_companies SET cover_image = $1, updated_at = NOW() WHERE company_id = $2',
                        [compressed, company.company_id]
                    );
                    updatedCount++;
                } else {
                    console.log(`Skipping ${company.name}: Compression didn't reduce size significantly`);
                    skippedCount++;
                }
            } else {
                console.log(`Skipping ${company.name}: Compression failed or invalid format`);
                errorCount++;
            }
        }

        console.log('Done.');
        console.log(`Updated: ${updatedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
        process.exit(0);

    } catch (error) {
        console.error('Script failed:', error);
        process.exit(1);
    }
}

run();
