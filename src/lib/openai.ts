/**
 * Shared AI Chat Completions client helper.
 * Supports Groq (free, fast) and OpenAI-compatible APIs.
 * Uses native fetch — no SDK dependency.
 */

export interface OpenAIChatRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  temperature: number;
  max_tokens: number;
  jsonMode?: boolean;
}

export interface OpenAIChatResponse {
  id: string;
  object: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Determines which AI provider to use and returns the config.
 * Priority: GROQ_API_KEY (free) > OPENAI_API_KEY (paid)
 */
function getProviderConfig(): { apiUrl: string; apiKey: string; model: string } {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (groqKey && !groqKey.includes('put_your') && !groqKey.includes('your_key_here')) {
    return {
      apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: groqKey,
      model: 'llama-3.3-70b-versatile', // Free, fast, great for creative tasks
    };
  }

  if (openaiKey && !openaiKey.includes('put_your') && !openaiKey.includes('your_key_here')) {
    return {
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: openaiKey,
      model: 'gpt-4o-mini',
    };
  }

  throw new Error('No valid AI API key found. Set GROQ_API_KEY (free) or OPENAI_API_KEY in .env.local');
}

/**
 * Calls the AI Chat Completions API (Groq or OpenAI) and returns the trimmed response content.
 *
 * @param request - The chat completion request parameters
 * @param signal - Optional AbortSignal for timeout support
 * @returns Trimmed content string from the first choice
 * @throws Error on non-2xx response, empty content, or network failure
 */
export async function callOpenAI(
  request: OpenAIChatRequest,
  signal?: AbortSignal
): Promise<string> {
  const config = getProviderConfig();

  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
      ...(request.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unable to read error body');
    throw new Error(
      `AI API error (${response.status}): ${errorBody}`
    );
  }

  const data: OpenAIChatResponse = await response.json();

  // Check if response was truncated
  if (data.choices?.[0]?.finish_reason === 'length') {
    console.warn('AI response was truncated (hit max_tokens limit)');
  }

  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('AI API returned an empty response (no content in choices[0].message.content)');
  }

  return content.trim();
}
