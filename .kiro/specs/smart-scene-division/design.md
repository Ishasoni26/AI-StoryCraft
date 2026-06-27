# Design Document: Smart Scene Division

## Overview

This design covers migrating the AI StoryCraft backend from Google Gemini to OpenAI ChatGPT API (`gpt-4o-mini`) and introducing intelligent two-phase story comprehension for scene division. The migration affects two API routes (`/api/brainstorm` and `/api/generate`) while keeping the frontend and response contracts unchanged.

The core innovation is the two-phase prompt approach for scene generation: rather than simply asking the AI to divide a story into scenes, the system first instructs the AI to analyze the story's narrative structure (dramatic beats, setting changes, emotional arcs) and then uses that comprehension to create intelligent scene breaks at natural narrative boundaries.

### Key Design Decisions

1. **Direct fetch to OpenAI API** — No SDK dependency. Uses native `fetch` with the Chat Completions endpoint (`https://api.openai.com/v1/chat/completions`). This keeps the codebase lightweight and avoids adding another package dependency.

2. **Single API call with structured system prompt** — The two-phase story comprehension is achieved within a single API call by using a system prompt that instructs the model to first analyze, then divide. This avoids extra latency and cost from two separate calls.

3. **Model: gpt-4o-mini** — Cost-effective, fast, and capable enough for script generation and scene division tasks.

4. **Backward-compatible response format** — The frontend (`/studio/page.tsx`) remains untouched. API responses maintain the exact same shape.

## Architecture

```mermaid
graph TD
    subgraph Frontend
        A[Studio Page /studio]
    end

    subgraph API Routes
        B[POST /api/brainstorm]
        C[POST /api/generate]
    end

    subgraph OpenAI Integration
        D[OpenAI Chat Completions API]
    end

    subgraph Fallback
        E[Local Fallback Splitter]
    end

    A -->|POST idea, characterProfile, locationProfile| B
    A -->|POST script, targetLanguage, characterProfile, locationProfile| C
    B -->|Chat Completions request| D
    C -->|Two-phase prompt| D
    D -->|Script text| B
    D -->|JSON scenes array| C
    C -->|On API failure/timeout| E
    B -->|{ script: string }| A
    C -->|{ scenes: Scene[] }| A
    E -->|Fallback scenes| C
```

### Request Flow

1. **Brainstorm flow**: User submits idea → `/api/brainstorm` sends system+user prompt to OpenAI → returns `{ script: string }`
2. **Generate flow**: User submits script → `/api/generate` sends two-phase system prompt to OpenAI → AI analyzes narrative structure then divides into scenes → returns `{ scenes: [...] }`
3. **Fallback**: If OpenAI API fails or times out (30s), the generate endpoint falls back to local sentence splitting

## Components and Interfaces

### OpenAI Client Module (shared utility)

A thin helper function used by both API routes to call OpenAI's Chat Completions API:

```typescript
// Shared interface for OpenAI Chat Completions request
interface OpenAIChatRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  temperature: number;
  max_tokens: number;
}

// Shared interface for OpenAI Chat Completions response
interface OpenAIChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
}

// Helper function signature
async function callOpenAI(request: OpenAIChatRequest): Promise<string>
```

### Brainstorm Route (`/api/brainstorm/route.ts`)

**Input (POST body):**
```typescript
interface BrainstormRequest {
  idea: string;               // Required - the story idea/topic
  characterProfile?: string;  // Optional - character description
  locationProfile?: string;   // Optional - location/setting description
}
```

**Output:**
```typescript
// Success (200)
interface BrainstormResponse {
  script: string;  // Generated Hindi script
}

// Error (400 | 500)
interface ErrorResponse {
  error: string;
  details: string;
}
```

**Behavior:**
- Validates `idea` is non-empty (returns 400 if missing)
- Checks `OPENAI_API_KEY` validity (returns mock data if placeholder)
- Sends prompt to OpenAI with temperature 0.9, max_tokens 1024
- Returns trimmed script text

### Generate Route (`/api/generate/route.ts`)

**Input (POST body):**
```typescript
interface GenerateRequest {
  script: string;              // Required - the full story script
  targetLanguage?: string;     // Optional - output language for dialogue
  characterProfile?: string;   // Optional - character description
  locationProfile?: string;    // Optional - location/setting description
}
```

**Output:**
```typescript
// Success (200)
interface GenerateResponse {
  scenes: Array<{
    imagePrompt: string;  // English, detailed, comma-separated
    dialogue: string;     // Target language text
  }>;
}

// Error (400 | 500)
interface ErrorResponse {
  error: string;
  details: string;
}
```

**Behavior:**
- Validates `script` is non-empty (returns 400 if missing)
- Checks `OPENAI_API_KEY` validity (returns mock data if placeholder)
- Sends two-phase system prompt to OpenAI with temperature 0.7, max_tokens 2048
- Parses JSON from response (strips markdown fences)
- Falls back to local splitter on API failure or 30s timeout
- Returns 5-8 scenes

### Two-Phase System Prompt Structure

The scene generation uses a structured system prompt that guides the AI through two phases in a single call:

```
PHASE 1 - STORY COMPREHENSION:
- Identify the narrative arc (beginning, rising action, climax, falling action, resolution)
- Map dramatic moments and emotional beats
- Note setting changes and character actions
- Identify natural scene break points

PHASE 2 - SCENE DIVISION:
- Create 5-8 scenes aligned with narrative beats
- Each scene represents a complete dramatic unit
- Generate detailed English image prompts with character/location descriptions
- Extract dialogue in the target language
```

### Fallback Splitter

Unchanged from current implementation — splits by `।`, `.`, or `\n`, trims whitespace, filters empty segments, and returns placeholder image prompts with the text segments as dialogue.

## Data Models

### Environment Configuration

```
OPENAI_API_KEY=sk-...        # Required for AI operations
# GEMINI_API_KEY removed from active use
```

### OpenAI API Request Shape (Chat Completions)

```typescript
// POST https://api.openai.com/v1/chat/completions
{
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "<system prompt with instructions>" },
    { role: "user", content: "<user's story/idea>" }
  ],
  temperature: 0.7 | 0.9,  // 0.9 for brainstorm, 0.7 for generate
  max_tokens: 1024 | 2048   // 1024 for brainstorm, 2048 for generate
}
```

### OpenAI API Response Shape

```typescript
{
  id: string,
  object: "chat.completion",
  choices: [{
    index: 0,
    message: {
      role: "assistant",
      content: string  // The generated text or JSON
    },
    finish_reason: "stop" | "length"
  }],
  usage: { prompt_tokens: number, completion_tokens: number, total_tokens: number }
}
```

### Scene Object (unchanged from current)

```typescript
interface Scene {
  imagePrompt: string;  // Detailed English description for image generation
  dialogue: string;     // Story text in target language
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Markdown fence stripping round-trip

*For any* valid JSON array of scene objects, wrapping it in any combination of markdown code fences (```` ```json...``` ````, ```` ```...``` ````, or no fences) and then applying the fence-stripping logic SHALL produce a string that parses to an identical JSON structure.

**Validates: Requirements 2.3**

### Property 2: Fallback splitter produces non-empty trimmed segments

*For any* non-empty string containing sentence separators (`।`, `.`, `\n`), the fallback splitter SHALL produce an array where every segment is non-empty (length > 0) and contains no leading or trailing whitespace.

**Validates: Requirements 2.5**

### Property 3: Profile injection completeness

*For any* non-empty `characterProfile` and/or `locationProfile` string provided in the request, the constructed prompt (for both brainstorm and generate routes) SHALL contain the exact profile string verbatim.

**Validates: Requirements 1.6, 2.6**

### Property 4: Response text extraction preserves trimmed content

*For any* OpenAI API response containing a non-empty `choices[0].message.content` string, the extraction logic SHALL return the content with leading and trailing whitespace removed, and SHALL not alter any interior characters.

**Validates: Requirements 1.3**

## Error Handling

### API Key Validation

Both routes check the `OPENAI_API_KEY` environment variable before making external calls:
- If `undefined`, empty string, or matches placeholder patterns (`put_your_openai_key_here`, contains `put_your` or `your_key_here`): return mock data with HTTP 200
- This prevents unnecessary API calls during development and provides a working demo experience

### OpenAI API Errors

**Brainstorm route:**
- Non-2xx response from OpenAI → throw error → caught by outer try/catch → return 500 with `{ error, details }`
- Empty response (no `choices[0].message.content`) → throw error → 500 response
- Network errors / fetch failure → caught by try/catch → 500 response

**Generate route:**
- Non-2xx response from OpenAI → caught by inner try/catch → triggers fallback splitter
- Timeout (30 seconds via `AbortController`) → caught by inner try/catch → triggers fallback splitter
- Empty response → throw error → triggers fallback splitter
- JSON parse failure (malformed AI output) → caught by outer try/catch → 500 response

### Fallback Behavior (Generate route only)

When the OpenAI API is unavailable, the fallback splitter:
1. Splits the user's script by `।`, `.`, or `\n`
2. Trims each segment
3. Filters out empty segments
4. Returns each segment as a scene with a placeholder `imagePrompt` indicating API unavailability
5. If no segments produced, returns a single default scene

### Input Validation

- Missing/empty `idea` in brainstorm → HTTP 400 with `{ error: 'Idea is required' }`
- Missing/empty `script` in generate → HTTP 400 with `{ error: 'Script is required' }`

## Testing Strategy

### Unit Tests (Example-based)

Focus on specific scenarios and edge cases:

1. **API key validation** — Test each invalid key scenario (undefined, empty, placeholder) returns mock data
2. **Input validation** — Test missing/empty required fields return 400
3. **Error response format** — Test that API failures produce correct `{ error, details }` format with appropriate status codes
4. **Two-phase prompt structure** — Verify system prompt contains Phase 1 (analysis) before Phase 2 (division) instructions
5. **Mock data responses** — Verify mock data matches expected format when API key is invalid
6. **Timeout handling** — Verify 30-second AbortController triggers fallback

### Property-Based Tests

Using `fast-check` for TypeScript property-based testing. Each test runs minimum 100 iterations.

| Property | Test Description | Generator Strategy |
|----------|-----------------|-------------------|
| Property 1 | Markdown fence stripping | Generate random valid JSON arrays, wrap in random fence styles |
| Property 2 | Fallback splitter invariants | Generate random strings with `।`, `.`, `\n` separators |
| Property 3 | Profile injection | Generate random non-empty strings for profiles |
| Property 4 | Response extraction | Generate random strings with various whitespace padding |

**Configuration:**
- Library: `fast-check`
- Minimum iterations: 100 per property
- Tag format: `Feature: smart-scene-division, Property {number}: {property_text}`

### Integration Tests

1. **End-to-end brainstorm** — With valid API key, verify full round-trip produces `{ script: string }`
2. **End-to-end generate** — With valid API key, verify full round-trip produces scenes array with correct structure
3. **Fallback activation** — With invalid/missing API key after mock check, simulate API failure and verify fallback produces valid scenes
4. **Response format compatibility** — Verify the frontend can consume responses without modification

