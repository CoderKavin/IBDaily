/**
 * Provider-agnostic AI client interface for question generation
 * AI role is coach, not examiner - avoids claiming certainty
 */

export type DifficultyRung = 1 | 2 | 3; // 1=Recall, 2=Application, 3=Exam-style

export interface QuestionGenerationInput {
  subjectName: string;
  level: "SL" | "HL";
  unitName: string;
  difficultyRung: DifficultyRung;
}

export interface GeneratedQuestion {
  questionText: string;
  markingGuideText: string;
  commonMistakesText: string;
}

export interface AiClient {
  generateQuestion(input: QuestionGenerationInput): Promise<GeneratedQuestion>;
  isAvailable(): boolean;
}

/**
 * Get difficulty label for display
 */
export function getDifficultyLabel(rung: DifficultyRung): string {
  switch (rung) {
    case 1:
      return "Recall";
    case 2:
      return "Application";
    case 3:
      return "Exam-style";
  }
}

/**
 * Build the prompt for question generation
 * Emphasizes coach role, uncertainty, and educational guidance
 */
function buildQuestionPrompt(input: QuestionGenerationInput): string {
  const difficultyDesc = {
    1: "Recall - test basic understanding and definitions",
    2: "Application - require applying concepts to scenarios",
    3: "Exam-style - mimic IB exam question format and complexity",
  };

  return `You are an IB study coach helping a student practice ${input.subjectName} (${input.level}).

Current unit: ${input.unitName}
Difficulty level: ${difficultyDesc[input.difficultyRung]}

Generate ONE practice question appropriate for this unit and difficulty level.

IMPORTANT GUIDELINES:
- Act as a supportive coach, not an authoritative examiner
- Frame guidance as suggestions, not absolute truths
- Use phrases like "consider whether...", "you might check if...", "a possible approach..."
- Acknowledge that there may be multiple valid approaches

Respond in this exact JSON format:
{
  "questionText": "The practice question here",
  "markingGuideText": "Key points to consider in your answer (framed as suggestions)",
  "commonMistakesText": "Possible pitfalls to watch for (framed as questions to ask yourself)"
}

Keep each field concise (2-4 sentences max). Do not include any text outside the JSON.`;
}

/**
 * Google Gemini client
 */
export class GeminiClient implements AiClient {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "gemini-2.0-flash") {
    this.apiKey = apiKey;
    this.model = model;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async generateQuestion(
    input: QuestionGenerationInput,
  ): Promise<GeneratedQuestion> {
    const prompt = buildQuestionPrompt(input);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error("No content in Gemini response");
    }

    // Parse JSON from response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        questionText: parsed.questionText || "Question generation failed",
        markingGuideText:
          parsed.markingGuideText || "No marking guide available",
        commonMistakesText:
          parsed.commonMistakesText || "No common mistakes listed",
      };
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", content);
      throw new Error("Failed to parse Gemini response as JSON");
    }
  }
}

/**
 * OpenAI-compatible client (works with OpenAI, etc.)
 */
export class OpenAICompatibleClient implements AiClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(
    apiKey: string,
    baseUrl: string = "https://api.openai.com/v1",
    model: string = "gpt-4o-mini",
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async generateQuestion(
    input: QuestionGenerationInput,
  ): Promise<GeneratedQuestion> {
    const prompt = buildQuestionPrompt(input);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse JSON from response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        questionText: parsed.questionText || "Question generation failed",
        markingGuideText:
          parsed.markingGuideText || "No marking guide available",
        commonMistakesText:
          parsed.commonMistakesText || "No common mistakes listed",
      };
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI response as JSON");
    }
  }
}

/**
 * Anthropic Claude client
 */
export class AnthropicClient implements AiClient {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "claude-3-haiku-20240307") {
    this.apiKey = apiKey;
    this.model = model;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async generateQuestion(
    input: QuestionGenerationInput,
  ): Promise<GeneratedQuestion> {
    const prompt = buildQuestionPrompt(input);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      throw new Error("No content in Anthropic response");
    }

    // Parse JSON from response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        questionText: parsed.questionText || "Question generation failed",
        markingGuideText:
          parsed.markingGuideText || "No marking guide available",
        commonMistakesText:
          parsed.commonMistakesText || "No common mistakes listed",
      };
    } catch (parseError) {
      console.error("Failed to parse Anthropic response:", content);
      throw new Error("Failed to parse Anthropic response as JSON");
    }
  }
}

/**
 * Null client for when no AI is configured
 */
export class NullAiClient implements AiClient {
  isAvailable(): boolean {
    return false;
  }

  async generateQuestion(): Promise<GeneratedQuestion> {
    throw new Error(
      "AI features are not configured. Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in .env",
    );
  }
}

/**
 * Get the configured AI client based on environment variables
 * Priority: Gemini > OpenAI > Anthropic
 */
export function getAiClient(): AiClient {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (geminiKey) {
    return new GeminiClient(geminiKey);
  }

  if (openaiKey) {
    return new OpenAICompatibleClient(openaiKey);
  }

  if (anthropicKey) {
    return new AnthropicClient(anthropicKey);
  }

  return new NullAiClient();
}

/**
 * Check if AI features are available
 */
export function isAiEnabled(): boolean {
  return !!(
    process.env.GEMINI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY
  );
}
