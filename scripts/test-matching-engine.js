/**
 * 匹配引擎单元测试
 * 运行: node scripts/test-matching-engine.js
 */

import matchingEngine from '../lib/services/matching-engine.js';

const {
    calculateSkillMatch,
    calculateTextSimilarity,
    calculateExperienceMatch,
    calculatePreferenceMatch
} = matchingEngine;

// 测试辅助函数
function assert(condition, message) {
    if (!condition) {
        console.error('❌ FAIL:', message);
        process.exitCode = 1;
    } else {
        console.log('✅ PASS:', message);
    }
}

function testSkillMatch() {
    console.log('\n=== 技能匹配测试 ===');

    // 完全匹配
    const fullMatch = calculateSkillMatch(
        ['javascript', 'react', 'nodejs'],
        ['javascript', 'react', 'nodejs']
    );
    assert(fullMatch >= 90, `完全匹配应 >= 90, 实际: ${fullMatch}`);

    // 部分匹配
    const partialMatch = calculateSkillMatch(
        ['javascript', 'react', 'vue'],
        ['javascript', 'react', 'angular']
    );
    assert(partialMatch >= 50 && partialMatch < 90, `部分匹配应在 50-90, 实际: ${partialMatch}`);

    // 无匹配
    const noMatch = calculateSkillMatch(
        ['python', 'django'],
        ['java', 'spring']
    );
    assert(noMatch <= 20, `无匹配应 <= 20, 实际: ${noMatch}`);

    // 空输入
    const emptyMatch = calculateSkillMatch([], ['javascript']);
    assert(emptyMatch === 0, `空技能列表应返回 0, 实际: ${emptyMatch}`);
}

function testTextSimilarity() {
    console.log('\n=== 文本相似度测试 ===');

    // 相似文本 (TF-IDF对短文本的相似度计算会偏低)
    const similar = calculateTextSimilarity(
        'Senior React developer with 5 years experience in frontend development',
        'Looking for experienced React developer for frontend projects'
    );
    assert(similar >= 20, `相似文本应 >= 20, 实际: ${similar}`);

    // 不同文本
    const different = calculateTextSimilarity(
        'Python backend engineer with Flask experience',
        'iOS mobile developer with Swift skills'
    );
    assert(different <= 40, `不同文本应 <= 40, 实际: ${different}`);

    // 空输入
    const empty = calculateTextSimilarity('', 'test');
    assert(empty === 0, `空输入应返回 0, 实际: ${empty}`);
}

function testExperienceMatch() {
    console.log('\n=== 经验匹配测试 ===');

    // 完美匹配
    const perfect = calculateExperienceMatch(3, 'Mid');
    assert(perfect === 100, `3年经验对 Mid 应为 100, 实际: ${perfect}`);

    // 经验不足
    const underqualified = calculateExperienceMatch(1, 'Senior');
    assert(underqualified < 50, `1年经验对 Senior 应 < 50, 实际: ${underqualified}`);

    // 经验过高 (仍可接受)
    const overqualified = calculateExperienceMatch(10, 'Mid');
    assert(overqualified >= 60, `10年经验对 Mid 应 >= 60, 实际: ${overqualified}`);
}

function testPreferenceMatch() {
    console.log('\n=== 偏好匹配测试 ===');

    // 完美匹配偏好
    const fullPref = calculatePreferenceMatch(
        { jobTypes: ['remote'], industries: ['tech'], locations: ['anywhere'] },
        { is_remote: true, industry: 'tech', location: 'Remote' }
    );
    assert(fullPref >= 80, `完美偏好匹配应 >= 80, 实际: ${fullPref}`);

    // 无偏好
    const noPref = calculatePreferenceMatch(null, { is_remote: true });
    assert(noPref === 50, `无偏好应返回 50, 实际: ${noPref}`);
}

// 运行所有测试
console.log('🧪 开始匹配引擎单元测试\n');

testSkillMatch();
testTextSimilarity();
testExperienceMatch();
testPreferenceMatch();

console.log('\n=== 测试完成 ===');
if (process.exitCode === 1) {
    console.log('❌ 有测试失败');
} else {
    console.log('✅ 所有测试通过');
}
