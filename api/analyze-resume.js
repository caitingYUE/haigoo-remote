
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    const { messages, model, provider = 'bailian', parameters } = body;

    let apiUrl = '';
    let apiKey = '';
    let requestBody = {};
    let headers = {
      'Content-Type': 'application/json',
    };

    if (provider === 'bailian') {
      apiKey = process.env.VITE_ALIBABA_BAILIAN_API_KEY;
      if (!apiKey) {
        throw new Error('Alibaba Bailian API Key not configured');
      }
      
      apiUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
      headers['Authorization'] = `Bearer ${apiKey}`;
      
      requestBody = {
        model: model || 'qwen-plus',
        input: { messages },
        parameters: parameters || {}
      };
    } else if (provider === 'deepseek') {
      apiKey = process.env.VITE_DEEPSEEK_API_KEY;
      if (!apiKey) {
        throw new Error('DeepSeek API Key not configured');
      }

      apiUrl = 'https://api.deepseek.com/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      
      requestBody = {
        model: model || 'deepseek-chat',
        messages: messages,
        stream: false,
        ...parameters
      };
    } else {
      throw new Error('Invalid provider');
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('AI API Error:', data);
      return res.status(response.status).json({ 
        success: false, 
        error: data.message || data.code || 'Provider Error',
        details: data
      });
    }

    // Normalize response to Bailian format
    let normalizedData = data;
    if (provider === 'deepseek') {
      normalizedData = {
        output: {
          text: data.choices?.[0]?.message?.content || '',
          finish_reason: data.choices?.[0]?.finish_reason || 'stop'
        },
        usage: {
          input_tokens: data.usage?.prompt_tokens || 0,
          output_tokens: data.usage?.completion_tokens || 0,
          total_tokens: data.usage?.total_tokens || 0
        },
        request_id: data.id
      };
    }

    // Return standardized response
    return res.status(200).json({
      success: true,
      data: normalizedData
    });

  } catch (error) {
    console.error('Proxy Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error'
    });
  }
}
