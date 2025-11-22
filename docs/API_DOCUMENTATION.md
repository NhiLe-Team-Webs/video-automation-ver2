# API Documentation

Complete API reference for the Video Automation System.

## Base URL

```
Production: https://your-app.railway.app
Local: http://localhost:3000
```

## Authentication

Currently, the API does not require authentication. In production, you should implement API key authentication.

## Response Format

All API responses follow this format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Upload & Processing APIs

### Upload Video

Upload a video file for processing.

**Endpoint:** `POST /api/upload`

**Content-Type:** `multipart/form-data`

**Request Body:**
- `video` (file, required): Video file (mp4, mov, avi, mkv)
- `userId` (string, optional): User identifier (default: "anonymous")

**Example:**

```bash
curl -X POST https://your-app.railway.app/api/upload \
  -F "video=@/path/to/video.mp4" \
  -F "userId=user123"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "jobId": "job_abc123",
    "status": "queued",
    "videoPath": "wasabi://bucket/uploads/video.mp4"
  },
  "message": "Video uploaded successfully. Processing started in background."
}
```

---

### Get Job Status

Get the current status of a processing job.

**Endpoint:** `GET /api/jobs/:jobId/status`

**Parameters:**
- `jobId` (path, required): Job ID returned from upload

**Example:**

```bash
curl https://your-app.railway.app/api/jobs/job_abc123/status
```

**Response:**

```json
{
  "success": true,
  "data": {
    "jobId": "job_abc123",
    "status": "processing",
    "currentStage": "transcribing",
    "progress": 45.5,
    "elapsedTimeMs": 120000,
    "estimatedTimeRemainingMs": 180000,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:32:00Z",
    "videoUrl": null,
    "error": null
  }
}
```

**Pipeline Stages:**
- `uploaded`: Video uploaded to storage
- `auto-editing`: Removing silence and filler content
- `transcribing`: Converting speech to text
- `storing-transcript`: Saving transcript to Google Sheets
- `detecting-highlights`: Identifying key moments
- `generating-plan`: AI creating editing plan
- `rendering`: Applying effects and animations
- `uploading`: Uploading final video to storage
- `completed`: Processing complete
- `failed`: Processing failed

---

### Download Final Video

Get download URL for the final processed video.

**Endpoint:** `GET /api/jobs/:jobId/download`

**Parameters:**
- `jobId` (path, required): Job ID

**Example:**

```bash
curl https://your-app.railway.app/api/jobs/job_abc123/download
```

**Response:**

```json
{
  "success": true,
  "data": {
    "jobId": "job_abc123",
    "downloadUrl": "https://s3.wasabisys.com/bucket/final/video.mp4?signature=...",
    "expiresIn": "7 days",
    "message": "Download URL is valid for 7 days"
  }
}
```

---

## Export & Integration APIs

### Get SRT Subtitles

Download subtitle file in SRT or JSON format.

**Endpoint:** `GET /api/export/srt/:jobId`

**Parameters:**
- `jobId` (path, required): Job ID
- `format` (query, optional): `srt` (default) or `json`

**Example (SRT format):**

```bash
curl https://your-app.railway.app/api/export/srt/job_abc123 \
  -o subtitles.srt
```

**Example (JSON format):**

```bash
curl "https://your-app.railway.app/api/export/srt/job_abc123?format=json"
```

**Response (JSON format):**

```json
{
  "success": true,
  "data": {
    "jobId": "job_abc123",
    "segments": [
      {
        "index": 1,
        "start": 0.5,
        "end": 3.2,
        "text": "Hello, welcome to my video"
      },
      {
        "index": 2,
        "start": 3.5,
        "end": 6.8,
        "text": "Today we're going to talk about..."
      }
    ]
  }
}
```

**Response (SRT format):**

```
1
00:00:00,500 --> 00:00:03,200
Hello, welcome to my video

2
00:00:03,500 --> 00:00:06,800
Today we're going to talk about...
```

---

### Export to Google Sheets

Export subtitles to Google Sheets.

**Endpoint:** `POST /api/export/sheets/:jobId`

**Parameters:**
- `jobId` (path, required): Job ID

**Request Body (optional):**

```json
{
  "title": "Custom Spreadsheet Title"
}
```

**Example:**

```bash
curl -X POST https://your-app.railway.app/api/export/sheets/job_abc123 \
  -H "Content-Type: application/json" \
  -d '{"title": "My Video Transcript"}'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "jobId": "job_abc123",
    "spreadsheetUrl": "https://docs.google.com/spreadsheets/d/abc123",
    "segmentCount": 45,
    "message": "Transcript is available in Google Sheets"
  }
}
```

---

### Get Raw Video

Download the original uploaded video.

**Endpoint:** `GET /api/export/video/:jobId/raw`

**Parameters:**
- `jobId` (path, required): Job ID

**Example:**

```bash
curl https://your-app.railway.app/api/export/video/job_abc123/raw
```

**Response:**

```json
{
  "success": true,
  "data": {
    "jobId": "job_abc123",
    "downloadUrl": "https://s3.wasabisys.com/bucket/raw/video.mp4?signature=...",
    "expiresIn": "7 days",
    "type": "raw"
  }
}
```

---

### Get Edited Video

Download the auto-edited video (after Auto Editor removes silence).

**Endpoint:** `GET /api/export/video/:jobId/edited`

**Parameters:**
- `jobId` (path, required): Job ID

**Example:**

```bash
curl https://your-app.railway.app/api/export/video/job_abc123/edited
```

**Response:**

```json
{
  "success": true,
  "data": {
    "jobId": "job_abc123",
    "downloadUrl": "https://s3.wasabisys.com/bucket/edited/video.mp4?signature=...",
    "expiresIn": "7 days",
    "type": "edited"
  }
}
```

---

### Get Final Video

Download the final rendered video with all effects and animations.

**Endpoint:** `GET /api/export/video/:jobId/final`

**Parameters:**
- `jobId` (path, required): Job ID

**Example:**

```bash
curl https://your-app.railway.app/api/export/video/job_abc123/final
```

**Response:**

```json
{
  "success": true,
  "data": {
    "jobId": "job_abc123",
    "downloadUrl": "https://s3.wasabisys.com/bucket/final/video.mp4?signature=...",
    "expiresIn": "7 days",
    "type": "final"
  }
}
```

---

### Get All Shareable Links

Get all available download links for a job (videos, subtitles, Google Sheets).

**Endpoint:** `GET /api/export/share/:jobId`

**Parameters:**
- `jobId` (path, required): Job ID

**Example:**

```bash
curl https://your-app.railway.app/api/export/share/job_abc123
```

**Response:**

```json
{
  "success": true,
  "data": {
    "jobId": "job_abc123",
    "status": "completed",
    "createdAt": "2024-01-15T10:30:00Z",
    "videos": {
      "raw": "https://s3.wasabisys.com/bucket/raw/video.mp4?signature=...",
      "edited": "https://s3.wasabisys.com/bucket/edited/video.mp4?signature=...",
      "final": "https://s3.wasabisys.com/bucket/final/video.mp4?signature=..."
    },
    "transcript": {
      "srt": "https://your-app.railway.app/api/export/srt/job_abc123",
      "json": "https://your-app.railway.app/api/export/srt/job_abc123?format=json",
      "googleSheets": "https://docs.google.com/spreadsheets/d/abc123",
      "segmentCount": 45
    }
  },
  "expiresIn": "7 days"
}
```

---

## Preview APIs

### List Available Previews

Get list of all generated preview videos.

**Endpoint:** `GET /api/preview/list`

**Example:**

```bash
curl https://your-app.railway.app/api/preview/list
```

**Response:**

```json
{
  "success": true,
  "data": {
    "previews": [
      {
        "name": "animated-text-preview.mp4",
        "path": "/previews/animated-text-preview.mp4",
        "url": "https://your-app.railway.app/previews/animated-text-preview.mp4",
        "size": 1024000,
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "count": 1
  }
}
```

---

## Health Check

### Server Health

Check if the server is running.

**Endpoint:** `GET /health`

**Example:**

```bash
curl https://your-app.railway.app/health
```

**Response:**

```json
{
  "status": "ok"
}
```

---

## Integration Examples

### Node.js / JavaScript

```javascript
// Upload video
const formData = new FormData();
formData.append('video', videoFile);
formData.append('userId', 'user123');

const uploadResponse = await fetch('https://your-app.railway.app/api/upload', {
  method: 'POST',
  body: formData
});

const { data } = await uploadResponse.json();
const jobId = data.jobId;

// Poll for status
const checkStatus = async () => {
  const response = await fetch(`https://your-app.railway.app/api/jobs/${jobId}/status`);
  const { data } = await response.json();
  
  console.log(`Status: ${data.currentStage} - ${data.progress}%`);
  
  if (data.status === 'completed') {
    // Get final video
    const videoResponse = await fetch(`https://your-app.railway.app/api/jobs/${jobId}/download`);
    const videoData = await videoResponse.json();
    console.log('Download URL:', videoData.data.downloadUrl);
  } else if (data.status === 'failed') {
    console.error('Processing failed:', data.error);
  } else {
    // Check again in 5 seconds
    setTimeout(checkStatus, 5000);
  }
};

checkStatus();
```

### Python

```python
import requests
import time

# Upload video
with open('video.mp4', 'rb') as f:
    files = {'video': f}
    data = {'userId': 'user123'}
    response = requests.post('https://your-app.railway.app/api/upload', files=files, data=data)
    
job_id = response.json()['data']['jobId']

# Poll for status
while True:
    response = requests.get(f'https://your-app.railway.app/api/jobs/{job_id}/status')
    data = response.json()['data']
    
    print(f"Status: {data['currentStage']} - {data['progress']}%")
    
    if data['status'] == 'completed':
        # Get final video
        video_response = requests.get(f'https://your-app.railway.app/api/jobs/{job_id}/download')
        download_url = video_response.json()['data']['downloadUrl']
        print(f'Download URL: {download_url}')
        break
    elif data['status'] == 'failed':
        print(f"Processing failed: {data['error']}")
        break
    
    time.sleep(5)
```

### cURL

```bash
#!/bin/bash

# Upload video
RESPONSE=$(curl -s -X POST https://your-app.railway.app/api/upload \
  -F "video=@video.mp4" \
  -F "userId=user123")

JOB_ID=$(echo $RESPONSE | jq -r '.data.jobId')
echo "Job ID: $JOB_ID"

# Poll for status
while true; do
  STATUS_RESPONSE=$(curl -s "https://your-app.railway.app/api/jobs/$JOB_ID/status")
  STATUS=$(echo $STATUS_RESPONSE | jq -r '.data.status')
  STAGE=$(echo $STATUS_RESPONSE | jq -r '.data.currentStage')
  PROGRESS=$(echo $STATUS_RESPONSE | jq -r '.data.progress')
  
  echo "Status: $STAGE - $PROGRESS%"
  
  if [ "$STATUS" = "completed" ]; then
    # Get download URL
    DOWNLOAD_RESPONSE=$(curl -s "https://your-app.railway.app/api/jobs/$JOB_ID/download")
    DOWNLOAD_URL=$(echo $DOWNLOAD_RESPONSE | jq -r '.data.downloadUrl')
    echo "Download URL: $DOWNLOAD_URL"
    break
  elif [ "$STATUS" = "failed" ]; then
    ERROR=$(echo $STATUS_RESPONSE | jq -r '.data.error')
    echo "Processing failed: $ERROR"
    break
  fi
  
  sleep 5
done
```

---

## Webhook Integration

### Zapier / Make.com

You can integrate with automation platforms using polling:

1. **Trigger**: Poll `/api/jobs/:jobId/status` every 5 minutes
2. **Condition**: Check if `status === 'completed'`
3. **Action**: Use `/api/export/share/:jobId` to get all links
4. **Send**: Email, Slack, Discord, etc.

### Example Zapier Workflow

1. **Webhook Trigger**: Receive job ID from your app
2. **Delay**: Wait 5 minutes
3. **Code**: Poll status endpoint
4. **Filter**: Only continue if completed
5. **HTTP Request**: Get shareable links
6. **Gmail**: Send email with download links

---

## Error Codes

| Status Code | Meaning |
|-------------|---------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Job or resource not found |
| 500 | Internal Server Error |

---

## Rate Limits

Currently, there are no rate limits. In production, consider implementing:
- 100 requests per hour per IP
- 10 concurrent uploads per user
- 1GB max file size per upload

---

## Best Practices

### 1. Poll Responsibly

Don't poll too frequently. Recommended intervals:
- Status checks: Every 5-10 seconds
- For long videos (>10 min): Every 30 seconds

### 2. Handle Errors Gracefully

Always check the `success` field and handle errors:

```javascript
const response = await fetch(url);
const result = await response.json();

if (!result.success) {
  console.error('API Error:', result.error);
  // Handle error
}
```

### 3. Store Job IDs

Save job IDs in your database to track processing status and retrieve results later.

### 4. Use Signed URLs Wisely

Download URLs expire after 7 days. Download and store videos if you need them longer.

### 5. Validate Before Upload

Check video format and size before uploading to avoid wasted processing time.

---

## Support

For issues or questions:
- Check logs in Railway dashboard
- Review error messages in API responses
- Contact support with job ID for troubleshooting

---

## Changelog

### v1.0.0 (2024-01-15)
- Initial API release
- Upload and processing endpoints
- Export and integration APIs
- Preview APIs
