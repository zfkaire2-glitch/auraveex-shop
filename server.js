import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import multer from 'multer';
import cluster from 'cluster';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, appendFileSync, readFileSync, writeFileSync } from 'fs';
import compression from 'compression';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { initSheets, saveOrder, isSheetsReady } from './sheets.js';
import communes from './data/communes.json' with { type: 'json' };
import themeDefaults from './data/theme.json' with { type: 'json' };
import { calculateDelivery, createShipment, trackShipment } from './yalidine.js';
import * as store from './store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

function startWorker() {
  initSheets();

const storage = multer.diskStorage({
  destination: join(__dirname, 'public', 'uploads'),
  filename: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
  },
});
const upload = multer({ storage });

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(compression());

app.use(express.static(join(__dirname, 'public'), {
  maxAge: '1d',
  setHeaders: (res, _path, _stat) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'SAMEORIGIN');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }
}));
app.set('view engine', 'ejs');
app.set('trust proxy', 1);
app.set('views', join(__dirname, 'views'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'store-secret',
  resave: false,
  saveUninitialized: true,
}));

// ---------- Validation helper ----------

function validateRequired(fields, body) {
  const missing = fields.filter(f => !body[f] || !body[f].toString().trim());
  if (missing.length > 0) return 'الحقول التالية مطلوبة: ' + missing.join(', ');
  return null;
}

const YALIDINE_API_KEY = process.env.YALIDINE_API_KEY || '';
const YALIDINE_PARTNER_TOKEN = process.env.YALIDINE_PARTNER_TOKEN || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const WILAYAS = [
  { id: 1, name: 'أدرار' }, { id: 2, name: 'الشلف' }, { id: 3, name: 'الأغواط' },
  { id: 4, name: 'أم البواقي' }, { id: 5, name: 'باتنة' }, { id: 6, name: 'بجاية' },
  { id: 7, name: 'بسكرة' }, { id: 8, name: 'بشار' }, { id: 9, name: 'البليدة' },
  { id: 10, name: 'البويرة' }, { id: 11, name: 'تمنراست' }, { id: 12, name: 'تبسة' },
  { id: 13, name: 'تلمسان' }, { id: 14, name: 'تيارت' }, { id: 15, name: 'تيزي وزو' },
  { id: 16, name: 'الجزائر' }, { id: 17, name: 'الجلفة' }, { id: 18, name: 'جيجل' },
  { id: 19, name: 'سطيف' }, { id: 20, name: 'سعيدة' }, { id: 21, name: 'سكيكدة' },
  { id: 22, name: 'سيدي بلعباس' }, { id: 23, name: 'عنابة' }, { id: 24, name: 'قالمة' },
  { id: 25, name: 'قسنطينة' }, { id: 26, name: 'المدية' }, { id: 27, name: 'مستغانم' },
  { id: 28, name: 'المسيلة' }, { id: 29, name: 'معسكر' }, { id: 30, name: 'ورقلة' },
  { id: 31, name: 'وهران' }, { id: 32, name: 'البيض' }, { id: 33, name: 'إليزي' },
  { id: 34, name: 'برج بوعريريج' }, { id: 35, name: 'بومرداس' }, { id: 36, name: 'الطارف' },
  { id: 37, name: 'تندوف' }, { id: 38, name: 'تيسمسيلت' }, { id: 39, name: 'الوادي' },
  { id: 40, name: 'خنشلة' }, { id: 41, name: 'سوق أهراس' }, { id: 42, name: 'تيبازة' },
  { id: 43, name: 'ميلة' }, { id: 44, name: 'عين الدفلى' }, { id: 45, name: 'النعامة' },
  { id: 46, name: 'عين تموشنت' }, { id: 47, name: 'غرداية' }, { id: 48, name: 'غليزان' },
  { id: 49, name: 'تيميمون' }, { id: 50, name: 'برج باجي مختار' }, { id: 51, name: 'أولاد جلال' },
  { id: 52, name: 'بني عباس' }, { id: 53, name: 'عين صالح' }, { id: 54, name: 'عين قزام' },
  { id: 55, name: 'تقرت' }, { id: 56, name: 'جانت' }, { id: 57, name: 'المغير' },
  { id: 58, name: 'المنيعة' },
];

const DELIVERY_PRICES = {
  "1": { domicile: 1100, stopdesk: 700 },
  "2": { domicile: 700, stopdesk: 400 },
  "3": { domicile: 750, stopdesk: 500 },
  "4": { domicile: 700, stopdesk: 400 },
  "5": { domicile: 700, stopdesk: 400 },
  "6": { domicile: 700, stopdesk: 400 },
  "7": { domicile: 750, stopdesk: 500 },
  "8": { domicile: 900, stopdesk: 600 },
  "9": { domicile: 550, stopdesk: 350 },
  "10": { domicile: 600, stopdesk: 400 },
  "11": { domicile: 1400, stopdesk: 900 },
  "12": { domicile: 700, stopdesk: 400 },
  "13": { domicile: 700, stopdesk: 400 },
  "14": { domicile: 700, stopdesk: 400 },
  "15": { domicile: 600, stopdesk: 350 },
  "16": { domicile: 400, stopdesk: 200 },
  "17": { domicile: 750, stopdesk: 500 },
  "18": { domicile: 700, stopdesk: 400 },
  "19": { domicile: 700, stopdesk: 400 },
  "20": { domicile: 700, stopdesk: 450 },
  "21": { domicile: 700, stopdesk: 450 },
  "22": { domicile: 700, stopdesk: 450 },
  "23": { domicile: 700, stopdesk: 450 },
  "24": { domicile: 700, stopdesk: 450 },
  "25": { domicile: 700, stopdesk: 450 },
  "26": { domicile: 600, stopdesk: 450 },
  "27": { domicile: 700, stopdesk: 450 },
  "28": { domicile: 700, stopdesk: 450 },
  "29": { domicile: 700, stopdesk: 450 },
  "30": { domicile: 800, stopdesk: 500 },
  "31": { domicile: 700, stopdesk: 450 },
  "32": { domicile: 800, stopdesk: 500 },
  "33": { domicile: 1600, stopdesk: 1000 },
  "34": { domicile: 650, stopdesk: 400 },
  "35": { domicile: 550, stopdesk: 400 },
  "36": { domicile: 750, stopdesk: 550 },
  "37": { domicile: 1200, stopdesk: 600 },
  "38": { domicile: 700, stopdesk: 450 },
  "39": { domicile: 800, stopdesk: 600 },
  "40": { domicile: 700, stopdesk: 450 },
  "41": { domicile: 700, stopdesk: 450 },
  "42": { domicile: 550, stopdesk: 450 },
  "43": { domicile: 700, stopdesk: 450 },
  "44": { domicile: 650, stopdesk: 450 },
  "45": { domicile: 800, stopdesk: 500 },
  "46": { domicile: 700, stopdesk: 450 },
  "47": { domicile: 800, stopdesk: 550 },
  "48": { domicile: 700, stopdesk: 450 },
  "49": { domicile: 1100, stopdesk: 600 },
  "50": { domicile: 1300, stopdesk: 600 },
  "51": { domicile: 800, stopdesk: 600 },
  "52": { domicile: 1000, stopdesk: 600 },
  "53": { domicile: 1500, stopdesk: 900 },
  "54": { domicile: null, stopdesk: null },
  "55": { domicile: 800, stopdesk: 500 },
  "56": { domicile: 1600, stopdesk: null },
  "57": { domicile: 800, stopdesk: null },
  "58": { domicile: 800, stopdesk: null },
};

// ---------- Keep-alive (Render, UptimeRobot) ----------

app.get('/ping', (_req, res) => res.send('pong'));

// ---------- Dynamic sitemap ----------

app.get('/sitemap.xml', (_req, res) => {
  const products = store.getProducts();
  const urls = [
    { loc: '/', priority: '1.0' },
    { loc: '/products', priority: '0.9' },
    { loc: '/how', priority: '0.7' },
    { loc: '/track', priority: '0.6' },
    { loc: '/cart', priority: '0.5' },
    { loc: '/login', priority: '0.4' },
    { loc: '/signup', priority: '0.4' },
  ];
  products.forEach(p => {
    urls.push({ loc: '/product/' + p.id, priority: '0.8' });
  });
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => '  <url><loc>https://auraveex-shop.onrender.com' + u.loc + '</loc><priority>' + u.priority + '</priority></url>').join('\n') +
    '\n</urlset>';
  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

app.use((_req, _res, next) => {
  _res.setHeader('X-Content-Type-Options', 'nosniff');
  _res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  _res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  _res.locals.customerPhone = _req.session.customerPhone || null;
  _res.locals.cartCount = (_req.session.cart || []).reduce((a, i) => a + i.quantity, 0);
  _res.locals.currentPath = _req.path;
  _res.locals.pageTitle = null;
  _res.locals.pageDescription = null;
  _res.locals.pageKeywords = null;
  _res.locals.ogTitle = null;
  _res.locals.ogDescription = null;
  _res.locals.ogImage = null;
  _res.locals.canonicalUrl = null;
  _res.locals.baseUrl = `${_req.protocol}://${_req.get('host')}`;
  const activeTheme = getTheme();
  _res.locals.themeCSS = themeCSSVars(activeTheme);
  _res.locals.logoText = activeTheme.logo.type === 'text' ? activeTheme.logo.text : '';
  _res.locals.logoImg = activeTheme.logo.type === 'image' ? activeTheme.logo.image || '' : '';
  _res.locals.favicon = activeTheme.favicon || '';
  _res.locals.heroImage = activeTheme.hero_image || '/uploads/hero-eagle.jpg';
  next();
});

function requireAdmin(req, res, next) {
  if (req.session.admin) return next();
  res.redirect('/admin/login');
}

function getTheme() {
  try {
    return JSON.parse(readFileSync(join(__dirname, 'data', 'theme.json'), 'utf8'));
  } catch { return themeDefaults; }
}

function saveTheme(t) {
  writeFileSync(join(__dirname, 'data', 'theme.json'), JSON.stringify(t, null, 2), 'utf8');
}

function getPages() {
  try {
    return JSON.parse(readFileSync(join(__dirname, 'data', 'pages.json'), 'utf8'));
  } catch { return { homepage: { sections: [] } }; }
}

function savePages(p) {
  writeFileSync(join(__dirname, 'data', 'pages.json'), JSON.stringify(p, null, 2), 'utf8');
}

function themeCSSVars(theme) {
  const c = theme.colors.light;
  const d = theme.colors.dark;
  const f = theme.fonts;
  return `
:root {
  --font-main: ${f.body};
  --font-heading: ${f.heading};
  --font-size-base: ${f.size_base};
  --font-size-heading: ${f.size_heading};
  --bg-primary: ${c.bg_primary};
  --bg-card: ${c.bg_card};
  --bg-dark: ${c.navbar_bg};
  --bg-dark-hover: ${c.navbar_text_hover};
  --bg: ${c.bg_card};
  --text-primary: ${c.text_primary};
  --text-secondary: ${c.text_secondary};
  --text-muted: ${c.text_muted};
  --text-light: ${c.navbar_text};
  --text: ${c.text_primary};
  --border-light: ${c.border_light};
  --border-dark: ${c.navbar_bg};
  --border: ${c.border_light};
  --btn-text: ${c.navbar_text};
  --accent: ${c.accent};
  --accent-hover: ${c.accent_hover};
  --footer-bg: ${c.footer_bg};
  --radius-sm: ${c.radius_sm};
  --radius-md: ${c.radius};
  --radius-lg: ${c.radius};
  --radius-xl: ${c.radius};
  --shadow-sm: 0 2px 8px rgba(0,0,0,.05);
  --shadow-md: 0 4px 16px rgba(0,0,0,.08);
  --shadow-lg: 0 12px 32px rgba(0,0,0,.12);
  --transition: all .3s cubic-bezier(.4,0,.2,1);
}
html[data-theme="dark"] {
  --bg-primary: ${d.bg_primary};
  --bg-card: ${d.bg_card};
  --bg-dark: ${d.navbar_bg};
  --bg-dark-hover: ${d.navbar_text_hover};
  --bg: ${d.bg_card};
  --text-primary: ${d.text_primary};
  --text-secondary: ${d.text_secondary};
  --text-muted: ${d.text_muted};
  --text-light: ${d.navbar_text};
  --text: ${d.text_primary};
  --border-light: ${d.border_light};
  --border-dark: ${d.navbar_bg};
  --border: ${d.border_light};
  --btn-text: ${d.navbar_text};
  --accent: ${d.accent};
  --accent-hover: ${d.accent_hover};
  --radius-sm: ${d.radius_sm};
  --radius-md: ${d.radius};
  --radius-lg: ${d.radius};
  --radius-xl: ${d.radius};
  --shadow-sm: 0 2px 8px rgba(0,0,0,.3);
  --shadow-md: 0 4px 16px rgba(0,0,0,.4);
  --shadow-lg: 0 12px 32px rgba(0,0,0,.5);
  --transition: all .3s cubic-bezier(.4,0,.2,1);
}`;
}

// ---------- Public routes ----------

app.get('/debug', (_req, res) => {
  res.json({
    sheetsReady: isSheetsReady(),
    keyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || 'NOT SET',
    sheetId: process.env.GOOGLE_SHEET_ID ? (process.env.GOOGLE_SHEET_ID.slice(0, 8) + '...') : 'NOT SET',
    nodeVersion: process.version,
    env: process.env.NODE_ENV || 'not set',
  });
});

app.get('/debug/test-sheet', async (_req, res) => {
  const result = await saveOrder({
    id: 'TEST-' + Date.now(),
    firstName: 'test',
    lastName: 'test',
    phone: '0555000000',
    address: 'test address',
    wilaya: 'test',
    wilayaId: 0,
    commune: 'test',
    items: [{ name: 'test item', quantity: 1, price: 100 }],
    subtotal: 100,
    deliveryPrice: 0,
    total: 100,
    status: 'جديد',
    trackingCode: null,
  });
  res.json({ saved: result, sheetsReady: isSheetsReady() });
});

app.get('/debug/backfill', async (_req, res) => {
  const orders = store.getOrders();
  let ok = 0, fail = 0;
  for (const order of orders) {
    const r = await saveOrder(order);
    if (r) ok++; else fail++;
  }
  res.json({ total: orders.length, saved: ok, failed: fail });
});

app.get('/', (_req, res) => {
  const products = store.getProducts();
  const categories = [...new Set(products.map(p => p.category))];
  const featured = products.slice(0, 4);
  const pages = getPages();
  const sections = pages.homepage?.sections || [];
  res.render('index', {
    pageTitle: 'الرئيسية',
    pageDescription: 'AURA VEEX — متجر ألبسة جزائرية متخصص في الأطقم الأوفر سايز والستريت وير المستوردة. جودة عالية، أسعار منافسة، توصيل عبر Yalidine لجميع ولايات الجزائر.',
    products: featured,
    categories,
    sections,
    cartCount: (_req.session.cart || []).reduce((a, i) => a + i.quantity, 0),
  });
});

app.get('/products', (_req, res) => {
  const products = store.getProducts();
  const category = _req.query.category;
  const minPrice = parseFloat(_req.query.minPrice) || 0;
  const maxPrice = parseFloat(_req.query.maxPrice) || Infinity;
  const size = _req.query.size || '';
  let filtered = category ? products.filter(p => p.category === category) : products;
  filtered = filtered.filter(p => p.price >= minPrice && p.price <= maxPrice);
  if (size) filtered = filtered.filter(p => p.sizes && p.sizes.includes(size));
  const categories = [...new Set(products.map(p => p.category))];
  const allSizes = [...new Set(products.flatMap(p => p.sizes || []))];
  const catDesc = category ? ' — ' + category : '';
  res.render('products', {
    pageTitle: 'المنتجات' + catDesc,
    pageDescription: 'تصفح أحدث تشكيلة AURA VEEX من الأطقم الأوفر سايز والستريت وير المستوردة بجودة عالية' + (category ? ' في قسم ' + category : ''),
    products: filtered,
    categories,
    allSizes,
    selectedCategory: category || null,
    minPrice: _req.query.minPrice || '',
    maxPrice: _req.query.maxPrice || '',
    selectedSize: size,
    cartCount: (_req.session.cart || []).reduce((a, i) => a + i.quantity, 0),
  });
});

app.get('/product/:id', (_req, res) => {
  const product = store.getProduct(_req.params.id);
  if (!product) return res.status(404).send('Product not found');
  const all = store.getProducts();
  const suggested = all
    .filter(p => p.category === product.category && p.id !== product.id)
    .slice(0, 4);
  const baseUrl = res.locals.baseUrl;
  res.render('product', {
    pageTitle: product.name,
    pageDescription: (product.description || '').slice(0, 160),
    ogImage: product.images && product.images[0] ? (product.images[0].startsWith('/') ? baseUrl + product.images[0] : product.images[0]) : baseUrl + '/uploads/hero-eagle.jpg',
    canonicalUrl: baseUrl + '/product/' + product.id,
    product,
    suggested,
    cartCount: (_req.session.cart || []).reduce((a, i) => a + i.quantity, 0),
  });
});

app.post('/cart/add', (_req, res) => {
  const product = store.getProduct(_req.body.id);
  if (!product) return res.status(404).json({ error: 'not found' });
  if (!_req.session.cart) _req.session.cart = [];
  const existing = _req.session.cart.find(i => i.id === product.id && i.size === _req.body.size);
  const qty = parseInt(_req.body.quantity) || 1;
  if (existing) {
    existing.quantity += qty;
  } else {
    _req.session.cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0],
      size: _req.body.size || product.sizes[0],
      quantity: qty,
    });
  }
  res.redirect('/cart');
});

// Buy now: add to cart and go to checkout
app.post('/cart/buy', (_req, res) => {
  const product = store.getProduct(_req.body.id);
  if (!product) return res.redirect('/products');
  if (!_req.session.cart) _req.session.cart = [];
  const existing = _req.session.cart.find(i => i.id === product.id && i.size === _req.body.size);
  const qty = parseInt(_req.body.quantity) || 1;
  if (existing) {
    existing.quantity += qty;
  } else {
    _req.session.cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0],
      size: _req.body.size || product.sizes[0],
      quantity: qty,
    });
  }
  res.redirect('/checkout');
});

app.post('/cart/update', (_req, res) => {
  const { id, size, quantity } = _req.body;
  if (!_req.session.cart) return res.redirect('/cart');
  const item = _req.session.cart.find(i => i.id === id && i.size === size);
  if (item) {
    if (quantity <= 0) {
      _req.session.cart = _req.session.cart.filter(i => !(i.id === id && i.size === size));
    } else {
      item.quantity = parseInt(quantity);
    }
  }
  res.redirect('/cart');
});

app.post('/api/cart/update', (_req, res) => {
  const { id, size, quantity } = _req.body;
  if (!_req.session.cart) return res.json({ error: 'no cart' });
  if (quantity <= 0) {
    _req.session.cart = _req.session.cart.filter(i => !(i.id === id && i.size === size));
  } else {
    const item = _req.session.cart.find(i => i.id === id && i.size === size);
    if (item) item.quantity = parseInt(quantity);
  }
  const cart = _req.session.cart || [];
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  res.json({ ok: true, cart, subtotal, cartCount: cart.reduce((a, i) => a + i.quantity, 0) });
});

app.get('/cart', (_req, res) => {
  const cart = _req.session.cart || [];
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  res.render('cart', {
    pageTitle: 'سلة التسوق',
    cart, subtotal,
    cartCount: cart.reduce((a, i) => a + i.quantity, 0),
  });
});

app.get('/checkout', (_req, res) => {
  const cart = _req.session.cart || [];
  if (cart.length === 0) return res.redirect('/products');
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  res.render('checkout', {
    pageTitle: 'إتمام الشراء',
    cart, subtotal, wilayas: WILAYAS, communes,
    deliveryPrices: DELIVERY_PRICES,
    cartCount: cart.reduce((a, i) => a + i.quantity, 0),
  });
});

app.post('/checkout', async (_req, res) => {
  const cart = _req.session.cart || [];
  if (cart.length === 0) return res.redirect('/products');
  const validationError = validateRequired(['firstName', 'lastName', 'phone', 'wilaya', 'commune', 'address'], _req.body);
  if (validationError) {
    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    return res.render('checkout', { pageTitle: 'إتمام الشراء', error: validationError, cart, subtotal, wilayas: WILAYAS, communes, deliveryPrices: DELIVERY_PRICES, cartCount: cart.reduce((a, i) => a + i.quantity, 0) });
  }
  if (!/^0[0-9]{9}$/.test(_req.body.phone)) {
    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    return res.render('checkout', { pageTitle: 'إتمام الشراء', error: 'رقم هاتف غير صحيح', cart, subtotal, wilayas: WILAYAS, communes, deliveryPrices: DELIVERY_PRICES, cartCount: cart.reduce((a, i) => a + i.quantity, 0) });
  }
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const wilayaId = parseInt(_req.body.wilaya);
  const dp = DELIVERY_PRICES[wilayaId];
  const deliveryPrice = dp && dp.domicile ? dp.domicile : 0;
  const total = subtotal + deliveryPrice;
  const orderId = 'ORD-' + uuidv4().slice(0, 8).toUpperCase();

  let trackingCode = null;
  if (YALIDINE_API_KEY && YALIDINE_PARTNER_TOKEN) {
    try {
      const shipment = await createShipment(YALIDINE_API_KEY, YALIDINE_PARTNER_TOKEN, {
        id: orderId, firstName: _req.body.firstName, lastName: _req.body.lastName,
        phone: _req.body.phone, address: _req.body.address,
        wilayaId, total: subtotal, items: cart,
      });
      trackingCode = shipment.tracking_code || null;
    } catch (err) { console.error('Yalidine error:', err.message); }
  }

  const wilayaName = WILAYAS.find(w => w.id === wilayaId)?.name || _req.body.wilaya;
  const order = {
    id: orderId, firstName: _req.body.firstName, lastName: _req.body.lastName,
    phone: _req.body.phone, address: _req.body.address, wilaya: wilayaName,
    wilayaId, commune: _req.body.commune || '',
    items: [...cart], subtotal, deliveryPrice, total, status: 'جديد', trackingCode,
  };

  await saveOrder(order);
  store.addOrder(order);
  if (!_req.session.orders) _req.session.orders = [];
  _req.session.orders.push(order);
  _req.session.cart = [];
  res.redirect('/thank-you?order=' + order.id);
});

app.get('/thank-you', (_req, res) => {
  const orderId = _req.query.order;
  if (!orderId) return res.redirect('/');
  const order = store.getOrders().find(o => o.id === orderId);
  if (!order) return res.redirect('/');
  res.render('order', { order, cartCount: 0 });
});

app.get('/orders', (_req, res) => {
  res.render('orders', {
    pageTitle: 'طلباتي',
    orders: _req.session.orders || [],
    cartCount: 0,
  });
});

app.get('/track', (_req, res) => {
  res.render('track', { pageTitle: 'تتبع طلبك', order: null, query: '', error: null, cartCount: 0 });
});

app.post('/track', (_req, res) => {
  const query = (_req.body.query || '').trim();
  const orders = store.getOrders();
  const order = orders.find(o => o.phone === query);
  res.render('track', {
    pageTitle: 'تتبع طلبك',
    order: order || null,
    query,
    error: order ? null : 'طلبك مازال قيد التحضير',
    cartCount: 0,
  });
});

app.get('/how', (_req, res) => {
  res.render('how', { pageTitle: 'كيفية العمل', cartCount: (_req.session.cart || []).reduce((a, i) => a + i.quantity, 0) });
});

// ---------- Customer Auth ----------

function cartCount(req) {
  return (req.session.cart || []).reduce((a, i) => a + i.quantity, 0);
}

app.get('/signup', (_req, res) => {
  res.render('signup', { pageTitle: 'إنشاء حساب', error: null, cartCount: cartCount(_req) });
});

app.post('/signup', (_req, res) => {
  const { phone, password, firstName, lastName } = _req.body;
  if (!phone || !password) return res.render('signup', { pageTitle: 'إنشاء حساب', error: 'رقم الهاتف وكلمة السر مطلوبان', cartCount: cartCount(_req) });
  const existing = store.findCustomer(phone);
  if (existing) return res.render('signup', { pageTitle: 'إنشاء حساب', error: 'هذا الرقم مسجل بالفعل', cartCount: cartCount(_req) });
  store.registerCustomer({ phone, password, firstName, lastName });
  _req.session.customerPhone = phone;
  res.redirect('/account');
});

app.get('/login', (_req, res) => {
  res.render('login', { pageTitle: 'تسجيل الدخول', error: null, cartCount: cartCount(_req) });
});

app.post('/login', (_req, res) => {
  const { phone, password } = _req.body;
  const customer = store.loginCustomer(phone, password);
  if (!customer) return res.render('login', { pageTitle: 'تسجيل الدخول', error: 'رقم الهاتف أو كلمة السر خطأ', cartCount: cartCount(_req) });
  _req.session.customerPhone = phone;
  res.redirect('/account');
});

app.get('/logout', (_req, res) => {
  _req.session.customerPhone = null;
  res.redirect('/');
});

app.get('/account', (_req, res) => {
  if (!_req.session.customerPhone) return res.redirect('/login');
  const customer = store.findCustomer(_req.session.customerPhone);
  if (!customer) { _req.session.customerPhone = null; return res.redirect('/login'); }
  const orders = store.getCustomerOrders(_req.session.customerPhone);
  res.render('account', { pageTitle: 'حسابي', customer, orders, wilayas: WILAYAS, cartCount: cartCount(_req) });
});

app.post('/account/address', (_req, res) => {
  if (!_req.session.customerPhone) return res.redirect('/login');
  store.addCustomerAddress(_req.session.customerPhone, {
    label: _req.body.label || 'الرئيسي',
    wilaya: _req.body.wilaya,
    commune: _req.body.commune,
    address: _req.body.address,
  });
  res.redirect('/account');
});

// ---------- Admin Stats ----------

app.get('/admin/stats', requireAdmin, (_req, res) => {
  const stats = store.getStats();
  res.render('admin/stats', { stats });
});

app.get('/api/tracking/:code', async (_req, res) => {
  if (!YALIDINE_API_KEY || !YALIDINE_PARTNER_TOKEN) {
    return res.json({ available: false, error: 'مفاتيح Yalidine غير مفعلة' });
  }
  try {
    const data = await trackShipment(YALIDINE_API_KEY, YALIDINE_PARTNER_TOKEN, _req.params.code);
    res.json({ available: true, data });
  } catch (err) {
    res.json({ available: false, error: err.message });
  }
});

// ---------- Admin routes ----------

app.get('/admin/login', (_req, res) => {
  res.render('admin/login', { error: null });
});

app.post('/admin/login', (_req, res) => {
  if (_req.body.password === ADMIN_PASSWORD) {
    _req.session.admin = true;
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: 'كلمة السر خطأ' });
});

app.get('/admin/logout', (_req, res) => {
  _req.session.admin = false;
  res.redirect('/admin/login');
});

app.get('/admin', requireAdmin, (_req, res) => {
  const products = store.getProducts();
  const categories = [...new Set(products.map(p => p.category))];
  res.render('admin/dashboard', { products, categories });
});

app.get('/admin/products/add', requireAdmin, (_req, res) => {
  res.render('admin/product-form', { product: null, categories: [] });
});

app.post('/admin/products/add', requireAdmin, upload.array('images'), (_req, res) => {
  const data = { ..._req.body };
  if (_req.files && _req.files.length > 0) {
    data.images = _req.files.map(f => '/uploads/' + f.filename);
  }
  store.addProduct(data);
  res.redirect('/admin');
});

app.get('/admin/products/edit/:id', requireAdmin, (_req, res) => {
  const product = store.getProduct(_req.params.id);
  if (!product) return res.status(404).send('Product not found');
  const existing = store.getProducts();
  const categories = [...new Set(existing.map(p => p.category))];
  res.render('admin/product-form', { product, categories });
});

app.post('/admin/products/edit/:id', requireAdmin, upload.array('images'), (_req, res) => {
  const data = { ..._req.body };
  if (_req.files && _req.files.length > 0) {
    data.images = _req.files.map(f => '/uploads/' + f.filename);
  }
  store.updateProduct(_req.params.id, data);
  res.redirect('/admin');
});

app.post('/admin/products/delete/:id', requireAdmin, (_req, res) => {
  store.deleteProduct(_req.params.id);
  res.redirect('/admin');
});

app.get('/admin/orders', requireAdmin, (_req, res) => {
  const orders = store.getOrders().reverse();
  const statuses = ['جديد', 'اتصال 1', 'اتصال 2', 'مؤكد', 'ملغي'];
  res.render('admin/orders', { orders, statuses });
});

app.post('/admin/orders/status', requireAdmin, (_req, res) => {
  store.updateOrderStatus(_req.body.id, _req.body.status);
  const order = store.getOrders().find(o => o.id === _req.body.id);
  if (order && YALIDINE_API_KEY) {
    try {
      const msg = 'مرحباً ' + order.firstName + '! تم تحديث حالة طلبك ' + order.id + ' إلى: ' + order.status;
      console.log('[WA NOTIFICATION]', msg);
    } catch (e) { /* ignore */ }
  }
  res.redirect('/admin/orders');
});

app.post('/admin/orders/tracking', requireAdmin, (_req, res) => {
  store.updateOrderTracking(_req.body.id, _req.body.trackingCode);
  res.redirect('/admin/orders');
});

app.post('/admin/orders/delete/:id', requireAdmin, (_req, res) => {
  store.deleteOrder(_req.params.id);
  res.redirect('/admin/orders');
});

app.post('/admin/orders/delete-batch', requireAdmin, (_req, res) => {
  const ids = _req.body.ids || [];
  if (ids.length > 0) store.deleteOrders(Array.isArray(ids) ? ids : [ids]);
  res.redirect('/admin/orders');
});

// ---------- PDF Invoice ----------

app.get('/admin/orders/:id/invoice', requireAdmin, (_req, res) => {
  const orders = store.getOrders();
  const order = orders.find(o => o.id === _req.params.id);
  if (!order) return res.status(404).send('Order not found');

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=invoice-' + order.id + '.pdf');
  doc.pipe(res);

  doc.fontSize(24).font('Helvetica-Bold').text('AURA VEEX', { align: 'center' });
  doc.fontSize(10).font('Helvetica').text('متجر ألبسة جزائرية', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(12).font('Helvetica-Bold').text('فاتورة - ' + order.id, { align: 'center' });
  doc.moveDown();

  doc.fontSize(10).font('Helvetica');
  doc.text('التاريخ: ' + new Date(order.createdAt || Date.now()).toLocaleDateString('ar-DZ'));
  doc.text('العميل: ' + (order.firstName || '') + ' ' + (order.lastName || ''));
  doc.text('الهاتف: ' + (order.phone || ''));
  doc.text('العنوان: ' + (order.address || '') + (order.commune ? '، ' + order.commune : '') + (order.wilaya ? '، ' + order.wilaya : ''));
  doc.moveDown();

  doc.fontSize(10).font('Helvetica-Bold');
  const headerX = 50;
  doc.text('المنتج', headerX, doc.y, { width: 250 });
  doc.text('الكمية', headerX + 260, doc.y, { width: 60, align: 'center' });
  doc.text('السعر', headerX + 330, doc.y, { width: 100, align: 'left' });
  doc.moveDown(0.3);
  doc.moveTo(headerX, doc.y).lineTo(525, doc.y).stroke();
  doc.moveDown(0.3);

  doc.font('Helvetica');
  if (order.items) {
    order.items.forEach(item => {
      doc.text(item.name || '', headerX, doc.y, { width: 250 });
      doc.text('x' + (item.quantity || 0), headerX + 260, doc.y - 15, { width: 60, align: 'center' });
      doc.text((item.price || 0).toLocaleString() + ' د.ج', headerX + 330, doc.y - 15, { width: 100, align: 'left' });
    });
  }
  doc.moveDown();
  doc.moveTo(headerX, doc.y).stroke();
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold');
  doc.text('المجموع الفرعي: ' + (order.subtotal || 0).toLocaleString() + ' د.ج', { align: 'left' });
  if (order.deliveryPrice) doc.text('التوصيل: ' + order.deliveryPrice.toLocaleString() + ' د.ج', { align: 'left' });
  doc.fontSize(14).text('المجموع: ' + (order.total || 0).toLocaleString() + ' د.ج', { align: 'left' });
  doc.fontSize(9).font('Helvetica').fillColor('#888').text('الدولة: الجزائر | الدفع عند الاستلام', 50, 750, { align: 'center' });

  doc.end();
});

// ---------- XLSX Sales Report ----------

app.get('/admin/export/sales', requireAdmin, async (_req, res) => {
  const orders = store.getOrders();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('المبيعات');

  sheet.columns = [
    { header: 'رقم الطلب', key: 'id', width: 20 },
    { header: 'العميل', key: 'customer', width: 25 },
    { header: 'الهاتف', key: 'phone', width: 15 },
    { header: 'الولاية', key: 'wilaya', width: 15 },
    { header: 'المنتجات', key: 'items', width: 40 },
    { header: 'المجموع', key: 'total', width: 15 },
    { header: 'الحالة', key: 'status', width: 12 },
    { header: 'التاريخ', key: 'date', width: 20 },
  ];

  orders.forEach(o => {
    sheet.addRow({
      id: o.id,
      customer: (o.firstName || '') + ' ' + (o.lastName || ''),
      phone: o.phone || '',
      wilaya: o.wilaya || '',
      items: (o.items || []).map(i => i.name + ' x' + i.quantity).join(', '),
      total: (o.total || 0) + ' د.ج',
      status: o.status || '',
      date: o.createdAt ? new Date(o.createdAt).toLocaleDateString('ar-DZ') : '',
    });
  });

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' }, bgColor: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=sales-report-' + new Date().toISOString().slice(0, 10) + '.xlsx');
  res.send(buffer);
});

// ---------- Theme Customizer ----------

app.get('/admin/theme', requireAdmin, (_req, res) => {
  const theme = getTheme();
  res.render('admin/theme', { pageTitle: 'تخصيص الثيم', theme, success: null });
});

app.post('/admin/theme', requireAdmin, (_req, res) => {
  const t = getTheme();
  if (_req.body.logo_type) t.logo.type = _req.body.logo_type;
  if (_req.body.logo_text) t.logo.text = _req.body.logo_text;
  if (_req.body.logo_image) t.logo.image = _req.body.logo_image;
  if (_req.body.favicon) t.favicon = _req.body.favicon;
  if (_req.body.hero_image) t.hero_image = _req.body.hero_image;
  if (_req.body.font_body) t.fonts.body = _req.body.font_body;
  if (_req.body.font_heading) t.fonts.heading = _req.body.font_heading;
  if (_req.body.font_size_base) t.fonts.size_base = _req.body.font_size_base;
  if (_req.body.font_size_heading) t.fonts.size_heading = _req.body.font_size_heading;
  if (_req.body.theme_label) t.label = _req.body.theme_label;
  // Light colors
  const lc = t.colors.light;
  if (_req.body.light_bg_primary) lc.bg_primary = _req.body.light_bg_primary;
  if (_req.body.light_bg_card) lc.bg_card = _req.body.light_bg_card;
  if (_req.body.light_text_primary) lc.text_primary = _req.body.light_text_primary;
  if (_req.body.light_text_secondary) lc.text_secondary = _req.body.light_text_secondary;
  if (_req.body.light_text_muted) lc.text_muted = _req.body.light_text_muted;
  if (_req.body.light_border_light) lc.border_light = _req.body.light_border_light;
  if (_req.body.light_accent) lc.accent = _req.body.light_accent;
  if (_req.body.light_accent_hover) lc.accent_hover = _req.body.light_accent_hover;
  if (_req.body.light_navbar_bg) lc.navbar_bg = _req.body.light_navbar_bg;
  if (_req.body.light_navbar_text) lc.navbar_text = _req.body.light_navbar_text;
  if (_req.body.light_navbar_text_hover) lc.navbar_text_hover = _req.body.light_navbar_text_hover;
  if (_req.body.light_footer_bg) lc.footer_bg = _req.body.light_footer_bg;
  if (_req.body.light_radius) lc.radius = _req.body.light_radius;
  if (_req.body.light_radius_sm) lc.radius_sm = _req.body.light_radius_sm;
  // Dark colors
  const dc = t.colors.dark;
  if (_req.body.dark_bg_primary) dc.bg_primary = _req.body.dark_bg_primary;
  if (_req.body.dark_bg_card) dc.bg_card = _req.body.dark_bg_card;
  if (_req.body.dark_text_primary) dc.text_primary = _req.body.dark_text_primary;
  if (_req.body.dark_text_secondary) dc.text_secondary = _req.body.dark_text_secondary;
  if (_req.body.dark_text_muted) dc.text_muted = _req.body.dark_text_muted;
  if (_req.body.dark_border_light) dc.border_light = _req.body.dark_border_light;
  if (_req.body.dark_accent) dc.accent = _req.body.dark_accent;
  if (_req.body.dark_accent_hover) dc.accent_hover = _req.body.dark_accent_hover;
  if (_req.body.dark_navbar_bg) dc.navbar_bg = _req.body.dark_navbar_bg;
  if (_req.body.dark_navbar_text) dc.navbar_text = _req.body.dark_navbar_text;
  if (_req.body.dark_navbar_text_hover) dc.navbar_text_hover = _req.body.dark_navbar_text_hover;
  if (_req.body.dark_footer_bg) dc.footer_bg = _req.body.dark_footer_bg;
  if (_req.body.dark_radius) dc.radius = _req.body.dark_radius;
  if (_req.body.dark_radius_sm) dc.radius_sm = _req.body.dark_radius_sm;
  saveTheme(t);
  res.render('admin/theme', { pageTitle: 'تخصيص الثيم', theme: t, success: '✅ تم حفظ الثيم بنجاح' });
});

// ---------- Page Builder ----------

app.get('/admin/builder', requireAdmin, (_req, res) => {
  const pages = getPages();
  const sections = pages.homepage?.sections || [];
  res.render('admin/builder', {
    pageTitle: 'Page Builder',
    sections,
  });
});

app.get('/admin/builder/preview', (_req, res) => {
  const products = store.getProducts();
  const categories = [...new Set(products.map(p => p.category))];
  const featured = products.slice(0, 4);
  const pages = getPages();
  const sections = pages.homepage?.sections || [];
  res.render('admin/builder-preview', {
    pageTitle: 'معاينة',
    products: featured,
    categories,
    sections,
    cartCount: 0,
  });
});

app.post('/admin/builder/save', requireAdmin, (_req, res) => {
  const pages = getPages();
  if (_req.body.sections) {
    pages.homepage = pages.homepage || {};
    pages.homepage.sections = _req.body.sections;
    savePages(pages);
    res.json({ success: true });
  } else {
    res.json({ success: false, error: 'No sections data' });
  }
});

// ---------- robots.txt ----------

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(`# robots.txt
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /private/

Sitemap: https://auraveex-shop.onrender.com/sitemap.xml
`);
});

// ---------- 404 ----------

app.use((_req, res) => {
  res.status(404).send('الصفحة غير موجودة');
});

// ---------- Error handler ----------

app.use((err, _req, res, _next) => {
  const logMsg = new Date().toISOString() + ' ' + (err.stack || err.message) + '\n';
  console.error(logMsg);
  try { appendFileSync(join(__dirname, 'error.log'), logMsg); } catch (e) { console.error('Log write failed', e); }
  res.status(500).send('خطأ: ' + (err.message || 'غير معروف'));
});

app.listen(PORT, () => {
  console.log(`Worker ${process.pid} running on http://localhost:${PORT}`);
  // Self-ping every 5 min to prevent Render sleep
  const selfUrl = process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + PORT;
  setInterval(() => {
    fetch(selfUrl + '/ping')
      .then(() => console.log('Self-ping OK'))
      .catch(() => {});
  }, 5 * 60 * 1000);
  console.log('Self-ping ' + selfUrl + '/ping every 5 min');
});
}

// ---------- Master / Primary process (disabled by default on low-memory hosts like Render free) ----------

const WORKERS = parseInt(process.env.CLUSTER_WORKERS || '0');

if (cluster.isPrimary && WORKERS > 0) {
  console.log(`Master ${process.pid} spawning ${WORKERS} worker(s)`);
  for (let i = 0; i < WORKERS; i++) cluster.fork();
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died (${signal || code}), restarting...`);
    cluster.fork();
  });
} else {
  startWorker();
}

