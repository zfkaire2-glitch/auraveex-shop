const API_BASE = 'https://api.yalidine.app/v1';

export async function calculateDelivery(apiKey, partnerToken, wilaya, price) {
  const res = await fetch(`${API_BASE}/delivery/calculate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      'X-Partner-Token': partnerToken,
    },
    body: JSON.stringify({
      wilaya_id: wilaya,
      price,
      type: 'standard',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Yalidine error: ${res.status} ${text}`);
  }

  return res.json();
}

export async function createShipment(apiKey, partnerToken, order) {
  const res = await fetch(`${API_BASE}/shipments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      'X-Partner-Token': partnerToken,
    },
    body: JSON.stringify({
      order_id: order.id,
      first_name: order.firstName,
      last_name: order.lastName,
      phone: order.phone,
      address: order.address,
      wilaya_id: order.wilayaId,
      commune_id: order.communeId,
      price: order.total,
      products: order.items.map(i => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
      })),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Yalidine error: ${res.status} ${text}`);
  }

  return res.json();
}

export async function trackShipment(apiKey, partnerToken, trackingCode) {
  const res = await fetch(`${API_BASE}/shipments/${trackingCode}`, {
    headers: {
      'X-API-Key': apiKey,
      'X-Partner-Token': partnerToken,
    },
  });

  if (!res.ok) throw new Error(`Yalidine tracking error: ${res.status}`);
  return res.json();
}
