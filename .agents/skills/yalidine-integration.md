# Yalidine Delivery Integration Skill

## Overview
Yalidine is an Algerian delivery/logistics service. This project integrates with Yalidine API for:
- Delivery price calculation (wilaya-based)
- Shipment creation when orders are placed
- Real-time tracking via tracking code

## API Credentials
- `YALIDINE_API_KEY` and `YALIDINE_PARTNER_TOKEN` in `.env`
- Currently disabled (keys are empty strings)
- When enabled, shipments are auto-created on checkout

## Files Involved
- `yalidine.js` — API client (calculateDelivery, createShipment, trackShipment)
- `server.js:295-303` — Shipment creation during checkout
- `server.js:412-422` — Tracking API endpoint (`/api/tracking/:code`)
- `views/orders.ejs` — Tracking display with fallback iframe
- `views/track.ejs` — Public tracking page
- `data/communes.json` — Algerian communes for delivery
- `server.js:42-63` — Wilaya list with IDs 1-58
- `server.js:65-124` — Delivery prices per wilaya (domicile + stopdesk)

## Tracking Flow
1. Order placed → `createShipment()` called → tracking code stored
2. Tracking code displayed in admin panel
3. Frontend calls `/api/tracking/:code` → `trackShipment()` → status history
4. Falls back to Yalidine tracking page iframe if API fails

## Key Endpoints (Yalidine)
- Price calculation: internal price map (no API call for prices)
- Shipment creation: POST to Yalidine API
- Tracking: GET from Yalidine API

## Testing
- Set YALIDINE_API_KEY and YALIDINE_PARTNER_TOKEN in .env
- Place a test order with real address
- Check tracking via `/api/tracking/:code`
