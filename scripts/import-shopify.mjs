import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PRODUCTS_PATH = join(ROOT, 'data', 'products.json');
const UPLOADS_DIR = join(ROOT, 'public', 'uploads');
const SHOPIFY_JSON = join(ROOT, 'scripts', 'shopify-products.json');

if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

const raw = readFileSync(SHOPIFY_JSON, 'utf-8');
const shopify = JSON.parse(raw);
const products = shopify.products;

const existing = existsSync(PRODUCTS_PATH) ? JSON.parse(readFileSync(PRODUCTS_PATH, 'utf-8')) : [];
const existingNames = new Set(existing.map(p => p.name.toLowerCase().replace(/\s+/g, ' ').trim()));

function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (!url || url === '') return resolve(null);
    const file = require('fs').createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location, (r2) => r2.pipe(file));
      } else {
        res.pipe(file);
      }
      file.on('finish', () => file.close(() => resolve(dest)));
    }).on('error', (err) => {
      try { file.close(); require('fs').unlinkSync(dest); } catch {}
      reject(err);
    });
  });
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

function categoryFromName(name, type) {
  if (type) return type.toUpperCase();
  if (/set/i.test(name)) return 'OVERSIZED SET';
  if (/shirt|tee|t-shirt/i.test(name)) return 'T-SHIRT';
  return 'GENERAL';
}

async function main() {
  let added = 0;
  let skipped = 0;

  for (const p of products) {
    const normalized = p.title.toLowerCase().replace(/\s+/g, ' ').trim();
    if (existingNames.has(normalized)) {
      skipped++;
      continue;
    }

    const idBase = slugify(p.title);
    const id = idBase + '-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

    // Download first 2 images
    const localImages = [];
    for (let i = 0; i < Math.min(2, p.images.length); i++) {
      const imgUrl = p.images[i].src;
      const ext = (imgUrl.split('?')[0].match(/\.(jpe?g|png|gif|webp|svg|jfif)$/i) || [])[1] || 'webp';
      const filename = `${id}-${i}.${ext}`;
      const dest = join(UPLOADS_DIR, filename);
      try {
        await download(imgUrl, dest);
        if (existsSync(dest)) {
          localImages.push(`/uploads/${filename}`);
        } else {
          localImages.push(imgUrl);
        }
      } catch {
        localImages.push(imgUrl);
      }
    }

    // Parse sizes from options
    let sizes = ['S', 'M', 'L', 'XL', 'XXL'];
    let colors = ['Black'];
    const sizeOpt = p.options?.find(o => o.name?.toLowerCase() === 'size');
    if (sizeOpt?.values?.length) sizes = sizeOpt.values;
    const colorOpt = p.options?.find(o => o.name?.toLowerCase() === 'color' || o.name?.toLowerCase() === 'colour');
    if (colorOpt?.values?.length) colors = colorOpt.values;

    const product = {
      id,
      name: p.title,
      price: parseFloat(p.variants[0]?.price) || 0,
      oldPrice: parseFloat(p.variants[0]?.compare_at_price) || null,
      description: (p.body_html || '').replace(/<[^>]*>/g, '').trim().substring(0, 2000),
      images: localImages.length > 0 ? localImages : [p.images[0]?.src || ''],
      category: categoryFromName(p.title, p.product_type),
      sizes,
      colors,
      inStock: p.variants[0]?.available ?? true,
    };

    existing.push(product);
    existingNames.add(normalized);
    added++;
    console.log(`+ ${p.title} (${product.price} DZD)`);
  }

  writeFileSync(PRODUCTS_PATH, JSON.stringify(existing, null, 2), 'utf-8');
  console.log(`\nDone: ${added} added, ${skipped} skipped (already exist). Total: ${existing.length} products`);
}

main().catch(console.error);
