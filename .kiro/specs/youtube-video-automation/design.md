# Design Document

## Overview

The YouTube Video Automation System is a cloud-based pipeline that transforms raw video uploads into professionally edited YouTube videos. The system orchestrates multiple specialized components in a sequential pipeline: Auto Editor for filler removal, Whisper for transcription, Google Sheets for storage, highlight detection for identifying key moments, Gemini LLM for intelligent editing plan generation, and Remotion for applying animations and effects. The final video is automatically uploaded to YouTube and the link is returned to the user.

The architecture emphasizes reusing existing open-source technologies rather than rebuilding from scratch. The system integrates Auto Editor (Python CLI), Whisper (AI transcription), Remotion (React-based video framework), and follows patterns from MoneyPrinterTurbo for B-roll insertion logic.

## Architecture

### System Architecture

```
┌─────────────┐
│   User      │
│  Upload     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Video Processing Pipeline                 │
│                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌─────────┐ │
│  │  Auto    │──▶│ Whisper  │──▶│  Google  │──▶│Highlight│ │
│  │  Editor  │   │Transcribe│   │  Sheets  │   │Detection│ │
│  └──────────┘   └──────────┘   └──────────┘   └─────────┘ │
│                                                      │       │
│                                                      ▼       │
│  ┌──────────┐   ┌──────────┐   ┌─────────────────────┐    │
│  │ YouTube  │◀──│ Remotion │◀──│   Gemini LLM        │    │
│  │  Upload  │   │ Renderer │   │  (Editing Plan)     │    │
│  └──────────┘   └──────────┘   └─────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│   User      │
│ Receives    │
│ YT Link     │
└─────────────┘
```

### Technology Stack

- **Backend**: Node.js/Python for pipeline orchestration
- **Video Processing**: 
  - Auto Editor (Python CLI) for filler removal
  - Remotion (React/TypeScript) for animation and effects
  - FFmpeg for video manipulation
- **AI Services**:
  - OpenAI Whisper for transcription
  - Google Gemini for editing plan generation
- **Storage**: Google Sheets API for transcript storage
- **Deployment**: Docker containers on cloud infrastructure (AWS/GCP/Azure)
- **Queue System**: Bull/BullMQ for job processing

### Pipeline Flow

1. **Video Upload**: User uploads raw video → System validates and stores
2. **Auto Edit**: Remove silence and filler content using Auto Editor
3. **Transcription**: Extract audio → Whisper generates SRT file
4. **Storage**: Save transcript to Google Sheets with timestamps
5. **Highlight Detection**: Analyze SRT to identify key moments
6. **LLM Planning**: Gemini generates editing plan (highlights, animations, B-roll, transitions)
7. **Rendering**: Remotion applies effects and generates final video
8. **Upload**: Push to YouTube and retrieve video link
9. **Notification**: Send YouTube link to user

## Components and Interfaces

### 1. Video Upload Handler

**Responsibility**: Accept and validate video uploads

**Interface**:
```typescript
interface VideoUploadHandler {
  uploadVideo(file: File, userId: string): Promise<UploadResult>;
  validateVideo(file: File): ValidationResult;
}

interface UploadResult {
  jobId: string;
  videoPath: string;
  status: 'queued' | 'processing' | 'failed';
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  metadata: VideoMetadata;
}

interface VideoMetadata {
  duration: number;
  resolution: { width: number; height: number };
  format: string;
  fileSize: number;
  checksum: string; // For file integrity validation
}
```

**Implementation Notes**:
- Validates video format (mp4, mov, avi, mkv)
- Checks file integrity using checksum verification (MD5 or SHA-256)
- Verifies file is not corrupted by attempting to read video metadata
- Rejects files that fail format or integrity checks with clear error messages

### 2. Auto Editor Service

**Responsibility**: Remove filler content and silence from videos

**Interface**:
```typescript
interface AutoEditorService {
  processVideo(inputPath: string, options: AutoEditorOptions): Promise<string>;
}

interface AutoEditorOptions {
  margin: string; // e.g., "0.2sec"
  editMode: 'audio' | 'motion';
  threshold: number;
}
```

**Implementation Notes**:
- Wraps Auto Editor Python CLI
- Uses `--edit audio:threshold=0.04` as default
- Adds `--margin 0.2sec` for smoother cuts
- Returns path to trimmed video

### 3. Transcription Service

**Responsibility**: Generate timestamped transcripts using Whisper

**Interface**:
```typescript
interface TranscriptionService {
  transcribe(audioPath: string): Promise<TranscriptResult>;
  extractAudio(videoPath: string): Promise<string>;
}

interface TranscriptResult {
  srtPath: string;
  segments: TranscriptSegment[];
}

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}
```

**Implementation Notes**:
- Uses OpenAI Whisper API or local Whisper model
- Generates SRT format output
- Implements retry logic (3 attempts with exponential backoff)

### 4. Google Sheets Storage Service

**Responsibility**: Store and retrieve transcripts

**Interface**:
```typescript
interface SheetsStorageService {
  saveTranscript(jobId: string, segments: TranscriptSegment[]): Promise<string>;
  getTranscript(jobId: string): Promise<TranscriptSegment[]>;
}
```

**Implementation Notes**:
- Uses Google Sheets API v4
- Creates one row per transcript segment
- Columns: Job ID, Start Time, End Time, Text

### 5. Highlight Detection Service

**Responsibility**: Identify important moments in video content

**Interface**:
```typescript
interface HighlightDetectionService {
  detectHighlights(srtPath: string): Promise<Highlight[]>;
}

interface Highlight {
  startTime: number;
  endTime: number;
  confidence: number;
  reason: string;
}
```

**Implementation Notes**:
- Analyzes transcript for keywords, sentiment, pacing
- Uses reference implementation from `planning/reference/highligh-detection`
- Returns timestamp ranges with confidence scores

### 6. LLM Editing Plan Service

**Responsibility**: Generate intelligent editing plans using Gemini

**Interface**:
```typescript
interface EditingPlanService {
  generatePlan(input: EditingPlanInput): Promise<EditingPlan>;
}

interface EditingPlanInput {
  transcript: TranscriptSegment[];
  highlights: Highlight[];
  videoDuration: number;
  videoMetadata: VideoMetadata;
  stylePreferences?: StylePreferences;
}

interface StylePreferences {
  targetAudience: 'professional' | 'casual' | 'educational' | 'entertainment';
  pacing: 'fast' | 'medium' | 'slow';
  visualStyle: 'minimal' | 'dynamic' | 'cinematic';
  maxBrollPerMinute: number; // default: 2
}

interface EditingPlan {
  highlights: HighlightEffect[];
  animations: AnimationEffect[];
  transitions: TransitionEffect[];
  brollPlacements: BrollPlacement[];
  soundEffects: SoundEffectPlacement[];
  zoomEffects: ZoomEffect[];
  textHighlights: TextHighlight[];
  styleGuide: StyleGuide;
  cutFilters: CutFilterSettings;
}

interface HighlightEffect {
  startTime: number;
  endTime: number;
  effectType: 'zoom' | 'highlight-box' | 'text-overlay';
  parameters: Record<string, any>;
}

interface AnimationEffect {
  startTime: number;
  duration: number;
  template: string; // References remotion-templates
  text?: string;
  parameters: Record<string, any>;
}

interface TransitionEffect {
  time: number;
  type: 'fade' | 'slide' | 'wipe';
  duration: number; // 300-500ms
  soundEffect?: string; // SFX ID
}

interface BrollPlacement {
  startTime: number;
  duration: number; // max 5 seconds
  searchTerm: string;
  fadeInDuration: number; // milliseconds
  fadeOutDuration: number; // milliseconds
}

interface SoundEffectPlacement {
  timestamp: number;
  effectType: 'text-appear' | 'zoom' | 'transition' | 'whoosh' | 'pop';
  soundEffectId: string;
  volume: number; // 0.0 to 1.0
}

interface TextHighlight {
  text: string;
  startTime: number; // 300ms before audio timestamp
  duration: number; // minimum 1 second
  style: TextStyle;
  soundEffect?: string;
}

interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor?: string;
  animation: 'fade-in' | 'slide-up' | 'pop' | 'typewriter';
}

interface CutFilterSettings {
  colorGrading: ColorGradingSettings;
  applySharpening: boolean;
  sharpeningIntensity: number;
  applyVignette: boolean;
  vignetteIntensity: number;
}
```

**Implementation Notes**:
- Uses Google Gemini API
- Prompt includes available animation templates from remotion-templates
- Implements retry with exponential backoff (3 attempts)
- Validates that referenced templates exist
- Enforces B-roll limit: maximum 1 per 30 seconds (2 per minute)
- Generates style guide based on video content and target audience
- Ensures text highlights appear 300ms before audio timestamp
- Selects consistent animation style family for entire video
- Assigns appropriate sound effects to each visual element
- Generates zoom effects for all highlight moments
- Specifies cut filter settings based on video quality analysis

### 7. B-roll Service

**Responsibility**: Download and insert supplementary footage

**Interface**:
```typescript
interface BrollService {
  searchAndDownload(searchTerm: string, duration: number): Promise<string>;
}
```

**Implementation Notes**:
- Follows MoneyPrinterTurbo pattern for API calls
- Uses Pexels/Pixabay APIs for stock footage
- Caches downloaded videos to avoid re-downloading
- Implements video quality validation

### 8. Remotion Rendering Service

**Responsibility**: Apply animations and effects, render final video

**Interface**:
```typescript
interface RemotionRenderingService {
  renderVideo(input: RenderInput): Promise<string>;
}

interface RenderInput {
  videoPath: string;
  editingPlan: EditingPlan;
  outputPath: string;
}
```

**Implementation Notes**:
- Uses Remotion framework with React components
- Reuses templates from `planning/reference/animation/remotion-templates`
- Applies CSS animations from `planning/reference/animation/animation-css`
- Renders at 30 FPS, 1920x1080 resolution
- Supports both portrait (9:16) and landscape (16:9) aspect ratios

### 9. YouTube Upload Service

**Responsibility**: Upload videos to YouTube and retrieve links

**Interface**:
```typescript
interface YouTubeUploadService {
  upload(videoPath: string, metadata: VideoMetadata): Promise<YouTubeResult>;
}

interface YouTubeResult {
  videoId: string;
  url: string;
  status: 'uploaded' | 'processing' | 'failed';
}
```

**Implementation Notes**:
- Uses YouTube Data API v3
- Implements OAuth2 authentication
- Retry logic (3 attempts)
- Monitors upload progress

### 10. Notification Service

**Responsibility**: Send notifications to users and system operators

**Interface**:
```typescript
interface NotificationService {
  notifyUser(userId: string, message: NotificationMessage): Promise<void>;
  notifyOperator(alert: OperatorAlert): Promise<void>;
}

interface NotificationMessage {
  type: 'completion' | 'error' | 'status';
  jobId: string;
  youtubeUrl?: string;
  message: string;
}

interface OperatorAlert {
  severity: 'error' | 'warning' | 'info';
  jobId: string;
  stage: PipelineStage;
  message: string;
  timestamp: Date;
}
```

**Implementation Notes**:
- Supports multiple notification channels (email, webhook, SMS)
- Configured via environment variables (NOTIFICATION_METHOD, NOTIFICATION_ENDPOINT)
- User notifications sent on job completion or failure
- Operator alerts sent for processing errors requiring attention
- Implements retry logic for failed notification delivery

### 11. Development Preview Service

**Responsibility**: Provide real-time preview of animations, transitions, and effects for developers

**Interface**:
```typescript
interface PreviewService {
  previewAnimation(template: string, parameters: Record<string, any>): Promise<PreviewResult>;
  previewTransition(type: TransitionType, videoSegments: VideoSegment[]): Promise<PreviewResult>;
  previewEffect(effect: EffectConfig, videoPath: string): Promise<PreviewResult>;
  previewFullVideo(editingPlan: EditingPlan, videoPath: string): Promise<PreviewResult>;
}

interface PreviewResult {
  previewUrl: string;
  duration: number;
  thumbnailUrl: string;
}

interface VideoSegment {
  videoPath: string;
  startTime: number;
  endTime: number;
}

interface EffectConfig {
  type: 'zoom' | 'highlight-box' | 'text-overlay' | 'color-grade';
  parameters: Record<string, any>;
  startTime: number;
  duration: number;
}

type TransitionType = 'fade' | 'slide' | 'wipe' | 'zoom';
```

**Implementation Notes**:
- Uses Remotion's preview server for real-time rendering
- Generates short preview clips (2-5 seconds) for quick feedback
- Caches preview results to improve performance
- Provides HTTP endpoints for web-based preview interface
- Supports hot-reload when template files change

### 12. Sound Effects Service

**Responsibility**: Retrieve and synchronize sound effects with visual elements

**Interface**:
```typescript
interface SoundEffectsService {
  searchSoundEffect(query: string, duration: number): Promise<SoundEffect>;
  applySoundEffect(videoPath: string, soundEffect: SoundEffect, timestamp: number): Promise<string>;
  validateVolumeLevels(mainAudio: AudioTrack, sfxAudio: AudioTrack): VolumeValidation;
}

interface SoundEffect {
  id: string;
  url: string;
  duration: number;
  category: 'whoosh' | 'pop' | 'transition' | 'zoom' | 'text-appear';
  volumeLevel: number; // 0.0 to 1.0
}

interface AudioTrack {
  path: string;
  peakVolume: number;
  averageVolume: number;
}

interface VolumeValidation {
  isValid: boolean;
  mainAudioPeak: number;
  sfxPeak: number;
  recommendedSfxVolume: number;
}
```

**Implementation Notes**:
- Uses Freesound API or Epidemic Sound API for sound effect library
- Caches downloaded sound effects locally
- Automatically adjusts SFX volume to 20-30% of main audio peak
- Supports multiple SFX categories for different visual effects

### 13. Cut Quality (Handled by Auto Editor)

**Responsibility**: Ensure smooth cuts without duplication or stuttering

**Implementation Notes**:
- Auto Editor service already handles smooth cuts with `--margin` parameter
- The `--margin 0.2sec` setting prevents frame duplication at cut boundaries
- Auto Editor maintains audio-video synchronization automatically
- No additional cut validation service needed - Auto Editor provides this functionality
- Properties 28-31 validate that Auto Editor produces quality cuts

### 14. Zoom Effects Service

**Responsibility**: Apply dynamic zoom effects during highlight moments

**Interface**:
```typescript
interface ZoomEffectsService {
  applyZoomEffect(config: ZoomConfig): ZoomEffect;
  validateZoomTiming(effects: ZoomEffect[]): ValidationResult;
}

interface ZoomConfig {
  startTime: number;
  endTime: number;
  targetScale: number; // e.g., 1.2 for 120%
  easingFunction: 'ease-in-out' | 'ease-in' | 'ease-out' | 'linear';
  zoomDuration: number; // milliseconds
}

interface ZoomEffect {
  id: string;
  config: ZoomConfig;
  soundEffect?: SoundEffect;
}

interface ValidationResult {
  isValid: boolean;
  conflicts: ZoomConflict[];
}

interface ZoomConflict {
  effect1: string; // effect ID
  effect2: string;
  overlapDuration: number;
  resolution: 'merge' | 'remove-second' | 'adjust-timing';
}
```

**Implementation Notes**:
- Uses Remotion's transform animations for smooth zoom
- Default zoom scale: 120% (1.2x)
- Default zoom duration: 400ms
- Uses ease-in-out easing for natural motion
- Automatically detects and resolves overlapping zoom effects

### 15. Style Guide Service

**Responsibility**: Maintain consistent visual styling across all video elements

**Interface**:
```typescript
interface StyleGuideService {
  generateStyleGuide(videoMetadata: VideoMetadata): StyleGuide;
  validateStyleConsistency(editingPlan: EditingPlan, styleGuide: StyleGuide): StyleValidation;
  applyStyleGuide(element: VisualElement, styleGuide: StyleGuide): StyledElement;
}

interface StyleGuide {
  colorScheme: ColorScheme;
  typography: Typography;
  animationTiming: AnimationTiming;
  transitionStyle: TransitionStyle;
  effectIntensity: EffectIntensity;
}

interface ColorScheme {
  primary: string; // hex color
  secondary: string;
  accent: string;
  textColor: string;
  backgroundColor: string;
}

interface Typography {
  fontFamily: string;
  fontSize: { small: number; medium: number; large: number };
  fontWeight: number;
  lineHeight: number;
}

interface AnimationTiming {
  textAppearDuration: number; // milliseconds
  textDisappearDuration: number;
  transitionDuration: number;
  zoomDuration: number;
}

interface TransitionStyle {
  type: 'fade' | 'slide' | 'wipe';
  duration: number;
  easing: string;
}

interface EffectIntensity {
  colorGrading: number; // 0.0 to 1.0
  contrast: number;
  saturation: number;
  sharpness: number;
  vignette: number;
}

interface StyleValidation {
  isConsistent: boolean;
  violations: StyleViolation[];
}

interface StyleViolation {
  element: string;
  property: string;
  expected: any;
  actual: any;
}

interface VisualElement {
  type: 'text' | 'animation' | 'transition' | 'effect';
  properties: Record<string, any>;
}

interface StyledElement extends VisualElement {
  appliedStyles: Record<string, any>;
}
```

**Implementation Notes**:
- Generates style guide based on video content and brand guidelines
- Validates all visual elements against style guide before rendering
- Automatically corrects style violations
- Supports custom style guide JSON configuration

### 16. Cut Filters Service

**Responsibility**: Apply professional color grading and visual enhancements

**Interface**:
```typescript
interface CutFiltersService {
  applyColorGrading(videoPath: string, settings: ColorGradingSettings): Promise<string>;
  applyExposureCorrection(videoPath: string): Promise<string>;
  applySharpening(videoPath: string, intensity: number): Promise<string>;
  applyVignette(videoPath: string, intensity: number): Promise<string>;
  analyzeVideoQuality(videoPath: string): QualityAnalysis;
}

interface ColorGradingSettings {
  temperature: number; // -100 to 100
  tint: number; // -100 to 100
  contrast: number; // 0.5 to 2.0
  saturation: number; // 0.5 to 1.5
  highlights: number; // -100 to 100
  shadows: number; // -100 to 100
}

interface QualityAnalysis {
  resolution: { width: number; height: number };
  averageBrightness: number;
  colorTemperature: number;
  needsSharpening: boolean;
  needsExposureCorrection: boolean;
  recommendedSettings: ColorGradingSettings;
}
```

**Implementation Notes**:
- Uses FFmpeg color filters for grading
- Analyzes video histogram to determine optimal settings
- Applies consistent color temperature across all segments
- Limits saturation boost to 1.2x to avoid oversaturation
- Applies subtle vignette (10-15% edge darkening)

### 12. Pipeline Orchestrator

**Responsibility**: Coordinate all services in the correct sequence

**Interface**:
```typescript
interface PipelineOrchestrator {
  processVideo(jobId: string): Promise<ProcessingResult>;
  getStatus(jobId: string): Promise<JobStatus>;
}

interface ProcessingResult {
  jobId: string;
  youtubeUrl: string;
  status: 'completed' | 'failed';
  error?: string;
}

interface JobStatus {
  jobId: string;
  currentStage: PipelineStage;
  progress: number;
  error?: string;
}

type PipelineStage = 
  | 'uploaded'
  | 'auto-editing'
  | 'transcribing'
  | 'storing-transcript'
  | 'detecting-highlights'
  | 'generating-plan'
  | 'rendering'
  | 'uploading'
  | 'completed'
  | 'failed';
```

### 17. API Key Management Service

**Responsibility**: Generate, validate, and manage API keys for programmatic access

**Interface**:
```typescript
interface ApiKeyService {
  generateApiKey(userId: string, name: string): Promise<ApiKeyResult>;
  validateApiKey(key: string): Promise<ValidationResult>;
  revokeApiKey(keyId: string): Promise<void>;
  listApiKeys(userId: string): Promise<ApiKey[]>;
  updateUsage(hashedKey: string): Promise<void>;
}

interface ApiKeyResult {
  key: string; // va_{64_hex_chars} - only returned once
  keyId: string;
  name: string;
  createdAt: Date;
}

interface ValidationResult {
  valid: boolean;
  userId?: string;
  keyId?: string;
  usageCount?: number;
  lastUsed?: Date;
}

interface ApiKey {
  keyId: string;
  name: string;
  hashedKey: string; // SHA-256 hash
  userId: string;
  createdAt: Date;
  lastUsed: Date | null;
  usageCount: number;
  status: 'active' | 'revoked';
}
```

**Implementation Notes**:
- Keys stored as SHA-256 hashes in Google Sheets
- Format: `va_{randomBytes(32).toString('hex')}` (64 hex chars)
- Plain key only shown once at generation
- Usage tracking updates on each API call
- Revoked keys immediately invalid

### 18. Webhook Service

**Responsibility**: Manage webhook registrations and deliver notifications

**Interface**:
```typescript
interface WebhookService {
  registerWebhook(userId: string, url: string): Promise<Webhook>;
  sendWebhook(webhookId: string, payload: WebhookPayload): Promise<void>;
  retryFailedWebhook(webhookId: string, payload: WebhookPayload): Promise<void>;
  listWebhooks(userId: string): Promise<Webhook[]>;
  deleteWebhook(webhookId: string): Promise<void>;
}

interface Webhook {
  id: string;
  userId: string;
  url: string;
  secret: string; // For HMAC signature verification
  status: 'active' | 'inactive' | 'failed';
  createdAt: Date;
  lastTriggered: Date | null;
  failureCount: number;
}

interface WebhookPayload {
  event: 'job.completed' | 'job.failed' | 'job.started';
  jobId: string;
  timestamp: string;
  data: {
    youtubeUrl?: string;
    error?: string;
    stage?: PipelineStage;
  };
}
```

**Implementation Notes**:
- Webhooks stored in Google Sheets
- Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
- HMAC-SHA256 signature in `X-Webhook-Signature` header
- Timeout: 10 seconds per webhook call
- Mark as inactive after 3 consecutive failures

### 19. Rate Limiting Middleware

**Responsibility**: Protect API from abuse and ensure fair usage

**Interface**:
```typescript
interface RateLimiter {
  checkLimit(apiKey: string): Promise<RateLimitResult>;
  incrementUsage(apiKey: string): Promise<void>;
  resetLimit(apiKey: string): Promise<void>;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // seconds
}
```

**Implementation Notes**:
- Uses Upstash Redis for rate limit tracking
- Sliding window: 100 requests per hour per API key
- Key format: `ratelimit:{apiKey}:{hour}`
- Returns `429 Too Many Requests` when exceeded
- Includes `Retry-After` header with seconds until reset

### 20. Object Storage Service

**Responsibility**: Store and retrieve videos from Cloudflare R2 or Backblaze B2

**Interface**:
```typescript
interface ObjectStorageService {
  uploadVideo(buffer: Buffer, key: string, metadata?: VideoMetadata): Promise<string>;
  downloadVideo(key: string): Promise<Buffer>;
  getSignedUrl(key: string, expiresIn: number): Promise<string>;
  deleteVideo(key: string): Promise<void>;
  listVideos(prefix: string): Promise<StorageObject[]>;
}

interface StorageObject {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
}
```

**Implementation Notes**:
- S3-compatible API (works with R2, B2, S3)
- Supports both Cloudflare R2 and Backblaze B2
- Automatic retry on network errors (3 attempts)
- Multipart upload for large files (>100MB)
- Public URLs for final videos, signed URLs for temporary access

## Data Models

### Job

```typescript
interface Job {
  id: string;
  userId: string;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
  videoMetadata: VideoMetadata;
  processingStages: StageResult[];
  finalYoutubeUrl?: string;
  error?: ErrorInfo;
}

interface StageResult {
  stage: PipelineStage;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  outputPath?: string;
  error?: string;
}

interface ErrorInfo {
  stage: PipelineStage;
  message: string;
  stack?: string;
  timestamp: Date;
}
```

### Configuration

```typescript
interface SystemConfig {
  autoEditor: {
    margin: string;
    threshold: number;
  };
  whisper: {
    model: string;
    apiKey?: string;
  };
  gemini: {
    apiKey: string;
    model: string;
  };
  googleSheets: {
    spreadsheetId: string;
    credentials: string;
  };
  pexels: {
    apiKey: string;
  };
  soundEffects: {
    apiKey: string; // Freesound or Epidemic Sound API key
    apiProvider: 'freesound' | 'epidemic-sound';
    cacheEnabled: boolean;
  };
  youtube: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  notifications: {
    method: 'email' | 'webhook' | 'sms';
    endpoint: string;
    operatorEmail?: string;
  };
  storage: {
    tempDir: string;
    cacheDir: string;
    sfxCacheDir: string;
  };
  rendering: {
    fps: number; // default: 30
    resolution: { width: number; height: number }; // default: 1920x1080
    transitionDuration: number; // 300-500ms
    zoomScale: number; // default: 1.2
    zoomDuration: number; // default: 400ms
    textLeadTime: number; // default: 300ms
    minTextDuration: number; // default: 1000ms
  };
  cutFilters: {
    enabled: boolean;
    defaultColorGrading: ColorGradingSettings;
    sharpeningThreshold: { width: number; height: number }; // Apply if below this
    vignetteIntensity: number; // 0.1-0.15
  };
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, several properties can be consolidated to avoid redundancy:

- Properties about pipeline initiation (1.1) and stage execution (2.1, 3.1, 4.1, 5.1, 6.1, 8.1) can be combined into a single comprehensive property about pipeline stage execution
- Properties about retry logic (3.4, 5.4, 8.4) share the same pattern and can be unified
- Properties about error logging (2.4, 6.5, 10.5) can be consolidated into one comprehensive error handling property
- Properties about validation (1.2, 4.3, 5.3) each validate different aspects and should remain separate

### Core Pipeline Properties

**Property 1: Pipeline stage execution**
*For any* valid video upload, the system should execute all pipeline stages in the correct sequence (upload → auto-edit → transcribe → store → detect highlights → generate plan → render → upload to YouTube), and each stage should produce valid output before the next stage begins.
**Validates: Requirements 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 8.1**

**Property 2: Video format validation**
*For any* uploaded file, the validation function should correctly identify valid video formats (mp4, mov, avi, mkv) and reject invalid formats with appropriate error messages.
**Validates: Requirements 1.2, 1.3**

**Property 3: Job status tracking**
*For any* job ID at any point in time, querying the status should return a valid pipeline stage and the stage should be one of the defined stages in the system.
**Validates: Requirements 1.5**

**Property 4: Pipeline completion produces YouTube link**
*For any* job that reaches the 'completed' status, the job record should contain a valid YouTube URL in the format `https://www.youtube.com/watch?v={videoId}`.
**Validates: Requirements 1.4, 8.2, 8.5**

### Video Processing Properties

**Property 5: Auto Editor output is shorter**
*For any* video processed by Auto Editor, the duration of the output video should be less than or equal to the duration of the input video.
**Validates: Requirements 2.2**

**Property 6: Resolution preservation**
*For any* video processed through Auto Editor, the output video resolution (width × height) should equal the input video resolution.
**Validates: Requirements 2.3**

### Transcription Properties

**Property 7: SRT file validity**
*For any* transcription output, the generated SRT file should be valid (proper format with sequential numbering, timestamp format HH:MM:SS,mmm --> HH:MM:SS,mmm, and non-empty text).
**Validates: Requirements 3.2**

**Property 8: Transcript storage round-trip**
*For any* transcript stored in Google Sheets, retrieving it by job ID should return segments that match the original SRT file content.
**Validates: Requirements 3.3**

**Property 9: Timestamp synchronization**
*For any* stored transcript segment, the start timestamp should be less than the end timestamp, and all timestamps should be within the video duration.
**Validates: Requirements 3.5**

### Highlight Detection Properties

**Property 10: Highlight timestamp validity**
*For any* list of detected highlights, each highlight should have start < end, and both timestamps should be within the video duration bounds.
**Validates: Requirements 4.3**

**Property 11: Empty highlights handling**
*For any* video where no highlights are detected (empty highlight list), the system should generate an editing plan with default parameters and continue processing.
**Validates: Requirements 4.4**

### LLM and Editing Plan Properties

**Property 12: Editing plan structure validity**
*For any* editing plan generated by the LLM, the plan should contain all required fields (highlights, animations, transitions, brollPlacements) and each effect should have valid timestamps within video duration.
**Validates: Requirements 5.2**

**Property 13: Animation template existence**
*For any* animation effect in an editing plan, the referenced template name should correspond to an existing file in the remotion-templates directory.
**Validates: Requirements 5.3**

### Rendering Properties

**Property 14: Animation-audio synchronization**
*For any* rendered video with animations, the animation start times in the final video should match the timestamps specified in the editing plan within a tolerance of 100ms.
**Validates: Requirements 6.4**

### B-roll Properties

**Property 15: B-roll insertion at correct timestamps**
*For any* B-roll placement in the editing plan, the B-roll footage should appear in the final video at the specified timestamp (within 100ms tolerance).
**Validates: Requirements 7.1**

**Property 16: B-roll transitions exist**
*For any* B-roll insertion, there should be transition effects at both the start and end of the B-roll segment.
**Validates: Requirements 7.3**

**Property 17: Missing B-roll graceful handling**
*For any* B-roll placement where footage is unavailable, the system should continue processing without the B-roll and log a warning message containing the search term.
**Validates: Requirements 7.4**

### YouTube Upload Properties

**Property 18: YouTube link format**
*For any* successful YouTube upload, the returned URL should match the pattern `https://www.youtube.com/watch?v=[11-character video ID]` or `https://youtu.be/[11-character video ID]`.
**Validates: Requirements 8.2**

**Property 19: Upload notification sent**
*For any* completed upload, the user associated with the job should receive a notification containing the YouTube URL through the configured notification method.
**Validates: Requirements 8.3**

**Property 24: Operator notification on errors**
*For any* processing error that requires operator attention (Auto Editor failures, rendering failures), the system should send an alert to the system operator containing the job ID, stage, and error details.
**Validates: Requirements 2.4**

**Property 25: File integrity validation**
*For any* uploaded video file, the validation process should verify both format correctness and file integrity (non-corrupted), rejecting files that fail either check.
**Validates: Requirements 1.2, 1.3**

### Reliability Properties

**Property 20: Retry with exponential backoff**
*For any* external API call (Whisper, Gemini, YouTube) that fails, the system should retry exactly 3 times with exponentially increasing delays (e.g., 1s, 2s, 4s) before marking the job as failed.
**Validates: Requirements 3.4, 5.4, 8.4**

**Property 21: Concurrent job isolation**
*For any* set of jobs uploaded concurrently, each job should process independently without data corruption, and all jobs should eventually reach either 'completed' or 'failed' status.
**Validates: Requirements 9.4**

**Property 22: Error logging completeness**
*For any* error that occurs during pipeline processing, the system should log an entry containing the job ID, pipeline stage, error message, and timestamp.
**Validates: Requirements 2.4, 6.5, 10.5**

**Property 23: Environment variable configuration**
*For any* external service integration (Whisper, Gemini, Google Sheets, Pexels, YouTube), the API keys and configuration should be loaded from environment variables, not hardcoded.
**Validates: Requirements 10.4**

### API Key Management Properties

**Property 66: API key format**
*For any* generated API key, the format should match the pattern `va_[64 hexadecimal characters]`.
**Validates: Requirements 20.1**

**Property 67: API key validation**
*For any* API request with an API key, the system should validate the key and reject invalid keys with HTTP 401 status.
**Validates: Requirements 20.2, 20.3**

**Property 68: API key usage tracking**
*For any* valid API key used in a request, the system should increment the usage count and update the last used timestamp.
**Validates: Requirements 20.4**

**Property 69: API key revocation**
*For any* revoked API key, subsequent requests using that key should be rejected with HTTP 401 status.
**Validates: Requirements 20.5**

**Property 70: API key storage round-trip**
*For any* API key stored in Google Sheets, retrieving it by hashed key should return the correct user ID and metadata.
**Validates: Requirements 23.1, 23.2**

### Rate Limiting Properties

**Property 71: Rate limit enforcement**
*For any* API key that exceeds 100 requests in an hour, the 101st request should be rejected with HTTP 429 status.
**Validates: Requirements 21.1**

**Property 72: Rate limit reset**
*For any* API key that was rate limited, after the hour window expires, requests should be allowed again.
**Validates: Requirements 21.3**

**Property 73: Independent rate limits**
*For any* two different API keys, the rate limit counter for one key should not affect the counter for the other key.
**Validates: Requirements 21.4**

### Webhook Properties

**Property 74: Webhook URL validation**
*For any* webhook registration, the URL should be validated as a proper HTTP/HTTPS URL before storage.
**Validates: Requirements 22.1**

**Property 75: Webhook delivery on completion**
*For any* job that completes successfully, if a webhook is registered for that user, the system should send a POST request to the webhook URL with job details.
**Validates: Requirements 22.2**

**Property 76: Webhook delivery on failure**
*For any* job that fails, if a webhook is registered for that user, the system should send a POST request to the webhook URL with error information.
**Validates: Requirements 22.3**

**Property 77: Webhook retry logic**
*For any* webhook delivery that fails, the system should retry exactly 3 times with exponential backoff before marking as failed.
**Validates: Requirements 22.4**

**Property 78: Webhook storage round-trip**
*For any* webhook stored in Google Sheets, retrieving it by user ID should return the correct webhook URL and status.
**Validates: Requirements 23.3**

### Object Storage Properties

**Property 79: Video upload-download round-trip**
*For any* video buffer uploaded to object storage, downloading it by the same key should return an identical buffer.
**Validates: Requirements 9.7**

**Property 80: Signed URL validity**
*For any* signed URL generated for a video, accessing the URL within the expiration time should successfully retrieve the video.
**Validates: Requirements 9.7**

### Deployment Properties

**Property 81: Serverless cold start handling**
*For any* API request after 15 minutes of inactivity, the system should respond within 60 seconds (accounting for cold start).
**Validates: Requirements 9.2**

**Property 82: Free tier quota monitoring**
*For any* service with free tier limits (Redis commands, storage, compute hours), the system should track usage and warn when approaching limits.
**Validates: Requirements 9.2, 9.6**

### Development Preview Properties

**Property 24: Animation preview generation**
*For any* animation template with valid parameters, the preview service should generate a preview video that successfully renders the animation.
**Validates: Requirements 11.2**

**Property 25: Transition preview generation**
*For any* transition type with two valid video segments, the preview service should generate a preview showing the transition effect between the segments.
**Validates: Requirements 11.3**

**Property 26: Effect preview generation**
*For any* effect configuration with a valid video path, the preview service should generate a preview demonstrating the effect applied to the video.
**Validates: Requirements 11.4**

**Property 27: Preview result validity**
*For any* successful preview generation, the preview result should contain a valid URL, positive duration, and valid thumbnail URL.
**Validates: Requirements 11.1, 11.5**

### Smooth Transitions and Cut Quality Properties

**Property 28: No frame duplication at cuts**
*For any* video with cut points, analyzing frames at cut boundaries should reveal zero duplicate frames.
**Validates: Requirements 12.1**

**Property 29: Consistent frame timing in transitions**
*For any* transition between scenes, the frame timing should maintain consistent intervals without stuttering (frame time variance < 5ms).
**Validates: Requirements 12.2**

**Property 30: Audio-video sync at cuts**
*For any* cut boundary in the edited video, the audio-video synchronization offset should be less than 50ms.
**Validates: Requirements 12.3**

**Property 31: No repeated words at cuts**
*For any* cut boundary, analyzing the transcript should reveal no repeated words or phrases within 500ms before and after the cut.
**Validates: Requirements 12.4**

**Property 32: Transition duration bounds**
*For any* scene transition, the duration should be between 300ms and 500ms inclusive.
**Validates: Requirements 12.5**

### Sound Effects Properties

**Property 33: Text highlights have sound effects**
*For any* text highlight in the editing plan, there should be a corresponding sound effect placement within 50ms of the text appearance timestamp.
**Validates: Requirements 13.1**

**Property 34: Zoom effects have sound effects**
*For any* zoom effect in the editing plan, there should be a corresponding whoosh or zoom sound effect within 50ms of the zoom start timestamp.
**Validates: Requirements 13.2**

**Property 35: Transitions have sound effects**
*For any* transition in the editing plan, there should be a corresponding transition sound effect at the transition timestamp.
**Validates: Requirements 13.3**

**Property 36: Sound effect volume levels**
*For any* sound effect placement, the sound effect volume should be between 20% and 30% of the main audio track peak volume.
**Validates: Requirements 13.5**

### B-roll Placement Properties

**Property 37: B-roll frequency limit**
*For any* editing plan, the number of B-roll placements divided by video duration in seconds should be at most 1 per 30 seconds (0.0333 per second).
**Validates: Requirements 14.1**

**Property 38: B-roll at highlights**
*For any* B-roll placement, there should be at least one highlight whose timestamp range overlaps with or is within 5 seconds of the B-roll timestamp.
**Validates: Requirements 14.2**

**Property 39: B-roll duration limit**
*For any* B-roll placement, the duration should be at most 5 seconds.
**Validates: Requirements 14.3**

**Property 40: B-roll fade transitions**
*For any* B-roll placement, both fadeInDuration and fadeOutDuration should be greater than 0ms.
**Validates: Requirements 14.4**

**Property 41: B-roll distribution across topics**
*For any* video with multiple topics (segments), B-roll placements should be distributed such that each topic segment has at least one B-roll if the segment is longer than 30 seconds.
**Validates: Requirements 14.5**

### Zoom Effects Properties

**Property 42: Highlights have zoom effects**
*For any* highlight in the editing plan, there should be a corresponding zoom effect starting at the highlight start timestamp (within 100ms tolerance).
**Validates: Requirements 15.1**

**Property 43: Zoom scale and duration**
*For any* zoom effect, the target scale should be 1.2 (120%) and the zoom duration should be 400ms.
**Validates: Requirements 15.2**

**Property 44: Zoom in-out pairing**
*For any* zoom-in effect at a highlight start, there should be a corresponding zoom-out effect at the highlight end timestamp returning to scale 1.0.
**Validates: Requirements 15.3**

**Property 45: Smooth zoom easing**
*For any* zoom effect, the easing function should be one of: 'ease-in-out', 'ease-in', or 'ease-out' (not 'linear').
**Validates: Requirements 15.4**

**Property 46: No overlapping zoom effects**
*For any* pair of zoom effects, their time ranges should not overlap (effect1.endTime <= effect2.startTime or effect2.endTime <= effect1.startTime).
**Validates: Requirements 15.5**

### Style Consistency Properties

**Property 47: Consistent animation style family**
*For any* editing plan, all animation templates should belong to the same style family (e.g., all 'modern', all 'minimal', or all 'dynamic').
**Validates: Requirements 16.1**

**Property 48: Consistent text styling**
*For any* set of text highlights in an editing plan, all should have the same fontFamily, color scheme (within style guide), and animation timing.
**Validates: Requirements 16.2**

**Property 49: Consistent effect intensity**
*For any* set of effects of the same type, the intensity and duration values should be identical or within 10% variance.
**Validates: Requirements 16.3**

**Property 50: Consistent transition types**
*For any* editing plan, all transitions should use the same transition type throughout the video.
**Validates: Requirements 16.4**

**Property 51: Style guide compliance**
*For any* visual element in the editing plan, validating it against the style guide should return isConsistent: true with zero violations.
**Validates: Requirements 16.5**

### Text Highlight Timing Properties

**Property 52: Text appears before audio**
*For any* text highlight, the startTime should be exactly 300ms before the corresponding audio timestamp from the transcript.
**Validates: Requirements 17.1**

**Property 53: Text display duration**
*For any* text highlight, the duration should be at least the spoken phrase duration plus 200ms.
**Validates: Requirements 17.2**

**Property 54: Text highlight gaps**
*For any* pair of consecutive text highlights, the gap between the first highlight's end and the second highlight's start should be at least 500ms.
**Validates: Requirements 17.3**

**Property 55: Minimum text duration**
*For any* text highlight where the spoken phrase is shorter than 800ms, the display duration should be at least 1000ms.
**Validates: Requirements 17.5**

### Subtitle Exclusion Properties

**Property 56: No continuous subtitles**
*For any* rendered video, analyzing the video tracks should reveal no continuous subtitle overlay track.
**Validates: Requirements 18.1**

**Property 57: Only highlighted text rendered**
*For any* editing plan with highlights, the set of text overlays in the final video should exactly match the set of highlighted phrases (no additional text).
**Validates: Requirements 18.2**

**Property 58: Stylized text formatting**
*For any* text highlight, the text style should include custom fontFamily, fontSize, and animation properties (not default subtitle formatting).
**Validates: Requirements 18.3**

**Property 59: Text-sound synchronization**
*For any* text highlight, there should be a sound effect placement at the same timestamp (within 50ms).
**Validates: Requirements 18.4**

**Property 60: No text without highlights**
*For any* video with zero highlights, the final rendered video should contain zero text overlays.
**Validates: Requirements 18.5**

### Cut Filters Properties

**Property 61: Consistent color temperature**
*For any* set of video segments in the final video, the color temperature variance should be less than 10% of the mean color temperature.
**Validates: Requirements 19.1**

**Property 62: Normalized brightness**
*For any* video with varying lighting conditions (brightness variance > 20%), the output video should have brightness variance reduced to less than 10%.
**Validates: Requirements 19.2**

**Property 63: Saturation limits**
*For any* video with color grading applied, the saturation multiplier should be at most 1.5x and contrast should be between 0.8x and 1.3x.
**Validates: Requirements 19.3**

**Property 64: Sharpening for low resolution**
*For any* video with resolution below 1920x1080, the cut filter settings should include applySharpening: true.
**Validates: Requirements 19.4**

**Property 65: Vignette application**
*For any* rendered video, the cut filter settings should include applyVignette: true with intensity between 0.1 and 0.15.
**Validates: Requirements 19.5**

## Error Handling

### Error Categories

1. **Validation Errors**: Invalid video format, corrupted files, missing metadata
   - Response: Immediate rejection with user-friendly error message
   - No retry

2. **Processing Errors**: Auto Editor failures, Whisper transcription errors, Remotion rendering failures
   - Response: Log detailed error, mark job as failed, notify user
   - No retry (these are typically deterministic failures)

3. **External API Errors**: Gemini API failures, YouTube API failures, Pexels API failures
   - Response: Retry with exponential backoff (3 attempts)
   - If all retries fail, mark job as failed and notify user

4. **Storage Errors**: Google Sheets API failures, file system errors
   - Response: Retry with exponential backoff (3 attempts)
   - Critical for data persistence

### Error Recovery Strategy

```typescript
interface ErrorHandler {
  handleError(error: Error, context: ErrorContext): Promise<ErrorResolution>;
}

interface ErrorContext {
  jobId: string;
  stage: PipelineStage;
  attemptNumber: number;
}

interface ErrorResolution {
  action: 'retry' | 'fail' | 'skip';
  delay?: number;
  userMessage: string;
}
```

### Logging Strategy

- **Structured Logging**: Use JSON format for all logs
- **Log Levels**: ERROR, WARN, INFO, DEBUG
- **Required Fields**: timestamp, jobId, stage, message, metadata
- **Error Logs**: Include stack traces and context
- **Performance Logs**: Track duration of each pipeline stage

## Testing Strategy

### Unit Testing

Unit tests will verify individual components in isolation:

1. **Video Upload Handler**: Test file validation logic with various formats
2. **Auto Editor Service**: Test CLI wrapper with mock subprocess calls
3. **Transcription Service**: Test SRT parsing and validation
4. **Highlight Detection**: Test timestamp extraction and validation
5. **LLM Service**: Test prompt generation and response parsing
6. **Remotion Service**: Test template loading and parameter passing
7. **YouTube Service**: Test OAuth flow and upload logic

### Property-Based Testing

Property-based tests will verify universal properties across many inputs using **fast-check** (JavaScript/TypeScript property testing library). Each test will run a minimum of 100 iterations.

**Test Configuration**:
```typescript
import fc from 'fast-check';

// Configure to run 100 iterations minimum
const testConfig = { numRuns: 100 };
```

**Property Test Examples**:

1. **Property 1: Pipeline stage execution**
   - Generate: Random valid video files
   - Test: All stages execute in sequence
   - Tag: **Feature: youtube-video-automation, Property 1: Pipeline stage execution**

2. **Property 2: Video format validation**
   - Generate: Random file extensions and formats
   - Test: Validation correctly identifies valid/invalid formats
   - Tag: **Feature: youtube-video-automation, Property 2: Video format validation**

3. **Property 7: SRT file validity**
   - Generate: Random transcription outputs
   - Test: All SRT files follow correct format
   - Tag: **Feature: youtube-video-automation, Property 7: SRT file validity**

4. **Property 8: Transcript storage round-trip**
   - Generate: Random transcript segments
   - Test: Store then retrieve produces identical data
   - Tag: **Feature: youtube-video-automation, Property 8: Transcript storage round-trip**

5. **Property 10: Highlight timestamp validity**
   - Generate: Random highlight lists
   - Test: All timestamps are valid (start < end, within bounds)
   - Tag: **Feature: youtube-video-automation, Property 10: Highlight timestamp validity**

6. **Property 13: Animation template existence**
   - Generate: Random editing plans
   - Test: All referenced templates exist
   - Tag: **Feature: youtube-video-automation, Property 13: Animation template existence**

7. **Property 20: Retry with exponential backoff**
   - Generate: Random API failure scenarios
   - Test: Exactly 3 retries with exponential delays
   - Tag: **Feature: youtube-video-automation, Property 20: Retry with exponential backoff**

8. **Property 21: Concurrent job isolation**
   - Generate: Random sets of concurrent jobs
   - Test: No data corruption, all jobs complete
   - Tag: **Feature: youtube-video-automation, Property 21: Concurrent job isolation**

9. **Property 28: No frame duplication at cuts**
   - Generate: Random videos with cut points
   - Test: Zero duplicate frames at boundaries
   - Tag: **Feature: youtube-video-automation, Property 28: No frame duplication at cuts**

10. **Property 32: Transition duration bounds**
    - Generate: Random scene transitions
    - Test: All durations between 300-500ms
    - Tag: **Feature: youtube-video-automation, Property 32: Transition duration bounds**

11. **Property 33: Text highlights have sound effects**
    - Generate: Random editing plans with text highlights
    - Test: Each text highlight has corresponding SFX
    - Tag: **Feature: youtube-video-automation, Property 33: Text highlights have sound effects**

12. **Property 37: B-roll frequency limit**
    - Generate: Random editing plans with various durations
    - Test: B-roll rate <= 1 per 30 seconds
    - Tag: **Feature: youtube-video-automation, Property 37: B-roll frequency limit**

13. **Property 39: B-roll duration limit**
    - Generate: Random B-roll placements
    - Test: All durations <= 5 seconds
    - Tag: **Feature: youtube-video-automation, Property 39: B-roll duration limit**

14. **Property 42: Highlights have zoom effects**
    - Generate: Random editing plans with highlights
    - Test: Each highlight has corresponding zoom effect
    - Tag: **Feature: youtube-video-automation, Property 42: Highlights have zoom effects**

15. **Property 43: Zoom scale and duration**
    - Generate: Random zoom effects
    - Test: All have scale=1.2 and duration=400ms
    - Tag: **Feature: youtube-video-automation, Property 43: Zoom scale and duration**

16. **Property 46: No overlapping zoom effects**
    - Generate: Random sets of zoom effects
    - Test: No time range overlaps
    - Tag: **Feature: youtube-video-automation, Property 46: No overlapping zoom effects**

17. **Property 47: Consistent animation style family**
    - Generate: Random editing plans
    - Test: All animations from same style family
    - Tag: **Feature: youtube-video-automation, Property 47: Consistent animation style family**

18. **Property 52: Text appears before audio**
    - Generate: Random text highlights with audio timestamps
    - Test: Text startTime = audioTime - 300ms
    - Tag: **Feature: youtube-video-automation, Property 52: Text appears before audio**

19. **Property 55: Minimum text duration**
    - Generate: Random text highlights with short phrases
    - Test: Duration >= 1000ms for phrases < 800ms
    - Tag: **Feature: youtube-video-automation, Property 55: Minimum text duration**

20. **Property 63: Saturation limits**
    - Generate: Random color grading settings
    - Test: Saturation <= 1.5x, contrast 0.8-1.3x
    - Tag: **Feature: youtube-video-automation, Property 63: Saturation limits**

### Integration Testing

Integration tests will verify component interactions:

1. **Auto Editor → Transcription**: Verify trimmed video produces valid transcript
2. **Transcription → Google Sheets**: Verify storage and retrieval
3. **Highlight Detection → LLM**: Verify editing plan generation
4. **LLM → Remotion**: Verify template application
5. **End-to-End**: Upload video → receive YouTube link

### Testing Tools

- **Unit Tests**: Jest or Vitest
- **Property-Based Tests**: fast-check (minimum 100 iterations per property)
- **Integration Tests**: Supertest for API testing
- **E2E Tests**: Playwright for full pipeline testing
- **Mocking**: Mock external APIs (Whisper, Gemini, YouTube) for faster tests

### Test Data

- **Sample Videos**: Short test videos (5-30 seconds) in various formats
- **Sample Transcripts**: Pre-generated SRT files for testing
- **Mock Responses**: Saved API responses from Gemini, YouTube
- **Animation Templates**: Use actual templates from remotion-templates directory

## Deployment Architecture

### Serverless/PaaS Infrastructure (MVP-Optimized)

**Recommended Stack**: Vercel + Railway/Render + Wasabi + Upstash Redis

**Design Rationale**: This architecture prioritizes free tier optimization and minimal operational overhead for MVP deployment. Wasabi's 30-day free trial (1TB) provides ample time to validate the product before committing to paid storage. Total estimated cost: $0 for first 30 days, then $7-13/month.

```
┌─────────────────────────────────────────────────────────┐
│                  Vercel Edge Network                     │
│              (Frontend + Static Assets)                  │
│                   FREE: 100GB/month                      │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Railway/Render Web Service                  │
│                    (API Server)                          │
│              FREE: 500 hours/month                       │
│         - Video upload endpoints                         │
│         - Job status API                                 │
│         - API key authentication                         │
│         - Rate limiting                                  │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│  Upstash Redis   │    │  Google Sheets   │
│  (Job Queue)     │    │  (Database)      │
│  FREE: 10k       │    │  FREE: Unlimited │
│  commands/day    │    │  - Job metadata  │
└────────┬─────────┘    │  - Transcripts   │
         │              │  - API keys      │
         │              │  - Webhooks      │
         │              └──────────────────┘
         ▼
┌─────────────────────────────────────────────────────────┐
│           Railway/Render Background Workers              │
│              FREE: 500 hours/month                       │
│         (Separate service from API)                      │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Auto Editor  │  │ Transcription│  │  Remotion    │ │
│  │   Worker     │  │   Worker     │  │  Renderer    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    Wasabi Storage                        │
│                  (Object Storage)                        │
│         FREE TRIAL: 1TB for 30 days (no CC)             │
│         Then: $6.99/month minimum                        │
│         - Raw uploaded videos                            │
│         - Processed video segments                       │
│         - Final rendered videos                          │
│         - B-roll cache                                   │
│         - Sound effects cache                            │
└─────────────────────────────────────────────────────────┘

External APIs (Pay-per-use):
- OpenAI Whisper: Transcription
- Google Gemini: Editing plan generation
- Pexels/Pixabay: B-roll footage
- Freesound: Sound effects
- YouTube Data API: Video upload
```

**Alternative Stack Options**:

1. **Wasabi** instead of Cloudflare R2 (Recommended for MVP):
   - FREE TRIAL: 1TB storage for 30 days (no credit card required)
   - After trial: $6.99/month minimum (still cheaper than alternatives)
   - No egress fees (unlimited downloads)
   - S3-compatible API (easy migration)
   - **Best for MVP**: 30 days free trial gives time to validate product

2. **Backblaze B2** (Budget option after trial):
   - FREE: 10GB storage + 1GB download/day
   - Pay-as-you-go: $0.005/GB storage + $0.01/GB download
   - Good for low-traffic MVP

3. **Fly.io** instead of Railway/Render:
   - FREE: 3 shared-cpu VMs (256MB RAM each)
   - Better for compute-intensive tasks
   - No sleep on free tier

4. **Modal Labs** for video processing workers:
   - FREE: 30 compute hours/month
   - GPU access for AI tasks
   - Better for heavy video processing

### Container Configuration

**API Server Dockerfile** (Railway/Render):
```dockerfile
FROM node:18-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --production

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

**Worker Dockerfile** (Railway/Render):
```dockerfile
FROM node:18

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

# Install Auto Editor
RUN pip3 install auto-editor

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --production

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

CMD ["node", "dist/worker.js"]
```

**Vercel Configuration** (vercel.json):
```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/public/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "https://your-railway-api.up.railway.app/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/src/public/$1"
    }
  ]
}

### Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3000
MAX_CONCURRENT_JOBS=5

# LLM Configuration
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-pro

# Transcription
WHISPER_API_KEY=your_openai_api_key
WHISPER_MODEL=whisper-1

# Google Sheets (Database + API Keys + Webhooks)
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SHEETS_CREDENTIALS=base64_encoded_credentials

# Stock Footage
PEXELS_API_KEY=your_pexels_api_key

# Sound Effects
FREESOUND_API_KEY=your_freesound_api_key

# YouTube
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret
YOUTUBE_REDIRECT_URI=your_redirect_uri

# Object Storage (Wasabi - Recommended for MVP)
WASABI_ACCESS_KEY_ID=your_wasabi_access_key
WASABI_SECRET_ACCESS_KEY=your_wasabi_secret_key
WASABI_BUCKET_NAME=video-automation-bucket
WASABI_REGION=us-east-1
WASABI_ENDPOINT=s3.us-east-1.wasabisys.com

# Alternative: Backblaze B2 (after Wasabi trial):
# B2_APPLICATION_KEY_ID=your_b2_key_id
# B2_APPLICATION_KEY=your_b2_key
# B2_BUCKET_NAME=video-automation-bucket
# B2_BUCKET_ID=your_bucket_id

# Redis Queue (Upstash)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# API Security
JWT_SECRET=your_super_secret_jwt_key
API_RATE_LIMIT=100
WEBHOOK_SECRET=your_webhook_secret

# Deployment Platform URLs
API_BASE_URL=https://your-api.up.railway.app
FRONTEND_URL=https://your-app.vercel.app
```

### Scaling Strategy

**Free Tier Optimization**:
- **API Server**: Single instance on Railway/Render free tier (500 hours/month)
- **Worker**: Single instance on Railway/Render free tier (500 hours/month)
- **Queue**: Upstash Redis free tier (10,000 commands/day = ~7 commands/minute)
- **Storage**: Wasabi 30-day free trial (1TB storage, unlimited egress)

**When to Scale Up** (Beyond Free Tier):
1. **After 30 days**: Wasabi requires credit card, $6.99/month minimum (still cheaper than alternatives)
2. **>500 hours/month usage**: Upgrade Railway to Hobby ($5/month) or Render to Starter ($7/month)
3. **>10k Redis commands/day**: Upgrade Upstash to Pay-as-you-go ($0.2 per 100k commands)
4. **>1TB storage**: Wasabi charges $0.0099/GB/month (very cheap, no egress fees)
5. **High concurrency**: Add more worker instances on Railway/Render

**Graceful Degradation**:
- When free tier limits reached, queue jobs instead of rejecting
- Display estimated wait time to users
- Send email notifications when jobs complete (async)

### Monitoring

**Free Monitoring Tools**:
- **Railway/Render Dashboard**: Built-in metrics (CPU, memory, requests)
- **Upstash Console**: Redis command count and latency
- **Cloudflare R2 Dashboard**: Storage usage and bandwidth
- **Application Logs**: Structured JSON logging to stdout (captured by platform)
- **Google Sheets**: Job status tracking and error logs

**Alerting** (Free Options):
- **Email Alerts**: Send via Gmail API when errors occur
- **Discord/Slack Webhooks**: Free notification channels
- **Uptime Monitoring**: UptimeRobot free tier (50 monitors)

### Deployment Process

**Vercel (Frontend)**:
1. Connect GitHub repository to Vercel
2. Configure build command: `npm run build` (if needed)
3. Set environment variables in Vercel dashboard
4. Auto-deploy on push to main branch

**Railway/Render (API + Workers)**:
1. Connect GitHub repository to Railway/Render
2. Create two services: `api` and `worker`
3. Configure Dockerfiles for each service
4. Set environment variables in platform dashboard
5. Auto-deploy on push to main branch
6. Health check endpoint: `GET /health`

**Manual Deployment Steps**:
```bash
# 1. Push code to GitHub
git push origin main

# 2. Vercel auto-deploys frontend
# 3. Railway/Render auto-deploys API + workers

# 4. Verify deployment
curl https://your-api.up.railway.app/health
curl https://your-app.vercel.app

# 5. Test video upload
# Upload test video through UI
# Check job status in Google Sheets
```

### Deployment Documentation

**Required Documentation** (per Requirement 9.5):

1. **Infrastructure Requirements**:
   - **Frontend**: Vercel account (free tier: 100GB bandwidth/month)
   - **API + Workers**: Railway or Render account (free tier: 500 hours/month each)
   - **Queue**: Upstash Redis account (free tier: 10,000 commands/day)
   - **Storage**: Wasabi account (30-day free trial: 1TB, then $6.99/month)
   - **Database**: Google Sheets (free, unlimited)
   - **Estimated costs**:
     - MVP first 30 days (free trial): $0/month
     - After trial (light usage): $7-13/month (Wasabi + potential Railway upgrade)
     - Medium usage (1000-5000 videos/month): $20-50/month
     - Heavy usage (>5000 videos/month): $100-300/month

2. **Setup Procedures**:
   
   **Step 1: Google Sheets Setup**
   - Create new Google Spreadsheet
   - Create sheets: `jobs`, `transcripts`, `api_keys`, `webhooks`
   - Enable Google Sheets API in Google Cloud Console
   - Create service account and download credentials JSON
   - Share spreadsheet with service account email
   
   **Step 2: Wasabi Storage Setup**
   - Create Wasabi account (30-day free trial, no credit card required)
   - Create bucket: `video-automation-bucket` in us-east-1 region
   - Generate access keys (Access Key ID + Secret Access Key)
   - Configure CORS policy for video uploads
   - Note: After 30-day trial, add credit card to continue ($6.99/month minimum)
   
   **Step 3: Upstash Redis Setup**
   - Create Upstash account
   - Create Redis database (free tier)
   - Copy REST URL and REST Token
   
   **Step 4: External API Keys**
   - OpenAI: Get API key for Whisper
   - Google Gemini: Get API key from Google AI Studio
   - Pexels: Get free API key from pexels.com/api
   - Freesound: Get API key from freesound.org/apiv2
   - YouTube: Set up OAuth2 credentials in Google Cloud Console
   
   **Step 5: Railway Deployment**
   - Connect GitHub repository to Railway
   - Create two services: `api` and `worker`
   - Set Dockerfile path for each service
   - Add all environment variables
   - Deploy both services
   
   **Step 6: Vercel Deployment**
   - Connect GitHub repository to Vercel
   - Configure `vercel.json` with API proxy rules
   - Add environment variables (API_BASE_URL)
   - Deploy frontend

3. **Configuration Guide**:
   - See "Environment Variables" section above for complete list
   - **Security best practices**:
     - Never commit `.env` files to git
     - Use platform secret management (Railway/Vercel environment variables)
     - Rotate API keys every 90 days
     - Use HTTPS only for all endpoints
     - Validate webhook URLs before registration
   - **Scaling configuration**:
     - `MAX_CONCURRENT_JOBS`: Start with 5, increase based on worker capacity
     - `API_RATE_LIMIT`: Start with 100/hour, adjust based on abuse patterns
     - Worker instances: Start with 1, add more when queue depth > 10

4. **Operational Procedures**:
   - **Monitoring**:
     - Check Railway/Render dashboard for CPU/memory usage
     - Monitor Upstash Redis command count
     - Track Cloudflare R2 storage usage
     - Review Google Sheets for job status and errors
   - **Troubleshooting**:
     - Cold starts: First request after inactivity may take 30-60s
     - Rate limits: Check Upstash dashboard for Redis command usage
     - Storage full: Clean up old videos from R2 bucket
     - Worker crashes: Check Railway/Render logs for errors
   - **Backup**:
     - Google Sheets: Automatic backup by Google
     - R2 videos: Set lifecycle policy to archive after 30 days
     - Configuration: Keep `.env.example` updated in git
   - **Cost optimization**:
     - Delete processed videos after YouTube upload
     - Cache B-roll and sound effects to reduce API calls
     - Use Cloudflare R2 (free egress) instead of S3 (paid egress)
     - Monitor free tier usage and upgrade only when needed

**Design Rationale**: This serverless/PaaS architecture minimizes operational overhead and costs for MVP deployment while maintaining scalability. The free tier optimization allows testing and initial user acquisition without financial risk, and the architecture can scale incrementally as usage grows.
