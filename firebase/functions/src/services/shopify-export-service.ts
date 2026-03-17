/**
 * Shopify image export service.
 * Uploads a generated image to a Shopify product via the REST Admin API.
 */

const SHOPIFY_API_VERSION = '2024-01';

export interface ShopifyImageUploadResult {
  shopifyImageId: string;
  src: string;
}

/**
 * Pushes a base64-encoded image to a Shopify product.
 * Uses the Shopify REST Admin API to create a product image.
 */
export async function uploadImageToShopify(
  storeDomain: string,
  accessToken: string,
  shopifyProductId: string,
  imageBase64: string,
  filename: string,
  altText: string,
): Promise<ShopifyImageUploadResult> {
  // Extract numeric ID from GID format: "gid://shopify/Product/123" → "123"
  const numericId = shopifyProductId.replace(/^gid:\/\/shopify\/Product\//, '');

  const url = `https://${storeDomain}/admin/api/${SHOPIFY_API_VERSION}/products/${numericId}/images.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: {
        attachment: imageBase64,
        filename,
        alt: altText,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Shopify image upload failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    image: { id: number; src: string };
  };

  return {
    shopifyImageId: String(data.image.id),
    src: data.image.src,
  };
}
