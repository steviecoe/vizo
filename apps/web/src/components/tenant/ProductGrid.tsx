'use client';

import { useReducer, useEffect } from 'react';
import type { ShopifyProduct } from '@vizo/shared';
import { callFunction } from '@/lib/firebase/functions';

// ─── Types ────────────────────────────────────────────────

type ViewMode = 'grid' | 'list';
type PageStatus = 'loading' | 'idle' | 'error' | 'empty';

interface GridState {
  status: PageStatus;
  products: (ShopifyProduct & { id: string })[];
  viewMode: ViewMode;
  searchQuery: string;
  serverError: string | null;
}

type GridAction =
  | { type: 'SET_LOADED'; products: (ShopifyProduct & { id: string })[] }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_VIEW_MODE'; mode: ViewMode }
  | { type: 'SET_SEARCH'; query: string };

const initialState: GridState = {
  status: 'loading',
  products: [],
  viewMode: 'grid',
  searchQuery: '',
  serverError: null,
};

function reducer(state: GridState, action: GridAction): GridState {
  switch (action.type) {
    case 'SET_LOADED':
      return {
        ...state,
        status: action.products.length === 0 ? 'empty' : 'idle',
        products: action.products,
      };
    case 'SET_ERROR':
      return { ...state, status: 'error', serverError: action.error };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.mode };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query };
    default:
      return state;
  }
}

// ─── Component ────────────────────────────────────────────

export function ProductGrid() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, products, viewMode, searchQuery, serverError } = state;

  useEffect(() => {
    async function loadProducts() {
      try {
        const data = await callFunction<{
          products: (ShopifyProduct & { id: string })[];
        }>('listProducts');
        dispatch({ type: 'SET_LOADED', products: data.products });
      } catch (err: unknown) {
        const error = err as { message?: string };
        dispatch({
          type: 'SET_ERROR',
          error: error.message || 'Failed to load products',
        });
      }
    }
    loadProducts();
  }, []);

  const filtered = products.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.productType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.vendor.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg bg-stone-200" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-900">Products</h1>
          <p className="mt-1 text-sm text-stone-500">
            {products.length} product{products.length !== 1 ? 's' : ''} synced from Shopify
          </p>
          <p className="mt-1 text-[11px] text-stone-400">
            Products are imported via Shopify Connector. Connect your store first to sync products.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) =>
              dispatch({ type: 'SET_SEARCH', query: e.target.value })
            }
            className="rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-stone-950 focus:outline-none focus:ring-1 focus:ring-stone-950"
            aria-label="Search products"
          />

          {/* View toggle */}
          <div className="flex rounded-md border border-stone-300" role="group" aria-label="View mode">
            <button
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', mode: 'grid' })}
              className={`px-3 py-2 text-sm ${
                viewMode === 'grid'
                  ? 'bg-stone-100 text-stone-950'
                  : 'bg-white text-stone-500 hover:text-stone-700'
              } rounded-l-md`}
              aria-pressed={viewMode === 'grid'}
            >
              Grid
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', mode: 'list' })}
              className={`px-3 py-2 text-sm ${
                viewMode === 'list'
                  ? 'bg-stone-100 text-stone-950'
                  : 'bg-white text-stone-500 hover:text-stone-700'
              } rounded-r-md`}
              aria-pressed={viewMode === 'list'}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {status === 'error' && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      {status === 'empty' && (
        <div className="rounded-lg border-2 border-dashed border-stone-300 p-12 text-center">
          <p className="text-stone-500">No products synced yet.</p>
          <p className="mt-1 text-sm text-stone-400">
            Connect your Shopify store and sync products to get started.
          </p>
        </div>
      )}

      {filtered.length === 0 && products.length > 0 && (
        <div className="py-8 text-center">
          <p className="text-stone-500">No products match &quot;{searchQuery}&quot;</p>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => (
            <article
              key={product.id}
              className="overflow-hidden rounded-lg border border-stone-200 bg-stone-50 shadow-sm transition hover:shadow-md"
            >
              <div className="aspect-square bg-stone-100">
                {product.images[0] ? (
                  <img
                    src={product.images[0].url}
                    alt={product.images[0].alt || product.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-stone-400">
                    No image
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-medium text-stone-900 line-clamp-1">
                  {product.title}
                </h3>
                <p className="mt-1 text-xs text-stone-500">{product.productType}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-stone-700">
                    {product.variants[0]?.price
                      ? `$${product.variants[0].price}`
                      : '—'}
                  </span>
                  <span className="text-xs text-stone-400">
                    {product.variants.length} variant{product.variants.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <span
                  className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    product.status === 'active'
                      ? 'bg-green-100 text-stone-950'
                      : product.status === 'draft'
                        ? 'bg-yellow-100 text-stone-950'
                        : 'bg-stone-100 text-stone-950'
                  }`}
                >
                  {product.status}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && filtered.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-stone-200">
          <table className="min-w-full divide-y divide-stone-200">
            <thead className="bg-stone-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-stone-500">
                  Product
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-stone-500">
                  Type
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-stone-500">
                  Variants
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-stone-500">
                  Price
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-stone-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 bg-stone-50">
              {filtered.map((product) => (
                <tr key={product.id} className="hover:bg-stone-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.images[0] && (
                        <img
                          src={product.images[0].url}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                        />
                      )}
                      <span className="text-sm font-medium text-stone-900">
                        {product.title}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-500">
                    {product.productType || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-500">
                    {product.variants.length}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-700">
                    {product.variants[0]?.price ? `$${product.variants[0].price}` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        product.status === 'active'
                          ? 'bg-green-100 text-stone-950'
                          : product.status === 'draft'
                            ? 'bg-yellow-100 text-stone-950'
                            : 'bg-stone-100 text-stone-950'
                      }`}
                    >
                      {product.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
