// AI服务 - 调用qwen3-vl-plus模型
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  content: string;
  suggestions?: string[];
}

class AIService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = 'sk-9abb2bed8d9744e2992e1bdf21222115';
    this.baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  }

  async sendMessage(messages: ChatMessage[]): Promise<AIResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'qwen3-vl-plus',
          messages: messages,
          stream: false,
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '抱歉，我无法处理您的请求。';

      // 生成相关建议
      const suggestions = this.generateSuggestions(content);

      return {
        content,
        suggestions,
      };
    } catch (error) {
      console.error('AI服务调用失败:', error);
      return {
        content: '抱歉，AI服务暂时不可用，请稍后再试。',
        suggestions: [],
      };
    }
  }

  // 基于简历优化场景生成建议
  private generateSuggestions(content: string): string[] {
    const suggestions = [
      '优化技能关键词匹配',
      '调整工作经历描述',
      '完善项目经验细节',
      '增强个人优势表达',
    ];

    // 根据内容智能筛选建议
    if (content.includes('技能') || content.includes('skill')) {
      return suggestions.filter(s => s.includes('技能') || s.includes('项目'));
    }
    if (content.includes('经历') || content.includes('experience')) {
      return suggestions.filter(s => s.includes('经历') || s.includes('优势'));
    }
    
    return suggestions.slice(0, 2); // 默认返回前两个建议
  }

  // 分析简历匹配度
  async analyzeResumeMatch(jobDescription: string, userMessage: string): Promise<AIResponse> {
    const systemPrompt = `你是一个专业的简历优化助手。请根据职位描述分析用户的简历匹配情况，并提供具体的优化建议。

职位描述：
${jobDescription}

请从以下几个方面进行分析：
1. 技能匹配度
2. 工作经验相关性
3. 项目经验匹配
4. 关键词优化建议

请用简洁专业的语言回复，并提供具体可行的优化建议。`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    return this.sendMessage(messages);
  }
}

export const aiService = new AIService();