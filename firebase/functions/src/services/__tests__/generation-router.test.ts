import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../gemini-service', () => ({
  generateImage: vi.fn(),
}));

vi.mock('../grok-service', () => ({
  generateImageWithGrok: vi.fn(),
}));

import { generateWithFallback, type GenerationRequest } from '../generation-router';
import { generateImage } from '../gemini-service';
import { generateImageWithGrok } from '../grok-service';

const mockGenerateImage = generateImage as ReturnType<typeof vi.fn>;
const mockGenerateImageWithGrok = generateImageWithGrok as ReturnType<typeof vi.fn>;

function makeRequest(overrides?: Partial<GenerationRequest>): GenerationRequest {
  return {
    textPrompt: 'A fashion model wearing a summer dress',
    imageUrls: ['https://example.com/item.jpg'],
    tenantId: 'tenant-1',
    ...overrides,
  };
}

describe('generateWithFallback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns primary model result on success', async () => {
    mockGenerateImage.mockResolvedValue({
      imageBase64: 'Z2VtaW5pLWltYWdl',
      mimeType: 'image/png',
      promptTokens: 150,
      finishReason: 'STOP',
    });

    const result = await generateWithFallback(makeRequest());

    expect(result.imageBase64).toBe('Z2VtaW5pLWltYWdl');
    expect(result.mimeType).toBe('image/png');
    expect(result.promptTokens).toBe(150);
    expect(result.finishReason).toBe('STOP');
    expect(result.modelUsed).toBe('gemini');
    expect(result.usedFallback).toBe(false);

    expect(mockGenerateImage).toHaveBeenCalledWith({
      textPrompt: 'A fashion model wearing a summer dress',
      imageUrls: ['https://example.com/item.jpg'],
      tenantId: 'tenant-1',
    });
    expect(mockGenerateImageWithGrok).not.toHaveBeenCalled();
  });

  it('falls back to Grok when primary model fails', async () => {
    mockGenerateImage.mockRejectedValue(new Error('Gemini API rate limited'));
    mockGenerateImageWithGrok.mockResolvedValue({
      imageBase64: 'Z3Jvay1pbWFnZQ==',
      mimeType: 'image/png',
      promptTokens: 200,
      finishReason: 'stop',
    });

    const result = await generateWithFallback(makeRequest());

    expect(result.imageBase64).toBe('Z3Jvay1pbWFnZQ==');
    expect(result.mimeType).toBe('image/png');
    expect(result.promptTokens).toBe(200);
    expect(result.modelUsed).toBe('grok');
    expect(result.usedFallback).toBe(true);

    expect(mockGenerateImage).toHaveBeenCalledTimes(1);
    expect(mockGenerateImageWithGrok).toHaveBeenCalledWith({
      textPrompt: 'A fashion model wearing a summer dress',
      imageUrls: ['https://example.com/item.jpg'],
      tenantId: 'tenant-1',
    });
  });

  it('throws primary error when both models fail', async () => {
    const primaryError = new Error('Gemini content blocked');
    mockGenerateImage.mockRejectedValue(primaryError);
    mockGenerateImageWithGrok.mockRejectedValue(new Error('Grok also failed'));

    await expect(generateWithFallback(makeRequest())).rejects.toThrow(
      'Gemini content blocked',
    );

    expect(mockGenerateImage).toHaveBeenCalledTimes(1);
    expect(mockGenerateImageWithGrok).toHaveBeenCalledTimes(1);
  });
});
