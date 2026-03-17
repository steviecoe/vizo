import { describe, it, expect } from 'vitest';
import { assemblePrompt, getLayerByName } from '../prompt-orchestrator';
import type { PromptContext } from '../prompt-orchestrator';

function makeContext(overrides: Partial<PromptContext> = {}): PromptContext {
  return {
    flowType: 'quick',
    resolution: '1k',
    aspectRatio: '1:1',
    tenantArtDirection: {
      defaultBrief: 'High-end fashion photography style',
      quickGenBrief: 'Bright studio lighting, minimal props',
      shopifyGenBrief: '',
      photoshootBrief: '',
    },
    models: [],
    backgrounds: [],
    products: [],
    itemImageUrls: [],
    userBrief: '',
    ...overrides,
  };
}

describe('PromptOrchestrator', () => {
  describe('assemblePrompt', () => {
    it('produces a prompt with exactly 6 layers', () => {
      const result = assemblePrompt(makeContext());
      expect(result.layers).toHaveLength(6);
      expect(result.layers.map((l) => l.name)).toEqual([
        'system',
        'art_direction',
        'subject',
        'product',
        'user_brief',
        'output_specs',
      ]);
    });

    it('joins all layer content into textPrompt', () => {
      const result = assemblePrompt(makeContext());
      for (const layer of result.layers) {
        expect(result.textPrompt).toContain(layer.content);
      }
    });
  });

  // ─── Layer 1: System (Risk Mitigation) ────────────────

  describe('Layer 1: System', () => {
    it('includes quality standards', () => {
      const result = assemblePrompt(makeContext());
      const layer = getLayerByName(result, 'system')!;
      expect(layer.content).toContain('Studio-grade lighting');
      expect(layer.content).toContain('Commercially viable');
    });

    it('includes NSFW/safety blockers', () => {
      const result = assemblePrompt(makeContext());
      const layer = getLayerByName(result, 'system')!;
      expect(layer.content).toContain('NEVER generate nudity');
      expect(layer.content).toContain('NEVER generate violent');
      expect(layer.content).toContain('NEVER generate content depicting minors');
    });

    it('includes copyright protection', () => {
      const result = assemblePrompt(makeContext());
      const layer = getLayerByName(result, 'system')!;
      expect(layer.content).toContain('copyrighted logos');
      expect(layer.content).toContain('celebrity likenesses');
    });

    it('enforces 18+ age requirement', () => {
      const result = assemblePrompt(makeContext());
      const layer = getLayerByName(result, 'system')!;
      expect(layer.content).toContain('18+ years');
    });

    it('includes diversity and representation guidelines', () => {
      const result = assemblePrompt(makeContext());
      const layer = getLayerByName(result, 'system')!;
      expect(layer.content).toContain('Diversity & Representation');
      expect(layer.content).toContain('body types naturally');
      expect(layer.content).toContain('stereotypical');
    });

    it('prohibits weapons, drugs, alcohol, tobacco', () => {
      const result = assemblePrompt(makeContext());
      const layer = getLayerByName(result, 'system')!;
      expect(layer.content).toContain('weapons, drugs, alcohol, or tobacco');
    });
  });

  // ─── Layer 2: Art Direction ───────────────────────────

  describe('Layer 2: Art Direction', () => {
    it('uses flow-specific brief when available', () => {
      const result = assemblePrompt(makeContext({ flowType: 'quick' }));
      const layer = getLayerByName(result, 'art_direction')!;
      expect(layer.content).toContain('Bright studio lighting, minimal props');
    });

    it('falls back to default brief when flow-specific is empty', () => {
      const result = assemblePrompt(makeContext({ flowType: 'shopify' }));
      const layer = getLayerByName(result, 'art_direction')!;
      expect(layer.content).toContain('High-end fashion photography style');
    });

    it('handles empty art direction gracefully', () => {
      const result = assemblePrompt(
        makeContext({
          tenantArtDirection: {
            defaultBrief: '',
            quickGenBrief: '',
            shopifyGenBrief: '',
            photoshootBrief: '',
          },
        }),
      );
      const layer = getLayerByName(result, 'art_direction')!;
      expect(layer.content).toContain('professional fashion photography defaults');
    });
  });

  // ─── Layer 3: Subject ─────────────────────────────────

  describe('Layer 3: Subject', () => {
    it('includes model specifications', () => {
      const result = assemblePrompt(
        makeContext({
          models: [
            {
              id: 'm-1',
              name: 'Summer Model',
              gender: 'female',
              skinColour: 'medium',
              hairColour: 'brown',
              height: '175cm',
              clothingSize: 12,
              age: '25-30',
              referenceImageUrl: null,
              generatedAt: null,
              createdAt: '',
              createdBy: '',
            },
          ],
        }),
      );
      const layer = getLayerByName(result, 'subject')!;
      expect(layer.content).toContain('Summer Model');
      expect(layer.content).toContain('female');
      expect(layer.content).toContain('skin: medium');
      expect(layer.content).toContain('UK 12');
      expect(layer.content).toContain('25-30');
    });

    it('includes background descriptions', () => {
      const result = assemblePrompt(
        makeContext({
          backgrounds: [
            {
              id: 'bg-1',
              name: 'White Studio',
              type: 'studio',
              description: 'Clean white backdrop with soft lighting',
              referenceImageUrl: null,
              generatedAt: null,
              createdAt: '',
              createdBy: '',
            },
          ],
        }),
      );
      const layer = getLayerByName(result, 'subject')!;
      expect(layer.content).toContain('White Studio');
      expect(layer.content).toContain('studio');
      expect(layer.content).toContain('Clean white backdrop');
    });

    it('suggests flat lay when no model provided', () => {
      const result = assemblePrompt(makeContext());
      const layer = getLayerByName(result, 'subject')!;
      expect(layer.content).toContain('flat lay or mannequin');
    });
  });

  // ─── Layer 4: Product ─────────────────────────────────

  describe('Layer 4: Product', () => {
    it('includes Shopify product details', () => {
      const result = assemblePrompt(
        makeContext({
          products: [
            {
              id: 'p-1',
              shopifyProductId: 'gid://shopify/Product/1',
              title: 'Summer Dress',
              description: 'A beautiful floral summer dress',
              productType: 'Dress',
              vendor: 'Brand',
              images: [{ url: 'https://cdn.shopify.com/dress.jpg', alt: null, position: 1 }],
              variants: [{ id: 'v-1', title: 'Small', sku: 'SD-S', price: '49.99' }],
              status: 'active',
              lastSyncedAt: '',
              createdAt: '',
            },
          ],
        }),
      );
      const layer = getLayerByName(result, 'product')!;
      expect(layer.content).toContain('Summer Dress');
      expect(layer.content).toContain('Dress');
      expect(layer.content).toContain('beautiful floral');
    });

    it('notes attached reference images', () => {
      const result = assemblePrompt(
        makeContext({
          itemImageUrls: ['https://example.com/item.jpg'],
        }),
      );
      const layer = getLayerByName(result, 'product')!;
      expect(layer.content).toContain('Reference product images are attached');
      expect(layer.content).toContain('correct colours, patterns');
    });
  });

  // ─── Layer 5: User Brief ──────────────────────────────

  describe('Layer 5: User Brief', () => {
    it('includes user brief when provided', () => {
      const result = assemblePrompt(
        makeContext({ userBrief: 'Outdoor feel, golden hour lighting' }),
      );
      const layer = getLayerByName(result, 'user_brief')!;
      expect(layer.content).toContain('golden hour lighting');
    });

    it('handles empty brief gracefully', () => {
      const result = assemblePrompt(makeContext());
      const layer = getLayerByName(result, 'user_brief')!;
      expect(layer.content).toContain('No additional brief');
    });
  });

  // ─── Layer 6: Output Specs ────────────────────────────

  describe('Layer 6: Output Specs', () => {
    it('specifies resolution and aspect ratio', () => {
      const result = assemblePrompt(
        makeContext({ resolution: '2k', aspectRatio: '4:5' }),
      );
      const layer = getLayerByName(result, 'output_specs')!;
      expect(layer.content).toContain('2048×2048');
      expect(layer.content).toContain('4:5');
      expect(layer.content).toContain('portrait');
    });

    it('specifies no watermarks', () => {
      const result = assemblePrompt(makeContext());
      const layer = getLayerByName(result, 'output_specs')!;
      expect(layer.content).toContain('No watermarks');
    });
  });

  // ─── Image URL collection ─────────────────────────────

  describe('Image URL collection', () => {
    it('collects product images for multimodal input', () => {
      const result = assemblePrompt(
        makeContext({
          products: [
            {
              id: 'p-1',
              shopifyProductId: 'x',
              title: 'Dress',
              description: '',
              productType: '',
              vendor: '',
              images: [
                { url: 'https://cdn.shopify.com/img1.jpg', alt: null, position: 1 },
                { url: 'https://cdn.shopify.com/img2.jpg', alt: null, position: 2 },
              ],
              variants: [],
              status: 'active',
              lastSyncedAt: '',
              createdAt: '',
            },
          ],
        }),
      );
      expect(result.imageUrls).toContain('https://cdn.shopify.com/img1.jpg');
      expect(result.imageUrls).toContain('https://cdn.shopify.com/img2.jpg');
    });

    it('collects item image URLs', () => {
      const result = assemblePrompt(
        makeContext({ itemImageUrls: ['https://example.com/my-item.jpg'] }),
      );
      expect(result.imageUrls).toContain('https://example.com/my-item.jpg');
    });

    it('collects model reference images', () => {
      const result = assemblePrompt(
        makeContext({
          models: [
            {
              id: 'm-1', name: 'Test', gender: 'female', skinColour: '', hairColour: '',
              height: '', clothingSize: 12, age: '',
              referenceImageUrl: 'https://storage/model-ref.jpg',
              generatedAt: null, createdAt: '', createdBy: '',
            },
          ],
        }),
      );
      expect(result.imageUrls).toContain('https://storage/model-ref.jpg');
    });

    it('returns empty imageUrls when no images provided', () => {
      const result = assemblePrompt(makeContext());
      expect(result.imageUrls).toEqual([]);
    });
  });
});
