# Railway Quick Start (5 Minutes)

Deploy your video automation system to Railway in 5 minutes.

## Prerequisites

- Railway account: https://railway.app
- GitHub repo with your code
- API keys ready

## Step 1: Create Project (1 min)

1. Go to https://railway.app
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository
5. Railway auto-detects Dockerfile ✅

## Step 2: Set Environment Variables (3 min)

Click **"Variables"** tab and paste:

### Minimum Required Variables

```bash
NODE_ENV=production
PORT=3000

# Wasabi Storage
WASABI_ACCESS_KEY_ID=your_key
WASABI_SECRET_ACCESS_KEY=your_secret
WASABI_BUCKET=your_bucket
WASABI_REGION=us-east-1

# OpenAI
OPENAI_API_KEY=sk-...

# Gemini
GEMINI_API_KEY=AIzaSy...

# Google Sheets (paste entire JSON)
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account",...}
GOOGLE_SHEETS_SPREADSHEET_ID=1abc...

# Pexels
PEXELS_API_KEY=your_key

# Telegram
TELEGRAM_BOT_TOKEN=123:ABC...
TELEGRAM_CHAT_ID=123456
```

💡 **Tip**: Copy from `.env.railway.example` file

## Step 3: Deploy (1 min)

Railway automatically:
1. ✅ Builds Docker image
2. ✅ Installs dependencies
3. ✅ Runs health checks
4. ✅ Deploys to production

Wait for **"Active"** status (2-3 minutes)

## Step 4: Test (30 sec)

Get your Railway URL from dashboard, then:

```bash
curl https://your-app.railway.app/health
```

Should return: `{"status":"ok"}` ✅

## Done! 🎉

Your video automation system is live!

**Next Steps:**
- Upload a test video
- Monitor logs in Railway dashboard
- Set up custom domain (optional)

## Troubleshooting

**Build fails?**
- Check Dockerfile exists
- Verify all dependencies in package.json

**Health check fails?**
- Check environment variables are set
- View logs in Railway dashboard

**Need help?**
- Read full guide: `docs/RAILWAY_DEPLOYMENT.md`
- Railway Discord: https://discord.gg/railway

---

**Cost**: Free tier ($5/month credit) is enough for testing!
