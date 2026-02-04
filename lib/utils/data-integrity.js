
/**
 * Data Integrity Guard
 * 
 * 专门用于保护核心业务数据，防止在同步、迁移或更新过程中意外覆盖或丢失关键字段。
 * 解决了 "Read-Modify-Write" 模式中因查询字段缺失导致的数据回写丢失问题。
 */

// 核心保留字段：无论爬虫爬取到什么新数据，这些字段在更新时如果数据库中已有值，
// 且新数据为空或不应覆盖时，必须强制保留数据库中的原值。
export const PROTECTED_JOB_FIELDS = [
    // 业务分类与元数据 (高价值，人工维护)
    'industry',
    'category',
    'tags',
    'jobType',
    'experienceLevel',
    'salary', // 往往人工修正过
    'region',
    'location', // 爬虫可能爬取到 "Remote"，但人工修正为 "US (Remote)"
    'timezone',

    // 状态与权限控制 (绝对不可丢失)
    'isManuallyEdited',
    'isApproved',
    'isFeatured',
    'canRefer',
    'status',
    'sourceType',

    // 内部管理字段
    'riskRating',
    'haigooComment',
    'hiddenFields',
    
    // 昂贵的生成内容
    'translations',
    'isTranslated',
    'translatedAt'
];

/**
 * 智能合并：将数据库中的现有数据 (existing) 安全地合并到新抓取的数据 (incoming) 中
 * @param {object} incoming - 新抓取/生成的数据对象
 * @param {object} existing - 数据库中已存在的完整数据对象
 * @param {object} options - 配置项
 * @returns {object} 合并后的安全对象
 */
export function mergeWithIntegrity(incoming, existing, options = {}) {
    if (!existing) return incoming;

    const merged = { ...incoming };
    const { isManualOverride = false } = options;

    // 如果是人工编辑过的数据，或者配置了强制保留，则严格保护
    const shouldProtect = existing.isManuallyEdited || existing.sourceType === 'manual' || isManualOverride;

    PROTECTED_JOB_FIELDS.forEach(field => {
        const existingValue = existing[field];
        const incomingValue = incoming[field];

        // 策略 1: 如果数据库中有值，而新数据中没有 (undefined/null/empty)，强制保留旧值
        // 防止 SELECT漏查字段 -> 写入空值 的事故
        if (hasValue(existingValue) && !hasValue(incomingValue)) {
            merged[field] = existingValue;
            return;
        }

        // 策略 2: 如果是受保护记录 (人工编辑过)，且旧值存在，则以旧值为准 (忽略爬虫的新值)
        // 除非新值明确是 "更有价值" 的更新 (这很难判断，通常人工编辑 > 爬虫)
        if (shouldProtect && hasValue(existingValue)) {
            // 特例：如果是追加型字段 (如 tags)，可能需要合并而不是覆盖？
            // 目前策略：人工编辑过的字段，爬虫不许改。
            merged[field] = existingValue;
        }
    });

    // 总是保留 ID 和关键标识
    merged.id = existing.id || merged.id;
    merged.companyId = existing.companyId || merged.companyId;

    return merged;
}

/**
 * 完整性检查：在写入数据库前，最后一次验证关键字段是否异常丢失
 * @param {object} finalObject - 准备写入的对象
 * @param {object} originalObject - 原始对象 (可选)
 * @throws {Error} 如果检测到非法的数据丢失
 */
export function validateIntegrity(finalObject, originalObject) {
    if (!originalObject) return true;

    const criticalChecks = ['industry', 'isApproved', 'sourceType'];
    const errors = [];

    criticalChecks.forEach(field => {
        // 如果原值存在且非空，但新值丢失了，且不是故意置空 (这里假设我们很少故意置空核心字段)
        if (hasValue(originalObject[field]) && !hasValue(finalObject[field])) {
            errors.push(`Critical field lost: ${field} (Was: ${JSON.stringify(originalObject[field])}, Now: Empty)`);
        }
    });

    if (errors.length > 0) {
        throw new Error(`[DataIntegrityViolation] 拒绝写入：检测到核心数据丢失！\n${errors.join('\n')}`);
    }

    return true;
}

// 辅助：判断是否有有效值 (非 null, undefined, 空字符串)
function hasValue(val) {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string' && val.trim() === '') return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
}
