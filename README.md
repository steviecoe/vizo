# Vizo Image Gen

**AI-Driven Fashion Photography Platform**

Vizo is a B2B SaaS platform that enables fashion brands to generate professional-quality product photography using AI. Tenants upload their models, backgrounds, and products, then generate on-brand imagery at scale — replacing traditional photoshoots with AI-powered generation.

Built for [Tom&Co](https://tomandco.com) as a white-label platform.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Monorepo Structure](#monorepo-structure)
3. [Setup & Installation](#setup--installation)
4. [Environment Variables](#environment-variables)
5. [Architecture Overview](#architecture-overview)
6. [Authentication & Roles](#authentication--roles)
7. [Multi-Tenant Data Model](#multi-tenant-data-model)
8. [Cloud Functions API](#cloud-functions-api)
9. [Services Layer](#services-layer)
10. [Image Generation Pipeline](#image-generation-pipeline)
11. [Photoshoot Mode](#photoshoot-mode)
12. [Credit System](#credit-system)
13. [Stripe Billing](#stripe-billing)
14. [Shopify Integration](#shopify-integration)
15. [Art Direction](#art-direction)
16. [Image Repository & Exports](#image-repository--exports)
17. [Video Generation](#video-generation)
18. [CMS & Homepage Editor](#cms--homepage-editor)
19. [Admin Reporting](#admin-reporting)
20. [Impersonation System](#impersonation-system)
21. [Internationalization (i18n)](#internationalization-i18n)
22. [Frontend Pages & Components](#frontend-pages--components)
23. [Shared Package](#shared-package)
24. [Security](#security)
25. [Testing](#testing)
26. [Build & Deployment](#build--deployment)
27. [Requirements Checklist](#requirements-checklist)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14.2 (App Router), React 18, Tailwind CSS 3.4 |
| Backend | Firebase Cloud Functions v2 (Node 20, TypeScript) |
| Database | Cloud Firestore (multi-tenant document model) |
| Storage | Firebase Storage (tenant-scoped image buckets) |
| Auth | Firebase Authentication (Email/Password + Google OAuth) |
| AI Generation | Google Gemini Imagen 3 (primary) + Grok (fallback) |
| Payments | Stripe (Payment Intents, Webhooks, Invoicing) |
| E-commerce | Shopify Admin API (product sync + image export) |
| Secrets | Google Cloud Secret Manager |
| Task Queue | Google Cloud Tasks (photoshoot scheduling) |
| Video | Google Veo (4-sec video generation from images) |
| Support | Zendesk (embedded iframe) |
| Monorepo | pnpm 9.x + Turborepo 2.4 |
| Testing | Vitest 3.0 + React Testing Library + Playwright 1.50 + MSW 2.7 |
| CI/Quality | Husky pre-commit hooks + lint-staged |

---

## Monorepo Structure

```
vizo-image-gen/
├── apps/
│   └── web/                          # Next.js 14 frontend (@vizo/web)
│       ├── src/
│       │   ├── app/                  # App Router pages (24 routes)
│       │   │   ├── (auth)/login/     # Login page
│       │   │   ├── (dashboard)/      # Protected dashboard routes
│       │   │   │   ├── admin/        # Superadmin pages (tenants, costs, CMS, etc.)
│       │   │   │   └── tenant/       # Tenant pages (studio, repository, etc.)
│       │   │   └── admin/bootstrap/  # One-time bootstrap page
│       │   ├── components/           # React components
│       │   │   ├── admin/            # 8 admin components
│       │   │   ├── tenant/           # 12 tenant components
│       │   │   ├── layout/           # 5 layout components (Sidebar, Shell, banners)
│       │   │   ├── shared/           # Shared UI (AiLimitationsTooltip)
│       │   │   └── auth/             # LoginForm
│       │   ├── lib/
│       │   │   ├── firebase/         # Firebase client SDK + function caller
│       │   │   ├── hooks/            # useAuth hook
│       │   │   └── i18n/             # Internationalization (11 locales)
│       │   └── test/                 # Test fixtures + setup
│       ├── e2e/                      # 8 Playwright E2E specs
│       ├── vitest.config.ts
│       └── playwright.config.ts
│
├── firebase/
│   ├── functions/                    # Cloud Functions v2 backend (@vizo/functions)
│   │   └── src/
│   │       ├── api/                  # 20 API modules (50+ callable functions)
│   │       ├── services/             # 10 service modules
│   │       ├── middleware/           # Auth middleware (RBAC, tenant resolution)
│   │       ├── generation/           # Prompt orchestrator
│   │       └── test/                 # Test fixtures + setup
│   ├── firestore.rules               # Tenant isolation security rules
│   ├── firestore.indexes.json        # Composite indexes
│   └── storage.rules                 # Tenant-scoped storage rules
│
├── packages/
│   └── shared/                       # Shared TypeScript package (@vizo/shared)
│       └── src/
│           ├── types/                # 6 type files (auth, tenant, generation, credits, shopify, platform)
│           ├── constants/            # Roles, credit defaults, generation params
│           └── validation/           # Zod schemas (tenant, generation, credits)
│
├── turbo.json                        # Turborepo task config
├── pnpm-workspace.yaml               # Workspace definition
└── tsconfig.base.json                # Shared TS config (ES2022, strict)
```

---

## Setup & Installation

### Prerequisites

- Node.js >= 20.0.0
- pnpm 9.x (`corepack enable && corepack prepare pnpm@9.15.4 --activate`)
- Firebase CLI (`npm i -g firebase-tools`)
- Google Cloud project with Firestore, Storage, and Secret Manager enabled

### Installation

```bash
# Clone and install
git clone <repo-url>
cd vizo-image-gen
pnpm install

# Copy environment file
cp .env.example apps/web/.env.local
# Fill in Firebase + Stripe + Zendesk values
```

### Secrets Setup (Google Cloud Secret Manager)

```bash
# Stripe keys
gcloud secrets create stripe-secret-key --data-file=- <<< "sk_test_..."
gcloud secrets create stripe-webhook-secret --data-file=- <<< "whsec_..."

# Gemini API keys are stored per-tenant via admin UI
# Shopify API tokens are stored per-tenant via Shopify connector
```

### Development

```bash
# Start Next.js dev server
pnpm dev

# Or run just the web app on a specific port
cd apps/web && npx next dev -p 3003

# Start Firebase emulators (optional, for local testing)
cd firebase && firebase emulators:start
```

### First-Time Bootstrap

1. Start the app and navigate to `/admin/bootstrap`
2. Enter your email — this creates the first superadmin account
3. Sets custom claims `{role: 'vg_admin'}` on your Firebase Auth user
4. Initializes platform config with default credit costs
5. This endpoint is idempotent and will refuse to run if an admin already exists

---

## Environment Variables

### Frontend (`.env.local` in `apps/web/`)

```env
# Firebase (required)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=vizo-image-gen.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=vizo-image-gen
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=vizo-image-gen.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Stripe (required for billing)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Zendesk (optional)
NEXT_PUBLIC_ZENDESK_URL=

# Google Cloud
GOOGLE_CLOUD_PROJECT=vizo-image-gen
```

### Backend (Google Cloud Secret Manager)

| Secret Name | Purpose |
|-------------|---------|
| `stripe-secret-key` | Stripe API secret key |
| `stripe-webhook-secret` | Stripe webhook signing secret |
| `tenants/{tenantId}/gemini-api-key` | Per-tenant Gemini API key |
| `tenants/{tenantId}/shopify-access-token` | Per-tenant Shopify API token |
| `grok-api-key` | Grok fallback API key |

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                       │
│  (App Router, React 18, Tailwind, Stripe Elements)          │
└─────────────────────────┬──────────────────────────────────┘
                          │ Firebase callable functions
                          ▼
┌────────────────────────────────────────────────────────────┐
│               Firebase Cloud Functions v2                    │
│  ┌──────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐ │
│  │ Auth MW  │  │ API Layer │  │ Services  │  │ Prompt   │ │
│  │ (RBAC)   │→ │ (20 mods) │→ │ (10 mods) │→ │ Orch.    │ │
│  └──────────┘  └───────────┘  └───────────┘  └──────────┘ │
└────┬──────────────┬──────────────┬──────────────┬──────────┘
     ▼              ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐
│ Firestore│  │ Storage  │  │ Secret   │  │ External APIs│
│ (data)   │  │ (images) │  │ Manager  │  │ Gemini/Grok  │
│          │  │          │  │ (keys)   │  │ Stripe/Shopify│
└──────────┘  └──────────┘  └──────────┘  │ Cloud Tasks  │
                                           │ Veo          │
                                           └──────────────┘
```

---

## Authentication & Roles

### Login Flow

1. User navigates to `/login`
2. Signs in via **Email/Password** or **Google OAuth**
3. Firebase Auth returns user + ID token with custom claims
4. `useAuth` hook reads claims and routes:
   - `vg_admin` → `/admin/tenants`
   - `tenant_admin` / `tenant_user` → `/tenant/dashboard`

### Three-Tier RBAC

| Role | Description | Custom Claims | Access |
|------|-------------|---------------|--------|
| `vg_admin` | Platform superadmin | `{role: 'vg_admin'}` | Full platform: tenants, costs, CMS, reporting, impersonation |
| `tenant_admin` | Tenant owner | `{role: 'tenant_admin', tenantId}` | Full tenant: generation, billing, users, art direction, Shopify |
| `tenant_user` | Tenant member | `{role: 'tenant_user', tenantId}` | Limited: generation, repository, dashboard (read-only settings) |

### Tenant Admin Permissions

`tenant_admin` has 4 additional permissions over `tenant_user`:
- `invite_users` — invite/remove tenant members
- `topup_credits` — purchase credits
- `change_art_direction` — edit models, backgrounds, briefs
- `configure_shopify` — connect/disconnect Shopify store

### Auth Middleware (`middleware/auth.ts`)

| Function | Description |
|----------|-------------|
| `requireAuth(request)` | Validates auth token, returns `CustomClaims` |
| `requireRole(request, ...roles)` | Validates role in claims |
| `requireAdmin(request)` | Requires `vg_admin` |
| `requireTenantAdmin(request)` | Requires `tenant_admin` or `vg_admin` |
| `resolveEffectiveTenantId(claims)` | Returns impersonated tenant ID if impersonating, else user's tenant |

---

## Multi-Tenant Data Model

### Firestore Collections

```
/platform
  /config
    /global/settings              # CreditCosts, aspectRatios, zendeskUrl
    /homepage/content             # Hero, whatsNew[], trending[]

/admins/{uid}                     # Admin user records (email, displayName)

/auditLog/{entry}                 # Impersonation audit trail

/cms/articles/items/{articleId}   # Blog articles (title, slug, body, category, status)

/tenants/{tenantId}
  ├─ name, slug, pricePerCredit, creditBalance
  ├─ lowCreditThreshold, status (active|suspended)
  ├─ allowedFeatures: {shopifyIntegration, photoshootMode, quickGeneration}
  ├─ artDirection: {defaultBrief, quickGenBrief, shopifyGenBrief, photoshootBrief}
  ├─ shopify: {storeDomain, connectedAt, lastSyncAt}
  ├─ language: {defaultLocale, autoDetect}
  │
  ├─ /users/{uid}                       # Tenant members (email, role, invitedBy, status)
  ├─ /creditLedger/{entryId}            # Atomic ledger (type, amount, balanceAfter)
  ├─ /generatedImages/{imageId}         # AI-generated images with approval workflow
  ├─ /generationJobs/{jobId}            # Quick gen + photoshoot job records
  ├─ /generatedVideos/{videoId}         # Veo-generated videos
  ├─ /photoshoots/{photoshootId}        # Batch photoshoot sessions
  ├─ /artDirectionModels/{modelId}      # Fashion model profiles
  ├─ /artDirectionBackgrounds/{bgId}    # Background/environment definitions
  ├─ /products/{productId}              # Shopify-synced products
  └─ /stripePayments/{paymentId}        # Payment records
```

### Storage Structure

```
/tenants/{tenantId}/
  /generatedImages/{imageId}.png              # Full-size generated images
  /generatedImages/{imageId}_thumbnail.png    # Thumbnails
  /artDirectionModels/{modelId}_reference.png # Model reference photos
  /artDirectionBackgrounds/{bgId}_reference.png
  /generatedVideos/{videoId}.mp4              # 4-sec generated videos
```

**Rules:** 20 MB max, `image/*` content type only, tenant-scoped access.

---

## Cloud Functions API

All functions are Firebase callable (v2 `onCall`) unless noted. Region: `us-central1`.

### Admin & Tenant Management

| Function | Auth | Description |
|----------|------|-------------|
| `bootstrapSuperadmin()` | None (one-time) | Creates first admin, initializes platform config |
| `createTenant(name, slug, ...)` | `vg_admin` | Creates tenant + invites admins, stores Gemini key |
| `updateTenant(tenantId, ...)` | `vg_admin` | Partial updates (name, slug, features, art direction, status) |
| `deleteTenant(tenantId)` | `vg_admin` | Removes tenant, all users, clears claims |
| `listTenants()` | `vg_admin` | Returns all tenants |
| `listTenantUsers(tenantId)` | `vg_admin` | Lists all members of a tenant |
| `inviteTenantUser(tenantId, email, role)` | `vg_admin` | Creates/invites user, sets claims |
| `removeTenantUser(tenantId, uid)` | `vg_admin` | Removes user from tenant, clears claims |

### Image Generation

| Function | Auth | Description |
|----------|------|-------------|
| `quickGenerate(params)` | Tenant member | Single-image gen (quick or shopify mode) |
| `createPhotoshoot(name, modelIds, ...)` | Tenant member | Creates batch photoshoot, enqueues Cloud Task |
| `processPhotoshoot(photoshootId)` | Cloud Task | Worker that generates all images in batch |
| `listPhotoshoots()` | Tenant member | Lists all photoshoots with pagination |
| `regenerateImage(imageId)` | Tenant member | Re-runs generation with original params |
| `generateVideoFromImage(imageId)` | Tenant member | Creates 4-sec video from approved image via Veo |

### Image Repository

| Function | Auth | Description |
|----------|------|-------------|
| `listImages(statusFilter?)` | Tenant member | Lists images with optional status filter |
| `updateImageStatus(imageIds, status)` | Tenant member | Bulk approve/reject (max 500 per batch) |
| `pushImageToShopify(imageId)` | Tenant member | Exports approved image to Shopify product |
| `bulkDownloadImages(imageIds)` | Tenant member | Generates ZIP archive (max 100), returns signed URL |

### Credits & Billing

| Function | Auth | Description |
|----------|------|-------------|
| `debitCredits(amount, type, ...)` | Internal | Pre-generation credit reserve |
| `refundCredits(amount, jobId)` | Internal | Post-failure credit refund |
| `adminTopupCredits(tenantId, amount, desc)` | `vg_admin` | Manual admin credit grant |
| `purchaseCredits(creditAmount)` | Tenant admin | Creates Stripe PaymentIntent |
| `handleStripeWebhook(req, res)` | Stripe signature | Webhook: grants credits on payment success |
| `getBillingInfo()` | Tenant member | Returns Stripe payment history |
| `getCreditCosts()` | `vg_admin` | Fetches platform credit pricing |
| `updateCreditCosts(...)` | `vg_admin` | Updates per-type credit prices |
| `purchaseCreditsViaShopify(amount)` | Tenant member | Creates Shopify draft order for credits |
| `confirmShopifyCreditPurchase(orderId)` | Internal | Confirms Shopify credit purchase |

### Art Direction

| Function | Auth | Description |
|----------|------|-------------|
| `listModels()` | Tenant member | Lists all fashion models |
| `createModel(name, gender, ...)` | Tenant admin | Creates model profile |
| `updateModel(id, ...)` | Tenant admin | Updates model details |
| `deleteModel(id)` | Tenant admin | Removes model |
| `listBackgrounds()` | Tenant member | Lists all backgrounds |
| `createBackground(name, type, desc)` | Tenant admin | Creates background definition |
| `updateBackground(id, ...)` | Tenant admin | Updates background |
| `deleteBackground(id)` | Tenant admin | Removes background |

### Shopify

| Function | Auth | Description |
|----------|------|-------------|
| `connectShopify(storeDomain, apiKey)` | Tenant admin | Validates + stores credentials |
| `syncShopifyProducts()` | Tenant admin | Fetches all products from Shopify |
| `disconnectShopify()` | Tenant admin | Clears Shopify connection |
| `listProducts()` | Tenant member | Lists synced products |

### Dashboard & Reporting

| Function | Auth | Description |
|----------|------|-------------|
| `getTenantDashboard()` | Tenant member | Credit balance, stats, recent activity |
| `getReportingData()` | `vg_admin` | Platform metrics (revenue, AI cost, margins) |

### CMS & Homepage

| Function | Auth | Description |
|----------|------|-------------|
| `createArticle(title, slug, ...)` | `vg_admin` | Creates blog article |
| `updateArticle(articleId, ...)` | `vg_admin` | Updates article |
| `deleteArticle(articleId)` | `vg_admin` | Removes article |
| `listArticlesAdmin()` | `vg_admin` | All articles |
| `listPublishedArticles()` | Any auth | Published articles only |
| `getArticle(articleId)` | Any auth | Single article |
| `getHomepageConfig()` | Any auth | Landing page content |
| `updateHomepageConfig(hero, ...)` | `vg_admin` | Updates homepage |

### Impersonation

| Function | Auth | Description |
|----------|------|-------------|
| `impersonate(targetTenantId)` | `vg_admin` | Mints custom token to view tenant as member |
| `endImpersonation()` | `vg_admin` | Returns clean admin token |

### Tenant Settings

| Function | Auth | Description |
|----------|------|-------------|
| `getTenantSettings()` | Tenant member | Returns language settings |
| `updateTenantLanguage(locale, autoDetect)` | Tenant admin | Updates language preferences |
| `getPlatformPublicConfig()` | Any auth | Returns zendeskUrl |

---

## Services Layer

10 service modules in `firebase/functions/src/services/`:

| Service | Purpose |
|---------|---------|
| `firebase-admin.ts` | Singleton accessors: `getAuth()`, `getDb()`, `getStorage()` |
| `credit-service.ts` | Atomic credit operations: `reserveCredits()`, `refundCreditsForFailure()`, `adminTopup()` |
| `generation-router.ts` | Routes generation through Gemini (primary) → Grok (fallback) |
| `gemini-service.ts` | Gemini API integration (multimodal payload, safety settings) |
| `grok-service.ts` | Grok API fallback integration |
| `stripe-service.ts` | Stripe SDK: PaymentIntents, webhooks, invoices |
| `shopify-service.ts` | Shopify Admin API: credential validation, product fetch |
| `shopify-export-service.ts` | Upload generated images to Shopify products |
| `secret-manager.ts` | Google Cloud Secret Manager: `getSecret()`, `createOrUpdateSecret()` |
| `cloud-tasks.ts` | Google Cloud Tasks: photoshoot scheduling, image count computation |
| `cost-calculator.ts` | AI cost estimation, revenue, profit margin calculations |
| `veo-service.ts` | Google Veo video generation service |

---

## Image Generation Pipeline

### Quick Generation Flow

```
User fills QuickGenWizard (Studio page)
  │
  ├─ Selects: product/image URLs, model, background, resolution, aspect ratio, variants, brief
  │
  ▼
Validate via quickGenSchema (Zod) — requires at least 1 item image or product
  │
  ▼
Compute credit cost = creditCosts[flowType + resolution] × variantCount
  │
  ▼
Reserve credits atomically (Firestore transaction)
  ├─ Check tenant balance >= cost
  ├─ Debit creditBalance
  └─ Create ledger entry with balanceAfter
  │
  ▼
For each variant:
  ├─ Assemble prompt via Prompt Orchestrator:
  │   ├─ System layer (professional fashion photographer guidelines + safety)
  │   ├─ User brief + flow-specific brief (quickGenBrief / shopifyGenBrief)
  │   ├─ Model details (gender, skin, hair, height, size, age)
  │   ├─ Background description (type, setting)
  │   ├─ Product info (title, type, variants)
  │   └─ Technical specs (resolution, aspect ratio, lighting)
  │
  ├─ Call generateWithFallback():
  │   ├─ Try Gemini (gemini-2.0-flash-exp) with tenant's Secret Manager key
  │   └─ On failure → try Grok fallback
  │
  ├─ Store image in Storage: tenants/{tenantId}/generatedImages/{imageId}.png
  ├─ Create generatedImages document (status: 'waiting_approval')
  │
  └─ On failure: refund proportional credits
  │
  ▼
Create generationJob document (status: 'completed')
  │
  ▼
Images appear in Image Repository for approval
```

### Prompt Orchestrator

Located at `firebase/functions/src/generation/prompt-orchestrator.ts`.

Assembles a multi-layered text prompt:

1. **System layer** — professional fashion photography guidelines, safety rules (no nudity, violence, copyrighted logos, celebrity likenesses)
2. **Brief layer** — tenant's default brief + flow-specific brief + user override
3. **Models layer** — each model's physical attributes
4. **Backgrounds layer** — environment/setting descriptions
5. **Products layer** — product details and variants
6. **Technical layer** — resolution specs, aspect ratio, lighting/composition

Output: `{ textPrompt, imageUrls (reference images), layers (for debugging) }`

---

## Photoshoot Mode

Batch generation: creates images for every combination of models × backgrounds × products × variants.

### Image Count Formula

```
totalImages = modelCount × backgroundCount × max(productCount, 1) × variantCount

Example: 2 models, 3 backgrounds, 4 products, 2 variants = 48 images
```

### Photoshoot Flow

```
User fills PhotoshootWizard
  │
  ├─ Selects: models (min 1), backgrounds (min 1), products, resolution, variants, brief
  ├─ Optional: isOvernight (runs at 2 AM UTC)
  │
  ▼
Compute total images and credit cost
  │
  ▼
Reserve ALL credits upfront (Commit-or-Refund)
  │
  ▼
Create photoshoot document (status: 'scheduled' or 'processing')
  │
  ▼
Enqueue Google Cloud Task
  ├─ Immediate: fires within seconds
  └─ Overnight: scheduled for next 2 AM UTC
  │
  ▼
[Cloud Task fires] processPhotoshoot():
  ├─ Loads photoshoot + all referenced assets
  ├─ For each (model × background × product × variant):
  │   ├─ Assemble prompt
  │   ├─ Generate image
  │   ├─ Store result
  │   └─ Track success/failure
  ├─ On partial failure: refund failed images only
  └─ Update photoshoot status → 'completed'
```

### Cloud Tasks Integration

- Queue: `photoshoot-worker` (europe-west1)
- Endpoint: `processPhotoshoot` Cloud Function
- Scheduling: optional delay via `scheduledAt` timestamp

---

## Credit System

### Ledger Entry Types

| Type | Direction | Description |
|------|-----------|-------------|
| `topup_stripe` | + | Stripe payment succeeded |
| `topup_admin` | + | Manual admin grant |
| `topup_shopify` | + | Shopify credit purchase |
| `debit_generation` | - | Quick gen / photoshoot image |
| `debit_photoshoot` | - | Photoshoot batch debit |
| `debit_video` | - | Video generation |
| `refund_generation_failure` | + | Auto-refund on failed generation |

### Default Credit Costs

| Generation Type | 1k Resolution | 2k Resolution |
|----------------|---------------|---------------|
| Quick Gen | 5 credits | 10 credits |
| Shopify Gen | 5 credits | 10 credits |
| Photoshoot | 3 credits | 7 credits |
| Model Gen | 2 credits | — |
| Background Gen | 2 credits | — |
| Video Gen | 15 credits | — |

Configurable by admin via `/admin/credit-costs`.

### Commit-or-Refund Pattern

Every generation follows this atomic pattern:

1. **Reserve** — debit credits via Firestore transaction (fails fast if insufficient)
2. **Execute** — run AI generation
3. **Reconcile** — refund proportionally for any failed images

Each ledger entry records `balanceAfter` for complete audit trail.

### Low Credit Warning

When tenant balance drops below `lowCreditThreshold` (default: 50), an amber banner appears globally across the dashboard.

---

## Stripe Billing

### Payment Flow

```
1. Tenant selects credit amount on /tenant/credits
2. Call purchaseCredits(creditAmount):
   ├─ Compute: amountCents = creditAmount × tenant.pricePerCredit × 100
   ├─ Create Stripe PaymentIntent with metadata: {tenantId, uid, creditAmount}
   ├─ Record pending payment in Firestore
   └─ Return clientSecret

3. Frontend: Stripe Payment Element collects card details

4. Stripe fires webhook → handleStripeWebhook():
   ├─ Verify signature (Secret Manager)
   ├─ Check event type: payment_intent.succeeded
   ├─ Idempotency check (prevent double-crediting on retries)
   ├─ Atomic transaction: creditBalance += creditAmount + ledger entry
   └─ Auto-create and email Stripe invoice
```

### Idempotency

The webhook handler checks if a ledger entry already exists for the PaymentIntent ID before granting credits. Safe for retries.

---

## Shopify Integration

### Connection Flow

1. Tenant enters `storeDomain` + admin API key on `/tenant/shopify`
2. `connectShopify()` validates credentials via Shopify API
3. API key stored in Secret Manager (never in Firestore)
4. Tenant doc updated with `shopify.storeDomain` + `connectedAt`

### Product Sync

- `syncShopifyProducts()` fetches all products via Shopify Admin API (v2024-01)
- Upserts into `tenants/{tenantId}/products/{productId}` with batched writes
- Stores: title, description, productType, vendor, images[], variants[], status

### Image Export

After approving a generated image in the repository:
1. `pushImageToShopify(imageId)` validates image is approved
2. Downloads image, uploads to Shopify product via Admin API
3. Updates `shopifyExportStatus` → `'exported'`

### Credit Purchase via Shopify

Basic infrastructure in place:
- `purchaseCreditsViaShopify()` creates draft order
- `confirmShopifyCreditPurchase()` grants credits
- Full webhook integration is planned for future scope

---

## Art Direction

Accessible via `/tenant/art-direction` with **Models** and **Backgrounds** tabs.

### Models

Fashion model profiles used in AI prompt assembly:

| Field | Type | Description |
|-------|------|-------------|
| name | string | Model name |
| gender | enum | male, female, non-binary |
| skinColour | string | Skin tone description |
| hairColour | string | Hair color |
| height | string | Height (e.g. "165cm") |
| clothingSize | 8-18 | UK clothing size |
| age | string | Age or age range |
| referenceImageUrl | string? | Optional reference photo |

Stored at: `tenants/{tenantId}/artDirectionModels/{modelId}`

### Backgrounds

Environment/setting definitions:

| Field | Type | Description |
|-------|------|-------------|
| name | string | Background name |
| type | enum | studio, outdoor, campaign, custom |
| description | string | Detailed description (max 500 chars) |
| referenceImageUrl | string? | Optional reference image |

Stored at: `tenants/{tenantId}/artDirectionBackgrounds/{bgId}`

### Usage in Generation

The Prompt Orchestrator inserts model attributes and background descriptions into the AI prompt to ensure consistent, on-brand imagery across all generations.

---

## Image Repository & Exports

### Approval Workflow

Generated images land in the repository with status `waiting_approval`.

Available actions:
- **Approve** — marks image as production-ready
- **Reject** — marks image as rejected
- **Regenerate** — re-runs generation with original params (new credit charge)
- **Export to Shopify** — pushes approved image to Shopify product
- **Bulk download** — generates ZIP archive (max 100 images), returns signed URL

### Image Statuses

```
waiting_approval → approved → exported (to Shopify)
                 → rejected → regenerated (creates new image)
```

### Bulk Operations

- `updateImageStatus(imageIds, status)` supports up to 500 images per batch via Firestore batch writes
- `bulkDownloadImages(imageIds)` generates ZIP via `archiver` library, max 100 images

---

## Video Generation

Uses Google Veo to create 4-second videos from approved images.

### Flow

1. User clicks "Generate Video" on an approved image
2. `generateVideoFromImage(imageId)`:
   - Validates image is approved
   - Reserves credits (cost: `creditCosts.videoGeneration`, default 15)
   - Creates `generatedVideos` document (status: `pending`)
   - Downloads image from Storage, sends to Veo API
   - On success: stores video in Storage, updates doc with URL
   - On failure: refunds credits

---

## CMS & Homepage Editor

### CMS Articles (`/admin/cms`)

Blog/content management with:
- **Categories:** tutorial, news, update, guide, faq
- **Statuses:** draft, published, archived
- Auto-sets `publishedAt` on first publish
- Supports cover images, tags (max 10)

Stored at: `cms/articles/items/{articleId}`

### Homepage Editor (`/admin/homepage-editor`)

Configures the landing page:
- **Hero section:** image, title, subtitle, CTA button
- **What's New:** array of content cards (image, title, description, link)
- **Trending:** array of trending cards (image, title, optional tenant link)

Stored at: `platform/config/homepage/content` (singleton)

---

## Admin Reporting

### Reporting Dashboard (`/admin/reporting`)

Platform-wide metrics aggregated across all tenants:

| Metric | Description |
|--------|-------------|
| Total tenants | Active tenant count |
| Credits in system | Sum of all tenant balances |
| Credits spent | Sum of all debit ledger entries |
| Total images generated | Count across all tenants |
| Approved / Rejected images | Breakdown by status |
| Images 1k vs 2k | Resolution breakdown |
| Estimated AI cost | `(images1k × $0.04) + (images2k × $0.08)` |
| Credits revenue | `totalCreditsSpent × avgPricePerCredit` |
| Profit margin | `((revenue - aiCost) / revenue) × 100` |
| Top tenants | Ranked by usage (images + credits) |
| Recent ledger | Last 100 entries across all tenants |

---

## Impersonation System

Allows `vg_admin` to view any tenant's dashboard as if they were a tenant member, for debugging and support.

### Flow

1. Admin clicks "Log in as" on a tenant row in `/admin/tenants`
2. `impersonate(targetTenantId)`:
   - Mints custom token: `{role: 'vg_admin', impersonating: true, impersonatedTenantId, originalUid}`
   - Logs to `auditLog` collection
3. Admin signs in with custom token → sees tenant dashboard
4. **ImpersonationBanner** (amber bar) shows at top: "Impersonating tenant: {tenantId}"
5. Click "Exit Impersonation" → `endImpersonation()` mints clean admin token
6. All impersonation events are logged with admin email, target tenant, and timestamp

### Firestore/Storage Rule Integration

```javascript
function isImpersonating(tenantId) {
  return isAdmin()
    && request.auth.token.impersonating == true
    && request.auth.token.impersonatedTenantId == tenantId;
}
```

---

## Internationalization (i18n)

### Supported Locales

`en`, `pl`, `de`, `fr`, `es`, `it`, `pt`, `nl`, `ja`, `ko`, `zh`

### Setup

Provider: `I18nProvider` in `apps/web/src/lib/i18n/i18n-context.tsx`

Resolution order:
1. Tenant language preference (set in Settings)
2. GeoIP auto-detection (via ipapi.co) if enabled
3. Fallback: `'en'`

### Usage

```tsx
const { locale, setLocale, t } = useI18n();

<h1>{t('dashboard.title')}</h1>
<button onClick={() => setLocale('pl')}>Polski</button>
```

### Translation Keys

Structured with dot notation: `nav.dashboard`, `gen.studio`, `credits.purchase`, `repo.approve`, `auth.signIn`, etc.

---

## Frontend Pages & Components

### Routes (24 total)

**Public:**
| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Landing page | Public homepage with login CTA |
| `/admin/bootstrap` | Bootstrap | One-time superadmin setup |

**Auth:**
| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | LoginForm | Email + Google OAuth |

**Admin** (requires `vg_admin`):
| Route | Component | Description |
|-------|-----------|-------------|
| `/admin/tenants` | TenantManagement | CRUD tenants, invite users, impersonate |
| `/admin/credit-costs` | CreditCostsManager | Configure per-type credit pricing |
| `/admin/reporting` | ReportingDashboard | Platform metrics and financials |
| `/admin/cms` | CmsManager | Article CRUD |
| `/admin/homepage-editor` | HomepageEditor | Landing page content editor |

**Tenant** (requires tenant member):
| Route | Component | Description |
|-------|-----------|-------------|
| `/tenant/dashboard` | TenantDashboard | Credit balance, stats, recent activity |
| `/tenant/generate/quick` | QuickGenWizard | Single-image AI generation studio |
| `/tenant/generate/photoshoot` | PhotoshootWizard | Batch generation wizard (4 steps) |
| `/tenant/generate/shopify` | ShopifyGenWizard | Generate for synced Shopify products |
| `/tenant/art-direction/models` | ModelLibrary | CRUD fashion models |
| `/tenant/art-direction/backgrounds` | BackgroundLibrary | CRUD backgrounds |
| `/tenant/repository` | ImageRepository | Approve/reject/download/export images |
| `/tenant/products` | ProductGrid | View synced Shopify products |
| `/tenant/shopify` | ShopifyConnector | Connect store + sync products |
| `/tenant/credits` | CreditPurchase | Buy credits via Stripe |
| `/tenant/settings` | TenantSettings | Language preferences |
| `/tenant/support` | SupportEmbed | Zendesk iframe |

### Components (27 total)

**Admin (8):** AdminTopupDialog, CmsManager, CreateTenantDialog, CreditCostsManager, EditTenantDialog, HomepageEditor, ReportingDashboard, TenantManagement

**Tenant (12):** BackgroundLibrary, ContentHub, CreditPurchase, ImageRepository, ModelLibrary, PhotoshootWizard, ProductGrid, QuickGenWizard, ShopifyConnector, SupportEmbed, TenantDashboard, TenantSettings

**Layout (5):** DashboardShell, ImpersonationBanner, LowCreditBanner, MobileSidebarProvider, Sidebar

**Shared (1):** AiLimitationsTooltip (displays 5 known AI generation limitations)

**Auth (1):** LoginForm

---

## Shared Package

`@vizo/shared` — shared TypeScript types, Zod validation schemas, and constants.

### Types (`packages/shared/src/types/`)

| File | Key Types |
|------|-----------|
| `auth.ts` | `UserRole`, `CustomClaims`, `TenantUser`, `AdminUser`, `ImpersonationAuditEntry` |
| `tenant.ts` | `Tenant`, `AllowedFeatures`, `TenantArtDirection`, `ArtDirectionModel`, `ArtDirectionBackground` |
| `generation.ts` | `GenerationJob`, `GeneratedImage`, `GeneratedVideo`, `Photoshoot`, `Resolution`, `AspectRatio` |
| `credits.ts` | `CreditLedgerEntry`, `LedgerEntryType`, `CreditCosts`, `StripePayment` |
| `shopify.ts` | `ShopifyProduct`, `ShopifyProductVariant`, `ShopifyProductImage` |
| `platform.ts` | `HomepageConfig`, `PlatformConfig`, `CmsArticle` |

### Validation Schemas (`packages/shared/src/validation/`)

| Schema | Description |
|--------|-------------|
| `createTenantSchema` | name, slug, pricePerCredit, allowedFeatures, adminEmails[], geminiApiKey |
| `updateTenantSchema` | All optional + required tenantId |
| `quickGenSchema` | Resolution, aspect ratio, variants, brief, model/background/product IDs |
| `photoshootCreateSchema` | Name, model/background IDs (min 1 each), isOvernight |
| `artDirectionModelSchema` | Name, gender, skin, hair, height, clothingSize (8-18), age |
| `artDirectionBackgroundSchema` | Name, type (enum), description (max 500) |
| `shopifyConnectSchema` | storeDomain (.myshopify.com), adminApiKey |
| `creditTopupSchema` | creditAmount (10-100,000) |
| `adminCreditTopupSchema` | tenantId, creditAmount (1-1,000,000), description |
| `creditCostsSchema` | All 9 credit cost types (positive integers) |
| `cmsArticleSchema` | title, slug, body, category, status, tags |
| `videoGenerateSchema` | imageId |

### Constants (`packages/shared/src/constants/`)

| Constant | Value |
|----------|-------|
| `ROLES` | `{vg_admin, tenant_admin, tenant_user}` |
| `TENANT_ADMIN_PERMISSIONS` | `['invite_users', 'topup_credits', 'change_art_direction', 'configure_shopify']` |
| `DEFAULT_CREDIT_COSTS` | Quick 5/10, Shopify 5/10, Photoshoot 3/7, Model/BG 2, Video 15 |
| `LOW_CREDIT_THRESHOLD_DEFAULT` | 50 |
| `RESOLUTIONS` | `['1k', '2k']` |
| `ASPECT_RATIOS` | `['1:1', '4:5', '16:9']` |
| `MAX_VARIANTS_PER_JOB` | 10 |
| `CLOTHING_SIZES` | `[8, 10, 12, 14, 16, 18]` |
| `SUPPORTED_LOCALES` | 11 locales (en, pl, de, fr, es, it, pt, nl, ja, ko, zh) |
| `GENAI_MODELS` | `['gemini', 'grok']` (primary + fallback) |

---

## Security

### API Key Management

All sensitive credentials stored in **Google Cloud Secret Manager** — never in Firestore or environment variables:
- Stripe API keys
- Stripe webhook signing secret
- Per-tenant Gemini API keys
- Per-tenant Shopify API tokens
- Grok API key

### Tenant Data Isolation

**Firestore Rules:**
- `canAccessTenant(tenantId)` — admin OR impersonating admin OR tenant member
- All writes go through Cloud Functions (Admin SDK) — client-side writes denied globally
- Wildcard coverage: `tenants/{tenantId}/{subcollection}/{docId}`

**Storage Rules:**
- Tenant-scoped: `/tenants/{tenantId}/{allPaths}**`
- 20 MB upload limit
- `image/*` content type only

### Auth Security

- Custom claims set server-side only (via Cloud Functions Admin SDK)
- ID tokens verified on every callable function invocation
- Impersonation audit trail in Firestore

### AI Safety

Prompt orchestrator includes safety guidelines:
- No nudity, violence, or minors
- No copyrighted logos or celebrity likenesses
- Realistic body proportions
- Diverse representation
- Gemini safety settings: blocks sexually explicit (LOW+), hate speech (LOW+), harassment (MEDIUM+)

---

## Testing

### Test Summary

| Category | Framework | Count | Files |
|----------|-----------|-------|-------|
| Cloud Functions | Vitest | ~210 | 23 files |
| React Components | Vitest + RTL | ~195 | 22 files |
| E2E | Playwright | — | 8 specs |
| **Total** | | **~405** | **53 files** |

### Test Configurations

**Backend** (`firebase/functions/vitest.config.ts`):
- Environment: node
- Coverage: v8 provider, thresholds 60/55/60/60
- Setup: `src/test/setup.ts`

**Frontend** (`apps/web/vitest.config.ts`):
- Environment: jsdom (via `// @vitest-environment jsdom`)
- Coverage: v8 provider, thresholds 60/55/60/60
- MSW for API mocking
- Setup: `src/test/setup.ts`

**E2E** (`apps/web/playwright.config.ts`):
- Parallel execution
- HTML reporter
- Base URL: `http://localhost:3111`
- Trace on first retry

### E2E Specs

1. `bootstrap.spec.ts` — Superadmin bootstrap flow
2. `smoke.spec.ts` — Basic navigation + login
3. `admin.spec.ts` — Admin tenant CRUD + user management
4. `billing.spec.ts` — Stripe credit purchase + webhooks
5. `generation.spec.ts` — Quick gen + regenerate workflows
6. `photoshoot.spec.ts` — Batch generation + overnight scheduling
7. `shopify.spec.ts` — Shopify connect + product sync + image export
8. `uat.spec.ts` — Full end-to-end user lifecycle

### Running Tests

```bash
# All tests (functions + web)
pnpm test

# Cloud Functions only
cd firebase/functions && npx vitest run

# Web app only
cd apps/web && npx vitest run

# End-to-end (builds first)
pnpm test:e2e

# With coverage
pnpm test:coverage
```

### Testing Conventions

- **Factory fixtures** with `Partial<T>` overrides: `makeAdminClaims()`, `makeTenantAdminClaims()`, `makeGeneratedImage()`, etc.
- **Per-file environment:** `// @vitest-environment jsdom` for component tests
- **`useReducer` pattern** for all complex form/wizard state
- **MSW** for mocking Firebase callable functions and external APIs
- **`export const dynamic = 'force-dynamic'`** on all Next.js pages

---

## Build & Deployment

### Build Pipeline (Turborepo)

```bash
# Build all packages (dependency order: shared → functions + web)
pnpm build
```

Turborepo config ensures `shared` builds before `functions` and `web`.

### Functions Build

```bash
cd firebase/functions
npm run build
# Runs: tsc --noEmit && esbuild src/index.ts --bundle --platform=node --target=node20 --outfile=dist/index.js
```

External dependencies (not bundled): firebase-admin, firebase-functions, @google-cloud/*, stripe, archiver, zod

### Deploy to Production

```bash
# Full deploy: Firestore rules + Storage rules + Functions + Hosting
pnpm deploy:prod

# Functions only
cd firebase && npx firebase deploy --only functions

# Rules only
cd firebase && npx firebase deploy --only firestore:rules,storage:rules
```

### TypeScript Configuration

- Target: ES2022
- Module: ESNext
- Strict mode enabled
- Declaration + sourcemaps
- Shared via `tsconfig.base.json`

---

## Requirements Checklist

| # | Requirement | Status | Implementation |
|---|------------|--------|---------------|
| 1 | Multi-tenancy | DONE | Firestore `tenants/{id}` model, tenant-scoped subcollections |
| 2 | Role-based access (3-tier RBAC) | DONE | Custom claims + middleware enforcement |
| 3 | Admin impersonation | DONE | Custom tokens + audit trail |
| 4 | 100% tenant data isolation | DONE | Firestore + Storage rules |
| 5 | Atomic credit ledger | DONE | Commit-or-Refund pattern via transactions |
| 6 | Shopify integration | DONE | Connect, sync, export |
| 7 | AI cost reporting | DONE | Cost calculator with margin analysis |
| 8 | Art direction management | DONE | Models + Backgrounds CRUD with tabs |
| 9 | Quick Generate flow | DONE | Prompt orchestration + Gemini/Grok |
| 10 | Photoshoot mode | DONE | Batch gen via Cloud Tasks |
| 11 | Stripe billing | DONE | PaymentIntents + webhooks + invoicing |
| 12 | Image repository | DONE | Approve/reject with bulk operations |
| 13 | Export to Shopify | DONE | Push approved images to products |
| 14 | Bulk download | DONE | ZIP archive via archiver |
| 15 | Homepage CMS | DONE | Hero + content cards editor |
| 16 | Tenant dashboard | DONE | Credit balance, stats, activity |
| 17 | Admin reporting | DONE | Revenue, AI cost, profit margin |
| 18 | Credit costs config | DONE | Admin UI for per-type pricing |
| 19 | Image regeneration | DONE | Re-trigger with original params |
| 20 | Zendesk support | DONE | Embedded iframe |
| 21 | AI limitations tooltips | DONE | 5 limitations in all gen wizards |
| 22 | Low credit warning | DONE | Global amber banner |
| 23 | Production deploy | DONE | `pnpm deploy:prod` |
| 24 | Google OAuth login | DONE | Firebase Auth GoogleAuthProvider |

**All 24 requirements: COMPLETE**

---

## License

Proprietary. Copyright Tom&Co. All rights reserved.
