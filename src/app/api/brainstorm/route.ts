import { NextResponse } from 'next/server';
import { callOpenAI } from '@/lib/openai';

export async function POST(req: Request) {
  try {
    const { idea, characterProfile, locationProfile } = await req.json();

    if (!idea) {
      return NextResponse.json({ error: 'Idea is required' }, { status: 400 });
    }

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
