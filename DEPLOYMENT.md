# ربحني معجم — DEPLOYMENT GUIDE
# Production-Grade Telegram Mini App
# =====================================================

## STEP 1 — SUPABASE SETUP

1. Go to: https://supabase.com/dashboard/project/nfirqlldjuakkqrylpvp/sql
2. Open the SQL Editor
3. Paste the ENTIRE content of `/supabase/schema.sql`
4. Click RUN
5. Verify: all tables created, no errors

---

## STEP 2 — VERCEL ENVIRONMENT VARIABLES

Go to: https://vercel.com/dashboard → rabhni-app → Settings → Environment Variables

Add ALL these variables:

| Variable                | Value                                                         |
|------------------------|---------------------------------------------------------------|
| SUPABASE_URL           | https://nfirqlldjuakkqrylpvp.supabase.co                     |
| SUPABASE_SERVICE_KEY   | eyJhbGciOiJIUzI1NiIs... (your service role key)              |
| VITE_SUPABASE_URL      | https://nfirqlldjuakkqrylpvp.supabase.co                     |
| VITE_SUPABASE_ANON_KEY | sb_publishable_0clLRsCfcIBYy1Ai2wB-lQ_QbtANpaY               |
| TELEGRAM_BOT_TOKEN     | 8721111962:AAEvkbszlli1oKBrbk3wO2a9N8o1V83zJyE               |
| ADMIN_TELEGRAM_ID      | 8079733623                                                    |
| VITE_MONETAG_ZONE      | 10883938                                                      |
| APP_URL                | https://rabhni-app.vercel.app                                 |
| JWT_SECRET             | (generate: openssl rand -hex 32)                              |
| WEBHOOK_SECRET         | (generate: openssl rand -hex 16)                              |
| CRON_SECRET            | (generate: openssl rand -hex 16)                              |
| AFFILIATE_CHANNEL_ID   | @rabahnimujam                                                 |

---

## STEP 3 — DEPLOY TO VERCEL

Option A — GitHub (Recommended):
1. Push this entire project to a GitHub repo
2. Go to vercel.com → New Project → Import repo
3. Framework: Vite
4. Build command: npm run build
5. Output directory: dist
6. Click Deploy

Option B — Vercel CLI:
```bash
npm install -g vercel
cd /path/to/rabahni
vercel --prod
```

---

## STEP 4 — REGISTER TELEGRAM WEBHOOK

Run this command (replace YOUR_WEBHOOK_SECRET with what you set above):

```bash
curl -X POST https://api.telegram.org/bot8721111962:AAEvkbszlli1oKBrbk3wO2a9N8o1V83zJyE/setWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://rabhni-app.vercel.app/api/webhook",
    "secret_token": "YOUR_WEBHOOK_SECRET",
    "allowed_updates": ["message", "callback_query"]
  }'
```

Expected response: `{"ok":true,"result":true}`

---

## STEP 5 — SET MINI APP IN BOTFATHER

1. Open @BotFather on Telegram
2. Send /mybots → select @Rabahni_Bot
3. Bot Settings → Menu Button → Edit Menu Button URL
4. Enter: https://rabhni-app.vercel.app
5. Send /setmenubutton (optional label: 🎮 العب)

---

## STEP 6 — IMPORT SAMPLE QUESTIONS

Run this in Supabase SQL Editor:

```sql
-- After running schema.sql, import sample questions
-- Go to: Table Editor → questions → Insert rows
-- OR use Supabase API with service key to bulk insert from sample-questions.json
```

Or use this API call to validate and insert:
```bash
# Use Supabase Dashboard → Table Editor → Import CSV/JSON
```

---

## STEP 7 — CREATE TELEGRAM CHANNEL

1. Open Telegram → New Channel
2. Name: ربحني معجم
3. Username: @rabahnimujam
4. Add @Rabahni_Bot as administrator (with post permission)
5. Post first message to activate

---

## STEP 8 — TEST CHECKLIST

Before going live, verify:

[ ] Open @Rabahni_Bot in Telegram → /start → Mini App opens
[ ] Terms modal appears for new users
[ ] Game loads questions and plays
[ ] Score submits without error
[ ] Leaderboard shows rankings
[ ] Rewards page shows prize tiers
[ ] Ad button triggers Monetag ad
[ ] Admin panel accessible for user ID 8079733623
[ ] Weekly reset cron configured in vercel.json

---

## STEP 9 — WEEKLY OPERATIONS

Every Sunday:
1. Open Admin panel → view winners preview
2. Purchase gift card codes from Hepsiburada/Trendyol
3. Enter codes in Admin panel
4. Click "إرسال الجوائز للفائزين"
5. Winners receive private messages automatically
6. Weekly scores reset automatically via cron

---

## LEGAL COMPLIANCE CHECKLIST (Turkey)

[ ] ✅ Skill-based only — score determines winners
[ ] ✅ No randomness anywhere in the system
[ ] ✅ No cash payouts — only gift card vouchers (Hepsiburada/Trendyol)
[ ] ✅ "Ödül Kuralları" page visible in app
[ ] ✅ Terms checkbox on first launch
[ ] ✅ "Oyuncular reklam izlemeden de...ödül kazanabilir" statement embedded
[ ] ✅ Ads CANNOT affect leaderboard ranking
[ ] ✅ Global reward pool activation (not per-user)
[ ] ✅ All scoring deterministic and auditable
[ ] ✅ Full audit log in database
[ ] ✅ KVKK compliance: no unnecessary data storage
[ ] ✅ Prize classified as "promotional digital voucher"

---

## SUPPORT

Admin Telegram: @lordNe88
Bot: @Rabahni_Bot
App: https://rabhni-app.vercel.app
