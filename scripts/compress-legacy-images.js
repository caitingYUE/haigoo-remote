
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

import sharp from 'sharp';

async function run() {
    // Dynamic import to ensure env vars are loaded first
    const { default: neonHelper } = await import('./server-utils/dal/neon-helper.js');

    try {
        if (!neonHelper.isConfigured) {
            console.error('❌ Neon not configured');
            return;
        }

        console.log("=== LEGACY IMAGE COMPRESSION MIGRATION ===");
        
        // 1. Fetch companies with large base64 images (e.g. > 200KB)
        console.log("Scanning for large images...");
        const companies = await neonHelper.query(`
            SELECT company_id, name, length(cover_image) as size, cover_image
            FROM trusted_companies
            WHERE cover_image LIKE 'data:image/%'
            AND length(cover_image) > 200000
            LIMIT 50
        `);

        console.log(`Found ${companies.length} companies with large images.`);

        for (const company of companies) {
            console.log(`Processing ${company.name} (Size: ${(company.size / 1024).toFixed(2)} KB)...`);
            
            try {
                // Extract base64 data
                const matches = company.cover_image.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
                if (!matches || matches.length !== 3) {
                    console.log(`Skipping ${company.name}: Invalid base64 format`);
                    continue;
                }

                const buffer = Buffer.from(matches[2], 'base64');
                
                // Compress using Sharp (Resize to max 1200px width, convert to WebP quality 80)
                const compressedBuffer = await sharp(buffer)
                    .resize({ width: 1200, withoutEnlargement: true })
                    .webp({ quality: 80 })
                    .toBuffer();

                const compressedBase64 = `data:image/webp;base64,${compressedBuffer.toString('base64')}`;
                const newSize = compressedBase64.length;
                
                console.log(`  -> Compressed to ${(newSize / 1024).toFixed(2)} KB (Reduction: ${((1 - newSize/company.size) * 100).toFixed(1)}%)`);

                // Update DB
                await neonHelper.query(`
                    UPDATE trusted_companies 
                    SET cover_image = $1 
                    WHERE company_id = $2
                `, [compressedBase64, company.company_id]);
                
                console.log(`  -> Saved to DB.`);

            } catch (err) {
                console.error(`  -> Error processing ${company.name}:`, err.message);
            }
        }

        console.log("\n✅ Migration completed.");

    } catch (e) {
        console.error("❌ Migration failed:", e);
    }
}
run();
