-- 核心清洗脚本 (Phase 3 - Final Revised)
-- 引入 'global' 状态以解决“国内/海外”双向包含问题

-- 0. 基础设置
UPDATE jobs SET is_remote = true WHERE is_remote IS NOT true;

-- 1. 重置 Region 为临时状态，方便重新计算
-- (可选，但在生产环境直接 UPDATE 覆盖即可)

-- 2. 清洗 Region (三态逻辑)

-- 2.1 识别 Global/APAC (交集部分)
-- 这些岗位既算国内可申，也算海外可申
UPDATE jobs 
SET region = 'global'
WHERE 
    location ILIKE '%Anywhere%' OR location ILIKE '%Global%' OR location ILIKE '%Worldwide%' OR 
    location ILIKE '%Remote%' OR location ILIKE '%不限地点%' OR 
    location ILIKE '%APAC%' OR location ILIKE '%Asia Pacific%' OR 
    location ILIKE '%GMT+8%' OR location ILIKE '%UTC+8%';

-- 2.2 识别 Domestic (纯国内)
-- 仅限中国大陆及港澳台，覆盖之前的 global 标记
UPDATE jobs 
SET region = 'domestic'
WHERE 
    location ILIKE '%China%' OR location ILIKE '%CN%' OR 
    location ILIKE '%Beijing%' OR location ILIKE '%Shanghai%' OR location ILIKE '%Shenzhen%' OR 
    location ILIKE '%Guangzhou%' OR location ILIKE '%Hangzhou%' OR location ILIKE '%Chengdu%' OR 
    location ILIKE '%Hong Kong%' OR location ILIKE '%HK%' OR 
    location ILIKE '%Taiwan%' OR location ILIKE '%Macau%' OR 
    location ILIKE '%中国%' OR location ILIKE '%北京%' OR 
    location ILIKE '%上海%' OR location ILIKE '%深圳%' OR location ILIKE '%广州%' OR 
    location ILIKE '%杭州%' OR location ILIKE '%成都%';

-- 2.3 识别 Overseas (纯海外)
-- 排除上述两类后，明确标记为海外地点的
-- 注意：WHERE region != 'domestic' 确保不会把中国误判回去
UPDATE jobs 
SET region = 'overseas'
WHERE 
    region != 'domestic' AND (
    location ILIKE '%USA%' OR location ILIKE '%United States%' OR location ILIKE '%UK%' OR 
    location ILIKE '%London%' OR location ILIKE '%Europe%' OR location ILIKE '%Germany%' OR 
    location ILIKE '%France%' OR location ILIKE '%Canada%' OR location ILIKE '%Australia%' OR 
    location ILIKE '%Singapore%' OR location ILIKE '%Japan%' OR location ILIKE '%Korea%' OR
    location ILIKE '%North America%' OR location ILIKE '%Latin America%' OR location ILIKE '%EMEA%' OR
    location ILIKE '%San Francisco%' OR location ILIKE '%New York%' OR location ILIKE '%Berlin%'
);

-- 3. 修复 Source Type & Trusted Status (来源与可信状态)
-- 规则：
-- 企业官网/爬虫 (关联 trusted_companies): source_type = 'official', is_trusted = true
-- 可信平台 (RSS精选): source_type = 'trusted', is_trusted = false

-- 3.1 修复关联了 trusted_companies 的岗位
UPDATE jobs j
SET source_type = 'official', is_trusted = true
FROM trusted_companies tc
WHERE j.company_id = tc.company_id;

-- 3.2 修复 RSS 精选岗位
-- 如果 source_type 已经是 trusted，确保 is_trusted 为 false
UPDATE jobs
SET is_trusted = false
WHERE source_type = 'trusted';

-- 4. 修复 Industry (行业) - 强制同步
UPDATE jobs j
SET industry = tc.industry
FROM trusted_companies tc
WHERE j.company_id = tc.company_id 
AND j.industry IS DISTINCT FROM tc.industry
AND tc.industry IS NOT NULL;

-- 5. 修复 Tags (技能标签)
-- 简单示例修复
UPDATE jobs SET tags = tags || '["React"]'::jsonb WHERE (description ILIKE '%React%' OR title ILIKE '%React%') AND NOT (tags @> '["React"]'::jsonb) AND jsonb_array_length(tags) < 5;
UPDATE jobs SET tags = tags || '["Node.js"]'::jsonb WHERE (description ILIKE '%Node.js%' OR title ILIKE '%Node%') AND NOT (tags @> '["Node.js"]'::jsonb) AND jsonb_array_length(tags) < 5;
UPDATE jobs SET tags = tags || '["Python"]'::jsonb WHERE (description ILIKE '%Python%' OR title ILIKE '%Python%') AND NOT (tags @> '["Python"]'::jsonb) AND jsonb_array_length(tags) < 5;

-- 6. 修复 company_tags (从 trusted_companies 同步)
UPDATE jobs j
SET company_tags = tc.tags
FROM trusted_companies tc
WHERE j.company_id = tc.company_id 
AND j.company_tags IS DISTINCT FROM tc.tags;
