/**
 * Christmas Campaign Service
 * Handles resume analysis for the "Resume Christmas Tree" feature.
 */

import { generateTreeStructureLocal } from './local-keyword-extractor.js';

const CHRISTMAS_INTERPRETATION_PROMPT = `
You are a warm, perceptive career storyteller and poet.
Input: A list of career keywords extracted from a resume.
Keywords: {KEYWORDS}

Task:
1. Identify 3-4 key growth stages (e.g. Seed, Sprout, Bloom).
2. For EACH stage, pick ONE core keyword (English) that represents that phase best.
3. Generate a HIGHLY PERSONALIZED, EMOTIONAL, and POETIC interpretation based on the specific keywords provided.
   - **CRITICAL**: Do NOT use generic templates like "This is a tree rooting down..." or "This tree represents...".
   - **CRITICAL**: Read the keywords carefully to determine the person's specific profession (e.g., Developer, Marketer, Designer, Founder).
   - Use metaphors *specific* to their profession:
     - For Developers: Use terms like "architecture", "refactoring", "compiling", "stable core".
     - For Designers: Use terms like "color palette", "white space", "perspective", "visual harmony".
     - For Marketers/Sales: Use terms like "resonance", "amplification", "connection", "conversion".
     - For Finance: Use terms like "compounding", "assets", "balance", "investment".
   - If keywords are mixed, weave them into a unique story of a "Hybrid Soul".

Output: A STRICT JSON object (no markdown) with this structure:
{
  "growth_stages": [
    {"label": "String (e.g. Seed)", "keyword": "String (e.g. Curiosity)"},
    {"label": "String (e.g. Sprout)", "keyword": "String (e.g. Action)"},
    {"label": "String (e.g. Bloom)", "keyword": "String (e.g. Impact)"}
  ],
  "personality": "String (1-2 sentences. A deeply personalized metaphor about this specific tree's character. Example: 'You are a Quiet Architect, building skyscrapers of logic in a noisy world.')",
  "uniqueness": "String (1-2 sentences. Highlight a specific unique combination of traits found in the keywords. Example: 'Few can balance the rigor of Java with the empathy of User Research like you do.')",
  "future_wish": "String (1 sentence. A warm, specific wish related to their field. Example: 'May your code always compile on the first try, and your bugs be few.')"
}

Rules:
1. Output in CHINESE (Simplified) for interpretation fields (personality, uniqueness, future_wish).
2. Keywords in growth_stages must be English.
3. ABSOLUTELY NO NUMBERS, DATES, YEARS, PHONE NUMBERS, OR EMAILS in any field.
4. Growth stage labels must be abstract (e.g., "Seed", "Sprout", "Bloom", "Harvest") or generic ("Start", "Rise", "Peak"), NOT years.
5. Tone: Deeply healing, literary, specific, non-judgmental.
6. AVOID clichés. Make it feel like a handwritten letter to an old friend.
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

    let interpretation = {
        personality: "这是一棵正在努力向下扎根的树，每一寸生长都充满力量。",
        uniqueness: "你的经历虽然曲折，但正是这些转折让你的年轮更加丰富迷人。",
        future_wish: "明年，愿阳光总能透过缝隙照耀到你最想舒展的枝头上。"
    };

    if (apiKey) {
        try {
            const provider = 'bailian';
            const key = apiKey;
            
            // Extract top 50 keywords for prompt context to give more detail
            const topKeywords = localTreeData.layers[0].keywords.slice(0, 50).map(k => k.text).join(', ');
            const prompt = CHRISTMAS_INTERPRETATION_PROMPT.replace('{KEYWORDS}', topKeywords);

            let apiUrl = '';
            let requestBody = {};

            console.log(`[ChristmasService] Using AI Provider: Alibaba Bailian (Model: qwen-plus)`);
            apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
            requestBody = {
                model: 'qwen-plus',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.8
            };

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
                // Inject growth stages into tree structure if available
                if (aiInterp.growth_stages && Array.isArray(aiInterp.growth_stages)) {
                    localTreeData.growth_stages = aiInterp.growth_stages;
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
