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
    
    const imageSeed = seed !== undefined ? seed : Math.floor(Math.random() * 999999);
    const qualityPrefix = `Masterpiece, best quality, perfect face, detailed eyes, symmetrical face, beautiful lighting, ${visualStyle}`;
    const encodedPrompt = encodeURIComponent(`${qualityPrefix}, ${prompt}`);
    const imageApiUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&seed=${imageSeed}&nofeed=true&negative=deformed,ugly,bad+anatomy,disfigured,poorly+drawn+face,mutation,extra+limbs,blurry`;

    // Retry logic — up to 3 attempts with increasing delay
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout per attempt

        const response = await fetch(imageApiUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          // If rate limited (429) or server error (5xx), retry after delay
          if ((response.status === 429 || response.status >= 500) && attempt < 3) {
            const delay = attempt * 3000; // 3s, 6s
            console.warn(`Pollinations attempt ${attempt} failed (${response.status}), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw new Error(`Pollinations Backend Error: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        
        // Return the raw image stream directly
        return new Response(arrayBuffer, {
          headers: {
            'Content-Type': response.headers.get('content-type') || 'image/jpeg',
          },
        });
      } catch (e: any) {
        lastError = e;
        if (e.name === 'AbortError') {
          console.warn(`Pollinations attempt ${attempt} timed out`);
        }
        if (attempt < 3) {
          const delay = attempt * 3000;
          console.warn(`Pollinations attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted — return error instead of placeholder
    const errorMessage = lastError instanceof Error ? lastError.message : 'Unknown error';
    console.error('All image generation attempts failed:', errorMessage);
    return NextResponse.json(
      { error: 'Image generation failed after 3 attempts', details: errorMessage },
      { status: 503 }
    );
  } catch (error: any) {
    console.error('Error generating proxy image:', error);
    return NextResponse.json(
      { error: 'Image generation failed', details: error.message },
      { status: 500 }
    );
  }
}
