
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import neonHelper from '../server-utils/dal/neon-helper.js';
import copilotHandler from '../lib/api-handlers/copilot.js';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

// Load env
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function getTestUser() {
    // Find a user who is a member
    const res = await neonHelper.query("SELECT user_id FROM users WHERE member_status = 'active' LIMIT 1");
    if (res && res.length > 0) return res[0].user_id;
    
    // If no member, find any user
    const res2 = await neonHelper.query("SELECT user_id FROM users LIMIT 1");
    if (res2 && res2.length > 0) {
        const uid = res2[0].user_id;
        // Temporarily make them a member for the test? 
        // Or we can mock the user check in the handler?
        // Since we can't easily mock the handler's internal query, we might need to update the user.
        // Let's just try with what we have. If they are not member, they might hit limits.
        return uid;
    }
    return null;
}

async function parseResume(filePath) {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf') {
        const data = await pdf(buffer);
        return data.text;
    } else if (ext === '.docx') {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    }
    return '';
}

async function insertTempResume(userId, text, filename) {
    const resumeId = `test_resume_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    await neonHelper.query(
        `INSERT INTO resumes (resume_id, user_id, content_text, file_name, file_size, file_type) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [resumeId, userId, text, filename, 1000, 'application/pdf']
    );
    return resumeId;
}

async function runTest() {
    console.log('Connecting to DB...');
    if (!neonHelper.isConfigured) {
        console.error('DB not configured');
        return;
    }

    const userId = await getTestUser();
    if (!userId) {
        console.error('No test user found');
        return;
    }
    console.log('Using User ID:', userId);

    // Helper for response mocking
    const createRes = (label) => ({
        status: (code) => ({
            json: (data) => {
                console.log(`\n[${label}] Status: ${code}`);
                if (data.plan) {
                    console.log('✅ Plan Generated!');
                    console.log('Overview:', data.plan.applicationPlan?.overview);
                    console.log('Resume Analysis Score:', data.plan.resumeEval?.score);
                    console.log('Recommendations Count:', data.plan.recommendations?.length);
                    // console.log('Full Plan:', JSON.stringify(data.plan, null, 2).substring(0, 500) + '...');
                } else if (data.error) {
                    console.log('❌ Error:', data.error);
                    if (data.message) console.log('Message:', data.message);
                } else {
                    console.log('Response:', JSON.stringify(data, null, 2));
                }
                return createRes(label);
            }
        })
    });

    // Test Case 1: No Resume
    console.log('\n--- Test Case 1: No Resume (Frontend Dev) ---');
    const req1 = {
        method: 'POST',
        headers: {},
        body: {
            userId,
            goal: 'full-time',
            timeline: 'immediately',
            background: {
                role: 'Frontend Developer',
                years: 'Senior',
                education: 'Bachelor',
                language: 'English'
            }
        }
    };
    
    await copilotHandler(req1, createRes('No Resume'));

    // Test Case 2: With Resume
    const resumeFiles = [
        'CV_Aria_Li.pdf', 
        'Resume of Weihao Wu.docx', 
        'qdaoming_AI工程师.pdf'
    ];
    
    for (const file of resumeFiles) {
        console.log(`\n--- Test Case 2: With Resume (${file}) ---`);
        const filePath = path.join(__dirname, '../public/resume', file);
        try {
            const text = await parseResume(filePath);
            console.log(`Parsed resume text length: ${text.length}`);
            if (text.length === 0) {
                console.log('Skipping empty resume text');
                continue;
            }
            const resumeId = await insertTempResume(userId, text, file);
            console.log(`Inserted temp resume: ${resumeId}`);
            
            // Determine role based on filename for better context
            let role = 'Software Engineer';
            if (file.includes('AI')) role = 'AI Engineer';
            if (file.includes('Product')) role = 'Product Manager';

            const req2 = {
                method: 'POST',
                headers: {},
                body: {
                    userId,
                    goal: 'full-time',
                    timeline: '1-3 months',
                    background: {
                        role: role,
                        years: 'Mid',
                        education: 'Master',
                        language: 'English'
                    },
                    resumeId
                }
            };
            
            await copilotHandler(req2, createRes(`Resume: ${file}`));
            
        } catch (e) {
            console.error(`Failed to test with ${file}:`, e);
        }
    }
}

runTest().catch(console.error).finally(() => {
    // We might want to clean up temp resumes but it's not strictly necessary for dev env
    console.log('\nTest completed.');
    process.exit();
});
