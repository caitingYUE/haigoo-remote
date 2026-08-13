# 数据协议、状态机与 API 草案

## 1. 任务状态

```ts
type WorkflowState =
  | "draft"
  | "file_uploaded"
  | "intake_completed"
  | "parsing"
  | "parse_failed"
  | "assessing"
  | "needs_clarification"
  | "assessment_ready"
  | "profile_pending_confirmation"
  | "profile_confirmed"
  | "matching"
  | "matches_ready"
  | "shortlist_confirmed"
  | "tailoring"
  | "tailored_resume_ready"
  | "application_started"
  | "archived"
  | "deletion_pending"
  | "deleted";
```

所有状态变化需要写入审计事件，后台任务必须幂等。

## 2. 核心结构

### 2.1 EvidenceItem

```ts
type EvidenceItem = {
  id: string;
  userId: string;
  sourceType: "resume" | "user_answer" | "portfolio" | "manual_review";
  sourceRef: string;
  category: "responsibility" | "project" | "outcome" | "skill" | "language" | "tool" | "work_style";
  statement: string;
  normalizedTags: string[];
  evidenceGrade: "A" | "B" | "C" | "D" | "U";
  confirmedByUser: boolean;
  containsMetric: boolean;
  metric?: {
    value: number;
    unit: string;
    baseline?: number;
    period?: string;
    scope?: string;
  };
};
```

### 2.2 CandidateProfile

```ts
type CandidateProfile = {
  id: string;
  userId: string;
  version: number;
  headline: string;
  seniority: "entry" | "mid" | "senior_ic" | "manager" | "director" | "uncertain";
  primaryFunctions: string[];
  transferableSkills: Array<{ name: string; level: "strong" | "moderate" | "emerging"; evidenceIds: string[] }>;
  domainAssets: Array<{ name: string; years?: number; evidenceIds: string[] }>;
  workStyleStrengths: Array<{ name: string; evidenceIds: string[] }>;
  languages: Array<{ language: string; level: string; evidenceIds: string[]; confirmed: boolean }>;
  tools: Array<{ name: string; level?: string; evidenceIds: string[]; confirmed: boolean }>;
  remoteStrengths: string[];
  remoteConstraints: {
    locations: string[];
    timezone: string;
    workModes: string[];
    weeklyHours?: number;
    availabilityWindows: Array<{ days: string[]; start: string; end: string; timezone: string }>;
    eveningOverlap: "yes" | "limited" | "no";
    workAuthorization?: string[];
    excludedConditions?: string[];
  };
  targetRolesNow: string[];
  targetRolesBridge: string[];
  targetRolesLater: string[];
  excludedRoles: string[];
  evidenceGaps: string[];
  unverifiedClaims: string[];
  confirmationStatus: "draft" | "confirmed";
  confirmedAt?: string;
};
```

### 2.3 JobRequirement

```ts
type JobRequirement = {
  jobId: string;
  functionTags: string[];
  domainTags: string[];
  seniority: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  languages: Array<{ language: string; level?: string; required: boolean }>;
  locationPolicy: {
    remoteType: "global" | "country_limited" | "region_limited" | "hybrid" | "onsite" | "unclear";
    allowedCountries: string[];
    excludedCountries: string[];
    workAuthorizationRequired?: boolean;
  };
  timezonePolicy: {
    requiredTimezone?: string;
    overlapWindows?: Array<{ start: string; end: string; timezone: string }>;
    asyncFriendly?: boolean;
  };
  employmentTypes: string[];
  schedule?: "fixed" | "flexible" | "shift" | "unclear";
  salary?: { currency: string; min?: number; max?: number; period?: string };
  sourceVerifiedAt?: string;
  eligibilityConfidence: "high" | "medium" | "low";
};
```

### 2.4 JobMatch

```ts
type JobMatch = {
  id: string;
  userId: string;
  profileVersion: number;
  jobId: string;
  eligibility: "eligible" | "possibly_eligible" | "ineligible";
  hardFilterReasons: string[];
  score: number;
  scoreBreakdown: {
    eligibility: number;
    skills: number;
    domain: number;
    seniority: number;
    workStyle: number;
    preference: number;
  };
  matchingEvidenceIds: string[];
  strengths: string[];
  gaps: string[];
  risks: string[];
  recommendedResumeTemplateId?: string;
  explanation: string;
};
```

### 2.5 TailoredResume

```ts
type TailoredResume = {
  id: string;
  userId: string;
  jobId: string;
  profileVersion: number;
  sourceResumeVersionId: string;
  templateId: string;
  language: string;
  content: ResumeDocument;
  claimChecks: Array<{
    path: string;
    text: string;
    evidenceIds: string[];
    status: "verified" | "needs_user_confirmation" | "blocked";
  }>;
  diff: Array<{
    type: "added_from_confirmed_evidence" | "rewritten" | "removed" | "reordered" | "risk";
    before?: string;
    after?: string;
    reason: string;
  }>;
  status: "draft" | "user_confirmed" | "exported";
};
```

## 3. 数据库迁移原则

- 使用 UUID；
- 所有核心对象具有 `created_at`, `updated_at`, `deleted_at`；
- AI 输出保存 `prompt_version`, `model_config`, `schema_version`；
- CandidateProfile 和 TailoredResume 使用版本表，不原地覆盖；
- 原始文件和导出文件只保存私有对象路径；
- 软删除与真正物理删除流程分开；
- JobPost 保留抓取来源与最后验证时间；
- PII 表和分析表逻辑隔离。

## 4. API 草案

### 用户端

```text
POST   /api/career/resumes/upload
POST   /api/career/intake
POST   /api/career/assessments
GET    /api/career/assessments/:id
POST   /api/career/assessments/:id/answers
GET    /api/career/profiles/:id
PATCH  /api/career/profiles/:id
POST   /api/career/profiles/:id/confirm
POST   /api/career/matches
GET    /api/career/matches/:runId
POST   /api/career/matches/:matchId/feedback
POST   /api/career/shortlists
POST   /api/career/tailored-resumes
GET    /api/career/tailored-resumes/:id
PATCH  /api/career/tailored-resumes/:id
POST   /api/career/tailored-resumes/:id/confirm
POST   /api/career/tailored-resumes/:id/export
POST   /api/career/applications
PATCH  /api/career/applications/:id
POST   /api/career/privacy/export
DELETE /api/career/privacy/data
```

### 管理端

```text
GET    /api/admin/career/jobs/review-queue
PATCH  /api/admin/career/jobs/:id/eligibility
GET    /api/admin/career/ai/runs
GET    /api/admin/career/review-queue
POST   /api/admin/career/reviews/:id/resolve
GET    /api/admin/career/templates
POST   /api/admin/career/templates
PATCH  /api/admin/career/templates/:id
POST   /api/admin/career/prompts/publish
POST   /api/admin/career/evals/run
GET    /api/admin/career/metrics
```

## 5. 工具函数协议

AI Orchestrator 只能通过受控函数读取业务数据：

```text
get_candidate_profile(profile_id)
get_evidence_items(profile_id, filters)
search_jobs(filters, semantic_query, limit)
get_job(job_id)
get_job_requirements(job_id)
get_resume_template(template_id)
create_manual_review(reason, entity_id, metadata)
record_ai_run(stage, status, usage, error)
```

模型不能直接拥有数据库写权限。工具层校验用户权限、字段和幂等键。

## 6. 错误处理

- 文件无法解析：允许重新上传或粘贴文本；
- AI Schema 失败：自动重试一次，再进入人工或简化模式；
- 岗位库无结果：展示原因，不编造岗位；
- 导出失败：保留 Resume AST，可重新导出；
- 任务超时：显示可恢复状态；
- 用户答案冲突：标记冲突，要求确认，不自动选择一方。

## 7. 事件埋点

禁止在事件属性中记录简历正文、姓名、电话、邮箱和详细家庭信息。

建议事件：

```text
career_landing_viewed
resume_upload_started
resume_upload_completed
intake_completed
assessment_started
clarification_answered
assessment_viewed
profile_edited
profile_confirmed
matches_viewed
job_feedback_submitted
job_shortlisted
tailored_resume_started
tailored_resume_confirmed
resume_exported
application_link_opened
application_status_updated
career_data_deleted
```
