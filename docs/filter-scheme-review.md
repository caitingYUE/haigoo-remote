# 筛选规则复盘与优化方案 (Filter Scheme Review & Optimization)

## 1. 当前筛选规则总结 (Current Filter Rules)

后端筛选逻辑位于 `/lib/api-handlers/processed-jobs.js`，主要基于 SQL `WHERE` 子句构建。

| 筛选维度 | 参数名 | 逻辑 | 说明 |
| :--- | :--- | :--- | :--- |
| **关键词搜索** | `search` | `ILIKE` (Title OR Description) | 模糊匹配，按相关度排序 |
| **发布时间** | `dateFrom`, `dateTo` | `>=` / `<=` | 精确时间范围 |
| **区域/身份** | `regionType` / `region` | `IN ('domestic', 'both')` 或 `IN ('overseas', 'both')` | 支持国内/海外/全球筛选 |
| **职能分类** | `category` | `=` | 精确匹配 |
| **工作类型** | `jobType` / `type` | `ANY(array)` | 多选 (全职/兼职/合同等) |
| **经验要求** | `experienceLevel` | `ANY(array)` | 多选 (Entry/Mid/Senior等) |
| **行业领域** | `industry` | `ANY(array)` | 多选 |
| **时区** | `timezone` | `ANY(array)` | **[新增]** 多选，精确匹配字符串 |
| **状态** | `status` | `=` | 默认为 'active' |
| **远程** | `isRemote` | `=` | Boolean |
| **精选/认证** | `isTrusted`, `canRefer`, `isFeatured` | `=` | Boolean |
| **最新** | `isNew` | `>= 3 days ago` | 快捷筛选 |

## 2. 发现的问题 (Issues)

1.  **时区数据非标准化**: `timezone` 字段目前是自由文本 (VARCHAR)，可能存在 "EST", "Eastern Time", "GMT-5" 等多种表达，导致筛选列表冗长且重复。
2.  **薪资筛选缺失**: 代码中薪资筛选逻辑被注释掉 (`// Handle salary (range check)...`), 前端虽然有薪资筛选UI，但后端未生效。
3.  **区域筛选逻辑冗余**: 后端同时在 SQL 层 (`buildWhereClause`) 和 JS 层 (`filterJobByRegion`) 进行了区域过滤。如果分页是基于 SQL 的，JS 层的过滤会导致每页返回数量不足 `limit`，影响分页体验。
4.  **性能瓶颈**: 搜索使用 `ILIKE`，随着数据量增长性能会下降。

## 3. 优化方案 (Optimization Plan)

### P0: 时区筛选优化 (Timezone)
- **方案**: 前端提取所有去重后的时区列表，后端支持数组匹配 (已实施)。
- **后续**: 建议在数据入库时标准化时区格式 (e.g. 使用 IANA Timezone ID 如 `America/New_York` 或简写 `EST/PST`)。

### P1: 移除 JS 层冗余过滤 (Remove Redundant JS Filter)
- **方案**: 既然 SQL 已经处理了 `region` 过滤，应移除 `scatterJobs` 之前的 `filterJobByRegion` 调用，确保 SQL 分页的准确性。

### P2: 薪资筛选 (Salary)
- **方案**: 检查数据库是否有 `salary_min` / `salary_max` 字段。如果有，启用范围筛选；如果没有，暂时保持现状，等待数据层清洗薪资字段。

## 4. 实施记录 (Implementation Log)

- [x] **增加时区字段**: 数据库 `jobs` 表已确认包含 `timezone` 字段。
- [x] **后端支持**: `processed-jobs.js` 已更新 `mapRowToJob` 返回 `timezone`，`buildWhereClause` 支持 `timezone` 数组过滤。
- [x] **前端支持**: `JobFilterBar` 增加时区筛选下拉框，`JobsPage` 计算并传递时区选项。
- [x] **AI 解析优化**: 修复了 AI 返回错误提示作为 JD 的问题。

