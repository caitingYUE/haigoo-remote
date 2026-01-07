# API 服务使用情况与成本优化报告

**日期**: 2026-01-07
**状态**: 已更新 (Refining Strategy)

---

## 1. 核心策略调整 (Strategy Update)

根据用户反馈与网络环境测试，我们调整了整体 AI 服务策略：
1.  **翻译服务**: **免费优先** (Google Translate) > **AI 兜底**。
    -   *原因*: 免费服务足够应对大多数简单翻译，且响应最快。只有当免费服务失败时，才调用 AI。
2.  **AI 提供商**: **Alibaba Bailian (Qwen)** > **DeepSeek**。
    -   *原因*: 虽然 DeepSeek 极其便宜，但在 VPN 环境下连接不稳定。Qwen (通义千问) 更加稳定可靠。
3.  **使用场景**: AI 将聚焦于 **复杂数据处理** (爬虫解析、简历分析) 而非简单翻译。

---

## 2. API 使用点梳理 (API Usage Audit)

### A. 岗位翻译 (Job Translation) - 后端
- **代码位置**: `lib/services/translation-service.cjs`
- **优先级**:
    1.  **Google Translate** (Free)
    2.  **LibreTranslate** (Free)
    3.  **MyMemory** (Free)
    4.  **AI Service** (Bailian/DeepSeek) - *仅作为兜底*
- **成本影响**: 预计 90% 的翻译请求将由免费服务承担，大幅降低 token 消耗。

### B. 简历分析 (Resume Analysis) - 后端
- **代码位置**: `lib/api-handlers/resumes.js`
- **提供商**: 优先使用 **Alibaba Bailian**。
- **触发**: 用户主动点击，仅限会员。
- **功能**: 深度简历评分与优化建议 (高价值场景)。

### C. 爬虫增强 (Crawler Enhancement) - 爬虫脚本
- **代码位置**: `lib/job-crawler.js` (使用 `bailian-parser.js`)
- **逻辑**: 当 CSS Selector 提取失败时，使用 Bailian (Qwen-Plus) 智能提取 JD。
- **优化**: 仅在必要时开启 (`useAI=true`)，作为处理复杂/动态网页的强力工具。

### D. 前端 AI 助手 (Frontend Job Services)
- **代码位置**: `src/services/job-service.ts`
- **提供商**: 统一使用 Alibaba Bailian。

---

## 3. 消耗量估算 (Cost Estimation)

### 场景 A: 岗位翻译 (低频 AI 调用)
由于改为兜底策略，AI 调用量将大幅下降。
- **假设**: 10% 的每日岗位 (约 100 个) 需要 AI 介入。
- **DeepSeek 成本**: 忽略不计。
- **Bailian (Qwen-Plus) 成本**:
    - 输入: 0.004元/1k tokens
    - 输出: 0.012元/1k tokens
    - 100 岗位 * 2k tokens ≈ 0.2M tokens ≈ **￥1.00 - ￥2.00 / 天**
- **结论**: 即使使用较贵的 Qwen-Plus，作为兜底使用时成本依然极低。

### 场景 B: 爬虫与分析 (高价值)
- 这部分是 AI 真正发挥价值的地方（非结构化转结构化）。
- 建议为此类操作保留主要预算。

---

## 4. 最佳实践总结

1.  **稳定性优先**: 所有 AI 调用链路上，都已配置 Bailian 优先，DeepSeek 作为备选（或仅在非关键路径使用）。
2.  **避免滥用**: 爬虫脚本默认不开启 `useAI`，需人工确认目标站点难以解析时再开启。
3.  **监控**: 继续观察 `system_settings` 中的 token 计数，确保没有异常暴涨。

---
*注: 此文档反映了 2026-01-07 的最新代码逻辑配置。*
