# 业务逻辑文档 (Business Logic Documentation)

本文档整理了 Haigoo Assistant 项目的核心业务逻辑，特别是职位分类、数据源管理及同步机制。旨在方便后续开发与维护。

## 1. 职位区域分类逻辑 (Region Classification)

为了满足用户“国内可申”和“海外可申”的双向需求，系统采用了 **三态分类 (3-State Logic)** 结合 **双向查询 (Bidirectional Query)** 的机制。

### 1.1 三态定义

数据库 `jobs` 表的 `region` 字段包含以下三种状态：

1.  **`domestic` (纯国内)**
    *   **定义**: 仅限中国大陆及港澳台地区的线下岗位。
    *   **关键词**: China, CN, Beijing, Shanghai, Shenzhen, Hong Kong, Taiwan, Macau 等。
    *   **适用场景**: 仅在“国内可申”列表中显示。

2.  **`overseas` (纯海外)**
    *   **定义**: 明确为欧美、日韩、东南亚等非大中华区的线下岗位。
    *   **关键词**: USA, UK, Europe, Japan, Singapore, Australia, North America 等。
    *   **适用场景**: 仅在“海外可申”列表中显示。

3.  **`global` (全球/远程/亚太)**
    *   **定义**: 不限地点、全球远程、亚太区（APAC）或时区友好的岗位。此类岗位既适合国内候选人申请（远程/亚太），也适合海外候选人申请。
    *   **关键词**: Anywhere, Global, Remote, APAC, Asia Pacific, GMT+8, UTC+8 等。
    *   **适用场景**: **同时**在“国内可申”和“海外可申”列表中显示。

### 1.2 双向查询逻辑 (Backend Query)

在后端接口 (`lib/api-handlers/processed-jobs.js`) 查询时，通过 SQL `IN` 语句实现双向包含：

*   **查询“国内可申” (`region=domestic`)**:
    *   SQL: `region IN ('domestic', 'global')`
    *   结果: 国内岗位 + Global/APAC 岗位

*   **查询“海外可申” (`region=overseas`)**:
    *   SQL: `region IN ('overseas', 'global')`
    *   结果: 海外岗位 + Global/APAC 岗位

---

## 2. 数据源与可信状态 (Source Type & Trusted Status)

为了区分岗位的来源可靠性和推荐优先级，系统使用了 `source_type` 和 `is_trusted` 两个字段的组合逻辑。

### 2.1 状态映射表

| 来源类型 | 对应字段值 | 业务含义 | 标识 |
| :--- | :--- | :--- | :--- |
| **企业官网直投** | `source_type='official'` <br> `is_trusted=true` | 来自【可信企业管理】列表中的企业，通过爬虫直接抓取官网。质量最高，无中间商。 | 橙色认证徽章 (Official) |
| **精选平台/社区** | `source_type='trusted'` <br> `is_trusted=false` | 来自人工运营的精选 RSS 源（如特定社区、招聘聚合站）。经过人工筛选，但非官网直投。 | 蓝色/无徽章 (Trusted Platform) |
| **第三方/普通RSS** | `source_type='rss'` <br> `is_trusted=false` | 来自广泛的第三方 RSS 源。未经人工严格筛选，仅做基础聚合。 | 无徽章 (Third-party) |
| **内推** | `can_refer=true` | 带有内推属性的岗位，优先级最高。 | 专属内推标识 |

### 2.2 数据清洗规则

*   若岗位关联了 `trusted_companies` 表中的企业，**强制**更新为 `source_type='official'` 且 `is_trusted=true`。
*   若 `source_type` 为 `trusted`，则 `is_trusted` 必须为 `false`（避免混淆官网直投和精选平台）。

---

## 3. 企业数据管理 (Company Data Management)

系统中的企业数据分为【可信企业】和【全部企业】两类，二者通过不同的维护方式和数据流向进行管理。

### 3.1 可信企业 (Trusted Companies)
*   **来源**: 由管理员在后台人工录入、审查。
*   **用途**: 作为高质量数据源的基准，关联“官网直投”岗位。
*   **数据流向**: 可信企业的信息（Logo、简介、行业等）拥有最高优先级，会强制同步覆盖关联岗位的信息。

### 3.2 全部企业 (All Companies)
*   **来源**: 综合了【可信企业】和【三方RSS聚合】的所有企业数据。
*   **维护机制**:
    *   **刷新数据 (Extract)**: 通过“刷新数据”操作，系统扫描 `jobs` 表，提取所有出现的 unique 企业名称，构建初步的企业列表。
    *   **智能补全 (Enrichment)**:
        *   **自动补全并翻译**: 设计爬虫算法抓取企业官网，获取 Logo、简介等信息。
        *   **AI 分析标签**: 基于企业简介，利用 AI 分析出企业的行业归属（Industry）和特性标签（Tags）。
    *   **反向同步 (Sync Back)**: 经过清洗和补全的企业信息（行业、标签、简介），会通过 `sync-jobs` 机制反向更新到 `jobs` 表中，确保职位列表显示的行业和标签准确。

---

## 4. 可信企业爬虫逻辑 (Trusted Company Crawler Logic)

针对【可信企业】的岗位抓取，系统设计了严格的更新和保护机制。

### 4.1 替换更新机制 (Replacement Logic)
*   **触发**: 手动触发或定时任务触发。
*   **逻辑**: 为了保证官网岗位的实时性，爬虫在写入新数据前，会执行 **替换 (Replace)** 操作。
    *   **先删后插**: 爬虫会先**删除**该企业 ID 下已存在的旧岗位数据，然后**插入**本次抓取的最新数据。
    *   **目的**: 防止企业官网已下线的岗位继续滞留在系统中，避免数据陈旧和错误。

### 4.2 人工数据保护 (Manual Entry Protection)
*   **背景**: 部分岗位可能由管理员手动添加（如内推岗位），不应被自动爬虫覆盖。
*   **保护规则**: 在执行删除操作时，系统会检查岗位的来源标识。
    *   **条件**: `source = 'manual'` 或 `is_manually_edited = true` 的岗位。
    *   **结果**: 这些岗位**不会**被爬虫删除，需要管理员人工进行维护（删除或修改）。

---

## 5. 数据清洗与维护 (Data Maintenance)

### 5.1 SQL 清洗脚本

位于 `scripts/data-cleaning/01_clean_jobs_data.sql`，用于修复历史数据污染和逻辑变更后的数据刷新。

**主要步骤**:
1.  **重置**: 将所有岗位的 `is_remote` 设为默认值。
2.  **Region 计算**: 依次执行 Global -> Domestic -> Overseas 的更新语句（注意顺序和排除逻辑）。
3.  **来源修复**: 基于 `trusted_companies` 关联修复 `source_type` 和 `is_trusted`。
4.  **字段同步**: 强制同步 `industry` 和 `tags`。

### 5.2 注意事项

*   **严禁 Mock**: 生产环境严禁使用 Mock 数据，必须基于真实数据库查询。
*   **数据库变更**: 修改表结构必须更新 `server-utils/dal/neon-ddl.sql`，并注明日期和原因。

---

## 6. 后台数据处理全流程 (Backend Data Processing Workflow)

本节详细描述从数据获取到最终展示的完整数据流转过程。

### 6.1 RSS 数据获取与处理
*   **来源**: 【RSS页面】
*   **操作**: 获取原始 RSS 数据 (Raw Data)。
*   **流程**:
    1.  **解析与理解**: 在【职位数据页面】，系统对 RSS 数据进行解析和语义理解。
    2.  **字段判定**: 处理并确定关键字段，包括：
        *   **基础信息**: 岗位分类、级别、企业名称、URL、岗位类型。
        *   **核心逻辑**: 区域限制、区域分类 (Region)、技能标签 (Tags)、语言要求、发布日期、岗位来源。
    3.  **翻译**: 执行岗位数据的翻译操作，生成中文对照。

### 6.2 企业信息聚合与补全
*   **来源**: 【企业管理】(All Companies)
*   **操作**:
    1.  **聚合**: 系统自动聚合职位数据中的企业信息（如 URL、岗位数量），构建【全部企业】列表。
    2.  **自动补全并翻译**: 点击按钮后，触发爬虫抓取企业官网，获取 Logo 和简介，并自动补充到当前页面。
    3.  **AI 分析标签**: 点击按钮后，后台基于企业简介，利用 AI 智能分析企业的所属行业 (Industry) 并打上特性标签 (Tags)。

### 6.3 可信企业管理
*   **来源**: 【可信企业管理】
*   **操作**:
    1.  **人工添加**: 支持管理员点击添加按钮手动录入企业。
    2.  **智能辅助**: 支持自动抓取企业简介、Logo 和岗位数据；支持基于简介判断行业、添加标签；支持判断是否可内推。
    3.  **数据归一**: 可信企业最终也会被归类到【全部企业】的大池子中，且其抓取的高质量岗位数据会同步更新到所有岗位数据中，供前端展示。
