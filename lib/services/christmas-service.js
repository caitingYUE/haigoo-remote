/**
 * Christmas Campaign Service
 * Handles resume analysis for the "Resume Christmas Tree" feature.
 */

const CHRISTMAS_PROMPT = `
You are a warm, healing career mentor and artist. 
Your task is to analyze a resume and generate data for a "Career Christmas Tree" visualization, along with a healing interpretation.

Input: User's resume text.

Output: A STRICT JSON object (no markdown, no code blocks) with the following structure:
{
  "tree_structure": {
    "trunk_core_role": "String (e.g., 'Full Stack Developer')",
    "layers": [
      {
        "category": "String (e.g., 'Languages', 'Frameworks', 'Soft Skills', 'Tools')",
        "keywords": [
          { "text": "String", "weight": 1-10 }
        ]
      }
    ],
    "star_label": "String (A creative, 2-word professional label, e.g., 'Pixel Wizard', 'Backend Architect')",
    "style": "String ('engineering' | 'creative' | 'growth')"
  },
  "interpretation": {
    "personality": "String (1 sentence, personifying the tree, warm & affirming)",
    "uniqueness": "String (1 sentence, highlighting what makes their path special)",
    "future_wish": "String (1 sentence, gentle wish for next year, non-judgmental)"
  }
}

Rules:
1. **Style Determination**:
   - 'engineering': For technical, structured roles (dev, ops).
   - 'creative': For design, marketing, product roles.
   - 'growth': For sales, management, operations roles.
   - Default to 'growth' if unsure.
2. **Keywords**: Extract 20-30 top keywords. Group them logically. Weights determine size in the visual.
3. **Tone**: ABSOLUTELY POSITIVE, HEALING, and NON-JUDGMENTAL.
   - NO advice ("You should learn X").
   - NO critique ("Lack of Y").
   - Use metaphors related to trees, growth, light, and seasons.
4. **Language**: Output in CHINESE (Simplified), except for specific tech terms (Java, React) which should remain English.

RESUME TEXT:
`;

/**
 * Analyze resume text to generate Christmas Tree data
 * @param {string} resumeText 
 * @returns {Promise<Object>} treeData
 */
export async function generateChristmasTree(resumeText) {
    if (!resumeText || resumeText.length < 10) {
        throw new Error("Resume content too short");
    }

    const apiKey = process.env.VITE_ALIBABA_BAILIAN_API_KEY || process.env.ALIBABA_BAILIAN_API_KEY;
    const deepseekKey = process.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;

    if (!apiKey && !deepseekKey) {
        throw new Error("AI API configuration missing");
    }

    const provider = apiKey ? 'bailian' : 'deepseek';
    const key = apiKey || deepseekKey;

    let apiUrl = '';
    let requestBody = {};

    if (provider === 'bailian') {
        apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
        requestBody = {
            model: 'qwen-plus',
            messages: [{ role: 'user', content: CHRISTMAS_PROMPT + resumeText.substring(0, 4000) }],
            temperature: 0.8 // Slightly creative
        };
    } else {
        apiUrl = 'https://api.deepseek.com/chat/completions';
        requestBody = {
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: CHRISTMAS_PROMPT + resumeText.substring(0, 4000) }],
            temperature: 0.8
        };
    }

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`AI API Error: ${response.status} ${err}`);
        }

        const result = await response.json();
        const content = result.choices?.[0]?.message?.content || '{}';

        // Clean markdown
        const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("[ChristmasService] Generation failed:", error);
        // Return fallback data if AI fails to prevent total breakage
        return getFallbackTreeData();
    }
}

function getFallbackTreeData() {
    return {
        tree_structure: {
            trunk_core_role: "Explorer",
            layers: [
                { category: "Skills", keywords: [{ text: "Determination", weight: 9 }, { text: "Learning", weight: 8 }] }
            ],
            star_label: "Future Star",
            style: "growth"
        },
        interpretation: {
            personality: "这是一棵正在努力向下扎根的树，每一寸生长都充满力量。",
            uniqueness: "你的经历虽然曲折，但正是这些转折让你的年轮更加丰富迷人。",
            future_wish: "明年，愿阳光总能透过缝隙照耀到你最想舒展的枝头上。"
        },
        is_fallback: true
    };
}
