import type {
  ArtDirectionModel,
  ArtDirectionBackground,
  ShopifyProduct,
  TenantArtDirection,
  GenerationFlowType,
  Resolution,
  AspectRatio,
} from '@vizo/shared';

// ─── Types ─────────────────────────────────────────────────

export interface PromptContext {
  flowType: GenerationFlowType;
  resolution: Resolution;
  aspectRatio: AspectRatio;
  tenantArtDirection: TenantArtDirection;
  models: ArtDirectionModel[];
  backgrounds: ArtDirectionBackground[];
  products: ShopifyProduct[];
  itemImageUrls: string[];
  userBrief: string;
}

export interface AssembledPrompt {
  textPrompt: string;
  imageUrls: string[];
  layers: PromptLayer[];
}

export interface PromptLayer {
  name: string;
  content: string;
}

// ─── Resolution mapping ────────────────────────────────────

const RESOLUTION_MAP: Record<Resolution, { width: number; height: number; label: string }> = {
  '1k': { width: 1024, height: 1024, label: '1024×1024' },
  '2k': { width: 2048, height: 2048, label: '2048×2048' },
};

const ASPECT_RATIO_MAP: Record<AspectRatio, { ratio: string; description: string }> = {
  '1:1': { ratio: '1:1', description: 'square' },
  '4:5': { ratio: '4:5', description: 'portrait (4:5)' },
  '16:9': { ratio: '16:9', description: 'landscape (16:9)' },
};

// ─── Layer 1: System Prompt (quality + risk mitigation) ────

function buildSystemLayer(): PromptLayer {
  return {
    name: 'system',
    content: [
      'You are a professional AI fashion photographer assistant.',
      'Generate a high-quality, photorealistic fashion product image.',
      '',
      '## Quality Standards',
      '- Studio-grade lighting with natural skin tones',
      '- Accurate garment fit, fabric drape, and texture rendering',
      '- Commercially viable output suitable for e-commerce and lookbooks',
      '- Consistent colour accuracy — garment colours must match the reference image',
      '',
      '## Safety & Risk Mitigation',
      '- NEVER generate nudity, sexually suggestive, or explicit content',
      '- NEVER generate violent, gory, or disturbing imagery',
      '- NEVER generate content depicting minors in any fashion modelling context',
      '- NEVER generate content that promotes discrimination based on race, gender, body type, or disability',
      '- NEVER reproduce copyrighted logos, trademarks, or brand marks unless they are the tenant\'s own product',
      '- NEVER include real celebrity likenesses or identifiable public figures',
      '- All generated models must appear to be adults (18+ years)',
      '- Ensure body proportions are realistic and not distorted',
      '- Do not generate weapons, drugs, alcohol, or tobacco imagery',
      '',
      '## Diversity & Representation',
      '- Respect the specified model characteristics exactly as provided',
      '- Represent body types naturally and authentically',
      '- Avoid any stereotypical or demeaning poses or contexts',
    ].join('\n'),
  };
}

// ─── Layer 2: Tenant Art Direction ─────────────────────────

function buildArtDirectionLayer(
  artDirection: TenantArtDirection,
  flowType: GenerationFlowType,
): PromptLayer {
  const briefMap: Record<GenerationFlowType, string> = {
    quick: artDirection.quickGenBrief || artDirection.defaultBrief,
    shopify: artDirection.shopifyGenBrief || artDirection.defaultBrief,
    photoshoot: artDirection.photoshootBrief || artDirection.defaultBrief,
  };

  const brief = briefMap[flowType];

  return {
    name: 'art_direction',
    content: brief
      ? `## Brand Art Direction\n${brief}`
      : '## Brand Art Direction\nNo specific art direction provided. Use professional fashion photography defaults.',
  };
}

// ─── Layer 3: Subject (Model + Background) ─────────────────

function buildSubjectLayer(
  models: ArtDirectionModel[],
  backgrounds: ArtDirectionBackground[],
): PromptLayer {
  const parts: string[] = [];

  if (models.length > 0) {
    parts.push('## Model Specifications');
    for (const model of models) {
      parts.push(`- Model "${model.name}": ${model.gender}, skin: ${model.skinColour}, hair: ${model.hairColour}, height: ${model.height}, clothing size: UK ${model.clothingSize}, age range: ${model.age}`);
    }
  }

  if (backgrounds.length > 0) {
    parts.push('');
    parts.push('## Background / Setting');
    for (const bg of backgrounds) {
      parts.push(`- "${bg.name}" (${bg.type}): ${bg.description}`);
    }
  }

  if (parts.length === 0) {
    parts.push('## Subject\nNo specific model or background defined. Use a neutral studio background with no model (flat lay or mannequin).');
  }

  return {
    name: 'subject',
    content: parts.join('\n'),
  };
}

// ─── Layer 4: Product Context ──────────────────────────────

function buildProductLayer(
  products: ShopifyProduct[],
  itemImageUrls: string[],
): PromptLayer {
  const parts: string[] = ['## Product Details'];

  if (products.length > 0) {
    for (const product of products) {
      parts.push(`- "${product.title}" (${product.productType || 'Apparel'})`);
      if (product.description) {
        parts.push(`  Description: ${product.description.slice(0, 300)}`);
      }
      if (product.variants.length > 0) {
        const variantNames = product.variants.map((v) => v.title).join(', ');
        parts.push(`  Variants: ${variantNames}`);
      }
    }
  }

  if (itemImageUrls.length > 0) {
    parts.push('');
    parts.push('Reference product images are attached. The generated image must accurately depict these garments with correct colours, patterns, and details.');
  }

  if (products.length === 0 && itemImageUrls.length === 0) {
    parts.push('No specific product provided. Generate a generic fashion item showcase.');
  }

  return {
    name: 'product',
    content: parts.join('\n'),
  };
}

// ─── Layer 5: User Brief ───────────────────────────────────

function buildUserBriefLayer(brief: string): PromptLayer {
  return {
    name: 'user_brief',
    content: brief
      ? `## Creative Brief\n${brief}`
      : '## Creative Brief\nNo additional brief. Use the art direction and product context above.',
  };
}

// ─── Layer 6: Output Specifications ────────────────────────

function buildOutputLayer(resolution: Resolution, aspectRatio: AspectRatio): PromptLayer {
  const res = RESOLUTION_MAP[resolution];
  const ar = ASPECT_RATIO_MAP[aspectRatio];

  return {
    name: 'output_specs',
    content: [
      '## Output Specifications',
      `- Resolution: ${res.label}`,
      `- Aspect Ratio: ${ar.ratio} (${ar.description})`,
      '- Format: PNG with transparent background option',
      '- Colour space: sRGB',
      '- No watermarks, borders, or text overlays',
      '- Single image output per request',
    ].join('\n'),
  };
}

// ─── Public API ────────────────────────────────────────────

/**
 * Assembles a complete prompt from 6 layers:
 *
 * 1. System       — quality standards + safety / risk mitigation
 * 2. Art Direction — tenant-specific brand guidelines
 * 3. Subject      — model characteristics + background settings
 * 4. Product      — Shopify product data + item images
 * 5. User Brief   — free-form creative direction
 * 6. Output Specs — resolution, aspect ratio, format
 *
 * Returns the composed text prompt plus a list of image URLs for
 * multimodal input (product reference images, model reference images).
 */
export function assemblePrompt(context: PromptContext): AssembledPrompt {
  const layers: PromptLayer[] = [
    buildSystemLayer(),
    buildArtDirectionLayer(context.tenantArtDirection, context.flowType),
    buildSubjectLayer(context.models, context.backgrounds),
    buildProductLayer(context.products, context.itemImageUrls),
    buildUserBriefLayer(context.userBrief),
    buildOutputLayer(context.resolution, context.aspectRatio),
  ];

  const textPrompt = layers.map((l) => l.content).join('\n\n');

  // Collect all reference image URLs for multimodal input
  const imageUrls: string[] = [];

  // Product images from Shopify
  for (const product of context.products) {
    for (const img of product.images) {
      imageUrls.push(img.url);
    }
  }

  // Direct item images uploaded by user
  for (const url of context.itemImageUrls) {
    imageUrls.push(url);
  }

  // Model reference images
  for (const model of context.models) {
    if (model.referenceImageUrl) {
      imageUrls.push(model.referenceImageUrl);
    }
  }

  // Background reference images
  for (const bg of context.backgrounds) {
    if (bg.referenceImageUrl) {
      imageUrls.push(bg.referenceImageUrl);
    }
  }

  return { textPrompt, imageUrls, layers };
}

/**
 * Extracts individual layer content by name for testing/debugging.
 */
export function getLayerByName(
  prompt: AssembledPrompt,
  name: string,
): PromptLayer | undefined {
  return prompt.layers.find((l) => l.name === name);
}
