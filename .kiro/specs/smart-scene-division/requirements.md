# Requirements Document

## Introduction

यह feature AI StoryCraft app में दो key improvements लाता है: (1) Intelligent Scene Division — जहाँ system पहले user की पूरी story को समझता है (narrative structure, dramatic moments, setting changes, character actions, emotional beats) और फिर उसके अनुसार intelligently scenes divide करता है, बजाय simple sentence splitting के। (2) API Migration — Google Gemini API से OpenAI ChatGPT API पर switch, क्योंकि Gemini API की quota/limit exhaust हो रही है।

## Glossary

- **Scene_Divider**: The backend module responsible for analyzing a full story and intelligently dividing it into dramatic scenes based on narrative structure
- **Brainstorm_Engine**: The backend module responsible for taking a user idea and generating a complete Hindi story script
- **OpenAI_Client**: The HTTP client that communicates with the OpenAI ChatGPT API for all AI operations
- **Story_Analyzer**: The component within Scene_Divider that first comprehends the full story before performing division
- **Scene**: A unit of the storyboard containing an image prompt (English) and dialogue text (target language)
- **Narrative_Beat**: A distinct moment in the story defined by a change in setting, emotion, character action, or dramatic tension
- **Fallback_Splitter**: The local mechanism that splits story text by sentence separators when the AI API is unavailable

## Requirements

### Requirement 1: Replace Gemini API with OpenAI ChatGPT API for Brainstorming

**User Story:** As a developer, I want to switch the brainstorm endpoint from Google Gemini to OpenAI ChatGPT API, so that I can avoid Gemini's exhausted quota limits and continue generating scripts reliably.

#### Acceptance Criteria

1. WHEN a brainstorm request is received with a non-empty `idea` field in the request body, THE Brainstorm_Engine SHALL send the prompt to the OpenAI ChatGPT API (model: `gpt-4o-mini`) instead of the Google Gemini API
2. THE Brainstorm_Engine SHALL use the `OPENAI_API_KEY` environment variable for authentication with the OpenAI API
3. WHEN the OpenAI API returns a successful response, THE Brainstorm_Engine SHALL extract the generated Hindi script text from the response and return it as a trimmed string in the existing `{ script: string }` response format with HTTP 200
4. IF the `OPENAI_API_KEY` environment variable is not set, is empty, or equals the literal string `put_your_openai_key_here`, THEN THE Brainstorm_Engine SHALL return the existing mock script data in `{ script: string }` format with HTTP 200
5. IF the OpenAI API returns an error or an empty response, THEN THE Brainstorm_Engine SHALL return an HTTP 500 response with the error details in `{ error: string, details: string }` format
6. THE Brainstorm_Engine SHALL preserve the existing prompt structure including character profile injection (when `characterProfile` is provided in the request body), location profile injection (when `locationProfile` is provided in the request body), and Hindi language output requirement
7. THE Brainstorm_Engine SHALL set the OpenAI API request temperature parameter to 0.9 and limit the maximum response length to 1024 tokens

### Requirement 2: Replace Gemini API with OpenAI ChatGPT API for Scene Generation

**User Story:** As a developer, I want to switch the scene generation endpoint from Google Gemini to OpenAI ChatGPT API, so that scene division works without Gemini quota limitations.

#### Acceptance Criteria

1. WHEN a generate request is received with a non-empty script field, THE Scene_Divider SHALL send the prompt to the OpenAI ChatGPT API (model: gpt-4o-mini or higher) instead of the Google Gemini API
2. WHEN authenticating with the OpenAI API, THE Scene_Divider SHALL read the `OPENAI_API_KEY` environment variable and use it as the Bearer token for all API requests
3. WHEN the OpenAI API returns a successful response, THE Scene_Divider SHALL extract the JSON content from the response (stripping any markdown code fences), parse it, and return scenes in the existing `{ scenes: Array<{ imagePrompt: string, dialogue: string }> }` format
4. IF the `OPENAI_API_KEY` environment variable is not set, is empty, or equals a placeholder string (e.g., a value containing "put_your" or "your_key_here"), THEN THE Scene_Divider SHALL return the existing mock scene data without calling the OpenAI API
5. IF the OpenAI API returns a non-2xx HTTP status or does not respond within 30 seconds, THEN THE Fallback_Splitter SHALL split the script by sentence separators (।, ., \n), trim whitespace, filter empty segments, and return each segment as a scene with a placeholder image prompt indicating the API was unavailable
6. THE Scene_Divider SHALL include character profile injection, location profile injection, visual style direction, and target language translation instructions in the prompt sent to the OpenAI API, maintaining the same prompt structure used in the existing Gemini implementation
7. IF the script field is missing or empty in the request body, THEN THE Scene_Divider SHALL return an error response with HTTP status 400 indicating that a script is required

### Requirement 3: Intelligent Story Comprehension Before Scene Division

**User Story:** As a content creator, I want the system to first understand my complete story before dividing it into scenes, so that the scene breaks align with natural narrative structure rather than arbitrary sentence boundaries.

#### Acceptance Criteria

1. WHEN a script is submitted for scene generation, THE Story_Analyzer SHALL first analyze the complete story to identify narrative structure including dramatic moments, setting changes, character actions, and emotional beats
2. THE Story_Analyzer SHALL use a two-phase prompt approach: first comprehend the story structure (identifying beginning, rising action, climax, falling action, resolution), then divide into scenes based on that comprehension
3. WHEN dividing scenes, THE Scene_Divider SHALL create scene breaks at Narrative_Beats (defined as a change in setting, emotion, character action, or dramatic tension) rather than at arbitrary sentence boundaries
4. THE Scene_Divider SHALL produce between 5 and 8 scenes from any given story script regardless of the number of sentences in the input
5. WHEN a scene break is determined, THE Scene_Divider SHALL ensure each scene contains a complete dramatic unit with a clear visual moment suitable for image generation — no scene shall contain only transitional or filler text
6. THE Scene_Divider SHALL generate image prompts that reference the specific dramatic moment, character emotional state, and setting of each scene, including the character description and location description when provided
7. IF the story has fewer than 3 identifiable Narrative_Beats, THEN THE Scene_Divider SHALL create scene breaks at logical sentence groupings while maintaining a minimum of 3 scenes and a maximum of 5 scenes

### Requirement 4: Remove Google Gemini Dependency

**User Story:** As a developer, I want to completely remove the Google Gemini SDK and API references, so that the codebase is clean and does not carry unused dependencies.

#### Acceptance Criteria

1. THE OpenAI_Client SHALL replace all usages of the `@google/genai` package in the `src/app/api/brainstorm/route.ts` and `src/app/api/generate/route.ts` files, including the `GoogleGenAI` import, the client instantiation, and the direct `fetch` calls to `generativelanguage.googleapis.com`
2. WHEN the migration is complete, THE application SHALL have no remaining imports, references, or string literals referring to `@google/genai`, `GoogleGenAI`, `GEMINI_API_KEY`, or `generativelanguage.googleapis.com` in any source file under the `src/` directory
3. THE application SHALL use the `OPENAI_API_KEY` environment variable instead of `GEMINI_API_KEY` for all AI text-generation operations in the brainstorm and generate API routes
4. THE OpenAI_Client SHALL use the OpenAI Chat Completions API endpoint with the `gpt-4o-mini` model for both the brainstorm and generate API routes
5. WHEN the migration is complete, THE `package.json` SHALL no longer list `@google/genai` in its `dependencies` or `devDependencies` sections

### Requirement 5: Maintain Backward-Compatible Response Format

**User Story:** As a developer, I want the API responses to remain in the same format after migration, so that the frontend studio page continues to work without modifications.

#### Acceptance Criteria

1. THE Brainstorm_Engine SHALL return responses in the format `{ script: string }` matching the current contract
2. THE Scene_Divider SHALL return responses in the format `{ scenes: Array<{ imagePrompt: string, dialogue: string }> }` matching the current contract
3. WHEN a validation error occurs (e.g., missing required input), THE application SHALL return error responses in the format `{ error: string, details: string }` with HTTP status code 400
4. WHEN an internal processing error occurs, THE application SHALL return error responses in the format `{ error: string, details: string }` with HTTP status code 500
5. THE Scene_Divider SHALL ensure all image prompts are written in comma-separated English containing at least the character description, the scene action, and the setting location
6. THE Scene_Divider SHALL ensure all dialogue fields contain text exclusively in the user's specified target language as provided in the request body
7. THE Scene_Divider SHALL return between 5 and 8 scene objects in the scenes array
