# 🚀 Deployment Combo - Video Automation MVP

## 📋 Tổng hợp dịch vụ

### 🏗️ Kiến trúc tổng thể
```
Frontend (Vercel) → API (Render) → Workers (Render) → Storage (Wasabi)
                                    ↓
                              Queue (Redis) + DB (Google Sheets)
```

## 🆓 Combo Services (Free Tier)

### 1. **Render.com** - Free Tier
- **Web Service**: API Server (750 hours/tháng)
- **Background Worker**: Video processing (750 hours/tháng)
- **Redis Free**: Queue & caching (25MB RAM)
- **Bandwidth**: 100GB/tháng

### 2. **Vercel** - Free Tier
- **Frontend Hosting**: Static files + CDN
- **Custom Domain**: Free SSL certificates
- **Bandwidth**: 100GB/tháng
- **Function Invocations**: 100K/tháng

### 3. **Wasabi** - Storage
- **Free Tier**: **Không có free tier**
- **Pricing**: $0.0099/GB/tháng (rẻ hơn S3)
- **Min Charge**: $6.99/tháng (nếu <1TB)
- **Tính năng**: S3-compatible API

### 4. **Google Sheets** - Free
- **Database**: Job management
- **Storage**: Transcript data
- **Unlimited**: Rows và sheets

### 5. **AWS Route53** - DNS
- **Domain**: $0.50/tháng
- **Queries**: $0.40/million queries
- **SSL**: Free certificates

## 💰 Chi phí ước tính (tháng)

| Service | Free Tier | Paid (nếu vượt) |
|---------|-----------|----------------|
| Render | $0 (750h) | $7+ (vượt 750h) |
| Vercel | $0 (100GB) | $20+ (vượt 100GB) |
| Wasabi | **$6.99 min** | $0.0099/GB |
| Google Sheets | $0 | $0 |
| Route53 | $0.50 | $0.50 |
| **Total** | **~$7.49** | **~$28-100+** |

## 🔧 Cấu hình chi tiết

### Render.com Setup

#### 1. Web Service (API)
```yaml
Type: Web Service
Runtime: Docker
Build Command: docker build -f Dockerfile.api .
Start Command: node dist/server.js
Port: 3000
Auto-Deploy: Yes (from GitHub)
```

#### 2. Background Worker
```yaml
Type: Background Worker
Runtime: Docker
Build Command: docker build -f Dockerfile.worker .
Start Command: node dist/worker.js
Instances: 1-2 (auto-scale)
```

#### 3. Redis Add-on
```yaml
Plan: Free
RAM: 25MB
Connection: redis://default:password@host:port
```

### Wasabi Configuration

#### Bucket Setup
```bash
# Tạo bucket
Bucket Name: video-automation-bucket
Region: us-east-1
Access Policy: Public (cho video files)

# CORS Configuration
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

#### S3 Compatible Endpoint
```
Endpoint: s3.us-east-1.wasabisys.com
Region: us-east-1
Access Key: YOUR_ACCESS_KEY
Secret Key: YOUR_SECRET_KEY
```

## 📡 API Endpoints

### Core API (đã có)
```typescript
POST /api/upload              // Upload video file
GET  /api/jobs/:jobId/status  // Check job status
GET  /api/jobs/:jobId/download // Download processed video
GET  /health                  // Health check
```

### Extended API (cần thêm)
```typescript
// API v1 cho external usage
GET    /api/v1/jobs                    // List all jobs
GET    /api/v1/jobs/:id                // Get job details
POST   /api/v1/webhooks                // Register webhook
DELETE /api/v1/webhooks/:id            // Remove webhook
GET    /api/v1/stats                   // Usage statistics
POST   /api/v1/auth/keys               // Generate API key
GET    /api/v1/auth/keys               // List API keys
DELETE /api/v1/auth/keys/:id           // Revoke API key
```

## 🔐 Environment Variables

### Render.com Environment
```env
# Server Configuration
NODE_ENV=production
PORT=3000

# Redis (Render provides automatically)
REDIS_URL=redis://default:password@host:port

# Wasabi Storage
WASABI_ACCESS_KEY_ID=your-access-key
WASABI_SECRET_ACCESS_KEY=your-secret-key
WASABI_BUCKET_NAME=video-automation-bucket
WASABI_REGION=us-east-1
WASABI_ENDPOINT=s3.us-east-1.wasabisys.com

# Google Sheets (existing)
GOOGLE_SHEETS_SPREADSHEET_ID=your-spreadsheet-id
GOOGLE_SHEETS_CREDENTIALS=./credentials.json

# YouTube (existing)
YOUTUBE_CLIENT_ID=your-client-id
YOUTUBE_CLIENT_SECRET=your-client-secret
YOUTUBE_REDIRECT_URI=https://your-app.com/oauth/callback

# API Security
JWT_SECRET=your-super-secret-jwt-key
API_RATE_LIMIT=100
WEBHOOK_SECRET=your-webhook-secret

# AI Services
OPENAI_API_KEY=your-openai-key
GEMINI_API_KEY=your-gemini-key
```

## 🛠️ Code Changes Cần Thiết

### 1. Wasabi Storage Service
```typescript
// src/services/storage/wasabiStorageService.ts
import AWS from 'aws-sdk';
import { config } from '../../config';

export class WasabiStorageService {
  private s3: AWS.S3;

  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: config.wasabi.accessKeyId,
      secretAccessKey: config.wasabi.secretAccessKey,
      region: config.wasabi.region,
      endpoint: config.wasabi.endpoint,
      s3ForcePathStyle: true,
    });
  }

  async uploadVideo(buffer: Buffer, key: string): Promise<string> {
    const result = await this.s3.upload({
      Bucket: config.wasabi.bucketName,
      Key: key,
      Body: buffer,
      ContentType: 'video/mp4',
    }).promise();
    
    return result.Location;
  }

  async downloadVideo(key: string): Promise<Buffer> {
    const result = await this.s3.getObject({
      Bucket: config.wasabi.bucketName,
      Key: key,
    }).promise();
    
    return result.Body as Buffer;
  }

  getSignedUrl(key: string): string {
    return this.s3.getSignedUrl('getObject', {
      Bucket: config.wasabi.bucketName,
      Key: key,
      Expires: 3600, // 1 hour
    });
  }
}
```

### 2. API Key Management
```typescript
// src/services/auth/apiKeyService.ts
import { createHash, randomBytes } from 'crypto';
import { sheetsStorageService } from '../transcription/sheetsStorageService';

export class ApiKeyService {
  async generateApiKey(userId: string, name: string): Promise<string> {
    const key = `va_${randomBytes(32).toString('hex')}`;
    const hashedKey = createHash('sha256').update(key).digest('hex');
    
    // Store in Google Sheets
    await sheetsStorageService.saveApiKey(userId, {
      name,
      hashedKey,
      createdAt: new Date(),
      lastUsed: null,
      usageCount: 0,
    });
    
    return key;
  }

  async validateApiKey(key: string): Promise<{ userId: string; valid: boolean }> {
    const hashedKey = createHash('sha256').update(key).digest('hex');
    
    // Check in Google Sheets
    const apiKey = await sheetsStorageService.getApiKey(hashedKey);
    
    if (!apiKey) {
      return { userId: '', valid: false };
    }
    
    // Update last used
    await sheetsStorageService.updateApiKeyUsage(hashedKey);
    
    return { userId: apiKey.userId, valid: true };
  }
}
```

### 3. Webhook Service
```typescript
// src/services/webhook/webhookService.ts
import axios from 'axios';
import { Job } from '../../models/job';

export interface WebhookPayload {
  event: 'job.completed' | 'job.failed' | 'job.started';
  job: Job;
  timestamp: string;
}

export class WebhookService {
  async sendWebhook(url: string, payload: WebhookPayload): Promise<void> {
    try {
      await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'VideoAutomation/1.0',
        },
        timeout: 10000,
      });
    } catch (error) {
      console.error('Webhook failed:', error);
      // Optionally retry logic here
    }
  }

  async notifyJobCompletion(job: Job, webhookUrl: string): Promise<void> {
    const payload: WebhookPayload = {
      event: job.status === 'completed' ? 'job.completed' : 'job.failed',
      job,
      timestamp: new Date().toISOString(),
    };
    
    await this.sendWebhook(webhookUrl, payload);
  }
}
```

### 4. API Authentication Middleware
```typescript
// src/middleware/apiAuth.ts
import { Request, Response, NextFunction } from 'express';
import { apiKeyService } from '../services/auth/apiKeyService';

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required',
    });
  }
  
  const { userId, valid } = await apiKeyService.validateApiKey(apiKey);
  
  if (!valid) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key',
    });
  }
  
  req.userId = userId;
  next();
}
```

### 5. Rate Limiting
```typescript
// src/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';

export const apiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 requests per hour
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
```

## 🚀 Deployment Steps

### Phase 1: Setup Infrastructure
1. **Render.com Setup**
   - Create account
   - Connect GitHub repository
   - Create Web Service (API)
   - Create Background Worker
   - Add Redis add-on

2. **Wasabi Setup**
   - Create account
   - Create bucket
   - Generate access keys
   - Configure CORS

3. **Vercel Setup**
   - Create account
   - Connect GitHub repository
   - Configure custom domain

### Phase 2: Configuration
1. **Environment Variables**
   - Add all required env vars to Render
   - Configure secrets properly

2. **Database Setup**
   - Create Google Sheets for API keys
   - Update existing sheets structure

3. **Domain Setup**
   - Configure Route53
   - Setup SSL certificates

### Phase 3: Code Integration
1. **Add new services**
   - Wasabi storage service
   - API key management
   - Webhook service
   - Authentication middleware

2. **Update existing code**
   - Modify upload handlers
   - Update worker processes
   - Add API v1 routes

3. **Testing**
   - Test API endpoints
   - Test video processing
   - Test webhooks

## 📊 Monitoring & Analytics

### Free Monitoring Options
```typescript
// Basic logging
import { createLogger } from './utils/logger';

// Request tracking
app.use((req, res, next) => {
  logger.info('API Request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

// Error tracking
app.use((err, req, res, next) => {
  logger.error('API Error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
});
```

## 🎯 MVP Features Checklist

### Core Features ✅
- [x] Video upload & processing
- [x] Job status tracking
- [x] YouTube integration
- [x] Transcription service

### API Features (cần thêm)
- [ ] API key authentication
- [ ] Rate limiting
- [ ] Webhook support
- [ ] Usage statistics
- [ ] API documentation

### Infrastructure (cần setup)
- [ ] Render deployment
- [ ] Wasabi integration
- [ ] Vercel frontend
- [ ] Custom domain
- [ ] Monitoring setup

## 🔄 Scaling Path

### When to upgrade:
1. **Render**: >750 hours/tháng → Upgrade to Pro ($7/tháng)
2. **Vercel**: >100GB bandwidth → Pro ($20/tháng)
3. **Wasabi**: >1TB storage → Pay-as-you-go ($0.0099/GB)
4. **Database**: Google Sheets limits → Supabase Pro ($25/tháng)

### Estimated scaling costs:
- **Small**: $7-15/tháng
- **Medium**: $50-100/tháng
- **Large**: $200-500/tháng

---

## 📞 Support & Resources

### Documentation Links:
- [Render.com Docs](https://render.com/docs)
- [Wasabi Docs](https://wasabi-support.zendesk.com/hc/en-us)
- [Vercel Docs](https://vercel.com/docs)
- [Google Sheets API](https://developers.google.com/sheets/api)

### Troubleshooting:
- Check logs in Render dashboard
- Monitor Wasabi bucket usage
- Track API usage in Vercel analytics
- Monitor Google Sheets quota

---
*Last updated: November 2024*