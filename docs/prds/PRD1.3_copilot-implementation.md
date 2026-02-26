# Copilot V1.3 技术实现方案（对齐 PRD V1.3-Rev2）

## 0. 文档信息
- 版本：V1.3-Impl-Rev2
- 更新时间：2026-02-26
- 对应产品文档：`docs/prds/PRDV1.3_copilot.md`
- 实施原则：用户体验优先、性能可控、低成本增量落地

---

## 1. 目标与技术边界

## 1.1 本次必须达成
1. 修复“副业目标却推荐全职”为主的错配问题。  
2. 在方案首位输出远程适配结论（是否适合远程 + 核心差距）。  
3. 首页轻量结果、个人中心深度结果、模块按需扩展。  
4. Copilot 结果可融入岗位列表和详情（`AI推荐` + 推荐解释）。  
5. 具备可灰度、可回滚、可观测能力。

## 1.2 技术边界（控成本）
1. **不新增独立 Serverless Function**，继续复用 `/api/copilot?action=...` 路由。  
2. **不引入外部向量数据库**（本期使用规则+统计匹配）。  
3. **不做大规模数据迁移**，优先复用现有表和字段。  
4. AI 仅用于“解释/方案生成”，不放在主匹配链路。

---

## 2. 当前实现现状（与新版目标对齐）

## 2.1 已有能力（可复用）
1. `lib/api-handlers/copilot.js` 已有：
   - 目标/会员分层；
   - `refresh-recommendations`；
   - 匹配分阈值与高中低分层；
   - 推荐缓存（内存 TTL）。
2. `lib/services/matching-engine.js` 已有：
   - 结构化评分（skill/keyword/experience/preference）；
   - 缓存表 `user_job_matches`；
   - 用户画像与岗位特征提取。
3. `lib/api-handlers/processed-jobs.js` 已有：
   - `jobs_with_match_score` 个性化分数；
   - `match_details` 回填与会员锁逻辑；
   - 匹配底线过滤与分级映射。
4. 前端已具备：
   - `GeneratedPlanView` 推荐展示与刷新；
   - `JobDetailPanel` 中 `[AI匹配分析]` 模块；
   - 空推荐场景引导（岗位追踪/通用岗位）。

## 2.2 当前差距
1. “目标一致性”在推荐主链路权重不足（side-income 未做强约束）。  
2. 首页/个人中心仍偏“一次性计划”，分段生成策略未完全打通。  
3. 列表页尚未系统化标注 `AI推荐`。  
4. `copilot-v1.3.js` 中部分状态表（`copilot_user_state` 等）缺统一迁移文档，落地风险高。

---

## 3. 总体架构（低成本可落地）

## 3.1 双层引擎架构
1. **规则主干引擎（必须快）**
   - 输入：goal/background/language/resume profile/job features；
   - 输出：`goalFit`, `skillFit`, `skillAdjacency`, `languageFit`, `matchLevel`；
   - 不依赖 AI，支持缓存与批量计算。
2. **AI 解释引擎（可延后）**
   - 输入：规则引擎结果；
   - 输出：远程适配结论、推荐理由、行动建议、模块扩展内容。

## 3.2 分段生成架构
1. Lite（首页）：
   - 远程适配结论；
   - Top3-5 推荐；
   - 3 个关键行动。
2. Deep（个人中心）：
   - 语言准备；
   - 面试准备；
   - 投递计划。
3. Expand（二次触发）：
   - 面试“生成更多问题/模拟回答”；
   - 语言“扩展30天计划/学习资源”。

---

## 4. 核心算法改造（P0 必做）

## 4.1 目标感知评分模型
统一评分（默认）：

`S = GoalFit*0.30 + SkillFit*0.25 + SkillAdjacency*0.20 + LanguageFit*0.10 + ExperienceFit*0.10 + RemoteFit*0.05`

## 4.2 Goal Fit 规则（关键）
1. `goal=side-income`：
   - jobType 为 `part-time/freelance/contract/project-based`：高分；
   - `full-time` 仅在存在弹性信号（如 flexible/part-time possible）时给中分；
   - 否则降档或排除 TopN。
2. `goal=full-time`：
   - 全职优先，兼职可作为补充。
3. `goal=career-pivot/market-watch`：
   - 强化 SkillAdjacency 权重。

## 4.3 Skill Adjacency（邻近匹配）
1. 基于技能词典和角色映射做“可迁移岗位”加分。  
2. 不要求同岗，但要求技能集交集达到阈值。  
3. 输出 `skillAdjacencyScore`，用于推荐解释与 `AI推荐` 标识。

## 4.4 远程适配结论输出
1. `readiness_level`: `fit / transformable / not-ready`。  
2. `key_gaps`: Top3 缺口（语言、异步协作、作品证明、时区协作）。  
3. `next_actions`: 每个缺口至少一个可执行动作。

---

## 5. 接口设计（基于现有路由增量）

## 5.1 `/api/copilot` action 路由
1. 保留：`generate`, `refresh-recommendations`, `get-state`, `assess`, `match-jobs`, `create-plan`, `update-progress`。  
2. 新增（P1）：`expand-module`，参数：
   - `module=interview|language|apply`
   - `intent=more-questions|mock-answer|deep-plan|resources`
3. 输出结构升级：`plan_v2`（兼容旧结构）。

## 5.2 推荐结果结构（建议）
```json
{
  "id": "job_id",
  "title": "职位名",
  "company": "公司名",
  "matchLevel": "high|medium|low|none",
  "matchLabel": "高匹配|中匹配|低匹配",
  "goalFitScore": 0,
  "skillAdjacencyScore": 0,
  "aiRecommended": true,
  "reason": "推荐理由",
  "matchDetails": {},
  "matchDetailsLocked": false
}
```

## 5.3 列表页融合接口
1. 复用 `processed-jobs?action=jobs_with_match_score`。  
2. 增加可选参数：
   - `copilotGoal=side-income|full-time|...`
   - `copilotContext=1`
3. 返回附加字段：
   - `aiRecommended`（满足目标与匹配阈值）；
   - `goalFitScore`（可用于排序解释）。

---

## 6. 数据层方案（可落地、低迁移成本）

## 6.1 优先复用
1. 匹配缓存复用 `user_job_matches`（已在线使用）。  
2. 历史方案复用 `copilot_sessions`（加 `module` 字段）。  
3. 简历结构化优先写入 `copilot_user_state.resume_structured`。

## 6.2 最小新增表（仅在不存在时创建）
1. `copilot_user_state`：单用户状态（resume structured、readiness、phase、plan）。  
2. `copilot_tasks`：行动计划任务状态。  

> 不再新增 `copilot_job_matches`，避免与 `user_job_matches` 重复维护。

## 6.3 迁移策略
1. 新增一份幂等 migration（`IF NOT EXISTS`）。  
2. 不改历史数据结构，在线平滑扩展。  
3. 新表不可用时，接口自动降级到旧 `generate` 路径，保证可用性。

---

## 7. 前端实现策略（体验与性能并重）

## 7.1 首页（Lite）
1. 仅展示：readiness + Top3-5 + 3 steps。  
2. “刷新岗位”只刷新推荐模块，不刷新整页计划。  
3. 无匹配时显示引导（岗位追踪 + 通用岗位）。

## 7.2 个人中心（Deep）
1. 默认展示详细方案骨架。  
2. 模块内容按需加载（点击展开才请求 `expand-module`）。  
3. 每个模块独立 loading/error，避免全页阻塞。

## 7.3 岗位列表与详情融合
1. 列表卡片显示 `AI推荐` 标签（符合 Copilot 目标约束且高/中匹配）。  
2. 详情页保留 `[AI匹配分析]`，会员门控与折叠逻辑不变。  
3. 排序新增“按我的目标匹配”。

---

## 8. 性能与成本控制

## 8.1 性能预算
1. 首页 Lite：`p95 <= 2.5s`（缓存命中 <= 1.2s）。  
2. 刷新推荐：`p95 <= 1.8s`。  
3. 模块扩展：`p95 <= 4.0s`。

## 8.2 缓存设计
1. 推荐缓存 key：`userId + goal + role + seniority + isMember + resumeVersion`。  
2. 计划缓存 key：`userId + goal + timeline + resumeVersion`。  
3. 模块缓存 key：`userId + module + planVersion`。

## 8.3 Token 控制
1. 主推荐链路不依赖 AI。  
2. 首页只跑轻量 prompt。  
3. 深度模块按需触发。  
4. 复用结构化中间结果，避免重复喂整段简历/JD。

---

## 9. 可靠性、灰度与回滚

## 9.1 灰度开关
1. `COPILOT_GOAL_AWARE_SCORING_ENABLED`  
2. `COPILOT_PLAN_V2_ENABLED`  
3. `COPILOT_AI_RECOMMENDED_TAG_ENABLED`

## 9.2 回滚策略
1. 任何异常可切回旧 `generate` 与旧推荐排序。  
2. 新字段为可选字段，不影响旧前端渲染。  
3. 模块接口失败不影响岗位浏览主路径。

## 9.3 容错策略
1. AI 超时/失败：返回规则版保底结果。  
2. 新状态表缺失：自动退回 legacy path 并记录告警。  
3. JSON 解析失败：schema 校验失败后走 fallback。

---

## 10. 监控与埋点

## 10.1 必备埋点
1. `copilot_goal_mismatch_detected`  
2. `copilot_recommendation_refresh_clicked`  
3. `copilot_module_expand_clicked`  
4. `ai_recommended_job_clicked`  
5. `copilot_to_apply_conversion`

## 10.2 技术监控
1. 接口响应时间（p50/p95/p99）。  
2. 缓存命中率。  
3. AI 失败率与 fallback 比例。  
4. 目标错配率（side-income 用户 TopN 的 jobType 分布）。

---

## 11. 分阶段落地计划（技术视角）

## P0（1-1.5 周）
1. Goal Fit 强约束 + 动态权重接入 `fetchCandidateJobs`/匹配主链路。  
2. `plan_v2` Lite 输出（含 readiness 首位结论）。  
3. 列表与详情使用统一 match 规则；埋点与灰度开关接入。  

## P1（1.5-2 周）
1. Deep 模块骨架 + `expand-module`。  
2. 面试/语言/投递模块按需生成。  
3. 模块缓存与局部刷新。

## P2（1-1.5 周）
1. 列表 `AI推荐` 标签 + 目标匹配排序/筛选。  
2. 交互“流动感”优化（状态推进、过渡反馈）。  
3. A/B 与参数调优。

---

## 12. 验收标准（技术实现）

1. side-income 用户 Top3 推荐岗位类型符合预期（兼职/合同/自由职业占比达标）。  
2. 首页首屏展示远程适配结论且稳定返回。  
3. 模块扩展为增量请求，失败不影响主流程。  
4. 列表页可展示 `AI推荐`，详情页可展示对应推荐解释。  
5. 性能与可靠性指标达到预算。

---

## 13. 结论

本方案采用“规则主干 + AI解释 + 分段生成 + 全站融合”的低成本路径：  
先解决最影响体验的目标错配，再逐步增强深度内容与互动能力。  
在不引入重型基础设施的前提下，实现可落地、可观测、可扩展的 Copilot V1.3。

