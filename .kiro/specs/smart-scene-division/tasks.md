# Implementation Plan: Smart Scene Division

## Overview

Migrate AI StoryCraft from Google Gemini to OpenAI ChatGPT API with intelligent two-phase story comprehension for scene division. Implementation starts with a shared OpenAI client helper, then migrates each route, removes the Gemini dependency, and verifies the build.

## Tasks

- [x] 1. Create shared OpenAI client utility
  - [x] 1.1 Create `src/lib/openai.ts` with the `callOpenAI` helper function
    - Define `OpenAIChatRequest` interface with `model`, `messages`, `temperature`, `max_tokens` fields
    - Define `OpenAIChatResponse` interface matching OpenAI Chat Completions response shape
    - Implement `callOpenAI(request: OpenAIChatRequest): Promise<string>` that uses native `fetch` to POST to `https://api.openai.com/v1/chat/completions`
    - Include Bearer token auth using `process.env.OPENAI_API_KEY`
    - Add error handling: throw on non-2xx responses or empty `choices[0].message.content`
    - Return trimmed `choices[0].message.content` string
    - Accept an optional `AbortSignal` parameter for timeout support
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 4.4_

  - [ ]* 1.2 Write property test for response text extraction (Property 4)
    - **Property 4: Response text extraction preserves trimmed content**
    - **Validates: Requirements 1.3**
    - Set up vitest and fast-check as dev dependencies
    - For any non-empty string with various whitespace padding, the extraction logic returns content with only leading/trailing whitespace removed, interior characters unchanged

- [x] 2. Migrate brainstorm route to OpenAI
  - [x] 2.1 Rewrite `src/app/api/brainstorm/route.ts` to use OpenAI
    - Remove `@google/genai` import and `GoogleGenAI` instantiation
    - Import `callOpenAI` from `src/lib/openai`
    - Replace API key check: use `OPENAI_API_KEY` with placeholder detection (`put_your_openai_key_here`, contains `put_your` or `your_key_here`)
    - Keep mock data return when key is invalid/missing
    - Keep input validation (`idea` required, return 400)
    - Preserve existing prompt structure with character/location profile injection
    - Call `callOpenAI` with model `gpt-4o-mini`, temperature 0.9, max_tokens 1024
    - Return `{ script: text.trim() }` on success
    - Return 500 with `{ error, details }` on failure
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 5.1_

  - [ ]* 2.2 Write property test for profile injection completeness (Property 3)
    - **Property 3: Profile injection completeness**
    - **Validates: Requirements 1.6, 2.6**
    - For any non-empty `characterProfile` and/or `locationProfile` string, the constructed prompt contains the exact profile string verbatim

- [x] 3. Checkpoint - Verify brainstorm route
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Migrate generate route to OpenAI with two-phase prompt
  - [x] 4.1 Rewrite `src/app/api/generate/route.ts` to use OpenAI with intelligent scene division
    - Remove `@google/genai` import and `GoogleGenAI` instantiation
    - Import `callOpenAI` from `src/lib/openai`
    - Replace API key check: use `OPENAI_API_KEY` with placeholder detection
    - Keep mock data return when key is invalid/missing
    - Keep input validation (`script` required, return 400)
    - Implement the two-phase system prompt:
      - Phase 1: Instruct AI to analyze narrative arc (beginning, rising action, climax, falling action, resolution), map dramatic moments, note setting changes, identify natural scene break points
      - Phase 2: Instruct AI to create 5-8 scenes aligned with narrative beats, generate detailed English image prompts, extract dialogue in target language
    - Include character profile and location profile injection in the prompt
    - Call `callOpenAI` with model `gpt-4o-mini`, temperature 0.7, max_tokens 2048, and a 30-second `AbortController` timeout
    - Strip markdown code fences from response and parse JSON
    - On API failure or timeout, fall back to local sentence splitter (split by `।`, `.`, `\n`)
    - Return `{ scenes: [...] }` on success
    - Return 500 with `{ error, details }` on JSON parse failure
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 5.2, 5.5, 5.6, 5.7_

  - [ ]* 4.2 Write property test for markdown fence stripping (Property 1)
    - **Property 1: Markdown fence stripping round-trip**
    - **Validates: Requirements 2.3**
    - For any valid JSON array of scene objects, wrapping in any combination of markdown fences and applying the stripping logic produces an identical JSON structure

  - [ ]* 4.3 Write property test for fallback splitter (Property 2)
    - **Property 2: Fallback splitter produces non-empty trimmed segments**
    - **Validates: Requirements 2.5**
    - For any non-empty string containing sentence separators, the fallback splitter produces an array where every segment is non-empty and has no leading/trailing whitespace

- [x] 5. Checkpoint - Verify generate route
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Remove Gemini dependency and finalize
  - [x] 6.1 Remove `@google/genai` from `package.json` and clean up environment references
    - Remove `@google/genai` from `dependencies` in `package.json`
    - Add `OPENAI_API_KEY` to `.env.local` (with placeholder value)
    - Verify no remaining imports, references, or string literals referring to `@google/genai`, `GoogleGenAI`, `GEMINI_API_KEY`, or `generativelanguage.googleapis.com` in any file under `src/`
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [x] 6.2 Verify the application builds successfully
    - Run `npm run build` to confirm no TypeScript errors or missing imports
    - Confirm the app compiles cleanly with the Gemini dependency fully removed
    - _Requirements: 4.2, 4.5, 5.1, 5.2_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The design specifies direct `fetch` (no OpenAI SDK) to keep the codebase lightweight
- The two-phase prompt is implemented as a single API call with a structured system prompt (not two separate calls)
- Frontend (`/studio/page.tsx`) remains untouched — response contracts are preserved exactly

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3"] },
    { "id": 4, "tasks": ["6.1"] },
    { "id": 5, "tasks": ["6.2"] }
  ]
}
```
