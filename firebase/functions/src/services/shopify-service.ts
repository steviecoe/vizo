import type { ShopifyProduct, ShopifyProductImage, ShopifyProductVariant } from '@vizo/shared';

// ─── Shopify REST Admin API types ──────────────────────────

interface ShopifyApiImage {
  src: string;
  alt: string | null;
  position: number;
}

interface ShopifyApiVariant {
  id: number;
  title: string;
  sku: string | null;
  price: string;
}

interface ShopifyApiProduct {
  id: number;
  title: string;
  body_html: string;
  product_type: string;
  vendor: string;
  status: string;
  images: ShopifyApiImage[];
  variants: ShopifyApiVariant[];
}

interface ShopifyProductsResponse {
  products: ShopifyApiProduct[];
}

// ─── Constants ─────────────────────────────────────────────

const SHOPIFY_API_VERSION = '2024-01';
const PAGE_SIZE = 250; // Shopify max per page

// ─── Public API ────────────────────────────────────────────

/**
 * Fetches all products from a Shopify store using the REST Admin API.
 * Handles pagination via the Link header.
 */
export async function fetchShopifyProducts(
  storeDomain: string,
  accessToken: string,
): Promise<Omit<ShopifyProduct, 'id' | 'lastSyncedAt' | 'createdAt'>[]> {
  const allProducts: Omit<ShopifyProduct, 'id' | 'lastSyncedAt' | 'createdAt'>[] = [];
  let url: string | null =
    `https://${storeDomain}/admin/api/${SHOPIFY_API_VERSION}/products.json?limit=${PAGE_SIZE}&status=active`;

  while (url) {
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Shopify API error ${response.status}: ${body.slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as ShopifyProductsResponse;

    for (const p of data.products) {
      allProducts.push(mapShopifyProduct(p));
    }

    url = parseNextPageUrl(response.headers.get('link'));
  }

  return allProducts;
}

/**
 * Validates that a Shopify access token is working by hitting the shop endpoint.
 */
export async function validateShopifyCredentials(
  storeDomain: string,
  accessToken: string,
): Promise<{ shopName: string }> {
  const url = `https://${storeDomain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`;

  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid Shopify API credentials');
    }
    throw new Error(`Shopify API error: ${response.status}`);
  }

  const data = (await response.json()) as { shop: { name: string } };
  return { shopName: data.shop.name };
}

// ─── Helpers ───────────────────────────────────────────────

function mapShopifyProduct(
  p: ShopifyApiProduct,
): Omit<ShopifyProduct, 'id' | 'lastSyncedAt' | 'createdAt'> {
  const images: ShopifyProductImage[] = p.images.map((img) => ({
    url: img.src,
    alt: img.alt,
    position: img.position,
  }));

  const variants: ShopifyProductVariant[] = p.variants.map((v) => ({
    id: String(v.id),
    title: v.title,
    sku: v.sku,
    price: v.price,
  }));

  return {
    shopifyProductId: `gid://shopify/Product/${p.id}`,
    title: p.title,
    description: stripHtml(p.body_html || ''),
    productType: p.product_type || '',
    vendor: p.vendor || '',
    images,
    variants,
    status: mapStatus(p.status),
  };
}

function mapStatus(status: string): 'active' | 'draft' | 'archived' {
  if (status === 'active') return 'active';
  if (status === 'draft') return 'draft';
  return 'archived';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Parses the next page URL from Shopify's Link header.
 * Format: `<url>; rel="next"` or `<url>; rel="previous", <url>; rel="next"`
 */
function parseNextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;

  const parts = linkHeader.split(',');
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }

  return null;
}
