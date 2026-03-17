export interface ShopifyProductImage {
  url: string;
  alt: string | null;
  position: number;
}

export interface ShopifyProductVariant {
  id: string;
  title: string;
  sku: string | null;
  price: string;
}

export interface ShopifyProduct {
  id: string;
  shopifyProductId: string;
  title: string;
  description: string;
  productType: string;
  vendor: string;
  images: ShopifyProductImage[];
  variants: ShopifyProductVariant[];
  status: 'active' | 'draft' | 'archived';
  lastSyncedAt: string;
  createdAt: string;
}
