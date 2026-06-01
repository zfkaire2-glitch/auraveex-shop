import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { initSheets, saveOrder, isSheetsReady } from './sheets.js';
import communes from './data/communes.json' with { type: 'json' };
import { calculateDelivery, createShipment } from './yalidine.js';
import * as store from './store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
app.use(express.static(join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'store-secret',
  resave: false,
  saveUninitialized: true,
}));

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

initSheets();

function requireAdmin(req, res, next) {
  if (req.session.admin) return next();
  res.redirect('/admin/login');
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

app.get('/', (_req, res) => {
  const products = store.getProducts();
  const categories = [...new Set(products.map(p => p.category))];
  const featured = products.slice(0, 4);
  res.render('index', {
    products: featured,
    categories,
    cartCount: (_req.session.cart || []).reduce((a, i) => a + i.quantity, 0),
  });
});

app.get('/products', (_req, res) => {
  const products = store.getProducts();
  const category = _req.query.category;
  const filtered = category ? products.filter(p => p.category === category) : products;
  const categories = [...new Set(products.map(p => p.category))];
  res.render('products', {
    products: filtered,
    categories,
    selectedCategory: category || null,
    cartCount: (_req.session.cart || []).reduce((a, i) => a + i.quantity, 0),
  });
});

app.get('/product/:id', (_req, res) => {
  const product = store.getProduct(_req.params.id);
  if (!product) return res.status(404).send('Product not found');
  res.render('product', {
    product,
    cartCount: (_req.session.cart || []).reduce((a, i) => a + i.quantity, 0),
  });
});

app.post('/cart/add', (_req, res) => {
  const product = store.getProduct(_req.body.id);
  if (!product) return res.status(404).json({ error: 'not found' });
  if (!_req.session.cart) _req.session.cart = [];
  const existing = _req.session.cart.find(i => i.id === product.id && i.size === _req.body.size);
  if (existing) {
    existing.quantity += 1;
  } else {
    _req.session.cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0],
      size: _req.body.size || product.sizes[0],
      quantity: 1,
    });
  }
  res.redirect('/cart');
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

app.get('/cart', (_req, res) => {
  const cart = _req.session.cart || [];
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  res.render('cart', {
    cart, subtotal,
    cartCount: cart.reduce((a, i) => a + i.quantity, 0),
  });
});

app.get('/checkout', (_req, res) => {
  const cart = _req.session.cart || [];
  if (cart.length === 0) return res.redirect('/products');
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  res.render('checkout', {
    cart, subtotal, wilayas: WILAYAS, communes,
    deliveryPrices: DELIVERY_PRICES,
    cartCount: cart.reduce((a, i) => a + i.quantity, 0),
  });
});

app.post('/checkout', async (_req, res) => {
  const cart = _req.session.cart || [];
  if (cart.length === 0) return res.redirect('/products');
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
  res.render('order', { order, cartCount: 0 });
});

app.get('/orders', (_req, res) => {
  res.render('orders', {
    orders: _req.session.orders || [],
    cartCount: 0,
  });
});

app.get('/track', (_req, res) => {
  res.render('track', { order: null, query: '', error: null, cartCount: 0 });
});

app.post('/track', (_req, res) => {
  const query = (_req.body.query || '').trim();
  const orders = store.getOrders();
  const order = orders.find(o => o.phone === query);
  res.render('track', {
    order: order || null,
    query,
    error: order ? null : 'طلبك مازال قيد التحضير',
    cartCount: 0,
  });
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
  res.redirect('/admin/orders');
});

app.post('/admin/orders/tracking', requireAdmin, (_req, res) => {
  store.updateOrderTracking(_req.body.id, _req.body.trackingCode);
  res.redirect('/admin/orders');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`E-commerce store running on http://localhost:${PORT}`);
});
