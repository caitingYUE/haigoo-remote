
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { translateText, translateJob } = require('../lib/services/translation-service.cjs');

async function test() {
  console.log('--- Testing Single Text Translation ---');
  const text = 'Software Engineer';
  console.log(`Translating: "${text}"`);
  
  try {
    const result = await translateText(text, 'zh', 'en');
    console.log(`Result: "${result}"`);
  } catch (e) {
    console.error('Translation failed:', e);
  }

  console.log('\n--- Testing Job Translation ---');
  const mockJob = {
    id: 'test-1',
    title: 'Senior Frontend Developer',
    description: 'We are looking for a React expert.',
    requirements: ['React', 'TypeScript'],
    benefits: ['Remote work'],
    isTranslated: false
  };

  try {
    const jobResult = await translateJob(mockJob);
    console.log('Job Result:', JSON.stringify(jobResult, null, 2));
    
    if (jobResult.isTranslated && jobResult.translations) {
        console.log('✅ Job marked as translated');
    } else {
        console.log('❌ Job NOT marked as translated');
    }
  } catch (e) {
    console.error('Job translation failed:', e);
  }
}

test();
