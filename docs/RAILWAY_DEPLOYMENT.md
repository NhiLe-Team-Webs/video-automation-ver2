# Railway Deployment Guide

Complete guide to deploy the Video Automation system to Railway.

## Prerequisites

- Railway account (sign up at https://railway.app)
- GitHub repository with your code
- All API keys ready (see Environment Variables section)

## Why Railway?

✅ **Easy Docker deployment** - Automatic detection and build
✅ **Generous free tier** - $5/month credit, enough for testing
✅ **Persistent storage** - Volumes for temp files
✅ **Auto-scaling** - Handles traffic spikes
✅ **GitHub integration** - Auto-deploy on push

## Step-by-Step Deployment

### 1. Prepare Your Repository

Ensure these files exist in your repo:
- `Dockerfile` - Main deployment file
- `railway.json` - Railway configuration
- `.dockerignore` - Exclude unnecessary files

### 2. Create Railway Project

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Railway will auto-detect the Dockerfile

### 3. Configure Environment Variables

In Railway dashboard, go to **Variables** tab and add:

#### Required Variables

```bash
# Server Configuration
NODE_ENV=production
PORT=3000

# Wasabi Storage (S3-compatible)
WASABI_ACCESS_KEY_ID=your_access_key
WASABI_SECRET_ACCESS_KEY=your_secret_key
WASABI_BUCKET=your_bucket_name
WASABI_REGION=us-east-1

# OpenAI (for Whisper transcription)
OPENAI_API_KEY=sk-...

# Google Gemini (for editing plan)
GEMINI_API_KEY=your_gemini_key

# Google Sheets (for transcript storage)
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account",...}
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id

# Pexels (for B-roll)
PEXELS_API_KEY=your_pexels_key

# Telegram (for notifications)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

#### Optional Variables

```bash
# Logging
LOG_LEVEL=info

# Storage
TEMP_DIR=/app/temp
CACHE_DIR=/app/cache
```

### 4. Add Persistent Storage (Optional)

For temp file storage:

1. Go to **Volumes** tab
2. Click "New Volume"
3. Mount path: `/app/temp`
4. Size: 5GB (adjust as needed)

### 5. Deploy

Railway will automatically:
1. Build Docker image
2. Install all dependencies
3. Run health checks
4. Deploy to production URL

### 6. Verify Deployment

Check deployment status:
- ✅ Build logs show successful compilation
- ✅ Health check passes at `/health`
- ✅ Service shows "Active" status

Test the API:
```bash
curl https://your-app.railway.app/health
# Should return: {"status":"ok"}
```

## Post-Deployment

### Monitor Your App

Railway provides:
- **Metrics** - CPU, Memory, Network usage
- **Logs** - Real-time application logs
- **Deployments** - History of all deployments

### Set Up Alerts

1. Go to **Settings** > **Notifications**
2. Add webhook or email for:
   - Deployment failures
   - High resource usage
   - Service crashes

### Custom Domain (Optional)

1. Go to **Settings** > **Domains**
2. Click "Generate Domain" for free Railway subdomain
3. Or add your custom domain

## Scaling

### Vertical Scaling (More Resources)

Railway automatically scales based on usage. For heavy video processing:

1. Go to **Settings** > **Resources**
2. Adjust:
   - Memory: 2GB → 4GB
   - CPU: 1 vCPU → 2 vCPU

### Horizontal Scaling (More Instances)

For high traffic:

1. Update `railway.json`:
```json
{
  "deploy": {
    "numReplicas": 2
  }
}
```

2. Push to GitHub - Railway auto-deploys

## Cost Optimization

### Free Tier Limits

Railway free tier includes:
- $5/month credit
- ~500 hours of runtime
- Shared resources

### Tips to Stay Within Free Tier

1. **Use Wasabi for storage** - Don't store videos on Railway
2. **Clean up temp files** - Delete after processing
3. **Optimize Docker image** - Use multi-stage builds
4. **Monitor usage** - Check Railway dashboard daily

### When to Upgrade

Upgrade to paid plan ($5/month + usage) when:
- Processing > 10 videos/day
- Need guaranteed uptime
- Require more storage/bandwidth

## Troubleshooting

### Build Fails

**Error: "Out of memory"**
```bash
# Solution: Reduce dependencies or upgrade plan
```

**Error: "Python package not found"**
```bash
# Solution: Check Dockerfile has pip3 install commands
```

### Runtime Errors

**Error: "ENOENT: no such file or directory"**
```bash
# Solution: Create temp directories in Dockerfile
RUN mkdir -p temp/uploads temp/previews
```

**Error: "FFmpeg not found"**
```bash
# Solution: Ensure ffmpeg is installed in Dockerfile
RUN apt-get install -y ffmpeg
```

### Performance Issues

**Slow video processing**
- Upgrade to higher CPU plan
- Optimize FFmpeg settings
- Use smaller video resolutions

**High memory usage**
- Clean up temp files after processing
- Limit concurrent video processing
- Use streaming instead of loading full videos

## Environment-Specific Configuration

### Development vs Production

Use Railway's environment feature:

1. Create "staging" environment for testing
2. Create "production" environment for live
3. Different env vars for each

### Database (If Needed)

Railway offers managed databases:
- PostgreSQL
- MySQL
- Redis

Add from **New** > **Database**

## CI/CD Pipeline

Railway auto-deploys on:
- Push to `main` branch
- Pull request merge
- Manual trigger

### Custom Deploy Conditions

In `railway.json`:
```json
{
  "deploy": {
    "branch": "production"
  }
}
```

## Security Best Practices

1. **Never commit secrets** - Use Railway env vars
2. **Enable HTTPS** - Railway provides free SSL
3. **Restrict API access** - Add authentication
4. **Monitor logs** - Check for suspicious activity
5. **Regular updates** - Keep dependencies current

## Backup Strategy

1. **Code** - GitHub repository
2. **Environment variables** - Export from Railway dashboard
3. **Videos** - Stored on Wasabi (separate backup)
4. **Database** - Railway automatic backups (if using)

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- GitHub Issues: Your repository issues page

## Next Steps

After successful deployment:

1. ✅ Test video upload through UI
2. ✅ Verify all pipeline stages work
3. ✅ Check Wasabi storage integration
4. ✅ Set up monitoring alerts
5. ✅ Document your production URL
6. ✅ Share with users!

---

**Deployment Checklist:**

- [ ] Railway account created
- [ ] GitHub repo connected
- [ ] All environment variables set
- [ ] Dockerfile tested locally
- [ ] Health check endpoint working
- [ ] Wasabi storage configured
- [ ] First deployment successful
- [ ] API endpoints tested
- [ ] Monitoring set up
- [ ] Documentation updated with production URL
