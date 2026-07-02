import { NextResponse } from 'next/server';
import { callOpenAI } from '@/lib/openai';
import { chunkScript } from '@/lib/long-video/script-chunker';
import { assignSceneTypes, countSentences } from '@/lib/long-video/scene-types';
import { ExtendedScene } from '@/lib/long-video/types';

/**
 * Estimates duration in minutes based on total word count at 150 words/min.
 */
function estimateDurationMinutes(scenes: ExtendedScene[]): number {
  const totalWords = scenes.reduce((sum, scene) => {
    return sum + scene.dialogue.split(/\s+/).filter(w => w.length > 0).length;
  }, 0);
  return totalWords / 150;
}

/**
 * Splits scenes with more than 4 sentences into multiple scenes.
 * Returns a new array with the split scenes.
 */
function splitLongScenes(scenes: ExtendedScene[]): ExtendedScene[] {
  const result: ExtendedScene[] = [];

  for (const scene of scenes) {
    const sentenceCount = countSentences(scene.dialogue);
    if (sentenceCount > 4) {
      // Split dialogue into sentences and distribute into groups of 2-3
      const sentences = scene.dialogue.split(/(?<=[।.?!])\s*/).filter(s => s.trim().length > 0);
      let i = 0;
      while (i < sentences.length) {
        // Take 2-3 sentences per new scene
        const take = Math.min(3, sentences.length - i);
        const group = sentences.slice(i, i + take);
        result.push({
          ...scene,
          dialogue: group.join(' '),
          imagePrompt: scene.imagePrompt,
        });
        i += take;
      }
    } else {
      result.push(scene);
    }
  }

  return result;
}

/**
 * Parses AI response text into scene objects.
 */
function parseAIResponse(responseText: string): { scenes: ExtendedScene[]; thumbnailPrompt?: string } {
  // Strip markdown code fences if present
  let cleanedText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

  let parsed;

  // Attempt 1: Direct parse
  try {
    parsed = JSON.parse(cleanedText);
  } catch {
    // Attempt 2: Find JSON object or array in the text
    const jsonMatch = cleanedText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        const fixedJson = jsonMatch[0].replace(/\n/g, ' ').replace(/\r/g, '').replace(/\t/g, ' ');
        parsed = JSON.parse(fixedJson);
      } catch {
        // Attempt 3: Aggressive cleanup
        const aggressive = jsonMatch[0]
          .replace(/[\x00-\x1F\x7F]/g, ' ')
          .replace(/\s+/g, ' ');
        parsed = JSON.parse(aggressive);
      }
    } else {
      throw new Error('AI response did not contain valid JSON. Response started with: ' + cleanedText.slice(0, 100));
    }
  }

  if (Array.isArray(parsed)) {
    return { scenes: parsed };
  }

  return {
    thumbnailPrompt: parsed.thumbnailPrompt || null,
    scenes: parsed.scenes || parsed,
  };
}

/**
 * Builds the system prompt for long-form scene generation of a chunk.
 */
function buildLongFormSystemPrompt(
  charInstruction: string,
  locInstruction: string,
  langInstruction: string,
  previousScenes: ExtendedScene[]
): string {
  const contextSection = previousScenes.length > 0
    ? `\n\nPREVIOUS SCENES FOR CONTEXT (maintain narrative continuity with these):\n${previousScenes.map((s, i) => `Scene ${i + 1}: "${s.dialogue}"`).join('\n')}\n\nContinue the story naturally from where these scenes left off.`
    : '';

  return `You are an EXPERT AI Storyboard Director for long-form video content.

You will receive a portion of a story script. Your job is to divide it into scenes with 2-4 sentences each.

RULES:
- Each scene MUST have exactly 2-4 sentences of dialogue
- A sentence ends with "।" (Hindi purna viram), "." (English full stop), "?" (question mark), or "!" (exclamation mark)
- DO NOT put only 1 sentence or more than 4 sentences per scene
- Keep the dialogue text EXACTLY as it appears in the original — do not rephrase or summarize
- The image prompt should visually represent what's happening in those sentences

IMAGE PROMPT RULES:
1. ${charInstruction}
2. ${locInstruction}
3. LANGUAGE: ALL imagePrompt values MUST be written in ENGLISH ONLY.
4. Each imagePrompt must be highly detailed, comma-separated English, optimized for AI image generators
5. Include: scene/environment description, character if relevant, mood/emotion, cinematic quality keywords
6. ${langInstruction}
${contextSection}

OUTPUT FORMAT:
Return ONLY a raw JSON object (no markdown, no explanation):
{
  "scenes": [
    { "imagePrompt": "MUST BE IN ENGLISH - detailed description...", "dialogue": "2-4 complete sentences from the story in original language" },
    ...
  ]
}`;
}

export async function POST(req: Request) {
  try {
    const { script, targetLanguage, characterProfile, locationProfile, characters, isLongForm } = await req.json();

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

    // ========== LONG-FORM MODE ==========
    if (isLongForm) {
      return await handleLongFormGeneration(script, charInstruction, locInstruction, langInstruction);
    }

    // ========== SHORT-FORM MODE (existing behavior unchanged) ==========
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

    let responseText: string;
    try {
      // 60-second timeout via AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      responseText = await callOpenAI(
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
    } catch (apiError: unknown) {
      const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
      console.warn("OpenAI API failed, using Local Fallback Splitter:", errorMessage);

      // Local Fallback: Split into sentences then group 2-3 per scene
      const sentences = script
        .split(/।|\.\s|\n+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 5);

      const fallbackScenes: Array<{imagePrompt: string, dialogue: string}> = [];
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

    const { scenes, thumbnailPrompt } = parseAIResponse(responseText);

    // Handle both formats: new format { thumbnailPrompt, scenes } or legacy array format
    return NextResponse.json({
      thumbnailPrompt: thumbnailPrompt || null,
      scenes: scenes || []
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

/**
 * Handles long-form scene generation:
 * 1. Chunks script into 500-word segments
 * 2. Processes each chunk with OpenAI, including last 2 scenes as context
 * 3. Validates sentence count per scene (2-4 sentences)
 * 4. Assigns scene types
 * 5. Adds thumbnail, intro, and outro scenes
 * 6. Splits long scenes if duration < 10 min until scene count >= 40
 */
async function handleLongFormGeneration(
  script: string,
  charInstruction: string,
  locInstruction: string,
  langInstruction: string
): Promise<NextResponse> {
  // Step 1: Chunk the script into 500-word segments
  const chunks = chunkScript(script, 500);

  // Step 2: Process each chunk with AI, maintaining context overlap
  let allScenes: ExtendedScene[] = [];

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];

    // Get last 2 scenes from previous chunk for narrative continuity
    const previousScenes = allScenes.slice(-2);

    const systemPrompt = buildLongFormSystemPrompt(
      charInstruction,
      locInstruction,
      langInstruction,
      previousScenes
    );

    const userMessage = `Here is part ${chunkIndex + 1} of ${chunks.length} of the story script. Divide this into scenes with 2-4 sentences each:\n\n"""\n${chunk}\n"""`;

    try {
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

      if (responseText) {
        const { scenes: chunkScenes } = parseAIResponse(responseText);

        // Include all scenes with dialogue — don't filter out based on sentence count
        // This ensures no content is lost. Scene splitting happens later if needed.
        const validatedScenes: ExtendedScene[] = chunkScenes
          .filter((scene: ExtendedScene) => scene.dialogue && scene.dialogue.trim().length > 0)
          .map((scene: ExtendedScene): ExtendedScene => ({
            ...scene,
            chunkIndex,
          }));

        allScenes.push(...validatedScenes);
      }
    } catch (apiError: unknown) {
      const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
      console.error(`OpenAI API failed for chunk ${chunkIndex + 1}/${chunks.length}:`, errorMessage);
      // Continue with other chunks — partial results are acceptable
    }
  }

  // If no scenes were generated at all, log error for debugging
  if (allScenes.length === 0) {
    console.error('handleLongFormGeneration: 0 scenes generated from', chunks.length, 'chunks. Script length:', script.length, 'chars');
    
    // Fallback: split script into scenes locally (2-3 sentences per scene)
    const sentences = script
      .split(/[।.?!]\s*/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 5);

    for (let i = 0; i < sentences.length; i += 2) {
      const group = sentences.slice(i, i + 3);
      if (group.length > 0) {
        allScenes.push({
          imagePrompt: `Cinematic scene, dramatic lighting, story moment, detailed environment, masterpiece quality, 8k resolution`,
          dialogue: group.join('। ') + '।',
        });
      }
      if (group.length === 3) i++;
    }
    console.log('Fallback: created', allScenes.length, 'scenes from local sentence splitting');
  }

  // Step 5: If estimated duration < 10 min, split scenes with > 4 sentences until count >= 40
  let estimatedMinutes = estimateDurationMinutes(allScenes);
  let iterations = 0;
  const maxIterations = 10; // Safety limit to prevent infinite loops

  while (estimatedMinutes < 10 && allScenes.length < 40 && iterations < maxIterations) {
    const expandedScenes: ExtendedScene[] = [];
    let didSplit = false;

    for (const scene of allScenes) {
      const sentenceCount = countSentences(scene.dialogue);
      if (sentenceCount > 4 && allScenes.length + expandedScenes.length - allScenes.length < 40) {
        const splitResults = splitLongScenes([scene]);
        expandedScenes.push(...splitResults);
        if (splitResults.length > 1) didSplit = true;
      } else {
        expandedScenes.push(scene);
      }
    }

    if (!didSplit) break; // No more scenes to split
    allScenes = expandedScenes;
    estimatedMinutes = estimateDurationMinutes(allScenes);
    iterations++;
  }

  // Step 4: Assign scene types with max-3-consecutive constraint
  allScenes = assignSceneTypes(allScenes);

  // Step 6: Add structural scenes (thumbnail, intro, outro)
  const thumbnailScene: ExtendedScene = {
    imagePrompt: 'Dramatic YouTube thumbnail, Pixar 3D style, extreme close-up of main character with shocked expression, vibrant colors, cinematic lighting, 8k resolution',
    dialogue: '',
    isThumbnail: true,
    sceneType: 'establishing',
  };

  const outroScene: ExtendedScene = {
    imagePrompt: 'YouTube outro screen, subscribe button, bell icon notification, like and share prompt, vibrant colors, engaging call-to-action composition, 3D rendered',
    dialogue: 'अगर आपको यह कहानी पसंद आई तो लाइक करें, शेयर करें, और चैनल को सब्सक्राइब करें। अगली कहानी और भी रोमांचक होगी।',
    isOutro: true,
    sceneType: 'transition',
  };

  // Assemble final scene list: thumbnail at 0, all content scenes, outro at end
  // No intro scene — all story scenes start from beginning without skipping
  const finalScenes: ExtendedScene[] = [
    thumbnailScene,
    ...allScenes,
    outroScene,
  ];

  return NextResponse.json({
    scenes: finalScenes,
    totalSceneCount: finalScenes.length,
  });
}
