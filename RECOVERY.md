# دليل استرجاع مشروع AURA VEEX

> فقط قول **"رجع السيت"** واتبع الخطوات تحت.

---

## 1. المتطلبات الأساسية

| الحاجة | فين تحصلها |
|--------|-----------|
| **Node.js** | https://nodejs.org (حمل LTS version) |
| **Git** | https://git-scm.com (اختياري، تحميل عادي) |
| **Code Editor** | VS Code أو أي محرر |
| **Google Chrome** | اختياري |

---

## 2. تحميل المشروع

### الطريقة 1 — من GitHub (أفضل)
```bash
git clone https://github.com/zfkaire2-glitch/auraveex-shop.git
cd auraveex-shop
```

### الطريقة 2 — من الـ ZIP
- فك الضغط عن `auraveex-shop.zip`
- افتح المجلد في terminal

---

## 3. تثبيت الاعتماديات
```bash
npm install
```

---

## 4. ملف `.env` (ضروري جداً)

أنشئ ملف `.env` في جذر المشروع واحط فيه هذا المحتوى:

```env
PORT=3000
SESSION_SECRET=change-this-to-a-random-secret

# Admin Panel Password
ADMIN_PASSWORD=admin123

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_KEY=C:\Users\ZAKI\AppData\Local\Temp\opencode\ecommerce\vaulted-sector-498115-q5-696eb91d9a54.json
GOOGLE_SHEET_ID=1a2X0D-5s0eFrpDUof_P9gK20A0_6MZNDmXSPrEahEzY

# Yalidine API (اختياري)
# YALIDINE_API_KEY=your-yalidine-api-key
# YALIDINE_PARTNER_TOKEN=your-yalidine-partner-token

# Telegram Bot (اختياري)
# TELEGRAM_BOT_TOKEN=your-bot-token
# TELEGRAM_CHAT_ID=your-chat-id
# TELEGRAM_POLL_INTERVAL=30000

# Meta Pixel (اختياري)
META_PIXEL_ID=998739902533746
```

> ⚠️ **إذا غيرت مكان المجلد** → عدل المسار تاع `GOOGLE_SERVICE_ACCOUNT_KEY` باش يشير للمكان الجديد تاع `vaulted-sector-*.json`.

---

## 5. Google Service Account Key

الملف `vaulted-sector-498115-q5-696eb91d9a54.json` لازم يكون في نفس المكان اللي يشير إليه `.env`.

إذا نقلت المشروع → انسخ هذا الملف مع `.env` وعدل المسار في `.env`.

---

## 6. تشغيل السيرفر

```bash
node server.js
```

السيرفر يشتغل على: **http://localhost:3000**

### أوامر مفيدة
| الأمر | واش يسوي |
|------|---------|
| `node server.js` | تشغيل عادي |
| `node --watch server.js` | تشغيل مع auto-restart (للتطوير) |
| `Get-Process node \| Stop-Process` | يقتل السيرفر (قبل إعادة التشغيل) |
| `node --test` | يشغل الاختبارات |

---

## 7. تشغيل بوت تلغرام (اختياري)

في نافذة terminal منفصلة:
```bash
node telegram-bot.js
```

> يتطلب `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` في `.env`

---

## 8. رفع على Render (إنتاج)

### عبر git push (أوتوماتيكي)
```bash
git add -A
git commit -m "update"
git push origin master
```

### يدوياً
1. روح لـ https://dashboard.render.com
2. اختر **New Web Service**
3. ارتبط بـ GitHub repo: `zfkaire2-glitch/auraveex-shop`
4. **Build Command**: `npm install`
5. **Start Command**: `node server.js`
6. **Environment Variables** (زود هذو في Render Dashboard):
   | Key | Value |
   |-----|-------|
   | `ADMIN_PASSWORD` | `admin123` |
   | `META_PIXEL_ID` | `998739902533746` |
   | `GOOGLE_SHEET_ID` | `1a2X0D-5s0eFrpDUof_P9gK20A0_6MZNDmXSPrEahEzY` |
   | `GOOGLE_SERVICE_ACCOUNT_KEY` | (انسخ محتوى الـ JSON كامل وحطه) |
   | `SESSION_SECRET` | كلمة عشوائية |

---

## 9. بعد الاسترجاع — التحقق

افتح هذو وتأكد:
| الرابط | واش تشوف |
|--------|---------|
| http://localhost:3000 | الصفحة الرئيسية |
| http://localhost:3000/products | قائمة المنتجات |
| http://localhost:3000/admin | لوحة التحكم (password: `admin123`) |
| http://localhost:3000/debug | حالة Google Sheets |

---

## 10. الروابط المهمة

| الخدمة | الرابط |
|--------|--------|
| **المتجر (إنتاج)** | https://auraveex-shop.onrender.com |
| **GitHub** | https://github.com/zfkaire2-glitch/auraveex-shop |
| **Render Dashboard** | https://dashboard.render.com |
| **Meta Business** | https://business.facebook.com |
| **Meta Developers** | https://developers.facebook.com |

---

## 11. ملاحظات مهمة

- **البيانات الحساسة** (`customers.json`, `orders.json`) **gitignored** — ما تطلعش لـ GitHub
- **إذا غيرت اسم المستخدم في GitHub** → عدل `git remote set-url origin URL_جديد`
- **البوت** يحتاج `.env` مع `TELEGRAM_BOT_TOKEN` باش يشتغل
- **Google Sheets** يحتاج ملف JSON service account + `GOOGLE_SHEET_ID`
- **Meta Pixel** يحتاج `META_PIXEL_ID` في `.env`
- **Render auto-deploy** مفعل — كل push لـ `master` ينشر تلقائياً
