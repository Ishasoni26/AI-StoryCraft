import { NextResponse } from 'next/server';
import { callOpenAI } from '@/lib/openai';
import { validateTargetDuration, calculateTargetWordCount } from '@/lib/long-video/script-generator';

/**
 * Counts words in a text string by splitting on whitespace.
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Builds the long-form system prompt requesting a story of the target word count
 * with narrative arc structure.
 */
function buildLongFormSystemPrompt(targetWordCount: number): string {
  return `You are an expert long-form storytelling scriptwriter for YouTube videos.
Write a highly engaging, dramatic story script in HINDI based on the user's idea.
The script should be purely the narrative voiceover (no camera directions or sound effect notes).

TARGET LENGTH: Write approximately ${targetWordCount} words. This is very important - the story must be long and detailed.

NARRATIVE STRUCTURE (follow these proportions):
- Introduction (10-15% of total): Set the scene, introduce the main character, establish the world
- Rising Action (25-30% of total): Build tension, introduce conflicts, develop the plot
- Climax (15-20% of total): The peak of tension, the turning point of the story
- Falling Action (20-25% of total): Show consequences, begin resolution
- Resolution (15-20% of total): Conclude the story, deliver the moral or final message

Use dramatic language, vivid descriptions, and strong emotional hooks throughout.
Keep paragraphs flowing naturally - this will be narrated as a continuous voiceover.

Do NOT include any markdown formatting, headers, section labels, or English text. Just return the Hindi story text directly.`;
}

/**
 * Builds the continuation prompt for follow-up calls when word count is insufficient.
 */
function buildContinuationPrompt(currentScript: string, targetWordCount: number, currentWordCount: number): string {
  const remainingWords = targetWordCount - currentWordCount;
  return `Continue the story below seamlessly. Write approximately ${remainingWords} more words to complete it.
Do NOT repeat any part of the existing story. Continue naturally from where it left off.
Maintain the same tone, style, and language (Hindi). Do NOT include any English text or formatting.

EXISTING STORY SO FAR:
${currentScript.slice(-1000)}

Continue the story from here:`;
}

export async function POST(req: Request) {
  try {
    const { idea, characterProfile, locationProfile, isLongForm, targetDurationMinutes } = await req.json();

    if (!idea) {
      return NextResponse.json({ error: 'Idea is required' }, { status: 400 });
    }

    // --- Long-form script generation path ---
    if (isLongForm) {
      const duration = targetDurationMinutes ?? 12;

      // Validate target duration
      if (!validateTargetDuration(duration)) {
        return NextResponse.json(
          { error: 'targetDurationMinutes must be an integer between 1 and 20' },
          { status: 400 }
        );
      }

      const targetWordCount = calculateTargetWordCount(duration);
      const systemMessage = buildLongFormSystemPrompt(targetWordCount);

      let userMessage = `Topic/Idea: "${idea}"`;
      if (characterProfile) {
        userMessage += `\n\nThe main character is EXACTLY: "${characterProfile}". Make sure the story revolves around this character.`;
      }
      if (locationProfile) {
        userMessage += `\n\nThe main location/universe where this story takes place is EXACTLY: "${locationProfile}". Establish this setting clearly.`;
      }
      userMessage += `\n\nRemember: Write approximately ${targetWordCount} words. Make the story long, detailed, and engaging.`;

      let script = '';
      let wordCount = 0;

      // Initial generation
      try {
        const initialText = await callOpenAI({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.9,
          max_tokens: 4096,
        });

        script = initialText.trim();
        wordCount = countWords(script);
      } catch (error: any) {
        // API failure on initial call - return empty/partial with error flag
        console.error('Error during initial long-form generation:', error);
        return NextResponse.json({
          script: script || '',
          wordCount: countWords(script || ''),
          isIncomplete: true,
          estimatedDurationMinutes: countWords(script || '') / 130,
        });
      }

      // Continuation calls if under 1500 words (up to 3 retries)
      const MAX_CONTINUATIONS = 3;
      for (let i = 0; i < MAX_CONTINUATIONS && wordCount < targetWordCount; i++) {
        try {
          const continuationText = await callOpenAI({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemMessage },
              { role: 'user', content: buildContinuationPrompt(script, targetWordCount, wordCount) },
            ],
            temperature: 0.9,
            max_tokens: 4096,
          });

          script = script + '\n\n' + continuationText.trim();
          wordCount = countWords(script);
        } catch (error: any) {
          // API failure during continuation - return partial script
          console.error(`Error during continuation call ${i + 1}:`, error);
          return NextResponse.json({
            script,
            wordCount,
            isIncomplete: true,
            estimatedDurationMinutes: wordCount / 130,
          });
        }
      }

      return NextResponse.json({
        script,
        wordCount,
        isIncomplete: false,
        estimatedDurationMinutes: wordCount / 130,
      });
    }

    // --- Existing short-form script generation path (unchanged) ---

    // Check if any valid AI API key is available
    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const hasValidKey = (groqKey && !groqKey.includes('put_your') && !groqKey.includes('your_key_here')) ||
                        (openaiKey && !openaiKey.includes('put_your') && !openaiKey.includes('your_key_here'));
    
    if (!hasValidKey) {
      return NextResponse.json({
        script: `[MOCK SCRIPT] एक छोटे से गाँव में मोहन नाम का एक गरीब लड़का रहता था। वह अपनी बूढ़ी माँ के साथ एक टूटी-फूटी झोपड़ी में रहता था...`
      });
    }

    const systemMessage = `You are a viral YouTube Shorts scriptwriter.
Write a highly engaging, fast-paced 60-second YouTube Short story script in HINDI based on the user's idea.
The script should be purely the narrative voiceover (no camera directions or sound effect notes).
Use dramatic language and strong hooks. Keep it between 5 to 10 sentences total.

Do NOT include any markdown formatting, headers, or English text. Just return the Hindi story text directly.`;

    let userMessage = `Topic/Idea: "${idea}"`;

    if (characterProfile) {
      userMessage += `\n\nThe main character is EXACTLY: "${characterProfile}". Make sure the story revolves around this character.`;
    }
    if (locationProfile) {
      userMessage += `\n\nThe main location/universe where this story takes place is EXACTLY: "${locationProfile}". Establish this setting clearly.`;
    }

    const text = await callOpenAI({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.9,
      max_tokens: 1024,
    });

    return NextResponse.json({ script: text.trim() });
  } catch (error: any) {
    console.error('Error brainstorming script:', error);
    return NextResponse.json(
      { error: 'Failed to brainstorm script', details: error.message },
      { status: 500 }
    );
  }
}
