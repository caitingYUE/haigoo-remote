import type { LearningVideo } from '../types'

// 职业成长内容接口将在岗位主链路稳定后单独接入。
// 目前只保留与网站已有课程一致的展示数据，不参与岗位或申请逻辑。
export const mockVideos: LearningVideo[] = [
  {
    id: 'remote-interview',
    title: 'Preparing for Remote Job Interviews',
    category: '英语面试',
    duration: '18 分钟',
    level: '基础',
    description: '从设备、表达和远程协作三个方面准备英文远程面试。',
    accent: '#162c68',
    featured: true
  },
  {
    id: 'pm-interview',
    title: 'Product Manager Interview Guide',
    category: '产品经理',
    duration: '26 分钟',
    level: '进阶',
    description: '拆解产品经理面试中的产品设计、指标和行为问题。',
    accent: '#ddd6ff'
  },
  {
    id: 'interpreter-interview',
    title: 'Top Interpreter Interview Questions',
    category: '语言翻译',
    duration: '22 分钟',
    level: '进阶',
    description: '掌握口译岗位最常见的英文面试问题与回答框架。',
    accent: '#2b1d68',
    locked: true
  }
]
