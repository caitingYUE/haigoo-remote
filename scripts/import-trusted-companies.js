import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import neonHelper from '../server-utils/dal/neon-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = path.join(__dirname, '../docs/trusted-companies/trusted-companies-export.csv');
const IMAGES_DIR = path.join(__dirname, '../docs/trusted-companies');
const PUBLIC_UPLOADS_DIR = path.join(__dirname, '../public/uploads/companies');

// Ensure uploads directory exists
if (!fs.existsSync(PUBLIC_UPLOADS_DIR)) {
    fs.mkdirSync(PUBLIC_UPLOADS_DIR, { recursive: true });
}

async function importCompanies() {
    console.log('Starting trusted companies import...');

    if (!neonHelper.isConfigured) {
        console.error('Neon database is not configured. Please check your .env files.');
        process.exit(1);
    }

    try {
        // Read CSV
        console.log(`Reading CSV from: ${CSV_PATH}`);
        const workbook = XLSX.readFile(CSV_PATH);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const companies = XLSX.utils.sheet_to_json(worksheet);

        console.log(`Found ${companies.length} companies to import.`);

        const companiesToSave = [];

        for (const row of companies) {
            const company = {
                id: row.id,
                name: row.name,
                website: row.website,
                description: row.description,
                industry: row.industry,
                tags: row.tags ? row.tags.split(',').map(t => t.trim()) : [],
                source: 'manual_import',
                jobCount: 0,
                canRefer: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Handle Logo
            if (row.logo_filename) {
                const srcPath = path.join(IMAGES_DIR, row.logo_filename);
                if (fs.existsSync(srcPath)) {
                    const destFilename = row.logo_filename;
                    const destPath = path.join(PUBLIC_UPLOADS_DIR, destFilename);
                    fs.copyFileSync(srcPath, destPath);
                    company.logo = `/uploads/companies/${destFilename}`;
                } else {
                    console.warn(`Logo file not found: ${row.logo_filename}`);
                    company.logo = row.logo_url || ''; // Fallback to URL if available
                }
            } else {
                company.logo = row.logo_url || '';
            }

            // Handle Cover Image
            if (row.cover_filename) {
                const srcPath = path.join(IMAGES_DIR, row.cover_filename);
                if (fs.existsSync(srcPath)) {
                    const destFilename = row.cover_filename;
                    const destPath = path.join(PUBLIC_UPLOADS_DIR, destFilename);
                    fs.copyFileSync(srcPath, destPath);
                    company.coverImage = `/uploads/companies/${destFilename}`;
                } else {
                    console.warn(`Cover image file not found: ${row.cover_filename}`);
                    company.coverImage = row.cover_image_url || ''; // Fallback to URL if available
                }
            } else {
                company.coverImage = row.cover_image_url || '';
            }

            companiesToSave.push(company);
        }

        // Save to Database
        console.log(`Saving ${companiesToSave.length} companies to database...`);

        // Use neonHelper directly to insert/upsert
        // We'll do it in batches or one by one. Transaction is safer.
        await neonHelper.transaction(async (client) => {
            // Optional: Clear existing manual imports? Or just upsert?
            // User might want to keep crawled data. Let's upsert based on company_id.

            for (const company of companiesToSave) {
                await client.query(`
                    INSERT INTO trusted_companies 
                    (company_id, name, website, description, logo, cover_image, industry, tags, source, job_count, can_refer, status, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    ON CONFLICT (company_id) 
                    DO UPDATE SET 
                        name = EXCLUDED.name,
                        website = EXCLUDED.website,
                        description = EXCLUDED.description,
                        logo = EXCLUDED.logo,
                        cover_image = EXCLUDED.cover_image,
                        industry = EXCLUDED.industry,
                        tags = EXCLUDED.tags,
                        updated_at = NOW()
                `, [
                    company.id,
                    company.name,
                    company.website || '',
                    company.description || '',
                    company.logo || '',
                    company.coverImage || '',
                    company.industry || '其他',
                    JSON.stringify(company.tags || []),
                    company.source,
                    company.jobCount,
                    company.canRefer,
                    'active',
                    company.createdAt,
                    company.updatedAt
                ]);
            }
        });

        console.log('Import completed successfully!');

    } catch (error) {
        console.error('Import failed:', error);
        process.exit(1);
    }
}

importCompanies();
