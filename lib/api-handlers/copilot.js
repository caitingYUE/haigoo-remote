
import neonHelper from '../../server-utils/dal/neon-helper.js';
import { callBailianAPI } from '../bailian-parser.js';

/**
 * Remote Work Copilot API Handler
 * 
 * Handles generation of personalized remote work plans.
 * Supports:
 * - Trial generation for non-members (one-time)
 * - Full generation for members
 * - Resume syncing to user profile
 * - AI response generation via Bailian (Qwen)
 */
export default async function handler(req, res) {
  // 1. Auth Check (Basic)
  const token = req.headers.authorization?.split(' ')[1];
  const userId = req.method === 'GET' ? req.query.userId : req.body.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: User ID required' });
  }

  if (!neonHelper.isConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    // 2. GET: Fetch Latest Session (History)
    if (req.method === 'GET') {
      const sessionResult = await neonHelper.query(
        `SELECT * FROM copilot_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (sessionResult && sessionResult.length > 0) {
        const session = sessionResult[0];
        return res.status(200).json({
          success: true,
          plan: session.plan_data, 
          isTrial: session.is_trial,
          createdAt: session.created_at,
          isHistory: true
        });
      } else {
        return res.status(200).json({ success: true, plan: null });
      }
    }

    // 3. POST: Generate New Plan
    if (req.method === 'POST') {
      const { goal, timeline, background, resumeUrl } = req.body;

      // Fetch User Status
      const userResult = await neonHelper.query(
        `SELECT is_member, has_used_copilot_trial, resume_url FROM users WHERE id = $1`,
        [userId]
      );

      if (!userResult || userResult.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userResult[0];
      const isMember = user.is_member;
      const hasUsedTrial = user.has_used_copilot_trial;

      // Permission Check
      if (!isMember && hasUsedTrial) {
        return res.status(403).json({ 
          error: 'Trial limit reached', 
          code: 'TRIAL_EXPIRED',
          message: '您的试用次数已用完，请升级会员以获取完整报告。' 
        });
      }

      // Sync Resume
      if (resumeUrl && resumeUrl !== user.resume_url) {
        await neonHelper.query(
          `UPDATE users SET resume_url = $1 WHERE id = $2`,
          [resumeUrl, userId]
        );
      }

      // Generate Plan (Real AI)
      const plan = await generateAIPlan({ goal, timeline, background }, isMember);

      // Save Session
      const isTrial = !isMember;
      await neonHelper.query(
        `INSERT INTO copilot_sessions (user_id, goal, timeline, background, plan_data, is_trial) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, goal, timeline, JSON.stringify(background), JSON.stringify(plan), isTrial]
      );

      // Update Trial Status
      if (isTrial && !hasUsedTrial) {
        await neonHelper.query(
          `UPDATE users SET has_used_copilot_trial = true WHERE id = $1`,
          [userId]
        );
      }

      return res.status(200).json({
        success: true,
        plan,
        isTrial,
        remainingTrials: 0
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('[Copilot] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Generates an AI plan based on inputs using Bailian API
 */
async function generateAIPlan(inputs, isFullAccess) {
  const { goal, timeline, background } = inputs;
  const { education, industry, seniority, language } = background || {};

  const systemPrompt = `You are an expert Remote Career Coach. Your task is to generate a personalized remote work strategy plan based on the user's profile.
  
  Return the result strictly as a valid JSON object with the following structure:
  {
    "resumeEval": {
      "score": number (0-100),
      "strengths": string[] (2-3 items),
      "improvements": string[] (2-3 items)
    },
    "interviewPrep": {
      "focusAreas": string[] (3 items),
      "commonQuestions": string[] (3 items)
    },
    "recommendations": [
      { "title": string, "company": string, "match": string (e.g. "95%") }
    ]
  }

  ${isFullAccess ? `Also include "applicationPlan" object with:
    {
      "timeline": string,
      "steps": [{"week": number, "action": string, "priority": "High"|"Medium"}],
      "strategy": string
    }` : ''}
  
  Do not include any markdown formatting (like \`\`\`json). Just the raw JSON string.`;

  const userPrompt = `User Profile:
  - Goal: ${goal}
  - Timeline: ${timeline}
  - Role/Industry: ${industry}
  - Seniority: ${seniority}
  - Education: ${education}
  - Language: ${language}
  
  Please provide actionable advice specific to REMOTE work environments (async communication, timezone management, etc.).`;

  try {
    console.log('[Copilot] Calling Bailian API for plan generation...');
    const result = await callBailianAPI(userPrompt, systemPrompt);
    
    if (result && result.content) {
      // Clean up potential markdown code blocks
      const cleanContent = result.content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanContent);
    }
  } catch (e) {
    console.error('[Copilot] AI Generation Failed, falling back to mock:', e);
  }

  // Fallback to Mock if AI fails
  return generateMockPlan(inputs, isFullAccess);
}

/**
 * Generates a mock AI plan based on inputs (Fallback)
 */
function generateMockPlan(inputs, isFullAccess) {
  const { goal, timeline, background } = inputs;
  const { education, industry, seniority, language } = background || {};

  // 1. Resume Evaluation
  const resumeEval = {
    score: 75,
    strengths: [
      `您的${industry || '行业'}背景与远程工作需求高度匹配`,
      `${language || '英语'}能力是您申请国际远程岗位的核心优势`
    ],
    improvements: [
      '建议在简历中更突出量化成果（如：提升了xx%效率）',
      '增加"远程协作工具"技能板块（如Jira, Slack, Notion）',
      '针对远程岗位优化自我评价，强调自驱力和沟通能力'
    ]
  };

  // 2. Interview Prep (Simplified for Trial)
  const interviewPrep = {
    focusAreas: [
      '异步沟通能力的展示',
      '跨时区协作经验',
      '自我管理与交付能力'
    ],
    commonQuestions: [
      '你为什么选择远程工作？',
      '你如何处理与不同时区同事的沟通延迟？',
      '分享一次你独立解决复杂问题的经历'
    ]
  };

  // 3. Application Plan (Member Only)
  let applicationPlan = null;
  if (isFullAccess) {
    applicationPlan = {
      timeline: timeline || '3个月内',
      steps: [
        { week: 1, action: '优化英文简历与LinkedIn Profile', priority: 'High' },
        { week: 2, action: '筛选并投递5-10个目标岗位', priority: 'High' },
        { week: 3, action: '准备远程面试常见Q&A', priority: 'Medium' },
        { week: 4, action: '复盘投递反馈，调整策略', priority: 'Medium' }
      ],
      strategy: `针对您${seniority || '资深'}的${industry || ''}背景，建议优先通过LinkedIn和Haigoo精选内推渠道进行精准投递，避免海投。`
    };
  }

  // 4. Job Recommendations (Mock)
  // In real implementation, this would query the jobs DB with vector search
  const recommendations = [
    { title: `${industry || 'Senior'} Remote Specialist`, company: 'TechGlobal Inc.', match: '95%' },
    { title: `Remote ${industry || 'Manager'}`, company: 'CloudFirst Co.', match: '88%' },
    { title: `${industry || 'Analyst'} (APAC Remote)`, company: 'DataFlow', match: '82%' }
  ];

  return {
    resumeEval,
    interviewPrep,
    applicationPlan, // Null if trial
    recommendations
  };
}
