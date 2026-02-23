# Copilot升级方案

## 一、核心问题：

现在的copilot流程是：输入 → 一次性生成一份「完整方案」

问题是：
	1.	这是一次性文档，不是长期陪跑系统
	2.	没有状态记忆推进
	3.	没有岗位数据动态绑定
	4.	简历分析没有结构化抽取
	5.	面试与投递没有形成闭环系统

它更像一份规划书，不是一个远程求职操作系统。
我们实际真正想做的是：一个有状态、有进度、有岗位匹配、能持续更新的远程求职作战系统。


## 二、整体架构：

从文档生成升级为状态驱动型Copilot

✅ 结构化模块化生成 + 状态推进

## 三、Copilot最优结构

拆成 5 个核心子模块（每个模块独立生成，独立调用）

### 模块1: 远程适配度评估（轻量高价值）

目标
解决用户最关心的问题：
	•	我适不适合远程？
	•	距离远程差什么？

实现方式：让AI输出一个结构化JSON：
{
  "remote_readiness_score": 72,
  "strengths": [],
  "gaps": [],
  "priority_improvements": [],
  "risk_level": "low / medium / high"
}

然后前端渲染成：
	•	雷达图
	•	差距标签
	•	优先改进清单

Token优化策略
	•	第一次生成
	•	之后只在用户更新信息或上传新简历时重新生成
	•	不需要每次进入网站都调用模型

这个模块用 qwen plus 模型即可。


### 模块2: 动态岗位匹配引擎

这里非常关键，岗位匹配不用大模型，用：
	•	向量embedding + 相似度匹配
	•	或关键词权重评分

流程：
	1.	把用户职业方向、技能、经历提取成结构化tags
	2.	岗位库提前embedding
	3.	每次用户进入网站时：
	•	不调用大模型
	•	用本地算法算Top20匹配岗位
	•	只在解释原因时调用模型


### 模块3: 行动推进系统

不要再生成一份计划书，改为生成：
{
  "phases": [
    {
      "name": "简历优化阶段",
      "duration": "2周",
      "tasks": [
        {"task": "...", "type": "resume", "estimated_time": "2h"}
      ]
    }
  ]
}

用户可以：
	•	手动标记完成
	•	调整进度
	•	修改时间线
当用户完成某阶段时，触发：小模型调用 → 生成下一阶段具体执行建议


### 模块4: 简历与JD对齐引擎

这里可以做高价值付费功能。

技术思路
	1.	用户选择5个岗位
	2.	后端提取岗位JD核心要求（关键词抽取）
	3.	把简历做结构化提取：

{
  "skills": [],
  "experience": [],
  "metrics": [],
  "tools": []
}

	4.	用大模型做对齐分析：

输出：

{
  "match_score": 78,
  "missing_keywords": [],
  "resume_rewrite_suggestions": [],
  "cover_letter_outline": [],
  "email_template": "..."
}

Token控制策略
	•	JD先做摘要（不要直接喂完整JD）
	•	简历做结构化抽取后再分析
	•	分两次调用模型，而不是一次性塞全部

会员用max模型
普通用户不支持高级功能


### 模块5: 面试与英语提升

不要生成长篇英语学习计划。

改为生成：
{
  "interview_focus_areas": [],
  "common_questions": [],
  "answer_frameworks": [],
  "daily_speaking_plan": []
}

然后用户可以点击：
	•	生成模拟面试问题
	•	生成针对某岗位的问答

这时候才调用模型。
平时只展示结构化内容。


## 四、让Copilot活起来的关键：状态系统

必须加一个：用户状态表

记录：
	•	当前阶段
	•	已投递数量
	•	已面试数量
	•	面试反馈
	•	简历版本号
	•	上次生成时间

当用户再次进入时，不要重新生成。
而是：
	1.	读取状态
	2.	更新岗位推荐
	3.	仅在关键节点调用模型


## 五、Prompt优化方案参考

### 1. 总原则，所有Prompt通用
系统提示（System Prompt）统一：
{
你是一名专业的远程职业规划顾问和招聘专家。
请严格按照指定JSON格式输出。
不要输出解释说明。
不要输出多余文字。
不要添加代码块标记。
确保JSON可被直接解析。
}

### 模块1: 远程适配度评估
模型建议：qwen-plus 
调用时机：
	•	用户首次生成方案
	•	用户更新职业信息
	•	用户上传新简历

Prompt 模板:
{
根据以下用户信息，评估其远程工作适配度。

用户信息：
目标类型：{{goal_type}}
规划时间：{{timeline}}
职业方向：{{career_direction}}
工作年限：{{years_experience}}
学历：{{education}}
英语水平：{{english_level}}
核心技能：{{skills}}
（如有）简历结构化信息：
{{resume_structured_json}}

输出以下JSON：

{
  "remote_readiness_score": 0-100的整数,
  "readiness_level": "low / medium / high",
  "strengths": [
    {"point": "...", "reason": "..."}
  ],
  "gaps": [
    {"gap": "...", "impact": "..."}
  ],
  "priority_improvements": [
    {"action": "...", "expected_benefit": "..."}
  ],
  "estimated_offer_time_if_execute_well": "时间预估"
}
}

前端建议
	•	做雷达图
	•	做优先改进置顶卡片
	•	不展示长段文本


### 模块2: 简历结构化抽取
这是所有后续模块的基础。
模型：plus即可

Prompt
{
请将以下简历内容结构化提取。

简历内容：
{{resume_text}}

输出JSON：
{
  "career_level": "",
  "years_of_experience": "",
  "industries": [],
  "roles": [],
  "skills": [],
  "tools": [],
  "achievements_with_metrics": [],
  "management_experience": true/false,
  "english_related_experience": [],
  "remote_related_experience": []
}
}

### 模块3: 岗位JD结构化抽取（预处理）

备注：这个后台应该已经具备了，可以从已有的数据库里获取，字段可以使用数据库已有字段，prompt仅参考。

Prompt
{
提取以下JD核心要求：
{{job_description}}

输出JSON：
{
  "role": "",
  "required_skills": [],
  "preferred_skills": [],
  "experience_level": "",
  "industry": "",
  "tools": [],
  "language_requirement": "",
  "remote_type": ""
}
}

### 模块4: 简历 vs 5个JD对齐分析（会员核心功能）
模型：qwen-max

Prompt
{
你是一名招聘经理。
候选人简历结构化信息：
{{resume_structured_json}}
目标岗位信息（最多5个）：
{{job_structured_array}}
分析匹配情况。

输出JSON：
{
  "overall_match_score": 0-100,
  "strong_matches": [],
  "missing_keywords": [],
  "experience_gaps": [],
  "rewrite_suggestions": [
    {
      "original_problem": "",
      "optimized_version_example": ""
    }
  ],
  "cover_letter_outline": [
    "开头策略",
    "中段价值匹配",
    "结尾策略"
  ],
  "cold_email_template": "英文模板"
}
}

Token优化技巧
	•	不传完整JD，只传结构化版本
	•	不传完整简历，只传结构化版


### 模块5: 行动推进系统生成
模型：plus即可

Prompt
{
根据用户目标与时间规划，生成阶段性远程求职行动计划。

用户信息：
目标：{{goal}}
时间规划：{{timeline}}
远程适配评分：{{score}}
核心差距：{{gaps_array}}

输出JSON：
{
  "phases": [
    {
      "phase_name": "",
      "duration_weeks": "",
      "focus": "",
      "tasks": [
        {
          "task_name": "",
          "type": "resume / apply / network / interview / english",
          "priority": "high / medium / low"
        }
      ]
    }
  ]
}
}

### 模块6: 面试准备方案

模型：
plus（普通规划）
max（生成模拟问答）

Prompt（规划版）
{
根据以下信息生成远程英文面试准备方案。

职业方向：{{career}}
英语水平：{{english_level}}
目标岗位：{{target_role}}

输出JSON：
{
  "key_interview_topics": [],
  "common_questions": [],
  "answer_frameworks": [],
  "daily_speaking_plan": [],
  "improvement_priority": []
}
}

Prompt（模拟问答版本）
{
根据以下岗位与候选人背景生成3个模拟英文面试问题及参考答案。
岗位：
{{job_structured}}
候选人：
{{resume_structured}}

输出JSON：
{
  "mock_questions": [
    {
      "question": "",
      "sample_answer": "",
      "improvement_tip": ""
    }
  ]
}
}

### 模块7: 投递节奏优化器
Prompt
{
用户目标在{{timeline}}内拿到远程offer。
当前远程适配度：{{score}}
每周可投入时间：{{hours}}

请生成投递与面试节奏规划。

输出JSON：
{
  "weekly_application_target": "",
  "recommended_application_channels": [],
  "interview_pipeline_strategy": [],
  "risk_warnings": []
}
}

### 八、状态驱动增强Prompt（关键）

每次用户回来时：不要重新生成全部内容。
只调用：根据用户当前完成情况更新下一阶段建议。

当前阶段：{{current_phase}}
已完成任务：{{completed_tasks}}
未完成任务：{{pending_tasks}}
当前投递数量：{{applied_count}}
当前面试数量：{{interview_count}}

输出JSON：
{
  "next_focus": "",
  "adjustment_suggestions": [],
  "motivation_message": ""
}

这才是活的Copilot。

## 六、Token控制总结

模块	调用频率	模型
适配度	低	plus
岗位匹配	无模型	本地算法
计划生成	低	plus
简历对齐	付费	max
面试模拟	按需	max
进度更新	高频	plus
