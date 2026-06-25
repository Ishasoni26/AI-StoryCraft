import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { script, targetLanguage, characters } = await req.json();

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'put_your_free_gemini_key_here') {
      // Return Mock Data so the user can test the app without an API key
      return NextResponse.json({
        scenes: [
          {
            imagePrompt: "A poor Indian boy in a village",
            dialogue: "एक छोटे से गाँव में मोहन नाम का एक गरीब लड़का रहता था। वह अपनी बूढ़ी माँ के साथ एक टूटी-फूटी झोपड़ी में रहता था।"
          },
          {
            imagePrompt: "A magical glowing slipper in the forest",
            dialogue: "एक दिन मोहन जंगल के रास्ते से घर वापस आ रहा था। अचानक उसकी नज़र एक पुराने बरगद के पेड़ के नीचे पड़ी एक फटी-पुरानी चप्पल पर गई।"
          },
          {
            imagePrompt: "Terrifying red eyes in the dark",
            dialogue: "बाहर घना अंधेरा था। और उस अंधेरे में किसी की दो लाल चमकती आँखें दिखाई दे रही थीं..."
          }
        ]
      });
    }
    
    const langInstruction = targetLanguage && targetLanguage !== 'Hindi' 
      ? `\nCRITICAL DUBBING INSTRUCTION: The input script is in Hindi, but you MUST translate the "dialogue" field natively into ${targetLanguage}. Do NOT return Hindi dialogue if ${targetLanguage} is requested.`
      : '';

    // Check if custom character descriptions were passed
    const characterListStr = (characters && characters.length > 0)
      ? characters.map((c: any) => `- Character Name: ${c.name}\n  Visual Description: ${c.description}`).join('\n')
      : '';

    const characterInstructions = characterListStr 
      ? `CRITICAL CHARACTER DEFINITIONS (USER-DEFINED):
The user has predefined the characters for this story. You MUST use these exact visual descriptions in the "imagePrompt" whenever the character appears in a scene. Do NOT invent new descriptions for these characters:
${characterListStr}
CRITICAL INSTRUCTIONS FOR IMAGE PROMPTS:
1. ENFORCE 100% CONTINUITY: You MUST include the EXACT user-defined character descriptions in EVERY SINGLE imagePrompt where the character appears. Never change their physical details or clothing.`
      : `CRITICAL INSTRUCTIONS FOR IMAGE PROMPTS:
1. IDENTIFY THE PROTAGONIST FIRST: Read the whole script first. Identify the main character(s).
2. CREATE A MASTER CHARACTER DESCRIPTION: Invent a highly detailed physical description for them (e.g. "A 20-year-old Indian boy named Rohan with short messy black hair, wearing a white t-shirt and blue denim jacket").
3. ENFORCE 100% CONTINUITY: You MUST include this EXACT SAME master character description in EVERY SINGLE imagePrompt where the character appears. NEVER change their clothes, hair, or age between scenes!`;

    const prompt = `
You are an EXPERT AI Storyboard Director and Master Prompt Engineer for Stable Diffusion.
I will give you a story script in Hindi. 
Your ONLY job is to take the script and logically divide it into engaging VISUAL SCENES. 
Do not just split it sentence by sentence! Group related sentences together if they describe the same location, action, or visual moment. Each scene should represent a single camera shot or visual environment.

${characterInstructions}
4. SCENE CONTEXT & BACKGROUND: Read the Hindi sentence carefully. What is happening? Where are they? Describe the action and the background vividly in English. 
   - Poor: "Rohan is standing."
   - Excellent: "The 20-year-old Indian boy named Rohan with short messy black hair wearing a blue denim jacket is standing in the middle of a crowded, sunlit college campus courtyard, looking surprised, cinematic lighting, masterpiece, 8k resolution."
5. Write ALL imagePrompts in highly detailed, comma-separated English format optimized for AI image generators.
${langInstruction}

For each scene, provide:
1. "imagePrompt": The highly detailed, continuous English prompt as instructed above.
2. "dialogue": The exact text of that SINGLE short sentence (translated to ${targetLanguage || 'Hindi'} as instructed above).

Return the result STRICTLY as a JSON array of objects. Do not include markdown formatting or backticks around the JSON.
Example format:
[
  { "imagePrompt": "A 20-year-old Indian boy named Rohan with short messy black hair wearing a blue denim jacket, standing in front of a grand college building, holding books, cinematic lighting", "dialogue": "रोहन एक साधारण कॉलेज छात्र था।" },
  { "imagePrompt": "A 20-year-old Indian boy named Rohan with short messy black hair wearing a blue denim jacket, sitting alone on a park bench looking sad, cinematic lighting", "dialogue": "लेकिन वह हमेशा उदास रहता था।" }
]

Story Script:
${script}
    `;

    let responseText;
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API HTTP Error: ${response.status}`);
      }
      
      const data = await response.json();
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
    } catch (apiError: any) {
      console.warn("Gemini API failed, using Local Fallback Splitter:", apiError.message);
      
      // Local Fallback: Split the user's script manually into sentences
      // Split by Hindi full stop (।), English full stop (.), or newlines
      const fallbackScenes = script
        .split(/[।.\n]+/)
        .map((sentence: string) => sentence.trim())
        .filter((sentence: string) => sentence.length > 0)
        .map((sentence: string) => ({
          imagePrompt: `[API LIMIT REACHED] Please write your own English description for this scene, or wait 1 minute and click Generate Storyboard again.`,
          dialogue: sentence
        }));

      if (fallbackScenes.length === 0) {
        fallbackScenes.push({
          imagePrompt: "A beautiful empty landscape",
          dialogue: "कोई कहानी नहीं मिली।"
        });
      }

      return NextResponse.json({
        scenes: fallbackScenes
      });
    }

    const text = responseText;
    if (!text) {
      throw new Error('Empty response from Gemini');
    }
    
    // Clean up any potential markdown block from Gemini
    const cleanedText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const scenes = JSON.parse(cleanedText);

    return NextResponse.json({ scenes });
  } catch (error: any) {
    console.error('Error generating script:', error);
    return NextResponse.json(
      { error: 'Failed to generate scenes', details: error.message },
      { status: 500 }
    );
  }
}
