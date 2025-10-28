import { aiService, ChatMessage } from './aiService';

export interface ParsedJobInfo {
  title: string;
  company: string;
  location: string;
  jobType: 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship';
  experienceLevel: 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive';
  remoteLocationRestriction?: string;
  salary?: string;
  tags: string[];
  requirements: string[];
  benefits: string[];
  category: string;
}

class AIJobParser {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = 'sk-9abb2bed8d9744e2992e1bdf21222115';
    this.baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  }

  /**
   * 使用AI解析RSS职位信息
   */
  async parseJobInfo(title: string, description: string, source: string): Promise<ParsedJobInfo> {
    const prompt = this.createParsingPrompt(title, description, source);
    
    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `你是一个专业的职位信息解析专家。请仔细分析提供的职位信息，并按照指定的JSON格式返回结构化数据。确保信息准确、完整。`
        },
        {
          role: 'user',
          content: prompt
        }
      ];

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          messages: messages,
          stream: false,
          temperature: 0.1, // 降低温度以获得更一致的结果
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        console.error(`AI API请求失败: ${response.status}`);
        return this.fallbackParsing(title, description);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '';
      
      // 尝试解析JSON响应
      const parsedInfo = this.parseAIResponse(content);
      if (parsedInfo) {
        return parsedInfo;
      } else {
        console.warn('AI响应解析失败，使用备用解析方法');
        return this.fallbackParsing(title, description);
      }

    } catch (error) {
      console.error('AI解析职位信息失败:', error);
      return this.fallbackParsing(title, description);
    }
  }

  /**
   * 创建解析提示词
   */
  private createParsingPrompt(title: string, description: string, source: string): string {
    return `
请分析以下职位信息并提取关键数据：

职位标题: ${title}
职位描述: ${description}
来源: ${source}

请按照以下JSON格式返回解析结果，确保所有字段都有合理的值：

{
  "title": "清理后的职位标题（去除公司名称、地点等无关信息）",
  "company": "公司名称",
  "location": "工作地点（如果是远程工作，请标注具体的地理限制，如'美国远程'、'全球远程'等）",
  "jobType": "工作类型（full-time/part-time/contract/freelance/internship之一）",
  "experienceLevel": "经验等级（Entry/Mid/Senior/Lead/Executive之一）",
  "remoteLocationRestriction": "远程工作的地理限制（请仔细分析职位描述中的地理限制信息，如'仅限美国'、'欧盟国家'、'全球'等，如果不是远程工作则为null）",
  "salary": "薪资信息（如果有的话，保持原格式）",
  "tags": ["技能标签数组，提取3-8个关键技能"],
  "requirements": ["职位要求数组，提取3-6个主要要求"],
  "benefits": ["福利待遇数组，提取2-5个主要福利"],
  "category": "职位分类（从以下选择：全栈开发/前端开发/后端开发/移动开发/软件开发/DevOps/数据分析/数据科学/人工智能/质量保证/网络安全/UI/UX设计/平面设计/产品设计/产品管理/项目管理/商业分析/市场营销/销售/内容写作/客户支持/人力资源/招聘/财务/法律/会计/运营/商务拓展/咨询/教育培训/其他）"
}

注意事项：
1. 职位标题应该简洁明了，去除公司名称和地点信息
2. 公司名称要准确提取，不要包含职位信息
3. 地点信息要明确，远程工作要标注地理限制
4. 工作类型要根据描述准确判断
5. 经验等级要根据职位要求和标题判断
6. 技能标签要提取最相关的技术和技能
7. 要求和福利要简洁明了
8. 分类要准确匹配预定义的类别
9. **重要：对于remoteLocationRestriction字段，请特别仔细分析职位描述中的地理限制信息：**
   - 如果明确提到"US only"、"USA only"、"US citizens only"等，返回"仅限美国"
   - 如果提到"EU only"、"Europe only"、"EU citizens only"等，返回"仅限欧盟"
   - 如果提到"UK only"、"British citizens only"等，返回"仅限英国"
   - 如果提到"Canada only"、"Canadian citizens only"等，返回"仅限加拿大"
   - 如果提到特定时区要求如"EST timezone"、"Pacific time"等，返回相应时区信息
   - 如果提到"worldwide"、"global"、"anywhere"等，返回"全球远程"
   - 如果没有明确的地理限制但是远程工作，返回"全球远程"
   - 如果不是远程工作，返回null

请只返回JSON格式的结果，不要包含其他文字说明。
`;
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(content: string): ParsedJobInfo | null {
    try {
      // 尝试提取JSON部分
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      // 验证必需字段
      if (!parsed.title || !parsed.company || !parsed.jobType || !parsed.experienceLevel) {
        console.warn('AI响应缺少必需字段');
        return null;
      }

      // 标准化和验证数据
      return {
        title: String(parsed.title).trim(),
        company: String(parsed.company).trim(),
        location: String(parsed.location || 'Remote').trim(),
        jobType: this.validateJobType(parsed.jobType),
        experienceLevel: this.validateExperienceLevel(parsed.experienceLevel),
        remoteLocationRestriction: parsed.remoteLocationRestriction ? String(parsed.remoteLocationRestriction).trim() : undefined,
        salary: parsed.salary ? String(parsed.salary).trim() : undefined,
        tags: Array.isArray(parsed.tags) ? parsed.tags.map((tag: any) => String(tag).trim()).filter(Boolean) : [],
        requirements: Array.isArray(parsed.requirements) ? parsed.requirements.map((req: any) => String(req).trim()).filter(Boolean) : [],
        benefits: Array.isArray(parsed.benefits) ? parsed.benefits.map((benefit: any) => String(benefit).trim()).filter(Boolean) : [],
        category: String(parsed.category || '其他').trim()
      };

    } catch (error) {
      console.error('解析AI响应JSON失败:', error);
      return null;
    }
  }

  /**
   * 验证工作类型
   */
  private validateJobType(jobType: string): 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship' {
    const validTypes = ['full-time', 'part-time', 'contract', 'freelance', 'internship'];
    const normalized = String(jobType).toLowerCase().trim();
    
    if (validTypes.includes(normalized)) {
      return normalized as any;
    }
    
    // 尝试映射常见变体
    if (normalized.includes('full') || normalized.includes('全职')) return 'full-time';
    if (normalized.includes('part') || normalized.includes('兼职')) return 'part-time';
    if (normalized.includes('contract') || normalized.includes('合同')) return 'contract';
    if (normalized.includes('freelance') || normalized.includes('自由')) return 'freelance';
    if (normalized.includes('intern') || normalized.includes('实习')) return 'internship';
    
    return 'full-time'; // 默认值
  }

  /**
   * 验证经验等级
   */
  private validateExperienceLevel(level: string): 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive' {
    const validLevels = ['Entry', 'Mid', 'Senior', 'Lead', 'Executive'];
    const normalized = String(level).toLowerCase().trim();
    
    if (validLevels.map(l => l.toLowerCase()).includes(normalized)) {
      return validLevels.find(l => l.toLowerCase() === normalized) as any;
    }
    
    // 尝试映射常见变体
    if (normalized.includes('entry') || normalized.includes('junior') || normalized.includes('初级')) return 'Entry';
    if (normalized.includes('mid') || normalized.includes('middle') || normalized.includes('中级')) return 'Mid';
    if (normalized.includes('senior') || normalized.includes('高级')) return 'Senior';
    if (normalized.includes('lead') || normalized.includes('principal') || normalized.includes('主管')) return 'Lead';
    if (normalized.includes('executive') || normalized.includes('director') || normalized.includes('总监')) return 'Executive';
    
    return 'Mid'; // 默认值
  }

  /**
   * 备用解析方法（当AI解析失败时使用）
   */
  private fallbackParsing(title: string, description: string): ParsedJobInfo {
    return {
      title: title.trim(),
      company: this.extractCompanyFromDescription(description),
      location: 'Remote',
      jobType: 'full-time',
      experienceLevel: 'Mid',
      remoteLocationRestriction: undefined,
      salary: undefined,
      tags: this.extractTags(title, description),
      requirements: [],
      benefits: [],
      category: '其他'
    };
  }

  /**
   * 从描述中提取公司名称（备用方法）
   */
  private extractCompanyFromDescription(description: string): string {
    // 简单的公司名称提取逻辑
    const companyPatterns = [
      /Company:\s*([^\n\r]+)/i,
      /公司:\s*([^\n\r]+)/i,
      /at\s+([A-Z][a-zA-Z\s&.,-]+?)(?:\s+is|\s+seeks|\s+looking)/i,
      /([A-Z][a-zA-Z\s&.,-]+?)\s+is\s+(?:seeking|looking|hiring)/i
    ];

    for (const pattern of companyPatterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return 'Unknown Company';
  }

  /**
   * 提取技能标签（备用方法）
   */
  private extractTags(title: string, description: string): string[] {
    const text = `${title} ${description}`.toLowerCase();
    const commonTags = [
      'javascript', 'typescript', 'react', 'vue', 'angular', 'node.js', 'python', 'java',
      'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'flutter', 'react native',
      'html', 'css', 'sass', 'less', 'tailwind', 'bootstrap',
      'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch',
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'git',
      'figma', 'sketch', 'adobe', 'photoshop', 'illustrator'
    ];

    return commonTags.filter(tag => text.includes(tag)).slice(0, 6);
  }
}

export const aiJobParser = new AIJobParser();