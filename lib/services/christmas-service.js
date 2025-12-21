/**
 * Christmas Campaign Service
 * Handles resume analysis for the "Resume Christmas Tree" feature.
 */

import { generateTreeStructureLocal } from './local-keyword-extractor.js';

const CHRISTMAS_INTERPRETATION_PROMPT = `
You are a warm, healing career mentor and artist.
Input: A list of career keywords extracted from a resume.
Keywords: {KEYWORDS}

Task: Generate a healing interpretation for this person's career tree.

Output: A STRICT JSON object (no markdown) with this structure:
{
  "personality": "String (1 sentence, personifying the tree, warm & affirming)",
  "uniqueness": "String (1 sentence, highlighting what makes their path special)",
  "future_wish": "String (1 sentence, gentle wish for next year, non-judgmental)"
}

Rules:
1. Output in CHINESE (Simplified).
2. Tone: Healing, non-judgmental, metaphorical.
3. Be creative based on the keywords.
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

    // 1. Generate Tree Structure LOCALLY (No AI cost, instant)
    console.log('[ChristmasService] Generating tree structure locally...');
    let localTreeData;
    try {
        localTreeData = generateTreeStructureLocal(resumeText);
        console.log(`[ChristmasService] Local tree generated. Keywords: ${localTreeData.layers[0].keywords.length}`);
    } catch (e) {
        console.error('[ChristmasService] Local generation failed:', e);
        return getFallbackTreeData();
    }

    // 2. AI for Interpretation ONLY (Optional/Fallback)
    // If AI fails, we use default interpretation, but tree remains valid.
    
    const apiKey = process.env.VITE_ALIBABA_BAILIAN_API_KEY || process.env.ALIBABA_BAILIAN_API_KEY;
    const deepseekKey = process.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;

    let interpretation = {
        personality: "这是一棵正在努力向下扎根的树，每一寸生长都充满力量。",
        uniqueness: "你的经历虽然曲折，但正是这些转折让你的年轮更加丰富迷人。",
        future_wish: "明年，愿阳光总能透过缝隙照耀到你最想舒展的枝头上。"
    };

    if (apiKey || deepseekKey) {
        try {
            const provider = apiKey ? 'bailian' : 'deepseek';
            const key = apiKey || deepseekKey;
            
            // Extract top 20 keywords for prompt context to save tokens
            const topKeywords = localTreeData.layers[0].keywords.slice(0, 30).map(k => k.text).join(', ');
            const prompt = CHRISTMAS_INTERPRETATION_PROMPT.replace('{KEYWORDS}', topKeywords);

            let apiUrl = '';
            let requestBody = {};

            if (provider === 'bailian') {
                console.log(`[ChristmasService] Using AI Provider: Alibaba Bailian (Model: qwen-plus)`);
                apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
                requestBody = {
                    model: 'qwen-plus',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.8
                };
            } else {
                console.log(`[ChristmasService] Using AI Provider: DeepSeek (Model: deepseek-chat)`);
                apiUrl = 'https://api.deepseek.com/chat/completions';
                requestBody = {
                    model: 'deepseek-chat',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.8
                };
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for text only

            console.log(`[ChristmasService] Requesting AI interpretation...`);
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const result = await response.json();
                const content = result.choices?.[0]?.message?.content || '{}';
                const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
                const aiInterp = JSON.parse(jsonStr);
                if (aiInterp.personality) {
                    interpretation = aiInterp;
                }
            } else {
                console.warn(`[ChristmasService] AI Interpretation failed: ${response.status}`);
            }
        } catch (err) {
            console.error('[ChristmasService] AI Interpretation error (using fallback):', err);
        }
    }

    return {
        tree_structure: localTreeData,
        interpretation: interpretation
    };
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
