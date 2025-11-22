# Integration Guide

Quick start guide for integrating with the Video Automation API.

## Overview

After deploying to Railway, you'll have access to a complete REST API for:
- Uploading videos for processing
- Checking processing status
- Downloading processed videos
- Exporting subtitles (SRT format)
- Getting shareable links

## Quick Start

### 1. Upload a Video

```bash
curl -X POST https://your-app.railway.app/api/upload \
  -F "video=@video.mp4" \
  -F "userId=your-user-id"
```

Response:
```json
{
  "success": true,
  "data": {
    "jobId": "job_abc123",
    "status": "queued"
  }
}
```

### 2. Check Status

```bash
curl https://your-app.railway.app/api/jobs/job_abc123/status
```

Response:
```json
{
  "success": true,
  "data": {
    "jobId": "job_abc123",
    "status": "processing",
    "currentStage": "transcribing",
    "progress": 45.5
  }
}
```

### 3. Get All Links

Once completed, get all download links:

```bash
curl https://your-app.railway.app/api/export/share/job_abc123
```

Response:
```json
{
  "success": true,
  "data": {
    "videos": {
      "raw": "https://...",
      "edited": "https://...",
      "final": "https://..."
    },
    "transcript": {
      "srt": "https://...",
      "json": "https://...",
      "googleSheets": "https://..."
    }
  }
}
```

## Available Endpoints

### Core APIs
- `POST /api/upload` - Upload video
- `GET /api/jobs/:jobId/status` - Check status
- `GET /api/jobs/:jobId/download` - Download final video

### Export APIs
- `GET /api/export/srt/:jobId` - Get SRT subtitles
- `GET /api/export/srt/:jobId?format=json` - Get subtitles as JSON
- `POST /api/export/sheets/:jobId` - Export to Google Sheets
- `GET /api/export/video/:jobId/raw` - Get raw uploaded video
- `GET /api/export/video/:jobId/edited` - Get auto-edited video
- `GET /api/export/video/:jobId/final` - Get final rendered video
- `GET /api/export/share/:jobId` - Get all shareable links

## Use Cases

### 1. Automated Video Processing Workflow

```javascript
// Upload video from your app
const formData = new FormData();
formData.append('video', videoFile);

const response = await fetch('https://your-app.railway.app/api/upload', {
  method: 'POST',
  body: formData
});

const { jobId } = (await response.json()).data;

// Poll for completion
const interval = setInterval(async () => {
  const status = await fetch(`https://your-app.railway.app/api/jobs/${jobId}/status`);
  const data = (await status.json()).data;
  
  if (data.status === 'completed') {
    clearInterval(interval);
    // Get download link
    const links = await fetch(`https://your-app.railway.app/api/export/share/${jobId}`);
    const shareData = (await links.json()).data;
    console.log('Final video:', shareData.videos.final);
  }
}, 5000);
```

### 2. Subtitle Export for Translation

```python
import requests

# Get subtitles in JSON format
response = requests.get(
    f'https://your-app.railway.app/api/export/srt/{job_id}',
    params={'format': 'json'}
)

subtitles = response.json()['data']['segments']

# Process subtitles for translation
for segment in subtitles:
    print(f"{segment['start']} - {segment['end']}: {segment['text']}")
```

### 3. Batch Processing

```bash
#!/bin/bash

# Process multiple videos
for video in videos/*.mp4; do
  echo "Processing $video..."
  
  RESPONSE=$(curl -s -X POST https://your-app.railway.app/api/upload \
    -F "video=@$video")
  
  JOB_ID=$(echo $RESPONSE | jq -r '.data.jobId')
  echo "Job ID: $JOB_ID"
  
  # Store job ID for later retrieval
  echo $JOB_ID >> job_ids.txt
done

echo "All videos uploaded. Check status with job IDs in job_ids.txt"
```

### 4. Integration with Zapier/Make.com

**Trigger**: Webhook receives job ID from your app

**Steps**:
1. Delay 5 minutes
2. HTTP Request: GET `/api/jobs/:jobId/status`
3. Filter: Only continue if status = "completed"
4. HTTP Request: GET `/api/export/share/:jobId`
5. Send email/Slack/Discord with download links

### 5. Content Management System Integration

```javascript
// In your CMS (WordPress, Strapi, etc.)
async function processVideo(videoFile, postId) {
  // Upload to video automation
  const formData = new FormData();
  formData.append('video', videoFile);
  formData.append('userId', `cms-post-${postId}`);
  
  const response = await fetch('https://your-app.railway.app/api/upload', {
    method: 'POST',
    body: formData
  });
  
  const { jobId } = (await response.json()).data;
  
  // Save job ID to post meta
  await savePostMeta(postId, 'video_job_id', jobId);
  
  // Set up cron job to check status
  scheduleStatusCheck(jobId, postId);
}

async function checkVideoStatus(jobId, postId) {
  const response = await fetch(`https://your-app.railway.app/api/jobs/${jobId}/status`);
  const { data } = await response.json();
  
  if (data.status === 'completed') {
    // Get all links
    const linksResponse = await fetch(`https://your-app.railway.app/api/export/share/${jobId}`);
    const links = (await linksResponse.json()).data;
    
    // Update post with video URLs
    await updatePost(postId, {
      video_url: links.videos.final,
      subtitles_url: links.transcript.srt
    });
  }
}
```

## Error Handling

Always check the `success` field:

```javascript
const response = await fetch(url);
const result = await response.json();

if (!result.success) {
  console.error('API Error:', result.error);
  // Handle error appropriately
  return;
}

// Process successful response
const data = result.data;
```

## Best Practices

1. **Store Job IDs**: Save job IDs in your database to track processing
2. **Poll Responsibly**: Check status every 5-10 seconds, not more frequently
3. **Handle Timeouts**: Large videos can take 10-30 minutes to process
4. **Download Promptly**: Signed URLs expire after 7 days
5. **Validate Input**: Check video format and size before uploading

## Rate Limits

Currently no rate limits, but recommended:
- Max 10 concurrent uploads per user
- Max 1GB file size per upload
- Poll status every 5-10 seconds

## Support

For detailed API documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

For deployment issues, see [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)
