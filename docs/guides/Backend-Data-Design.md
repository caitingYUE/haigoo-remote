# 后端数据设计与同步逻辑文档

## 1. 核心架构概述

本系统采用 **"重后端、轻前端"** 的架构设计。后端作为唯一的数据真理源（Single Source of Truth），负责数据的聚合、清洗、去重、分类和同步。前端仅负责展示和简单的过滤交互。

### 1.1 核心数据表

*   **`jobs`**: 存储所有职位的核心表。无论是来自 RSS、爬虫还是手动录入，最终都存储在这里。
*   **`trusted_companies`**: 存储可信企业（白名单）的元数据（Logo、官网、介绍等）。此表**不存储职位**，仅用于关联和元数据补充。

## 2. 数据来源与同步策略

系统支持三种主要的数据来源，每种来源有不同的同步和更新策略。

### 2.1 RSS 订阅数据 (RSS Feeds)
*   **来源性质**: 第三方聚合器（如 WeWorkRemotely, RemoteOK 等）。
*   **同步频率**: 高频（通过 Cron Job 定时触发）。
*   **写入逻辑**: `Upsert` (插入或更新)。
*   **关键字段**:
    *   `source`: RSS源名称 (e.g., "WeWorkRemotely")
    *   `sourceType`: `'rss'` (或 `'third-party'`)
    *   `isTrusted`: `false` (默认不可信，除非后续被清洗规则命中)
    *   `canRefer`: `false`
*   **去重策略**: 基于 `Title + Company + URL` 生成唯一哈希。

### 2.2 可信企业爬虫 (Trusted Company Crawler)
*   **来源性质**: 企业官方招聘页面（直接抓取）。
*   **同步频率**: 中低频（每日或手动触发）。
*   **同步逻辑**: **"Clean Slate" (彻底同步)**
    *   为了解决“职位下线”问题，爬虫采用**先删后加**的策略。
    *   **步骤 1**: 开启数据库事务。
    *   **步骤 2**: 删除该企业 ID 下所有 **非人工 (`source != 'manual'`)** 的职位。
    *   **步骤 3**: 插入本次爬取到的所有新职位。
    *   **步骤 4**: 提交事务。
*   **关键字段**:
    *   `source`: 企业名称 (e.g., "AlphaSights")
    *   `sourceType`: `'trusted'` (对应前端“企业官网岗位”橙色角标)
    *   `isTrusted`: `true`
    *   `company_id`: 关联 `trusted_companies` 表的 ID
*   **安全机制**: SQL 删除语句显式排除了 `source = 'manual'` 和 `is_manually_edited = true` 的记录，防止误删人工维护的数据。

### 2.3 手动录入 (Manual Entry)
*   **来源性质**: 管理员在后台手动添加或修改的职位。
*   **写入逻辑**: 单条 `Insert` 或 `Update`。
*   **关键要求**:
    *   必须设置 `source = 'manual'` 或 `is_manually_edited = true`。
    *   **只有标记为人工的数据才能在爬虫“洗板”操作中幸存。**
*   **关键字段**:
    *   `source`: `'manual'`
    *   `is_manually_edited`: `true`

## 3. 字段定义与规范

| 字段名 | 类型 | 含义 | 备注 |
| :--- | :--- | :--- | :--- |
| `id` | Serial | 自增主键 | 内部使用 |
| `job_id` | String | 业务唯一ID | 通常为哈希值或源站ID |
| `company_id` | String | 关联企业ID | 关联 `trusted_companies.company_id` |
| `source` | String | 数据来源描述 | e.g., "manual", "WeWorkRemotely", "AlphaSights" |
| `sourceType` | String | **核心分类字段** | 枚举值见下表 |
| `is_trusted` | Boolean | 是否为可信来源 | 决定是否显示“认证”标识 |
| `can_refer` | Boolean | 是否可内推 | 决定是否显示“内推”标识 |
| `is_manually_edited` | Boolean | 是否人工干预 | **保护位**，防止被爬虫自动清理 |

### 3.1 `sourceType` 枚举值

*   **`rss` / `third-party`**: 第三方聚合数据。点击跳转到第三方平台。
*   **`trusted`**: 可信企业官网数据。点击通常跳转到企业官网 ATS (Lever, Greenhouse 等)。对应“企业官网岗位”。
*   **`club-referral`**: 内部内推数据。点击进入内推流程。对应“Haigoo 内推”。
*   **`official`**: (旧值/兼容) 同 `trusted`。

## 4. 潜在风险与注意事项

1.  **Neon Serverless 事务限制**:
    *   由于使用 HTTP 连接，Neon 驱动的事务是模拟的（非持久连接）。
    *   **风险**: 极低概率下，如果“删除旧职位”成功但“写入新职位”失败（例如网络中断），该企业可能会暂时显示为 0 个职位，直到下次重试。
    *   **对策**: 保持爬虫任务的原子性，尽量在一个请求周期内完成。

2.  **数据保护**:
    *   在开发任何新的“批量清理”脚本时，**必须** 始终加上 `AND source != 'manual'` 条件。
    *   **切记**: 人工数据是最高优先级的，任何自动化脚本都不应覆盖人工数据。

3.  **缓存一致性**:
    *   前端 `processed-jobs` 接口有 CDN 缓存。数据更新后，用户可能需要几分钟才能看到变化（除非手动刷新或 CDN 失效）。

## 5. 开发建议

*   **新增字段**: 修改 `server-utils/dal/neon-ddl.sql` 并记录变更日期。
*   **修改爬虫**: 务必保留“Clean Slate”逻辑中的保护子句。
*   **排查问题**: 优先检查 `jobs` 表中的 `source` 和 `company_id` 字段。
