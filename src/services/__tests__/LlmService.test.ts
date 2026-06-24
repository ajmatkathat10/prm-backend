import { test } from 'node:test';
import assert from 'node:assert';
import { LlmService } from '../LlmService.js';
import { systemConfigRepository } from '../../repositories/SystemConfigRepository.js';

test('LlmService generate successfully returns response', async () => {
  const mockConfigRepo = {
    getConfig: async () => ({
      llmApiKey: 'test-api-key',
      llmProvider: 'Gemini'
    })
  } as unknown as typeof systemConfigRepository;

  const llm = new LlmService(mockConfigRepo);

  const originalGemmaApiKey = process.env.GEMMA_API_KEY;
  process.env.GEMMA_API_KEY = 'mock-gemma-key';

  const mockResponse = {
    ok: true,
    json: async () => ({ response: 'Mock LLM Response' })
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => mockResponse) as unknown as typeof fetch;

  try {
    const result = await llm.generate('Hello');
    assert.strictEqual(result, 'Mock LLM Response');
  } finally {
    globalThis.fetch = originalFetch;
    process.env.GEMMA_API_KEY = originalGemmaApiKey;
  }
});

test('LlmService throws if API key is not configured', async () => {
  const mockConfigRepo = {
    getConfig: async () => ({
      llmApiKey: 'PLACEHOLDER',
      llmProvider: 'Gemini'
    })
  } as unknown as typeof systemConfigRepository;

  const llm = new LlmService(mockConfigRepo);

  const originalGemmaApiKey = process.env.GEMMA_API_KEY;
  delete process.env.GEMMA_API_KEY;

  try {
    await assert.rejects(async () => {
      await llm.generate('Hello');
    }, /Neither GEMMA_API_KEY nor Gemini API Key is configured/);
  } finally {
    process.env.GEMMA_API_KEY = originalGemmaApiKey;
  }
});

test('LlmService generate falls back to Gemini if Gemma fails and Gemini API Key is configured in db', async () => {
  const mockConfigRepo = {
    getConfig: async () => ({
      llmApiKey: 'mock-gemini-key',
      llmProvider: 'Gemini'
    })
  } as unknown as typeof systemConfigRepository;

  const llm = new LlmService(mockConfigRepo);

  const originalGemmaApiKey = process.env.GEMMA_API_KEY;
  process.env.GEMMA_API_KEY = 'mock-gemma-key';

  const mockResponseGemini = {
    ok: true,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [
              {
                text: 'Fallback Gemini Response'
              }
            ]
          }
        }
      ]
    })
  };

  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = (async (url: string | URL | Request) => {
    callCount++;
    if (callCount === 1) {
      return { ok: false, status: 500 } as unknown as Response;
    }
    assert.ok(String(url).includes('generativelanguage.googleapis.com'));
    return mockResponseGemini as unknown as Response;
  }) as unknown as typeof fetch;

  try {
    const result = await llm.generate('Hello');
    assert.strictEqual(result, 'Fallback Gemini Response');
    assert.strictEqual(callCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.GEMMA_API_KEY = originalGemmaApiKey;
  }
});

test('LlmService generate throws Gemma error if Gemma fails and Gemini API Key is not configured in db', async () => {
  const mockConfigRepo = {
    getConfig: async () => ({
      llmApiKey: 'PLACEHOLDER',
      llmProvider: 'Gemini'
    })
  } as unknown as typeof systemConfigRepository;

  const llm = new LlmService(mockConfigRepo);

  const originalGemmaApiKey = process.env.GEMMA_API_KEY;
  process.env.GEMMA_API_KEY = 'mock-gemma-key';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return { ok: false, status: 500 } as unknown as Response;
  }) as unknown as typeof fetch;

  try {
    await assert.rejects(async () => {
      await llm.generate('Hello');
    }, /LLM provider returned status code 500/);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.GEMMA_API_KEY = originalGemmaApiKey;
  }
});
