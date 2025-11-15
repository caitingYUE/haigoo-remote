# 简历解析实现指南

## 问题分析

### 问题1：本地能上传但解析失败
- **原因**：原 `api/parse-resume.js` 依赖 TIKA_URL 环境变量，未配置导致 500 错误
- **原因2**：旧的 `api/parse-resume.js` 使用了大量 Node.js 包，某些包在 Vercel 环境中不兼容

### 问题2：Vercel 正式环境无法上传
- **原因**：Edge Function 配置与实际实现不匹配
- **原因**：缺少必要的依赖包配置

## 解决方案

### 方案一：纯前端解析（推荐）✅

**优点：**
- 无需后端，完全客户端处理
- 响应速度快
- 不消耗 Vercel Function 配额
- 支持 PDF、DOCX、TXT

**实现：**
1. 使用 `pdf.js` (CDN) 解析 PDF
2. 使用 `jszip` 解析 DOCX
3. 原生 API 处理 TXT

**文件：**
- `src/services/resume-parser-enhanced.ts` - 增强的解析器

**使用方法：**
```typescript
import { parseResumeFileEnhanced } from '../services/resume-parser-enhanced'

// 在组件中
const handleFileUpload = async (file: File) => {
  const result = await parseResumeFileEnhanced(file)
  if (result.success) {
    console.log('姓名:', result.name)
    console.log('职位:', result.title)
    console.log('教育:', result.education)
    // ...
  }
}
```

### 方案二：轻量级后端解析（备用）

**优点：**
- 支持更复杂的格式
- 统一的解析逻辑
- 可扩展性强

**实现：**
使用轻量级 Node.js 包（pdf-parse, mammoth）

**文件：**
- `api/parse-resume-new.js` - 新的服务端解析器

**特点：**
- 纯 Node.js 实现，无外部依赖
- 支持 PDF、DOCX、TXT
- 手动实现 multipart 解析（避免 busboy）

## 部署步骤

### 1. 安装依赖（如果使用服务端解析）

```bash
npm install pdf-parse mammoth
```

### 2. 更新前端引用

在需要简历解析的页面中：

```typescript
// 方案一：纯前端（推荐）
import { parseResumeFileEnhanced } from '../services/resume-parser-enhanced'

// 方案二：服务端回退
import { parseResumeFile } from '../services/resume-parser'
```

### 3. 部署到 Vercel

```bash
# 提交代码
git add .
git commit -m "feat: 增强简历解析功能"
git push

# Vercel 会自动部署
```

### 4. 验证部署

访问以下 URL 测试：
- `https://haigoo.vercel.app/api/health` - 检查系统状态
- 上传 PDF/DOCX 简历测试解析

## 支持的格式

| 格式 | 前端解析 | 服务端解析 | 说明 |
|------|---------|-----------|------|
| PDF  | ✅ (pdf.js) | ✅ (pdf-parse) | 推荐 |
| DOCX | ✅ (jszip) | ✅ (mammoth) | 推荐 |
| TXT  | ✅ (原生) | ✅ (原生) | 完全支持 |
| DOC  | ❌ | ❌ | 不支持，建议转为 DOCX |
| 图片 | ❌ | ❌ | 需要 OCR（可选） |

## 提取的字段

自动提取以下字段：
- ✅ 姓名 (name)
- ✅ 职位标题 (title)
- ✅ 性别 (gender)
- ✅ 地点 (location)
- ✅ 求职方向 (targetRole)
- ✅ 教育背景 (education)
- ✅ 毕业年份 (graduationYear)
- ✅ 个人简介 (summary)
- ✅ 工作经历 (workExperience)
- ✅ 技能 (skills)

## 故障排查

### 问题：PDF 解析失败

**解决：**
1. 检查浏览器控制台是否有 PDF.js 加载错误
2. 确认 CDN 可访问
3. 尝试服务端解析

### 问题：DOCX 解析为空

**原因：**
- DOCX 文件损坏
- 文件是加密的
- 文件不是标准 OOXML 格式

**解决：**
1. 用 Word 重新保存为标准 DOCX
2. 使用服务端解析

### 问题：Vercel 部署后 500 错误

**检查：**
```bash
# 查看 Vercel 日志
vercel logs

# 测试 health API
curl https://haigoo.vercel.app/api/health
```

**常见原因：**
- 依赖包未正确安装
- Node 版本不匹配
- 环境变量未配置

## 性能优化

### 前端解析
- PDF.js 从 CDN 加载（约 500KB）
- 首次加载后缓存
- 大文件（>5MB）建议使用服务端

### 服务端解析
- 限制文件大小：最大 10MB
- 解析超时：30秒
- 并发限制：根据 Vercel 配额

## 扩展建议

### 添加 OCR 支持（图片简历）

可选择：
1. Tesseract.js（前端，约 2MB）
2. Google Vision API（服务端，付费）
3. Azure Computer Vision（服务端，付费）

### 添加结构化解析

使用 AI 模型进一步解析：
1. 工作经历时间线
2. 技能评级
3. 项目经历
4. 证书资质

推荐使用：
- OpenAI GPT-4（API）
- Claude（API）
- 本地模型（transformers.js）

## 测试用例

创建测试文件 `test-resume-parser.ts`：

```typescript
import { parseResumeFileEnhanced } from '../services/resume-parser-enhanced'

// 测试 PDF
const testPdf = async () => {
  const file = new File([...], 'resume.pdf', { type: 'application/pdf' })
  const result = await parseResumeFileEnhanced(file)
  console.assert(result.success, 'PDF parse failed')
  console.assert(result.name, 'Name not extracted')
}

// 测试 DOCX
const testDocx = async () => {
  const file = new File([...], 'resume.docx', { 
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
  })
  const result = await parseResumeFileEnhanced(file)
  console.assert(result.success, 'DOCX parse failed')
}
```

## 联系支持

如有问题，请检查：
1. Vercel 部署日志
2. 浏览器控制台错误
3. Network 面板查看 API 响应

---

更新时间：2025-01-06