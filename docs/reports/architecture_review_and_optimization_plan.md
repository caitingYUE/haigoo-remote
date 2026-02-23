# 架构审查与优化方案 (Architecture Review & Optimization Plan)

**日期**: 2026-01-08
**状态**: 进行中
**目标**: 构建更健壮、完善的 Haigoo Assistant 网站架构，遵循“重后端、轻前端”原则。

---

## 1. 现状审查 (Current State Review)

通过对代码库的深入分析，我们识别出以下关键问题、风险点及待优化项。

### 1.1 核心问题 (Critical Issues)

*   **违反“重后端、轻前端”原则**:
    *   **现象**: `src/services/rss-service.ts` 包含大量 RSS XML 解析、清洗和适配逻辑（如 `parseItemsByRegex`, `extractItemsFromXmlDoc`）。`src/services/classification-service.ts` 在前端维护了复杂的关键词映射。
    *   **影响**: 增加了前端 Bundle 体积；业务逻辑暴露在客户端；受限于用户设备性能；违反了 [project_rules.md](../.trae/rules/project_rules.md) 的核心规范。

*   **业务逻辑重复 (DRY Violation)**:
    *   **现象**: 职位分类、区域判定逻辑在前后端重复定义。
        *   后端: `lib/api-handlers/processed-jobs.js` (定义了 `GLOBAL_KEYWORDS` 等)。
        *   前端: `src/services/classification-service.ts` (定义了类似的关键词)。
    *   **影响**: 维护成本倍增；前后端判定逻辑可能不一致（Data Consistency Risk）。

*   **API 路由混乱**:
    *   **现象**: `api/data.js` 被标记为 `Deprecated` 但仍承载核心流量。新旧路由并存。
    *   **影响**: 增加了代码理解和维护的复杂度。

### 1.2 风险点 (Risks)

*   **硬编码环境配置**:
    *   **现象**: `src/services/processed-jobs-service.ts` 中硬编码了预发环境 URL (`private previewBaseUrl = 'https://...'`).
    *   **风险**: 环境迁移或分支变更将导致服务不可用。

*   **缓存策略风险**:
    *   **现象**: 后端使用 `globalThis.__haigoo_processed_jobs_mem` 进行简单的内存缓存。
    *   **风险**: 在 Serverless 环境下缓存行为不可控，可能导致数据陈旧或掩盖数据库错误。

### 1.3 待优化点 (Optimizations)

*   **类型系统断层**: 前端使用 TypeScript，后端使用 JavaScript，导致类型定义 (`src/types/`) 无法在后端直接复用，增加了类型不匹配的风险。

---

## 2. 优化方案与路线图 (Optimization Roadmap)

为了解决上述问题，我们将分阶段执行以下优化方案。

### 阶段一：核心逻辑后移 (Backend-Heavy Refactoring) - **Current Focus**

本阶段旨在移除前端的重型逻辑，将其迁移至后端 Serverless Functions。

#### 任务 1.1: RSS 解析逻辑迁移 (RSS Parsing Migration) - **Completed ✅**
*   **目标**: 前端不再解析 RSS XML。
*   **方案**:
    1.  完善后端 `lib/services/rss-parser.js`，使用 `cheerio` 替代前端的 DOM 解析。
    2.  迁移 `src/services/rss-service.ts` 中的适配器逻辑到后端。
    3.  前端 `src/services/rss-service.ts` 仅保留调用后端 API 的逻辑。
*   **状态**: 已完成。前端 `rss-service.ts` 和 `job-aggregator.ts` 已重构，移除了所有解析逻辑。后端 `stream-fetch-rss.js` 和 `stream-process-rss.js` 接管了数据流。

#### 任务 1.2: 分类服务统一 (Classification Service Unification)
*   **目标**: 唯一的分类真理来源 (Single Source of Truth) 在后端。
*   **方案**:
    1.  将 `src/services/classification-service.ts` 的关键词和分类算法完全迁移至 `lib/services/classification-service.js`。
    2.  前端在需要分类时（如预览），调用后端接口或使用后端返回的已分类字段。

### 阶段二：基础设施加固 (Infrastructure Hardening)

#### 任务 2.1: 环境变量规范化
*   **方案**: 移除硬编码 URL，使用 `import.meta.env.VITE_API_BASE_URL`，并在 Vercel 后台配置对应的环境变量。

#### 任务 2.2: API 路由重构
*   **方案**: 逐步迁移 `api/data.js` 的流量到 `api/jobs/index.js`, `api/companies/index.js` 等标准路由，最终删除 `api/data.js`。

### 阶段三：质量与监控 (Quality & Monitoring)

*   **任务 3.1**: 为后端关键逻辑添加单元测试（尤其是 RSS 解析和分类逻辑）。
*   **任务 3.2**: 完善错误监控日志。

---

## 3. 执行计划 (Execution Plan)

我们将立即开始 **阶段一** 的工作。

1.  **Analyze**: 检查后端现有的 `lib/cron-handlers/` 和 `lib/services/`，确认 RSS 处理现状。
2.  **Refactor**: 创建 `lib/services/rss-parser.js`，移植前端解析逻辑。
3.  **Integrate**: 更新后端 RSS 同步任务使用新的解析器。
4.  **Verify**: 验证数据抓取和解析的准确性。
5.  **Clean**: 移除前端冗余代码。
