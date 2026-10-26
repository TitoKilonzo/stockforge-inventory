# StockForge Inventory

A production-minded MVP scaffold for a general-purpose inventory management system with multiple branches and warehouses.

**Theme:** Atomic Orange `#FF6A00` + Ice Cream Blue `#BFEFFF`  
**Stack:** React, TypeScript, Vite, Tailwind CSS, Node.js, Express, Turso/libSQL, Zod, Vitest.

## Included

- Public Home, About and Contact pages with responsive navigation and an Explore dropdown
- Dedicated sign-in and registration-preview screens; sign-in includes a Back home button
- Demo admin account created by the seed script

- Responsive dashboard and inventory UI scaffold
- Product catalog with SKU/barcode, category, cost/selling price, reorder level and expiry tracking fields
- Multiple branches and warehouses in the schema
- Purchase orders, suppliers, sales and stock movement tables
- Transaction-oriented stock service with guarded quantity updates and movement ledger
- JWT authentication middleware and role checks
- Rate limiting, Helmet, CORS allowlist, Zod request validation
- SQL migration and demo seed script
- API health endpoint and product/stock endpoints
- Unit tests for inventory rules
- PWA manifest/service worker starter for offline app shell
- Local setup and deployment notes

## Architecture

```text
React + Vite PWA
      | HTTPS / JSON
      v
Express API (auth, validation, RBAC, rate limits)
      |
      +-- Product/catalog module
      +-- Inventory module (transaction + ledger)
      +-- Purchasing / sales modules (schema foundation)
      +-- Reporting endpoints (starter)
      |
      v
Turso / libSQL (relational tables, indexes, foreign keys)
```

Start as a modular monolith. Add shared cache, queue, object storage, and multiple API instances only when usage justifies them. Offline mode currently caches the app shell; stock-changing operations should be queued locally and synchronized with idempotency keys before enabling offline stock writes in production.

## Prerequisites

- Node.js 20+
- npm
- A Turso database (or local libSQL URL for development)

## Quick start

1. Copy environment templates:

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```

2. Configure `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in `apps/api/.env`. For local development, `file:./inventory.db` works with libSQL without a token.

3. Install dependencies from the repository root:

   ```bash
   npm install
   ```

4. Run migrations and seed demo data:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. Start API and web development servers:

   ```bash
   npm run dev
   ```

   Web: `http://localhost:5173`  
   API: `http://localhost:4000/api/health`

## Demo account

After running `npm run db:migrate` and `npm run db:seed`, the seed script creates this local/demo administrator if it does not already exist:

- Email: `admin@stockforgeinventory.com`
- Password: `Admin123!`

**Demo use only:** this is a predictable starter password. Change it before any public deployment, do not reuse it elsewhere, and do not expose a production database with these credentials. The seed script never overwrites the password of an existing account. For the first run, register an administrator using `POST /api/auth/register` only if you have not seeded the demo account.

Example request:

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Demo Admin","email":"admin@example.com","password":"ChangeThis-Strong-Password-123!"}'
```

The first account is assigned `admin` in this starter. In a real multi-user deployment, restrict public registration or add an invitation flow before launch.

## Environment variables

See `apps/api/.env.example` and `apps/web/.env.example`. Never commit real secrets. Rotate any secret that has been exposed.

## Scripts

- `npm run dev` — run web and API concurrently
- `npm run build` — build both apps
- `npm run test` — run API unit tests
- `npm run db:migrate` — apply SQL migrations
- `npm run db:seed` — add demo products, branch and warehouse

## Production deployment

### API (Render or similar)

- Root directory: repository root
- Build command: `npm install && npm run build`
- Start command: `npm run start:api`
- Set `NODE_ENV=production`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`, and `CORS_ORIGIN`.
- Use a long, random JWT secret (at least 32 bytes of entropy).
- Configure TLS, health checks at `/api/health`, and log retention.
- Disable public registration or implement invitation-only onboarding before real business use.

### Frontend (Vercel or similar)

- Root directory: repository root
- Build command: `npm install && npm run build`
- Output directory: `apps/web/dist`
- Set `VITE_API_URL` to the deployed API base URL, e.g. `https://your-api.example.com/api`.

### Database

- Apply migrations in a controlled release step.
- Use Turso backups and test restoration.
- Keep tenant/business scoping on every query; add authorization tests before using real data.
- For stock updates, use database transactions and conditional updates. If the selected Turso/libSQL deployment or transaction mode cannot provide the required write isolation, use a single-writer strategy or move the critical write path to a database configuration with the needed guarantees.

## Important production checklist

- [ ] Restrict signup / invitation flow
- [ ] Add password reset, email verification and session revocation
- [ ] Review multi-tenant isolation and authorization with security tests
- [ ] Configure backups and a tested restore procedure
- [ ] Add structured logging, monitoring and alerting
- [ ] Add audit log retention and export
- [ ] Add object storage for product images and documents
- [ ] Add barcode scanner device testing
- [ ] Implement offline mutation queue with idempotency and conflict resolution before offline stock writes
- [ ] Load-test concurrent inventory transactions
- [ ] Review dependency vulnerabilities with `npm audit`
