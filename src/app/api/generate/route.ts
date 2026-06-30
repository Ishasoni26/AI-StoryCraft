import { NextResponse } from 'next/server';
import { callOpenAI } from '@/lib/openai';

export async function POST(req: Request) {
  try {
    const { script, targetLanguage, characterProfile, locationProfile, characters } = await req.json();
    const { script, targetLanguage, characterProfile, locationProfile, characters } = await req.json();

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

    // Multi-character system: if characters array is provided, use it; otherwise fall back to single characterProfile
    const hasCharacters = Array.isArray(characters) && characters.length > 0 && characters.some((c: any) => c.name && c.description);

    let charInstruction: string;
    if (hasCharacters) {
      const charList = characters
        .filter((c: any) => c.name && c.description)
        .map((c: any) => `- "${c.name}": ${c.description}`)
        .join('\n');
      charInstruction = `MULTIPLE CHARACTERS DEFINED (FOR REFERENCE):
${charList}

CHARACTER USAGE RULES:
- Do NOT force characters into every scene
- Only include a character's visual description in the imagePrompt IF that character is actively DOING something or is the VISUAL FOCUS of that scene
- If the dialogue describes a LOCATION, ENVIRONMENT, or ATMOSPHERE (like "dark forest", "stormy night", "empty room"), make the imagePrompt about THAT SETTING — do NOT add characters
- If the dialogue mentions a character by name AND they are performing an action, THEN include their description
- Think like a movie director: what would the CAMERA show for these sentences? Sometimes it shows a wide landscape, sometimes a close-up of a character, sometimes just an object`;
    } else if (characterProfile) {
      charInstruction = `CHARACTER PROFILE (USE VERBATIM): "${characterProfile}". You MUST start every image prompt with this exact character description. Do not invent or summarize a new character.`;
    } else {
      charInstruction = `CREATE A MASTER CHARACTER DESCRIPTION: Invent a highly detailed physical description (e.g., "A 20-year-old Indian boy named Rohan with short messy black hair, wearing a white t-shirt and blue denim jacket"). Use this consistently in every image prompt.`;
    }

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

== PHASE 2: CREATE SCENES (2-3 SENTENCES PER SCENE) ==
Group the story into scenes where each scene contains exactly 2 or 3 consecutive sentences.

RULES:
- Each scene MUST have 2-3 FULL sentences combined together in the "dialogue" field
- A sentence ends with "।" (Hindi purna viram) or "." (English full stop)
- DO NOT put only 1 sentence per scene — always combine 2-3 together
- DO NOT put more than 3 sentences per scene
- The total number of scenes should be approximately (total sentences / 2) or (total sentences / 3)
- Keep the dialogue text EXACTLY as it appears in the original — do not rephrase or summarize
- The image prompt should visually represent what's happening across those 2-3 sentences

EXAMPLE:
If story has 10 sentences, you should have 4-5 scenes (2-3 sentences each).
If story has 6 sentences, you should have 2-3 scenes (2-3 sentences each).

IMAGE PROMPT RULES:
1. ${charInstruction}
2. ${locInstruction}
3. LANGUAGE: ALL imagePrompt values MUST be written in ENGLISH ONLY. Even though the story is in Hindi, the imagePrompt MUST be in English. This is for AI image generators that only understand English. NEVER write imagePrompt in Hindi/Devanagari script.
4. PROMPT STRUCTURE: Write each imagePrompt based on what should VISUALLY appear on screen for those sentences. If the dialogue describes a setting/environment, make the prompt about that setting. If it describes a character doing something, show the character. Think like a cinematographer — show what the camera would capture. Format: scene/environment description, any character if relevant, mood/emotion, quality keywords.
5. Each imagePrompt must be highly detailed, comma-separated English, optimized for AI image generators
6. Include only what's RELEVANT to what's happening: setting, character (only if active in scene), action/emotion, cinematic lighting, masterpiece, 8k resolution
7. The emotion and body language must match what is happening in those sentences
8. ${langInstruction}

THUMBNAIL RULES:
- Also include a "thumbnailPrompt" — the MOST DRAMATIC, CLICKBAIT-WORTHY moment from the story
- Include: character with EXTREME facial expression (shocked, terrified, amazed), dramatic element, Pixar 3D style, YouTube thumbnail composition, close-up, vibrant colors

OUTPUT FORMAT:
Return ONLY a raw JSON object (no markdown, no explanation):
{
  "thumbnailPrompt": "dramatic YouTube thumbnail description IN ENGLISH...",
  "scenes": [
    { "imagePrompt": "MUST BE IN ENGLISH - detailed description...", "dialogue": "2-3 complete sentences from the story in original language" },
    ...
  ]
}`;

    const userMessage = `Here is the story script to analyze and divide into scenes:\n\n"""\n${script}\n"""`;

    let finalScenes;
    let finalThumbnailPrompt = null;

    try {
      // 60-second timeout via AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const responseText = await callOpenAI(
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 8192,
          jsonMode: true
        },
        controller.signal
      );

      clearTimeout(timeoutId);

      if (!responseText) {
        throw new Error('Empty response from OpenAI');
      }

      let cleanedText = responseText.trim();

      // Attempt to extract the JSON block if the response is surrounded by conversational text
      const firstBrace = cleanedText.indexOf('{');
      const firstBracket = cleanedText.indexOf('[');
      const lastBrace = cleanedText.lastIndexOf('}');
      const lastBracket = cleanedText.lastIndexOf(']');

      let jsonText = cleanedText;

      if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        if (lastBrace !== -1 && lastBrace > firstBrace) {
          jsonText = cleanedText.slice(firstBrace, lastBrace + 1);
        }
      } else if (firstBracket !== -1) {
        if (lastBracket !== -1 && lastBracket > firstBracket) {
          jsonText = cleanedText.slice(firstBracket, lastBracket + 1);
        }
      }

      const parsed = JSON.parse(jsonText);

      // Handle both formats: new format { thumbnailPrompt, scenes } or legacy array format
      if (Array.isArray(parsed)) {
        finalScenes = parsed;
      } else {
        finalThumbnailPrompt = parsed.thumbnailPrompt || null;
        finalScenes = parsed.scenes || parsed;
      }

      if (!Array.isArray(finalScenes)) {
        throw new Error('Parsed scenes is not an array');
      }

    } catch (apiError: unknown) {
      const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
      console.warn("OpenAI API or JSON parsing failed, using Local Fallback Splitter:", errorMessage);

      // Local Fallback: Split into sentences then group 2-3 per scene
      const sentences = script
        .split(/।|\.\s|\n+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 5);

      const fallbackScenes: Array<{ imagePrompt: string, dialogue: string }> = [];
      for (let i = 0; i < sentences.length; i += 2) {
        const group = sentences.slice(i, i + 3); // Take 2-3 sentences
        if (group.length > 0) {
          fallbackScenes.push({
            imagePrompt: `[API LIMIT REACHED] Wait 1 minute and click Generate Storyboard again.`,
            dialogue: group.join('। ') + '।'
          });
        }
        // If we took 3, advance extra
        if (group.length === 3) i++;
      }

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
    let cleanedText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

    // Try to extract JSON from the response (AI might add explanatory text before/after)
    let parsed;

    // Attempt 1: Direct parse
    try {
      parsed = JSON.parse(cleanedText);
    } catch {
      // Attempt 2: Find JSON object or array in the text
      const jsonMatch = cleanedText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (jsonMatch) {
        try {
          // Replace unescaped newlines inside strings
          const fixedJson = jsonMatch[0].replace(/\n/g, ' ').replace(/\r/g, '').replace(/\t/g, ' ');
          parsed = JSON.parse(fixedJson);
        } catch {
          // Attempt 3: Aggressive cleanup
          const aggressive = jsonMatch[0]
            .replace(/[\x00-\x1F\x7F]/g, ' ')  // Replace ALL control chars with space
            .replace(/\s+/g, ' ');               // Collapse multiple spaces
          parsed = JSON.parse(aggressive);
        }
      } else {
        throw new Error('AI response did not contain valid JSON. Response started with: ' + cleanedText.slice(0, 100));
      }
    }

    // Handle both formats: new format { thumbnailPrompt, scenes } or legacy array format
    if (Array.isArray(parsed)) {
      return NextResponse.json({ scenes: parsed });
    }

    return NextResponse.json({
      thumbnailPrompt: finalThumbnailPrompt,
      scenes: finalScenes
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

