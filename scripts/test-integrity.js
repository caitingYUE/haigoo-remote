
import { mergeWithIntegrity, validateIntegrity } from '../lib/utils/data-integrity.js';

console.log('--- Testing Data Integrity Guard ---');

// Test 1: Simulate Missing Industry Bug
console.log('\n[Test 1] Missing Industry Protection');
const existingJob1 = {
    id: 'job1',
    title: 'Senior Engineer',
    industry: 'Fintech', // Crucial data
    isManuallyEdited: false
};

const crawledJob1 = {
    id: 'job1',
    title: 'Senior Engineer',
    industry: undefined, // Missing in crawl/sync
    description: 'New Description'
};

const merged1 = mergeWithIntegrity(crawledJob1, existingJob1);
if (merged1.industry === 'Fintech') {
    console.log('✅ PASS: Industry preserved');
} else {
    console.error('❌ FAIL: Industry lost', merged1);
    process.exit(1);
}

// Test 2: Protected Manual Edit
console.log('\n[Test 2] Manual Edit Protection');
const existingJob2 = {
    id: 'job2',
    title: 'Product Manager',
    salary: '$150k',
    isManuallyEdited: true
};

const crawledJob2 = {
    id: 'job2',
    title: 'Product Manager',
    salary: 'Competitive', // Crawler found generic value
};

const merged2 = mergeWithIntegrity(crawledJob2, existingJob2);
if (merged2.salary === '$150k') {
    console.log('✅ PASS: Manual salary preserved');
} else {
    console.error('❌ FAIL: Manual salary overwritten', merged2);
    process.exit(1);
}

// Test 3: Validation Logic
console.log('\n[Test 3] Validation Logic');
const unsafeJob = {
    id: 'job3',
    title: 'CEO',
    industry: undefined // Completely missing
};
const originalJob3 = {
    id: 'job3',
    title: 'CEO',
    industry: 'Tech'
};

try {
    validateIntegrity(unsafeJob, originalJob3);
    console.error('❌ FAIL: Validation should have failed');
    process.exit(1);
} catch (e) {
    console.log('✅ PASS: Validation caught missing industry:', e.message.split('\n')[1]);
}

console.log('\n🎉 All integrity tests passed!');
