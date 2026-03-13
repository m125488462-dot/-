
import { GoogleGenAI, Type } from "@google/genai";
import { TextLine } from "../types";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 5, delay = 6000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isOverloaded = error?.message?.includes('503') || error?.message?.includes('overloaded') || error?.message?.includes('429');
    if (retries > 0 && isOverloaded) {
      console.warn(`[Engine] Retrying due to load... ${delay}ms`);
      await sleep(delay);
      return withRetry(fn, retries - 1, delay * 1.5); 
    }
    throw error;
  }
}

// 辅助函数：根据比例获取特定的排版范式
const getLayoutLogic = (aspectRatio: string): string => {
  if (aspectRatio === '16:9' || aspectRatio === '4:3') {
    return `
    LANDSCAPE STRATEGY (Side-by-Side Split):
    - Divide the canvas into two primary zones: Left (Product) and Right (Text).
    - Place the primary product unit in the left 40% of the canvas.
    - Group all translated text blocks into a clean column on the right 60% of the canvas.
    - Background: Extend original background patterns horizontally to fill the wide frame.
    `;
  } else if (aspectRatio === '9:16') {
    return `
    VERTICAL STRATEGY (Vertical Stack):
    - Stack elements vertically: Logo at top, Main Headline in upper-third, Product in the center-middle, Technical data at the bottom.
    - Background: Extend the background gradients vertically to create a taller, elegant atmosphere.
    - Leave generous whitespace (breathable space) at the top and bottom.
    `;
  } else {
    return `
    SQUARE STRATEGY (Central Balance):
    - Use a centered hierarchical layout.
    - Headline and Logo at the top.
    - Product prominently in the middle.
    - Technical specs/sub-headings in the lower third.
    - Ensure margins are even on all sides.
    `;
  }
}

export const translateLines = async (lines: string[], targetLanguage: string): Promise<string[]> => {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key missing.");
  const ai = new GoogleGenAI({ apiKey });

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `You are a professional marketing translator for high-end technical products.
      Translate the following segments into ${targetLanguage}.
      
      CRITICAL REQUIREMENTS:
      1. TERMINOLOGY: Use industry-standard terms for power electronics (Solar, Inverters, Battery Storage).
      2. ACCURACY: Do not add flavor text. Maintain the exact meaning for B2B clients.
      3. OUTPUT: Return ONLY a JSON array of strings.
      
      Segments to translate: ${JSON.stringify(lines)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    try {
      return JSON.parse(response.text || "[]");
    } catch (e) {
      return lines; 
    }
  });
};

export const extractTextLines = async (imageBase64: string): Promise<string[]> => {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key missing.");
  const ai = new GoogleGenAI({ apiKey });
  const cleanBase64 = imageBase64.split(',')[1] || imageBase64;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
          { text: "Extract all visible text from this product poster. Identify: 1. Main Headline, 2. Brand Name, 3. Secondary specs. Return as a plain JSON array of strings." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    try {
      return JSON.parse(response.text || "[]");
    } catch (e) {
      return [];
    }
  });
};

export const generateAdaptedImage = async (
  imageBase64: string,
  aspectRatio: string,
  pixelWidth: number,
  pixelHeight: number,
  targetLanguage: string,
  textLines: TextLine[],
  specialInstructions?: string,
  customBackgroundBase64?: string
): Promise<string> => {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key missing.");
  const ai = new GoogleGenAI({ apiKey });
  const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
  const cleanBgBase64 = customBackgroundBase64 ? (customBackgroundBase64.split(',')[1] || customBackgroundBase64) : null;

  const activeLines = textLines.filter(l => l.translation && l.translation.trim() !== "");
  const manifest = activeLines
    .map((l, i) => `TEXT_BLOCK_${i + 1}: "${l.translation.replace(/"/g, "'")}"`)
    .join("\n");

  const layoutLogic = getLayoutLogic(aspectRatio);

  let promptText = `
    TASK: Professional Global Product Poster Adaptation
    TARGET ASPECT RATIO: ${aspectRatio}
    TARGET LANGUAGE: ${targetLanguage}

    DESIGN RULES FROM REFERENCE STUDY:
    ${layoutLogic}

    1. SUBJECT INTEGRITY: 
       - DO NOT stretch or distort the product hardware.
       - The product unit and brand logos must remain high-definition and original proportions.
       
    2. TYPOGRAPHY & STYLE (CRITICAL):
       - FONT SIZE: Ensure the new text is perfectly proportional to the original. DO NOT make the text overly large. Maintain elegant, refined sizing.
       - FONT COLOR: Sample the exact color from the original text and apply it precisely.
       - FONT FAMILY: If the TARGET LANGUAGE is Chinese (zh, zh-CN, zh-TW), you MUST use "Source Han Sans" (思源黑体) or "Noto Sans CJK" for a premium, modern aesthetic. For other languages, match the original font family.
       - SPACING: Maintain breathable line spacing and professional margins.
       - You MUST use the EXACT text provided in the TEXT MANIFEST below.
       - DO NOT hallucinate, guess, or change any letters. Copy the text character by character.
       - Spelling errors are unacceptable.

    TEXT MANIFEST:
    ${manifest}
    
    ART DIRECTION: ${specialInstructions || "Maintain a clean, high-tech B2B marketing aesthetic. Follow the provided composition strategy strictly."}
  `;

  if (cleanBgBase64) {
    promptText += `
    
    CRITICAL COMPOSITING INSTRUCTION:
    You have been provided with TWO images. 
    - Image 1 is the original product poster.
    - Image 2 is the BACKGROUND REFERENCE.
    You MUST extract the product hardware from Image 1 and composite it onto the background provided in Image 2. 
    IMPORTANT: Image 2 is just a reference for the background content. You MUST ensure the final output strictly matches the requested TARGET ASPECT RATIO (${aspectRatio}). If Image 2's dimensions do not perfectly match, crop or extend it seamlessly to fit the target dimensions. Do not distort the background.
    Add the text from the TEXT MANIFEST onto the composited image.
    `;
  } else {
    promptText += `
    
    3. SMART BACKGROUND EXPANSION:
       - Use in-painting to naturally extend background gradients, curves, and textures.
       - If widening (16:9), repeat and smooth the background patterns to the sides.
       - If lengthening (9:16), extend the top/bottom background elements.
       
    FINAL CHECK: No character mutations. Product position optimized for ${aspectRatio}. Background extension looks authentic.
    `;
  }

  const parts: any[] = [
    { inlineData: { mimeType: 'image/png', data: cleanBase64 } }
  ];

  if (cleanBgBase64) {
    parts.push({ inlineData: { mimeType: 'image/png', data: cleanBgBase64 } });
  }

  parts.push({ text: promptText });

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview', 
      contents: {
        parts: parts,
      },
      config: {
        imageConfig: { 
          aspectRatio: aspectRatio as any,
        }
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!part?.inlineData?.data) {
      throw new Error("Generation Stalled: The engine could not satisfy the precise composition rules.");
    }
    
    return `data:image/png;base64,${part.inlineData.data}`;
  });
};
