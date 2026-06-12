import { systemConfigRepository } from '../repositories/SystemConfigRepository.js';

export class LlmService {
  public lastModelUsed: string = 'None';

  constructor(private readonly configRepo: typeof systemConfigRepository) { }

  async generate(prompt: string): Promise<string> {
    const config = await this.configRepo.getConfig();
    const geminiApiKey = config?.llmApiKey;

    const gemmaApiKey = process.env.GEMMA_API_KEY;
    const gemmaHost = process.env.GEMMA_HOST || '';

    if (gemmaApiKey) {
      console.log('\n[LLM] 🤖 Calling Gemma 3 (gemma3:12b-it-q8_0)...');
      try {
        const url = gemmaHost.endsWith('/api/generate') ? gemmaHost : `${gemmaHost}/api/generate`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': gemmaApiKey
          },
          body: JSON.stringify({
            model: 'gemma3:12b-it-q8_0',
            prompt,
            stream: false
          })
        });

        if (!response.ok) {
          throw new Error(`LLM provider returned status code ${response.status}`);
        }

        const data = (await response.json()) as { response: string };
        this.lastModelUsed = 'Gemma 3';
        console.log('[LLM] 🤖 Gemma 3 returned success response.\n');
        return data.response;
      } catch (gemmaError) {
        if (!geminiApiKey || geminiApiKey === 'PLACEHOLDER' || geminiApiKey === 'PLACEHOLDER_API_KEY_GOES_HERE') {
          throw gemmaError;
        }
        console.log('[LLM] ⚠️ Gemma 3 call failed. Falling back to Gemini...');
        return await this.callGemini(prompt, geminiApiKey, gemmaError as Error);
      }
    } else {
      if (!geminiApiKey || geminiApiKey === 'PLACEHOLDER' || geminiApiKey === 'PLACEHOLDER_API_KEY_GOES_HERE') {
        throw new Error('Neither GEMMA_API_KEY nor Gemini API Key is configured.');
      }
      console.log('[LLM] 🤖 GEMMA_API_KEY not configured. Calling Gemini...');
      return await this.callGemini(prompt, geminiApiKey);
    }
  }

  private async callGemini(prompt: string, apiKey: string, originalError?: Error): Promise<string> {
    console.log('[LLM] 🤖 Calling Gemini (gemini-2.5-flash)...');
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      })
    });

    if (!geminiResponse.ok) {
      const errMsg = `Gemini fallback failed with status code ${geminiResponse.status}.` + (originalError ? ` Original error: ${originalError.message}` : '');
      throw new Error(errMsg, originalError ? { cause: originalError } : undefined);
    }

    const geminiData = (await geminiResponse.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };

    const fallbackText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!fallbackText) {
      const errMsg = `Gemini fallback returned an empty or invalid response.` + (originalError ? ` Original error: ${originalError.message}` : '');
      throw new Error(errMsg, originalError ? { cause: originalError } : undefined);
    }

    this.lastModelUsed = 'Gemini';
    console.log('[LLM] 🤖 Gemini returned success response.\n');
    return fallbackText;
  }
}

export const llmService = new LlmService(systemConfigRepository);
