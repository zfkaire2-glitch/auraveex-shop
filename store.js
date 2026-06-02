import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_PATH = join(__dirname, 'data', 'products.json');

let productsCache = null;
let productsCacheTime = 0;
const CACHE_TTL = 300_000; // 5 minutes

export function loadProducts() {
  const now = Date.now();
  if (productsCache && (now - productsCacheTime) < CACHE_TTL) return productsCache;
  const raw = readFileSync(PRODUCTS_PATH, 'utf-8');
  productsCache = JSON.parse(raw);
  productsCacheTime = now;
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
  order.createdAt = order.createdAt || new Date().toISOString();
  order.statusHistory = order.statusHistory || [{ from: '', to: 'جديد', timestamp: new Date().toISOString() }];
  orders.push(order);
  saveOrders(orders);
}

export function updateOrderStatus(id, status) {
  const orders = getOrders();
  const idx = orders.findIndex(o => o.id === id);
  if (idx === -1) return false;
  const oldStatus = orders[idx].status;
  orders[idx].status = status;
  if (!orders[idx].statusHistory) orders[idx].statusHistory = [];
  orders[idx].statusHistory.push({
    from: oldStatus,
    to: status,
    timestamp: new Date().toISOString(),
  });
  saveOrders(orders);
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

export function deleteOrder(id) {
  const orders = getOrders();
  const filtered = orders.filter(o => o.id !== id);
  if (filtered.length === orders.length) return false;
  writeFileSync(ORDERS_PATH, JSON.stringify(filtered, null, 2), 'utf-8');
  return true;
}

function saveOrders(orders) {
  writeFileSync(ORDERS_PATH, JSON.stringify(orders, null, 2), 'utf-8');
}

export function deleteOrders(ids) {
  const orders = getOrders();
  const filtered = orders.filter(o => !ids.includes(o.id));
  if (filtered.length === orders.length) return false;
  saveOrders(filtered);
  return true;
}

// ---------- Statistics ----------

export function getStats() {
  const orders = getOrders();
  const totalOrders = orders.length;
  const totalSales = orders.reduce((s, o) => s + (o.total || 0), 0);
  const byStatus = {};
  const statuses = ['جديد', 'اتصال 1', 'اتصال 2', 'مؤكد', 'ملغي'];
  statuses.forEach(s => byStatus[s] = 0);
  orders.forEach(o => { if (byStatus[o.status] !== undefined) byStatus[o.status]++; });
  const monthlySales = {};
  orders.forEach(o => {
    const d = new Date(o.createdAt || Date.now());
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    monthlySales[key] = (monthlySales[key] || 0) + (o.total || 0);
  });
  return { totalOrders, totalSales, byStatus, monthlySales };
}

// ---------- Customers ----------

const CUSTOMERS_PATH = join(__dirname, 'data', 'customers.json');

function ensureCustomersFile() {
  if (!existsSync(CUSTOMERS_PATH)) writeFileSync(CUSTOMERS_PATH, '[]', 'utf-8');
}

function getCustomers() {
  ensureCustomersFile();
  return JSON.parse(readFileSync(CUSTOMERS_PATH, 'utf-8'));
}

function saveCustomers(customers) {
  writeFileSync(CUSTOMERS_PATH, JSON.stringify(customers, null, 2), 'utf-8');
}

export function findCustomer(phone) {
  return getCustomers().find(c => c.phone === phone) || null;
}

export function registerCustomer(data) {
  const customers = getCustomers();
  if (customers.find(c => c.phone === data.phone)) return null;
  const customer = {
    phone: data.phone,
    password: createHash('sha256').update(data.password).digest('hex'),
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    addresses: [],
    createdAt: new Date().toISOString(),
  };
  customers.push(customer);
  saveCustomers(customers);
  return customer;
}

export function loginCustomer(phone, password) {
  const hash = createHash('sha256').update(password).digest('hex');
  return getCustomers().find(c => c.phone === phone && c.password === hash) || null;
}

export function addCustomerAddress(phone, address) {
  const customers = getCustomers();
  const c = customers.find(c => c.phone === phone);
  if (!c) return false;
  c.addresses = c.addresses || [];
  c.addresses.push({ ...address, id: Date.now().toString(36) });
  saveCustomers(customers);
  return true;
}

export function getCustomerOrders(phone) {
  return getOrders().filter(o => o.phone === phone);
}
