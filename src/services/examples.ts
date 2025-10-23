/**
 * AI服务使用示例
 * 展示如何使用各种AI服务功能
 */

import { resumeService } from './resume-service'
import { jobService } from './job-service'
import { aiService } from './ai-service'
import { errorHandler } from './error-handler'
import type {
  ResumeOptimizationRequest,
  JobMatchRequest,
  JobRecommendationRequest,
  InterviewPrepRequest,
  SkillAssessmentRequest
} from './types'

/**
 * 简历优化示例
 */
export async function exampleResumeOptimization() {
  console.log('=== 简历优化示例 ===')
  
  const request: ResumeOptimizationRequest = {
    resumeContent: `
      张三
      前端开发工程师
      
      工作经验：
      - 2021-2023 ABC公司 前端开发工程师
        负责公司官网和管理系统的前端开发
        使用React、Vue.js等技术栈
        
      技能：
      - JavaScript, HTML, CSS
      - React, Vue.js
      - Node.js基础
    `,
    jobDescription: '招聘高级前端开发工程师，要求熟练掌握React、TypeScript、微前端架构',
    targetPosition: '高级前端开发工程师',
    optimizationType: 'job-specific'
  }

  try {
    const result = await resumeService.optimizeResume(request)
    
    if (result.success && result.data) {
      console.log('优化后的简历：')
      console.log(result.data.optimizedResume)
      console.log('\n改进建议：')
      result.data.suggestions.forEach((suggestion, index) => {
        console.log(`${index + 1}. ${suggestion}`)
      })
      console.log(`\n整体评分: ${result.data.score.overall}/100`)
    } else {
      console.error('简历优化失败:', result.error)
    }
  } catch (error) {
    console.error('简历优化异常:', error)
  }
}

/**
 * 职位匹配示例
 */
export async function exampleJobMatching() {
  console.log('\n=== 职位匹配示例 ===')
  
  const request: JobMatchRequest = {
    resumeContent: `
      李四
      全栈开发工程师
      
      工作经验：
      - 2020-2023 XYZ科技 全栈开发工程师
        负责电商平台的前后端开发
        前端：React, TypeScript, Ant Design
        后端：Node.js, Express, MongoDB
        
      技能：
      - 前端：React, Vue.js, TypeScript, JavaScript
      - 后端：Node.js, Python, Java
      - 数据库：MySQL, MongoDB, Redis
      - 工具：Git, Docker, AWS
    `,
    jobDescription: `
      职位：高级全栈开发工程师
      
      职责：
      - 负责公司核心产品的前后端开发
      - 参与系统架构设计和技术选型
      - 指导初级开发人员
      
      要求：
      - 3年以上全栈开发经验
      - 熟练掌握React、Node.js
      - 有微服务架构经验
      - 熟悉云服务部署
    `,
    requirements: [
      '3年以上全栈开发经验',
      '熟练掌握React、Node.js',
      '有微服务架构经验',
      '熟悉云服务部署'
    ]
  }

  try {
    const result = await jobService.analyzeJobMatch(request)
    
    if (result.success && result.data) {
      console.log(`匹配度评分: ${result.data.matchScore}/100`)
      console.log('\n匹配优势:')
      result.data.strengths.forEach((strength, index) => {
        console.log(`${index + 1}. ${strength}`)
      })
      console.log('\n技能差距:')
      result.data.gaps.forEach((gap, index) => {
        console.log(`${index + 1}. ${gap}`)
      })
      console.log('\n改进建议:')
      result.data.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`)
      })
    } else {
      console.error('职位匹配失败:', result.error)
    }
  } catch (error) {
    console.error('职位匹配异常:', error)
  }
}

/**
 * 职位推荐示例
 */
export async function exampleJobRecommendation() {
  console.log('\n=== 职位推荐示例 ===')
  
  const request: JobRecommendationRequest = {
    userProfile: {
      skills: ['JavaScript', 'React', 'Node.js', 'TypeScript', 'Python'],
      experience: `
        5年软件开发经验，主要从事Web前端和后端开发。
        熟练使用React生态系统，有大型项目经验。
        具备Node.js后端开发能力，了解微服务架构。
        有团队协作和项目管理经验。
      `,
      preferences: {
        location: '北京',
        salary: { min: 20000, max: 35000 },
        jobType: '全职',
        industry: ['互联网', '金融科技', '电商']
      }
    },
    limit: 3
  }

  try {
    const result = await jobService.recommendJobs(request)
    
    if (result.success && result.data) {
      console.log('推荐职位:')
      result.data.recommendations.forEach((job, index) => {
        console.log(`\n${index + 1}. ${job.title} - ${job.company}`)
        console.log(`   匹配度: ${job.matchScore}/100`)
        console.log('   推荐理由:')
        job.reasons.forEach((reason) => {
          console.log(`   - ${reason}`)
        })
      })
    } else {
      console.error('职位推荐失败:', result.error)
    }
  } catch (error) {
    console.error('职位推荐异常:', error)
  }
}

/**
 * 面试准备示例
 */
export async function exampleInterviewPrep() {
  console.log('\n=== 面试准备示例 ===')
  
  const request: InterviewPrepRequest = {
    jobDescription: `
      职位：前端架构师
      
      职责：
      - 负责前端技术架构设计
      - 制定前端开发规范和最佳实践
      - 指导团队技术成长
      
      要求：
      - 5年以上前端开发经验
      - 深入理解前端工程化
      - 有大型项目架构经验
      - 优秀的沟通和领导能力
    `,
    resumeContent: `
      王五
      高级前端开发工程师
      
      工作经验：
      - 2019-2023 DEF公司 高级前端开发工程师
        负责公司主要产品的前端架构设计和开发
        建立了完整的前端工程化体系
        指导了5人的前端团队
        
      技能：
      - 前端框架：React, Vue.js, Angular
      - 工程化：Webpack, Vite, Rollup
      - 架构：微前端, 组件库设计
      - 管理：团队协作, 代码审查
    `,
    interviewType: 'technical'
  }

  try {
    const result = await jobService.prepareInterview(request)
    
    if (result.success && result.data) {
      console.log('面试问题准备:')
      result.data.questions.forEach((q, index) => {
        console.log(`\n${index + 1}. ${q.question}`)
        console.log(`   类型: ${q.type} | 难度: ${q.difficulty}`)
        console.log('   回答技巧:')
        q.tips.forEach(tip => {
          console.log(`   - ${tip}`)
        })
      })
      
      console.log('\n面试准备建议:')
      result.data.preparation_tips.forEach((tip, index) => {
        console.log(`${index + 1}. ${tip}`)
      })
    } else {
      console.error('面试准备失败:', result.error)
    }
  } catch (error) {
    console.error('面试准备异常:', error)
  }
}

/**
 * 技能评估示例
 */
export async function exampleSkillAssessment() {
  console.log('\n=== 技能评估示例 ===')
  
  const request: SkillAssessmentRequest = {
    skills: ['JavaScript', 'React', 'Node.js', 'TypeScript', 'Python', 'Docker'],
    experience: `
      3年前端开发经验，主要使用React和TypeScript。
      有一定的Node.js后端开发经验。
      了解Docker容器化部署。
      参与过2个大型项目的开发。
    `,
    jobRequirements: [
      '熟练掌握JavaScript和TypeScript',
      '深入理解React生态系统',
      '有Node.js全栈开发能力',
      '熟悉容器化部署',
      '有大型项目经验'
    ]
  }

  try {
    const result = await jobService.assessSkills(request)
    
    if (result.success && result.data) {
      console.log(`整体技能评分: ${result.data.overallScore}/100`)
      console.log('\n技能详细评估:')
      result.data.assessments.forEach((assessment, index) => {
        console.log(`\n${index + 1}. ${assessment.skill}`)
        console.log(`   水平: ${assessment.level} | 置信度: ${assessment.confidence}%`)
        console.log('   提升建议:')
        assessment.recommendations.forEach(rec => {
          console.log(`   - ${rec}`)
        })
      })
      
      console.log('\n需要改进的领域:')
      result.data.improvementAreas.forEach((area, index) => {
        console.log(`${index + 1}. ${area}`)
      })
    } else {
      console.error('技能评估失败:', result.error)
    }
  } catch (error) {
    console.error('技能评估异常:', error)
  }
}

/**
 * 错误处理示例
 */
export async function exampleErrorHandling() {
  console.log('\n=== 错误处理示例 ===')
  
  // 模拟一个可能失败的操作
  const riskyOperation = async () => {
    // 随机失败
    if (Math.random() < 0.7) {
      throw new Error('模拟网络错误')
    }
    return { success: true, data: '操作成功' }
  }

  try {
    const result = await errorHandler.executeWithRetry(riskyOperation, {
      maxRetries: 3,
      baseDelay: 500
    })
    
    if (result.success) {
      console.log('操作成功:', result.data)
    } else {
      console.log('操作失败:', result.error)
      console.log('错误类型:', result.errorType)
    }
  } catch (error) {
    console.error('错误处理异常:', error)
  }
}

/**
 * 服务健康检查示例
 */
export async function exampleHealthCheck() {
  console.log('\n=== 服务健康检查示例 ===')
  
  try {
    const isHealthy = await aiService.checkServiceHealth()
    console.log('AI服务状态:', isHealthy ? '正常' : '异常')
    
    const models = aiService.getAvailableModels()
    console.log('可用模型:', models)
  } catch (error) {
    console.error('健康检查异常:', error)
  }
}

/**
 * 运行所有示例
 */
export async function runAllExamples() {
  console.log('开始运行AI服务示例...\n')
  
  try {
    await exampleHealthCheck()
    await exampleResumeOptimization()
    await exampleJobMatching()
    await exampleJobRecommendation()
    await exampleInterviewPrep()
    await exampleSkillAssessment()
    await exampleErrorHandling()
    
    console.log('\n✅ 所有示例运行完成!')
  } catch (error) {
    console.error('\n❌ 示例运行出错:', error)
  }
}