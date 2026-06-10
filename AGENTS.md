# AURA VEEX E-Commerce — Agent Guidelines

## Quick Start
- **Run**: `npm start` (or `node server.js`)
- **Dev**: `npm run dev` (uses `node --watch`)
- **Test**: `node --test test/store.test.js`
- **Kill before restart**: `Get-Process node | Stop-Process` (old processes stay on port 3000)
- **Open**: <http://localhost:3000>

## Stack
- Express 5 (`"type": "module"` — all imports use ESM, no `require()`)
- EJS templates in `views/`
- Session via `express-session`
- Google Sheets backup (optional, env-configured)
- Multer for image uploads → `public/uploads/`

## Data (JSON files in `data/`)
| File | Purpose |
|---|---|
| `products.json` | 24 products, source of truth |
| `orders.json` | Placed orders (gitignored) |
| `pages.json` | Homepage sections (Page Builder editable) |
| `theme.json` | Visual theme (colors, fonts, logo) |
| `communes.json` | Wilaya/commune data for checkout |

## Key Routes
| Route | Purpose |
|---|---|
| `/` / `/products` / `/product/:id` | Storefront pages |
| `/cart` / `/checkout` (GET+POST) | Shopping flow |
| `/admin` | Admin dashboard (login: env `ADMIN_PASSWORD`) |
| `/admin/theme` | Visual theme customizer |
| `/admin/builder` | Page Builder (Canva-like section editor) |
| `/admin/builder/save` | POST JSON `{sections}` to persist (session auth) |
| `/debug` | Show sheets status |
| `/debug/test-sheet` | Test Google Sheets append |
| `/sitemap.xml` | Dynamic sitemap |
| `/robots.txt` | Dynamic robots (blocks `/admin/`, `/api/`) |

## Recovery
- **RECOVERY.md** — دليل كامل لاسترجاع المشروع بعد الفرمطة
- **GitHub**: `https://github.com/zfkaire2-glitch/auraveex-shop.git`
- **Render**: `https://auraveex-shop.onrender.com`

## Google Sheets Gotcha
`sheets.js:saveOrder()` must use `insertDataOption: 'INSERT_ROWS'` on `values.append()`.
Without this the API overwrites row 2 instead of inserting a new row.

## Express 5 (v5.2.1) Quirks
- `app.use(express.static(...))` with `setHeaders` works for security headers
- Example security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`
- Body parsing: `express.json()` + `express.urlencoded({ extended: true })` — both required

## Admin
- Password set via `ADMIN_PASSWORD` env var (default `admin123`)
- No separate admin accounts; single shared password
- Routes protected by `requireAdmin` middleware

## JSON-LD (in `views/partials/head.ejs`)
3 blocks rendered on all pages: `Organization` (with `sameAs`, ContactPoint, logo), `WebSite` (with SearchAction), `Product` (only on product detail page via `product.ejs`).

## Telegram Bot (مستقل)
`telegram-bot.js` — سكريبت منفصل يراقب Google Sheets ويبعث إشعارات على تليغرام المالك.
- **Env vars**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_POLL_INTERVAL` (ms, default 30s)
- **Run**: `node telegram-bot.js` (نافذة CLI لوحدها)
- **Tracking**: يحفظ الـ IDs المرسلة في `data/telegram-sent.json` باش ما يبعتهومش مرتين
- لإعداد البوت: كلم [@BotFather](https://t.me/botfather) تولد توكن، و [@userinfobot](https://t.me/userinfobot) تجيب Chat ID

## Render Deploy
- Free tier: 512MB RAM, cold start ~30–60s
- `CLUSTER_WORKERS=0` (single process, no cluster — use default)
- Self-ping every 5 min prevents sleep: fetch `/ping`
- `render.yaml` config: build = `npm install`, start = `node server.js`
- `--watch` flag NOT supported on Render (use plain `node server.js`)

## Shopify Importer
`scripts/import-shopify.mjs` — reads `scripts/shopify-products.json`, writes to `data/products.json`. Run once per import.

## Tests
- Built-in Node test runner (`node:test`)
- `store.test.js` validates product/order/stats functions
- No integration tests; no Playwright or browser tests
- Test command: `node --test`

## Lint / Typecheck
None configured. No ESLint, Prettier, or TypeScript.

## Customers
Simple local auth: phone + sha256 password. Stored in `data/customers.json`. No OAuth or email.

## WhatsApp Notifications
`whatsapp.js` sends order confirmation via WhatsApp Cloud API (Meta).
- **Env vars**: `WHATSAPP_PHONE_ID`, `WHATSAPP_TOKEN`
- Triggered automatically after `saveOrder()` in `POST /checkout`
- Number format: converts `05XX...` to `2135XX...` automatically
- Check status: `/debug` shows `whatsAppReady: true/false`
- **Pricing**: Free up to 1,000 conversations/month

## Debug Routes
| Route | Purpose |
|---|---|
| `/debug` | Show sheets + WhatsApp status |
| `/debug/test-sheet` | Test Google Sheets append |
