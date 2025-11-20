# YouTube Upload Service

This service handles uploading videos to YouTube using the YouTube Data API v3.

## Features

- OAuth2 authentication flow
- Video upload with metadata (title, description, tags, privacy status)
- Upload progress monitoring
- Retry logic with exponential backoff (3 attempts)
- YouTube link extraction and validation
- Support for both standard and short YouTube URL formats

## Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the YouTube Data API v3

### 2. Create OAuth2 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Web application"
4. Add authorized redirect URIs (e.g., `http://localhost:3000/oauth/callback`)
5. Download the credentials JSON file

### 3. Configure Environment Variables

Add the following to your `.env` file:

```bash
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/oauth/callback
```

## Usage

### Basic Upload

```typescript
import { YouTubeUploadService } from './services/youtube';

const service = new YouTubeUploadService();

// Set OAuth2 credentials (obtained from OAuth flow)
service.setCredentials({
  access_token: 'your_access_token',
  refresh_token: 'your_refresh_token',
});

// Upload video
const result = await service.upload(
  '/path/to/video.mp4',
  {
    title: 'My Video Title',
    description: 'Video description',
    tags: ['tag1', 'tag2'],
    privacyStatus: 'private',
  }
);

console.log('Video uploaded:', result.url);
// Output: https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

### OAuth2 Flow

```typescript
// 1. Generate authorization URL
const authUrl = service.getAuthUrl();
console.log('Visit this URL to authorize:', authUrl);

// 2. User visits URL and authorizes
// 3. User is redirected back with authorization code

// 4. Exchange code for tokens
const tokens = await service.getTokensFromCode(authorizationCode);

// 5. Store tokens securely for future use
// tokens.access_token
// tokens.refresh_token
```

### Upload with Progress Monitoring

```typescript
const result = await service.upload(
  '/path/to/video.mp4',
  {
    title: 'My Video',
    description: 'Description',
  },
  (progress) => {
    console.log(`Upload progress: ${progress.percentage}%`);
    console.log(`${progress.bytesUploaded} / ${progress.totalBytes} bytes`);
  }
);
```

### Extract Video ID from URL

```typescript
const videoId = service.extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
console.log(videoId); // Output: dQw4w9WgXcQ

const videoId2 = service.extractVideoId('https://youtu.be/dQw4w9WgXcQ');
console.log(videoId2); // Output: dQw4w9WgXcQ
```

## API Reference

### `YouTubeUploadService`

#### Methods

##### `setCredentials(credentials)`

Set OAuth2 credentials for API authentication.

**Parameters:**
- `credentials.access_token` (string): OAuth2 access token
- `credentials.refresh_token` (string, optional): OAuth2 refresh token
- `credentials.expiry_date` (number, optional): Token expiry timestamp

##### `getAuthUrl(): string`

Generate OAuth2 authorization URL for user consent.

**Returns:** Authorization URL string

##### `getTokensFromCode(code: string): Promise<any>`

Exchange authorization code for access and refresh tokens.

**Parameters:**
- `code` (string): Authorization code from OAuth callback

**Returns:** Tokens object with `access_token` and `refresh_token`

##### `upload(videoPath, metadata, onProgress?): Promise<YouTubeResult>`

Upload video to YouTube with retry logic.

**Parameters:**
- `videoPath` (string): Path to video file
- `metadata` (VideoMetadata): Video metadata
  - `title` (string): Video title
  - `description` (string): Video description
  - `tags` (string[], optional): Video tags
  - `categoryId` (string, optional): YouTube category ID (default: "22" - People & Blogs)
  - `privacyStatus` ('public' | 'private' | 'unlisted', optional): Privacy status (default: 'private')
- `onProgress` (function, optional): Progress callback

**Returns:** Promise resolving to YouTubeResult
- `videoId` (string): YouTube video ID
- `url` (string): Full YouTube URL
- `status` ('uploaded' | 'processing' | 'failed'): Upload status

**Throws:** ProcessingError if upload fails after 3 attempts

##### `extractVideoId(url: string): string | null`

Extract video ID from YouTube URL.

**Parameters:**
- `url` (string): YouTube URL (standard or short format)

**Returns:** Video ID or null if invalid URL

## Error Handling

The service implements retry logic with exponential backoff:
- Attempt 1: Immediate
- Attempt 2: Wait 1 second
- Attempt 3: Wait 2 seconds
- Attempt 4: Wait 4 seconds (not used, max 3 attempts)

If all attempts fail, a `ProcessingError` is thrown with details about the failure.

## YouTube URL Formats

The service validates and supports two YouTube URL formats:

1. Standard: `https://www.youtube.com/watch?v=VIDEO_ID`
2. Short: `https://youtu.be/VIDEO_ID`

Video IDs must be exactly 11 characters (alphanumeric, underscore, hyphen).

## Testing

Run unit tests:

```bash
npm test -- src/services/youtube/youtubeUploadService.test.ts
```

## Requirements Validation

This service implements the following requirements:

- **Requirement 8.1**: Upload final video to YouTube using YouTube API
- **Requirement 8.2**: Retrieve and store YouTube video link
- **Requirement 8.4**: Retry up to 3 times with exponential backoff on failure

## Notes

- OAuth2 tokens should be stored securely (e.g., encrypted database)
- Refresh tokens allow obtaining new access tokens without user interaction
- The service uses the YouTube Data API v3 quota system
- Default video category is "22" (People & Blogs) if not specified
- Default privacy status is "private" if not specified
