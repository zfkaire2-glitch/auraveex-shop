import { google } from 'googleapis';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let sheetsClient = null;

export function initSheets() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyPath || !existsSync(keyPath)) {
    console.log('Google Sheets: No service account key found, skipping.');
    return false;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheetsClient = google.sheets({ version: 'v4', auth });
    console.log('Google Sheets connected.');
    return true;
  } catch (err) {
    console.warn('Google Sheets init failed:', err.message);
    return false;
  }
}

export async function saveOrder(order) {
  if (!sheetsClient) return false;

  try {
    // Ensure headers
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Orders!A1:N1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['معرف الطلب', 'الاسم', 'اللقب', 'الهاتف', 'العنوان', 'الولاية', 'البلدية', 'المنتجات', 'المجموع الفرعي', 'التوصيل', 'المجموع الكلي', 'الحالة', 'رمز التتبع', 'التاريخ']],
      },
    }).catch(() => {}); // ignore if sheet doesn't exist yet

    const values = [[
      order.id,
      order.firstName,
      order.lastName,
      order.phone,
      order.address,
      order.wilaya,
      order.commune || '',
      order.items.map(i => `${i.name} x${i.quantity}`).join(', '),
      order.subtotal || order.total,
      order.deliveryPrice || 0,
      order.total,
      order.status || 'جديد',
      order.trackingCode || '',
      new Date().toISOString(),
    ]];

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Orders!A2:N',
      valueInputOption: 'RAW',
      requestBody: { values },
    });
    return true;
  } catch (err) {
    console.warn('Sheets save failed:', err.message);
    return false;
  }
}
