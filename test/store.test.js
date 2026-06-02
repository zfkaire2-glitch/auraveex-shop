import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../store.js';

describe('store.getProducts', () => {
  let products;
  before(() => { products = store.getProducts(); });

  it('returns an array', () => {
    assert.ok(Array.isArray(products));
  });

  it('contains at least one product', () => {
    assert.ok(products.length > 0);
  });

  it('each product has required fields', () => {
    products.forEach(p => {
      assert.ok(p.id);
      assert.ok(p.name);
      assert.ok(typeof p.price === 'number');
      assert.ok(Array.isArray(p.images));
      assert.ok(Array.isArray(p.sizes));
    });
  });
});

describe('store.getProduct', () => {
  let products;
  before(() => { products = store.getProducts(); });

  it('returns a product by id', () => {
    if (products.length > 0) {
      const p = store.getProduct(products[0].id);
      assert.ok(p);
      assert.equal(p.id, products[0].id);
    }
  });

  it('returns null for unknown id', () => {
    assert.equal(store.getProduct('nonexistent'), null);
  });
});

describe('store.getStats', () => {
  it('returns stats object with required keys', () => {
    const stats = store.getStats();
    assert.ok(typeof stats.totalOrders === 'number');
    assert.ok(typeof stats.totalSales === 'number');
    assert.ok(stats.byStatus);
    assert.ok(stats.monthlySales);
  });
});

describe('store.getOrders', () => {
  it('returns an array', () => {
    const orders = store.getOrders();
    assert.ok(Array.isArray(orders));
  });
});
