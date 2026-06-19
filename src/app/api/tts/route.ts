import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Unofficial free Google Translate TTS API (client=tw-ob bypasses captcha)
    // Google TTS has a strict 200 character limit, otherwise it throws 400 Bad Request
    const safeText = text.length > 199 ? text.substring(0, 196) + '...' : text;
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(safeText)}&tl=hi&client=tw-ob`;
    
    const response = await fetch(url, {
        headers: {
            // Spoof user agent just in case
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });

    if (!response.ok) {
        throw new Error(`Google TTS API Error: ${response.status}`);
    }

    const audioBlob = await response.blob();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Return base64 audio
    const base64Audio = `data:audio/mp3;base64,${buffer.toString('base64')}`;

    return NextResponse.json({ audioUrl: base64Audio });
  } catch (error: any) {
    console.error('Error fetching TTS:', error);
    return NextResponse.json(
      { error: 'Failed to generate audio', details: error.message },
      { status: 500 }
    );
  }
}
