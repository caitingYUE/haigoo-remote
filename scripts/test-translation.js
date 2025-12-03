#!/usr/bin/env node

/**
 * 测试翻译服务
 * 用于诊断翻译失败的原因
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const SITE_URL = process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://haigoo.vercel.app';

const TRANSLATE_ENDPOINT = `${SITE_URL}/api/translate`;
const INTERNAL_SECRET = process.env.TRANSLATE_INTERNAL_SECRET || '';

console.log('=== 翻译服务诊断 ===\n');
console.log('配置:');
console.log(`  SITE_URL: ${SITE_URL}`);
console.log(`  TRANSLATE_ENDPOINT: ${TRANSLATE_ENDPOINT}`);
console.log(`  HAS_SECRET: ${!!INTERNAL_SECRET}`);
console.log('');

async function testTranslation() {
    const testText = 'Hello World';

    console.log(`测试翻译: "${testText}"`);
    console.log('');

    try {
        console.log('发送请求...');
        const response = await fetch(TRANSLATE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Test-Script/1.0',
                ...(INTERNAL_SECRET ? { 'Authorization': `Bearer ${INTERNAL_SECRET}` } : {})
            },
            body: JSON.stringify({
                text: testText,
                targetLanguage: 'zh',
                sourceLanguage: 'en'
            })
        });

        console.log(`响应状态: ${response.status} ${response.statusText}`);
        console.log('');

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ 请求失败:');
            console.error(errorText);
            return;
        }

        const result = await response.json();
        console.log('✅ 翻译成功:');
        console.log(JSON.stringify(result, null, 2));

        if (result.success && result.data) {
            console.log('');
            console.log(`原文: ${testText}`);
            console.log(`译文: ${result.data.translatedText}`);
            console.log(`提供商: ${result.data.provider}`);
            console.log(`置信度: ${result.data.confidence}`);
        }

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error(error.stack);
    }
}

testTranslation();
