import { NextResponse } from 'next/server';
import { callOpenAI } from '@/lib/openai';

export async function POST(req: Request) {
  try {
    const { script, targetLanguage, characterProfile, locationProfile } = await req.json();

    // Check if any valid AI API key is available
    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const hasValidKey = (groqKey && !groqKey.includes('put_your') && !groqKey.includes('your_key_here')) ||
                        (openaiKey && !openaiKey.includes('put_your') && !openaiKey.includes('your_key_here'));
    
    if (!hasValidKey) {
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
      ? `Ensure all dialogue text is written exclusively in ${targetLanguage}.`
      : '';

    const charInstruction = characterProfile
      ? `CHARACTER PROFILE (USE VERBATIM): "${characterProfile}". You MUST start every image prompt with this exact character description. Do not invent or summarize a new character.`
      : `CREATE A MASTER CHARACTER DESCRIPTION: Invent a highly detailed physical description (e.g., "A 20-year-old Indian boy named Rohan with short messy black hair, wearing a white t-shirt and blue denim jacket"). Use this consistently in every image prompt.`;

    const locInstruction = locationProfile
      ? `LOCATION PROFILE (USE VERBATIM): "${locationProfile}". If a scene takes place in this location, you MUST include this exact location description in the image prompt.`
      : `VISUAL STYLE: Use a highly detailed, dramatic, cinematic visual style for all scene descriptions.`;

    const systemPrompt = `You are an EXPERT AI Storyboard Director and Narrative Analyst.

You will receive a complete story script. Your job is:
1. First, UNDERSTAND the full story deeply
2. Then, create a PERFECT image prompt for EACH SENTENCE of the story

== PHASE 1: UNDERSTAND THE STORY (think internally, do NOT output this) ==
- Read the ENTIRE story from start to end
- Understand: Who are the characters? What is happening? What is the mood?
- Understand the setting, time, emotions, and visual environment of EACH moment
- Think about what would make each moment look AMAZING as an image

== PHASE 2: CREATE SCENE FOR EACH LINE ==
Now, split the story into individual sentences/lines. For EACH line, create a scene with:
- A highly detailed, context-aware image prompt that reflects what is ACTUALLY happening in that specific moment of the story
- The exact original text as the dialogue

CRITICAL RULES:
- EACH SENTENCE gets its own scene — one line = one scene
- Split by Hindi full stops (।), English full stops (.), or line breaks
- The image prompt must reflect the SPECIFIC moment — not generic descriptions
- Because you understood the FULL STORY first, each image prompt should show the correct emotion, setting, and action for that exact point in the narrative
- Even though each line is separate, the image prompts should feel like a CONTINUOUS VISUAL STORY

IMAGE PROMPT RULES:
1. ${charInstruction}
2. ${locInstruction}
3. Each imagePrompt must be highly detailed, comma-separated English, optimized for AI image generators
4. Include: character description, specific action/emotion for THIS moment, the correct setting/location for THIS part of the story, cinematic lighting, masterpiece, 8k resolution
5. The emotion and body language in the prompt must match what is happening in that specific line
6. ${langInstruction}

THUMBNAIL RULES:
- Also include a "thumbnailPrompt" — the MOST DRAMATIC, CLICKBAIT-WORTHY moment from the story
- Include: character with EXTREME facial expression (shocked, terrified, amazed), dramatic element, Pixar 3D style, YouTube thumbnail composition, close-up, vibrant colors

OUTPUT FORMAT:
Return ONLY a raw JSON object (no markdown, no explanation):
{
  "thumbnailPrompt": "dramatic YouTube thumbnail description...",
  "scenes": [
    { "imagePrompt": "detailed context-aware description for this specific moment...", "dialogue": "exact original line from story" },
    ...
  ]
}`;

    const userMessage = `Here is the story script to analyze and divide into scenes:\n\n"""\n${script}\n"""`;

    let responseText: string;
    try {
      // 30-second timeout via AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      responseText = await callOpenAI(
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 4096
        },
        controller.signal
      );

      clearTimeout(timeoutId);
    } catch (apiError: unknown) {
      const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
      console.warn("OpenAI API failed, using Local Fallback Splitter:", errorMessage);

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

    if (!responseText) {
      throw new Error('Empty response from OpenAI');
    }

    // Strip markdown code fences if present
    const cleanedText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedText);

    // Handle both formats: new format { thumbnailPrompt, scenes } or legacy array format
    if (Array.isArray(parsed)) {
      return NextResponse.json({ scenes: parsed });
    }

    return NextResponse.json({
      thumbnailPrompt: parsed.thumbnailPrompt || null,
      scenes: parsed.scenes || parsed
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error generating script:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to generate scenes', details: errorMessage },
      { status: 500 }
    );
  }
}
