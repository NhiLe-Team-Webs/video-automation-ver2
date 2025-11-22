# Railway Deployment Checklist

Use this checklist to ensure smooth deployment to Railway.

## Pre-Deployment

### Code Preparation
- [ ] All code committed to GitHub
- [ ] `Dockerfile` exists in root directory
- [ ] `railway.json` configuration file present
- [ ] `.dockerignore` excludes unnecessary files
- [ ] `package.json` has correct start script: `"start": "node dist/server.js"`
- [ ] TypeScript builds successfully: `npm run build`
- [ ] Health check endpoint works: `/health` returns `{"status":"ok"}`

### Environment Variables Ready
- [ ] Wasabi credentials (Access Key + Secret Key)
- [ ] Wasabi bucket name and region
- [ ] OpenAI API key (for Whisper)
- [ ] Google Gemini API key
- [ ] Google Sheets credentials (JSON)
- [ ] Google Sheets spreadsheet ID
- [ ] Pexels API key
- [ ] Telegram bot token and chat ID

### Testing
- [ ] Local Docker build succeeds: `docker build -t test .`
- [ ] Local Docker run works: `docker run -p 3000:3000 test`
- [ ] All tests pass: `npm test`
- [ ] Manual pipeline test completed successfully

## Railway Setup

### Account & Project
- [ ] Railway account created at https://railway.app
- [ ] GitHub repository connected
- [ ] New project created
- [ ] Dockerfile detected automatically

### Configuration
- [ ] All environment variables added in Railway dashboard
- [ ] PORT variable set to 3000
- [ ] NODE_ENV set to "production"
- [ ] Health check path configured: `/health`
- [ ] Restart policy set to "ON_FAILURE"

### Optional: Persistent Storage
- [ ] Volume created for `/app/temp` (if needed)
- [ ] Volume size configured (5GB recommended)

## Deployment

### Initial Deploy
- [ ] First deployment triggered
- [ ] Build logs show no errors
- [ ] Health check passes
- [ ] Service status shows "Active"
- [ ] Railway URL accessible

### Verification
- [ ] Health endpoint responds: `curl https://your-app.railway.app/health`
- [ ] Upload endpoint accessible: `/api/upload`
- [ ] Status endpoint works: `/api/jobs/:jobId/status`
- [ ] Download endpoint works: `/api/jobs/:jobId/download`

### Testing in Production
- [ ] Upload test video through UI
- [ ] Monitor logs for errors
- [ ] Verify all pipeline stages execute
- [ ] Check Wasabi storage for uploaded video
- [ ] Verify final video is accessible
- [ ] Test download link expiration (7 days)

## Post-Deployment

### Monitoring
- [ ] Railway metrics dashboard reviewed
- [ ] Log monitoring set up
- [ ] Error alerts configured (email/Discord/Slack)
- [ ] Uptime monitoring enabled (UptimeRobot)

### Documentation
- [ ] Production URL documented
- [ ] Environment variables backed up
- [ ] Deployment process documented
- [ ] Team members notified

### Security
- [ ] Secrets not committed to Git
- [ ] HTTPS enabled (automatic with Railway)
- [ ] API authentication considered (if needed)
- [ ] Rate limiting configured (if needed)

### Optimization
- [ ] Resource usage monitored
- [ ] Temp file cleanup verified
- [ ] Wasabi lifecycle policies configured
- [ ] Cost tracking enabled

## Ongoing Maintenance

### Weekly
- [ ] Check Railway dashboard for errors
- [ ] Review resource usage
- [ ] Monitor Wasabi storage costs
- [ ] Check free tier credit remaining

### Monthly
- [ ] Review and clean up old videos on Wasabi
- [ ] Update dependencies: `npm update`
- [ ] Review and optimize Dockerfile
- [ ] Check for Railway platform updates

### As Needed
- [ ] Scale resources if needed
- [ ] Add custom domain
- [ ] Set up staging environment
- [ ] Configure CI/CD pipeline

## Troubleshooting Reference

### Build Fails
- Check Dockerfile syntax
- Verify all dependencies in package.json
- Review build logs in Railway dashboard
- Test Docker build locally

### Runtime Errors
- Check environment variables are set correctly
- Review application logs
- Verify external API keys are valid
- Check Wasabi connectivity

### Performance Issues
- Monitor CPU/Memory usage
- Check for memory leaks
- Optimize video processing settings
- Consider upgrading Railway plan

## Emergency Rollback

If deployment fails:
1. [ ] Go to Railway dashboard → Deployments
2. [ ] Find last working deployment
3. [ ] Click "Redeploy"
4. [ ] Verify service is restored
5. [ ] Investigate issue in separate branch

## Success Criteria

Deployment is successful when:
- ✅ Service is "Active" in Railway
- ✅ Health check passes
- ✅ Test video processes successfully
- ✅ Final video is accessible from Wasabi
- ✅ No errors in logs
- ✅ Resource usage is within limits
- ✅ All team members can access

---

**Last Updated**: [Date]
**Deployed By**: [Name]
**Production URL**: [Railway URL]
**Status**: [ ] In Progress  [ ] Complete  [ ] Issues
