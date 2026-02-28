# Copilot Prompts 方案参考

## 总原则（所有Prompt通用）

系统提示（System Prompt）统一：

你是一名专业的远程职业规划顾问和招聘专家。
请严格按照指定JSON格式输出。
不要输出解释说明。
不要输出多余文字。
不要添加代码块标记。
确保JSON可被直接解析。

所有模块都遵循这个规则。

⸻

## 模块1: 远程适配度评估

模型建议：

qwen-plus 即可

调用时机：
	•	用户首次生成方案
	•	用户重新生成方案

Prompt 模板参考：

根据以下用户信息，评估其远程工作适配度。

用户信息：
目标类型：{{参数1}}
规划时间：{{参数2}}
职业方向：{{参数3}}
资历：{{参数4}}
学历：{{参数5}}
语言：{{参数6}}
（如有）简历结构化信息：
{{参数7}}

输出以下JSON：（可以根据代码的变量和参数调整json里的变量命名）

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


⸻

前端建议
	•	做雷达图
	•	做“优先改进”置顶卡片
	•	不展示长段文本
⸻

## 模块2: 简历结构化抽取（非常重要）

这是所有后续模块的基础。

模型：

plus即可

⸻

Prompt 参考：

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


⸻

## 模块3：岗位JD结构化抽取（预处理）

这个建议后台批量跑一次存数据库。（针对已审核通过的岗位即可）

⸻

Prompt 参考：

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


⸻

## 模块4：简历 vs 5个JD对齐分析（会员核心功能）

模型：

qwen-max

⸻

Prompt 参考：

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


⸻

Token优化技巧
	•	不传完整JD，只传结构化版本
	•	不传完整简历，只传结构化版

⸻

## 模块5：行动推进系统生成

模型：

plus即可

⸻

Prompt 参考：

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


⸻

## 模块6：面试准备方案

模型：

plus（普通规划）
max（生成模拟问答）

⸻

Prompt 参考（规划版）

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


⸻

模拟问答版本（会员）

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


⸻

## 模块7：投递节奏优化器（高级玩法）

⸻

Prompt 参考：

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


⸻

## 模块8：状态驱动增强Prompt（关键）

每次用户回来时：

不要重新生成全部内容。

只调用：

根据用户当前完成情况更新下一阶段建议。

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


⸻

## 九、Token控制总结

模块	调用频率	模型
适配度	低	plus
岗位匹配	无模型	本地算法
计划生成	低	plus
简历对齐	付费	max
面试模拟	按需	max
进度更新	高频	plus

