# Video Upload API

## Overview

The video upload API provides endpoints for uploading videos and tracking their processing status.

## Endpoints

### POST /api/upload

Upload a video file for processing.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `video`: Video file (mp4, mov, avi, mkv)
  - `userId`: User identifier (optional, defaults to 'anonymous')

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "uuid-v4",
    "videoPath": "/path/to/video",
    "status": "queued"
  },
  "message": "Video uploaded successfully and queued for processing"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Video validation failed: Unsupported video format: txt. Supported formats: mp4, mov, avi, mkv"
}
```

### GET /api/upload/status/:jobId

Get the processing status of a video job.

**Request:**
- Method: `GET`
- URL Parameter: `jobId` - The job identifier returned from upload

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "uuid-v4",
    "status": "processing",
    "currentStage": "transcribing",
    "progress": 33,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:05:00.000Z",
    "youtubeUrl": null,
    "error": null
  }
}
```

## Validation

The video upload handler validates:

1. **File Format**: Only mp4, mov, avi, and mkv formats are supported
2. **File Integrity**: Verifies the file is not corrupted using ffmpeg metadata extraction
3. **Video Metadata**: Ensures valid duration and resolution
4. **Checksum**: Calculates MD5 checksum for file integrity verification

## Error Handling

The API returns appropriate HTTP status codes:

- `200`: Success
- `400`: Validation error (invalid format, corrupted file)
- `404`: Job not found
- `500`: Internal server error

All errors include a descriptive message to help users understand what went wrong.

## Example Usage

### Using curl

```bash
# Upload a video
curl -X POST http://localhost:3000/api/upload \
  -F "video=@/path/to/video.mp4" \
  -F "userId=user123"

# Check status
curl http://localhost:3000/api/status/job-id-here
```

### Using JavaScript

```javascript
// Upload a video
const formData = new FormData();
formData.append('video', videoFile);
formData.append('userId', 'user123');

const uploadResponse = await fetch('http://localhost:3000/api/upload', {
  method: 'POST',
  body: formData,
});

const { data } = await uploadResponse.json();
console.log('Job ID:', data.jobId);

// Check status
const statusResponse = await fetch(`http://localhost:3000/api/status/${data.jobId}`);
const status = await statusResponse.json();
console.log('Status:', status.data.status);
console.log('Progress:', status.data.progress + '%');
```
