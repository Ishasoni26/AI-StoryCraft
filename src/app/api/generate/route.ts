import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { script, targetLanguage, characterProfile, locationProfile } = await req.json();

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
    
    if (!script) {
      return NextResponse.json({ error: 'Script is required' }, { status: 400 });
    }

    const langInstruction = targetLanguage 
      ? `Ensure the generated dialogue is completely translated to ${targetLanguage} ONLY.`
      : '';

    const charInstruction = characterProfile
      ? `2. THE USER HAS PROVIDED THE MASTER CHARACTER DESCRIPTION: "${characterProfile}". YOU MUST START EVERY SINGLE IMAGE PROMPT WITH THIS EXACT DESCRIPTION! DO NOT INVENT A NEW CHARACTER. DO NOT SUMMARIZE IT.`
      : `2. CREATE A MASTER CHARACTER DESCRIPTION: Invent a highly detailed physical description for them (e.g. "A 20-year-old Indian boy named Rohan with short messy black hair, wearing a white t-shirt and blue denim jacket"). Use this in every prompt.`;

    const locInstruction = locationProfile
      ? `3. THE USER HAS PROVIDED THE MASTER LOCATION DESCRIPTION: "${locationProfile}". If the scene happens here, YOU MUST INCLUDE THIS EXACT LOCATION DESCRIPTION IN THE IMAGE PROMPT.`
      : `3. VISUAL STYLE: You must use a highly detailed, dramatic, cinematic style.`;

    const prompt = `
You are an EXPERT AI Storyboard Director and Master Prompt Engineer for Stable Diffusion.
You are converting a short ${targetLanguage} story into a highly engaging, visual 6-scene storyboard.

STORY SCRIPT:
"""
${script}
"""

YOUR TASK:
1. Divide the story into 5-8 dramatic scenes.
${charInstruction}
${locInstruction}
4. SCENE CONTEXT: Read the sentence carefully. What is happening? Describe the action vividly in English. 
   - Poor: "Rohan is standing."
   - Excellent: "${characterProfile || "A 20-year-old Indian boy named Rohan..."} is standing in the middle of a ${locationProfile || "crowded, sunlit college campus courtyard"}, looking surprised, cinematic lighting, masterpiece, 8k resolution."
5. Write ALL imagePrompts in highly detailed, comma-separated English format optimized for AI image generators. START EVERY SINGLE PROMPT WITH THE EXACT CHARACTER DESCRIPTION AND INCLUDE THE LOCATION.
6. Extract the exact ${targetLanguage} dialogue/sentence for each scene.

Return the result as a raw JSON array of objects:
[
  { "imagePrompt": "...", "dialogue": "..." },
  ...
]
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
