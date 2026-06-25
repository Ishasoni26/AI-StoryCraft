import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { idea, characterProfile, locationProfile } = await req.json();

    if (!idea) {
      return NextResponse.json({ error: 'Idea is required' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'put_your_free_gemini_key_here') {
      return NextResponse.json({
        script: `[MOCK SCRIPT] एक छोटे से गाँव में मोहन नाम का एक गरीब लड़का रहता था। वह अपनी बूढ़ी माँ के साथ एक टूटी-फूटी झोपड़ी में रहता था...`
      });
    }

    const prompt = `
You are a viral YouTube Shorts scriptwriter.
A user has provided a short topic/idea: "${idea}"

${characterProfile ? `The main character is EXACTLY: "${characterProfile}". Make sure the story revolves around this character.` : ''}
${locationProfile ? `The main location/universe where this story takes place is EXACTLY: "${locationProfile}". Establish this setting clearly.` : ''}

Write a highly engaging, fast-paced 60-second YouTube Short story script in HINDI based on this idea.
The script should be purely the narrative voiceover (no camera directions or sound effect notes).
Use dramatic language and strong hooks. Keep it between 5 to 10 sentences total.

Do NOT include any markdown formatting, headers, or English text. Just return the Hindi story text directly.
    `;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.9,
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API HTTP Error: ${response.status}`);
    }
    
    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    return NextResponse.json({ script: text.trim() });
  } catch (error: any) {
    console.error('Error brainstorming script:', error);
    return NextResponse.json(
      { error: 'Failed to brainstorm script', details: error.message },
      { status: 500 }
    );
  }
}
