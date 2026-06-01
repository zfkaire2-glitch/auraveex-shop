import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_PATH = join(__dirname, 'data', 'products.json');

let productsCache = null;

export function loadProducts() {
  if (productsCache) return productsCache;
  const raw = readFileSync(PRODUCTS_PATH, 'utf-8');
  productsCache = JSON.parse(raw);
  return productsCache;
}

export function getProducts() {
  return loadProducts();
}

export function getProduct(id) {
  return loadProducts().find(p => p.id === id) || null;
}

export function addProduct(data) {
  const products = loadProducts();
  const id = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
  const product = {
    id,
    name: data.name,
    price: parseFloat(data.price) || 0,
    oldPrice: data.oldPrice ? parseFloat(data.oldPrice) : null,
    description: data.description || '',
    images: data.images || [],
    category: data.category || 'عام',
    sizes: (data.sizes || '').split(',').map(s => s.trim()).filter(Boolean),
    colors: (data.colors || '').split(',').map(s => s.trim()).filter(Boolean),
    inStock: true,
  };
  products.push(product);
  saveProducts(products);
  return product;
}

export function updateProduct(id, data) {
  const products = loadProducts();
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return null;
  const p = products[idx];
  if (data.name) p.name = data.name;
  if (data.price) p.price = parseFloat(data.price);
  if (data.oldPrice !== undefined) p.oldPrice = data.oldPrice ? parseFloat(data.oldPrice) : null;
  if (data.description) p.description = data.description;
  if (data.images) p.images = data.images;
  if (data.category) p.category = data.category;
  if (data.sizes) p.sizes = data.sizes.split(',').map(s => s.trim()).filter(Boolean);
  if (data.colors) p.colors = data.colors.split(',').map(s => s.trim()).filter(Boolean);
  saveProducts(products);
  return p;
}

export function deleteProduct(id) {
  const products = loadProducts();
  const filtered = products.filter(p => p.id !== id);
  if (filtered.length === products.length) return false;
  saveProducts(filtered);
  return true;
}

function saveProducts(products) {
  productsCache = products;
  writeFileSync(PRODUCTS_PATH, JSON.stringify(products, null, 2), 'utf-8');
}

// ---------- Orders ----------

const ORDERS_PATH = join(__dirname, 'data', 'orders.json');

function ensureOrdersFile() {
  if (!existsSync(ORDERS_PATH)) {
    writeFileSync(ORDERS_PATH, '[]', 'utf-8');
  }
}

export function getOrders() {
  ensureOrdersFile();
  return JSON.parse(readFileSync(ORDERS_PATH, 'utf-8'));
}

export function addOrder(order) {
  const orders = getOrders();
  orders.push(order);
  writeFileSync(ORDERS_PATH, JSON.stringify(orders, null, 2), 'utf-8');
}

export function updateOrderStatus(id, status) {
  const orders = getOrders();
  const idx = orders.findIndex(o => o.id === id);
  if (idx === -1) return false;
  orders[idx].status = status;
  writeFileSync(ORDERS_PATH, JSON.stringify(orders, null, 2), 'utf-8');
  return true;
}

export function updateOrderTracking(id, trackingCode) {
  const orders = getOrders();
  const idx = orders.findIndex(o => o.id === id);
  if (idx === -1) return false;
  orders[idx].trackingCode = trackingCode || null;
  writeFileSync(ORDERS_PATH, JSON.stringify(orders, null, 2), 'utf-8');
  return true;
}
