export default function ShopifyGenerationPage() {
  return (
    <div className="min-h-full bg-stone-50 p-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Shopify Generation</h1>
        <p className="mt-2 text-stone-600">Generate images for your Shopify products.</p>
      </div>
      <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs text-amber-800">
          This page is a placeholder. Full Shopify generation will be available once a Shopify store is connected (Shopify Connector) and a Gemini API key is configured for this tenant. The generation workflow will allow batch image creation for synced Shopify products.
        </p>
      </div>
    </div>
  );
}
