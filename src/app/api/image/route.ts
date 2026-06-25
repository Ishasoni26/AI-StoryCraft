import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt, style, aspectRatio, seed } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const visualStyle = style || "pixar 3d cartoon style";
    
    let width = 1024;
    let height = 576;
    if (aspectRatio === '9:16') {
        width = 576;
        height = 1024;
    }
    
    // Use the provided seed for consistency, or generate a random one if omitted.
    const imageSeed = seed !== undefined ? seed : Math.floor(Math.random() * 1000000); 
    const encodedPrompt = encodeURIComponent(`Masterpiece, best quality, ${visualStyle}, ${prompt}`);
    const imageApiUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&seed=${imageSeed}`;

    const response = await fetch(imageApiUrl);

    if (!response.ok) {
        throw new Error(`Pollinations Backend Error: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    
    // Return the raw image stream directly instead of large base64 JSON
    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'image/jpeg',
      },
    });
  } catch (error: any) {
    console.error('Error generating proxy image:', error);
    
    try {
      const fallbackUrl = 'https://placehold.co/800x600/png?text=Image+API+Busy';
      const fallbackRes = await fetch(fallbackUrl);
      const fallbackBuffer = await fallbackRes.arrayBuffer();
      return new Response(fallbackBuffer, { headers: { 'Content-Type': 'image/png' } });
    } catch (fallbackError) {
      return NextResponse.json({ error: 'Fallback failed' }, { status: 500 });
    }
  }
}
