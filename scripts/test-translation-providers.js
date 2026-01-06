/**
 * 翻译服务可用性测试脚本
 * 用法: node scripts/test-translation-providers.js
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const require = createRequire(import.meta.url);
const service = require('../lib/services/translation-service.cjs');

async function testProvider(name, text) {
    console.log(`\nTesting Provider: ${name}...`);
    try {
        let result;
        if (name === 'google') {
            // Accessing internal private function via specific export would be hard since they are not exported.
            // But we can use the public 'translateText' and force provider checking/mocking?
            // Actually, translation-service.cjs does NOT export individual providers.
            // We have to inspect the code or use the verify logic.
            // Let's rely on 'translateText' and see logs (if we enabled debug logs).

            // Wait, we can't force a provider easily without modifying the code or ENV.
            // Modify env for this process.
            process.env.PREFERRED_TRANSLATION_PROVIDER = name;
            result = await service.translateText(text, 'zh', 'en');
        } else if (name === 'ai') {
            process.env.PREFERRED_TRANSLATION_PROVIDER = 'ai';
            // Enable AI
            service.configure({ aiEnabled: true });
            result = await service.translateText(text, 'zh', 'en');
        } else {
            process.env.PREFERRED_TRANSLATION_PROVIDER = name;
            result = await service.translateText(text, 'zh', 'en');
        }

        console.log(`[${name}] Result:`, result);

        const hasChinese = /[\u4e00-\u9fa5]/.test(result);
        if (hasChinese && result !== text) {
            console.log(`✅ [${name}] Success!`);
        } else {
            console.log(`❌ [${name}] Failed (Returned original or no Chinese)`);
        }
    } catch (e) {
        console.error(`❌ [${name}] Error:`, e.message);
    }
}

async function run() {
    console.log('🔍 Starting Translation Provider Diagnosis...');
    const text = "Hello world, this is a test for translation service.";

    // Testing free providers
    await testProvider('google', text);
    await testProvider('mymemory', text);
    await testProvider('libretranslate', text);

    // Testing AI (if keys exist)
    const hasAiKeys = !!(process.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.VITE_ALIBABA_BAILIAN_API_KEY || process.env.ALIBABA_BAILIAN_API_KEY);
    if (hasAiKeys) {
        await testProvider('ai', text);
    } else {
        console.log('\n⚠️ Skipping AI test: No API Keys found in .env.local');
    }
}

run();
