import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Production API endpoint - correct domain
const API_URLS = [
  'https://haigoo.vercel.app/api/data/trusted-companies',
  'https://haigoo-remote.vercel.app/api/data/trusted-companies'
];


async function fetchCompaniesFromAPI() {
  for (const url of API_URLS) {
    try {
      console.log(`Trying: ${url}`);
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        // API returns {success: true, companies: [...]}
        const companies = data.companies || data;
        const count = Array.isArray(companies) ? companies.length : 0;
        console.log(`✓ Success! Got ${count} companies\n`);
        return Array.isArray(companies) ? companies : [];
      }

      console.log(`✗ Failed: ${response.status} ${response.statusText}`);
    } catch (error) {
      console.log(`✗ Error: ${error.message}`);
    }
  }

  console.error('All API endpoints failed!');
  return [];
}

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    if (!url) {
      resolve();
      return;
    }

    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadImage(redirectUrl, filepath).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(filepath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlink(filepath, () => { }); // Delete partial file
        reject(err);
      });
    });

    request.on('error', (err) => {
      reject(err);
    });

    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

async function exportData() {
  console.log('Starting export...\n');

  const companies = await fetchCompaniesFromAPI();

  if (!Array.isArray(companies) || companies.length === 0) {
    console.log('No companies found!');
    return;
  }

  console.log(`Found ${companies.length} companies\n`);

  // Create output directories
  const docsDir = path.join(__dirname, '../docs');
  const imagesDir = path.join(docsDir, 'trusted-companies-images');

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
    console.log(`Created directory: ${imagesDir}\n`);
  }

  // Prepare CSV data
  const csvRows = [];
  csvRows.push([
    'ID',
    'Company Name',
    'Website',
    'Industry',
    'Description',
    'Tags',
    'Logo URL',
    'Cover Image URL',
    'Logo Filename',
    'Cover Image Filename',
    'Job Board URL',
    'Created At',
    'Updated At'
  ].join(','));

  // Process each company
  let logoSuccessCount = 0;
  let coverSuccessCount = 0;

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    console.log(`[${i + 1}/${companies.length}] Processing: ${company.name}`);

    const logoFilename = company.logo ? `${company.id}_logo${path.extname(company.logo) || '.png'}` : '';
    const coverFilename = company.coverImage ? `${company.id}_cover${path.extname(company.coverImage) || '.jpg'}` : '';

    // Download logo
    if (company.logo && logoFilename) {
      try {
        const logoPath = path.join(imagesDir, logoFilename);
        await downloadImage(company.logo, logoPath);
        console.log(`  ✓ Downloaded logo`);
        logoSuccessCount++;
      } catch (err) {
        console.error(`  ✗ Failed to download logo: ${err.message}`);
      }
    }

    // Download cover image
    if (company.coverImage && coverFilename) {
      try {
        const coverPath = path.join(imagesDir, coverFilename);
        await downloadImage(company.coverImage, coverPath);
        console.log(`  ✓ Downloaded cover image`);
        coverSuccessCount++;
      } catch (err) {
        console.error(`  ✗ Failed to download cover: ${err.message}`);
      }
    }

    // Add to CSV
    const row = [
      company.id || '',
      `"${(company.name || '').replace(/"/g, '""')}"`,
      company.website || '',
      `"${(company.industry || '').replace(/"/g, '""')}"`,
      `"${(company.description || '').replace(/"/g, '""')}"`,
      `"${(company.tags || []).join('; ')}"`,
      company.logo || '',
      company.coverImage || '',
      logoFilename,
      coverFilename,
      company.jobBoardUrl || '',
      company.createdAt || '',
      company.updatedAt || ''
    ];

    csvRows.push(row.join(','));
  }

  // Write CSV file
  const csvPath = path.join(docsDir, 'trusted-companies-export.csv');
  fs.writeFileSync(csvPath, '\ufeff' + csvRows.join('\n'), 'utf-8');

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ Export complete!');
  console.log(`${'='.repeat(60)}`);
  console.log(`📊 CSV file: ${csvPath}`);
  console.log(`🖼️  Images directory: ${imagesDir}`);
  console.log(`📈 Total companies: ${companies.length}`);
  console.log(`🖼️  Logos downloaded: ${logoSuccessCount}`);
  console.log(`🖼️  Covers downloaded: ${coverSuccessCount}`);
  console.log(`${'='.repeat(60)}\n`);
}

exportData().catch(console.error);
