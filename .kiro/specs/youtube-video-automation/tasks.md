# Implementation Plan

## Phase 1: Local Development Setup (No Docker Required)

- [ ] 1. Set up local development environment

  - Install required system dependencies: Node.js 18+, Python 3.8+, FFmpeg
  - Install Auto Editor via pip: `pip install auto-editor`
  - Initialize Node.js/TypeScript project with proper configuration
  - Configure environment variable management with dotenv
  - Set up logging infrastructure with structured JSON logging
  - Create base error handling utilities
  - Create local file storage for videos (temp directory)
  - _Requirements: 10.1, 10.2, 10.4, 10.5_

- [ ] 1.1 Write property test for environment variable configuration

  - **Property 23: Environment variable configuration**
  - **Validates: Requirements 10.4**

## Phase 2: Core Pipeline Implementation

- [x] 2. Implement video upload handler and validation

  - Create video upload endpoint with file handling
  - Implement video format validation (mp4, mov, avi, mkv)
  - Implement video metadata extraction (duration, resolution, format, file size)
  - Create job creation and storage logic
  - Implement upload error handling and user notifications
  - _Requirements: 1.1, 1.2, 1.3_

- [ ]* 2.1 Write property test for video format validation
  - **Property 2: Video format validation**
  - **Validates: Requirements 1.2, 1.3**

- [x] 3. Set up pipeline orchestrator (synchronous processing)

  - Implement pipeline orchestrator with stage sequencing
  - Create job status tracking and retrieval
  - Implement progress reporting for each pipeline stage
  - _Requirements: 1.5, 9.4_
  - _Note: Using synchronous processing instead of queue system for single-user MVP_

- [ ]* 3.1 Write property test for job status tracking
  - **Property 3: Job status tracking**
  - **Validates: Requirements 1.5**

- [x] 4. Implement Auto Editor service integration

  - Create Python CLI wrapper for Auto Editor
  - Implement video processing with configurable margin and threshold
  - Add video duration comparison logic
  - Implement resolution preservation verification
  - Add error handling and logging for Auto Editor failures
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 4.1 Write property test for Auto Editor output duration

  - **Property 5: Auto Editor output is shorter**
  - **Validates: Requirements 2.2**

- [ ]* 4.2 Write property test for resolution preservation
  - **Property 6: Resolution preservation**
  - **Validates: Requirements 2.3**

- [x] 5. Implement transcription service with Whisper

  - Create audio extraction from video using FFmpeg
  - Integrate Whisper API for transcription
  - Implement SRT file generation with proper formatting
  - Add SRT validation logic
  - Implement retry logic with exponential backoff
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 5.1 Write property test for SRT file validity

  - **Property 7: SRT file validity**
  - **Validates: Requirements 3.2**

- [ ]* 5.2 Write property test for retry with exponential backoff
  - **Property 20: Retry with exponential backoff**
  - **Validates: Requirements 3.4, 5.4, 8.4**

- [x] 6. Implement Google Sheets storage service

  - Set up Google Sheets API authentication
  - Implement transcript storage with job ID indexing
  - Implement transcript retrieval by job ID
  - Add timestamp validation for stored segments
  - _Requirements: 3.3, 3.5_

- [x] 6.1 Write property test for transcript storage round-trip

  - **Property 8: Transcript storage round-trip**
  - **Validates: Requirements 3.3**

- [ ]* 6.2 Write property test for timestamp synchronization
  - **Property 9: Timestamp synchronization**
  - **Validates: Requirements 3.5**

- [x] 7. Implement highlight detection service

  - Integrate highlight detection technology from reference implementation
  - Implement SRT analysis for keyword and sentiment detection
  - Create highlight timestamp extraction and validation
  - Implement default parameter handling for empty highlights
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 7.1 Write property test for highlight timestamp validity
  - **Property 10: Highlight timestamp validity**
  - **Validates: Requirements 4.3**

- [ ]* 7.2 Write property test for empty highlights handling
  - **Property 11: Empty highlights handling**
  - **Validates: Requirements 4.4**

- [x] 8. Implement LLM editing plan service with Gemini

  - Set up Gemini API integration
  - Create prompt template with available animation templates
  - Implement editing plan generation with all required fields
  - Add validation for animation template references
  - Implement retry logic with exponential backoff
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ]* 8.1 Write property test for editing plan structure validity
  - **Property 12: Editing plan structure validity**
  - **Validates: Requirements 5.2**

- [ ]* 8.2 Write property test for animation template existence
  - **Property 13: Animation template existence**
  - **Validates: Requirements 5.3**

- [x] 9. Implement B-roll service

  - Integrate Pexels API following MoneyPrinterTurbo patterns
  - Implement video search and download logic
  - Add video caching to avoid re-downloads
  - Implement graceful handling for missing B-roll
  - Add transition generation for B-roll segments
  - _Requirements: 7.1, 7.3, 7.4, 7.5_

- [ ]* 9.1 Write property test for B-roll insertion timestamps
  - **Property 15: B-roll insertion at correct timestamps**
  - **Validates: Requirements 7.1**

- [ ]* 9.2 Write property test for B-roll transitions
  - **Property 16: B-roll transitions exist**
  - **Validates: Requirements 7.3**

- [ ]* 9.3 Write property test for missing B-roll handling
  - **Property 17: Missing B-roll graceful handling**
  - **Validates: Requirements 7.4**

- [x] 10. Set up Remotion rendering infrastructure

  - Initialize Remotion project with TypeScript
  - Copy animation templates from remotion-templates reference
  - Copy CSS animations from animation-css reference
  - Create template loader and parameter injection system
  - Set up rendering configuration (30 FPS, 1920x1080)
  - Set up Remotion preview server for development
  - _Requirements: 6.1, 6.2, 6.3, 11.1_

- [x] 11. Implement development preview service

  - Create preview service with HTTP endpoints
  - Implement animation preview generation
  - Implement transition preview generation
  - Implement effect preview generation
  - Implement full video preview with editing plan
  - Add preview caching for performance
  - Create web-based preview interface for developers
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ]* 11.1 Write property test for animation preview generation
  - **Property 24: Animation preview generation**
  - **Validates: Requirements 11.2**

- [ ]* 11.2 Write property test for transition preview generation
  - **Property 25: Transition preview generation**
  - **Validates: Requirements 11.3**

- [ ]* 11.3 Write property test for effect preview generation
  - **Property 26: Effect preview generation**
  - **Validates: Requirements 11.4**

- [ ]* 11.4 Write property test for preview result validity
  - **Property 27: Preview result validity**
  - **Validates: Requirements 11.1, 11.5**

- [x] 12. Implement Remotion rendering service

  - Create video composition with editing plan
  - Implement animation application with timestamp synchronization
  - Add B-roll insertion with transitions
  - Implement subtitle overlay rendering
  - Add error handling and detailed logging for rendering failures
  - _Requirements: 6.4, 6.5_

- [ ]* 12.1 Write property test for animation-audio synchronization
  - **Property 14: Animation-audio synchronization**
  - **Validates: Requirements 6.4**

- [x] 13. Implement YouTube upload service

  - Set up YouTube Data API v3 integration
  - Implement OAuth2 authentication flow
  - Create video upload with metadata
  - Implement upload progress monitoring
  - Add retry logic with exponential backoff
  - Implement YouTube link extraction and validation
  - _Requirements: 8.1, 8.2, 8.4_

- [ ]* 13.1 Write property test for YouTube link format
  - **Property 18: YouTube link format**
  - **Validates: Requirements 8.2**

- [x] 14. Implement user notification system

  - Create notification service for sending YouTube links
  - Implement notification delivery tracking
  - Add job completion status updates
  - _Requirements: 8.3, 8.5_

- [ ]* 14.1 Write property test for upload notification
  - **Property 19: Upload notification sent**
  - **Validates: Requirements 8.3**

- [x] 15. Integrate all services into pipeline orchestrator

  - Wire up all services in correct sequence
  - Implement error propagation between stages
  - Add comprehensive error logging at each stage
  - Implement job status updates throughout pipeline
  - _Requirements: 1.4_

- [ ]* 15.1 Write property test for pipeline stage execution
  - **Property 1: Pipeline stage execution**
  - **Validates: Requirements 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 8.1**

- [ ]* 15.2 Write property test for pipeline completion
  - **Property 4: Pipeline completion produces YouTube link**
  - **Validates: Requirements 1.4, 8.2, 8.5**

- [ ]* 15.3 Write property test for error logging completeness
  - **Property 22: Error logging completeness**
  - **Validates: Requirements 2.4, 6.5, 10.5**

- [x] 16. Checkpoint - Ensure all core tests pass





  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: User Interface (Web Upload/Download)

- [x] 17. Create user-facing web interface





  - Build React/Vue frontend for video upload
  - Create upload form with file selection and validation
  - Implement progress bar showing pipeline stages
  - Add job status polling to display real-time progress
  - Create download/share interface for final video
  - Display YouTube link with copy-to-clipboard functionality
  - Add error display with user-friendly messages
  - _Requirements: 1.1, 1.4, 1.5_

- [x] 17.1 Create API endpoint for job status polling


  - Implement GET /api/jobs/:jobId/status endpoint
  - Return current pipeline stage and progress percentage
  - Include estimated time remaining
  - _Requirements: 1.5_

- [x] 17.2 Create API endpoint for video download


  - Implement GET /api/jobs/:jobId/download endpoint
  - Stream final video file to user
  - Set proper content-type and headers
  - _Requirements: 1.4_

- [x] 18. Checkpoint - Test UI with local pipeline










  - Upload test video through UI
  - Verify progress updates display correctly
  - Verify final video link is accessible
  - Ask the user if questions arise.

## Phase 4: Local Testing & Validation

- [x] 19. Create local testing setup guide






  - Document all required API keys (Gemini, Whisper, YouTube, Pexels, Google Sheets)
  - Create .env.local.example with all required variables
  - Write setup instructions for local development
  - Document how to test each pipeline stage independently
  - _Requirements: 10.2, 10.4_

- [ ] 20. Test complete pipeline locally













  - Upload sample video through UI
  - Verify all pipeline stages execute successfully
  - Verify final YouTube link is generated
  - Test error handling with invalid inputs
  - Verify notifications are sent correctly
  - _Requirements: 1.1, 1.4, 1.5, 9.4_

- [ ] 21. Checkpoint - All local tests pass

  - Ensure all tests pass, ask the user if questions arise.

## Phase 5: Serverless/PaaS Deployment Setup

- [x] 22. Set up object storage (Wasabi - recommended for MVP)

  - Create Wasabi account (30-day free trial, 1TB storage, no credit card)
  - Create bucket: `video-automation-bucket` in us-east-1 region
  - Generate access keys (Access Key ID + Secret Access Key)
  - Configure CORS policy for video uploads
  - Implement ObjectStorageService with S3-compatible API (Wasabi uses S3 API)
  - Replace YouTube upload with Wasabi storage upload
  - Implement B-roll and SFX deduplication tracking on Wasabi
  - Note: After 30-day trial, add credit card for $6.99/month minimum
  - _Requirements: 9.1, 9.7_

- [ ]* 22.1 Write property test for video upload-download round-trip
  - **Property 79: Video upload-download round-trip**
  - **Validates: Requirements 9.7**

- [ ]* 22.2 Write property test for signed URL validity
  - **Property 80: Signed URL validity**
  - **Validates: Requirements 9.7**

- [x] 23. ~~Set up Upstash Redis for job queue~~ (REMOVED - Single user, no queue needed)

  - _Note: Removed for single-user MVP. Using synchronous processing._

- [x] 24. Update video upload/download to use object storage





  - Modify upload handler to store videos in Wasabi instead of local filesystem
  - Update all pipeline stages to read/write from Wasabi object storage
  - Implement cleanup: delete raw videos after processing to save storage costs
  - Generate signed URLs for final video download
  - Configure lifecycle policies to auto-delete old videos after 30 days
  - _Requirements: 9.7_

- [ ] 25. Create Railway deployment configuration



  - Create Dockerfile for API server (optimized for Railway/Render)
  - Create Dockerfile for worker service (with Python + FFmpeg)
  - Create railway.json or render.yaml configuration files
  - Document environment variable setup
  - Create deployment guide with step-by-step instructions
  - _Requirements: 9.1, 9.5_

- [x] 26. Create Vercel frontend deployment





  - Create vercel.json with API proxy configuration
  - Configure build settings for static frontend
  - Set up environment variables (API_BASE_URL)
  - Test frontend deployment and API proxy
  - _Requirements: 9.1, 9.3_

- [ ] 27. Checkpoint - Deployment infrastructure ready

  - Test object storage upload/download
  - Ask the user if questions arise.

## Phase 6: Production Deployment & Monitoring

- [ ] 28. Deploy to Railway/Render

  - Connect GitHub repository to Railway/Render
  - Create API service with Dockerfile
  - Configure environment variables in platform dashboard
  - Deploy service and verify health checks
  - _Requirements: 9.1, 9.2_

- [ ] 29. Deploy frontend to Vercel

  - Connect GitHub repository to Vercel
  - Configure vercel.json with production API URL
  - Deploy frontend and test video upload flow
  - _Requirements: 9.1, 9.3_

- [ ] 30. Set up monitoring and alerting

  - Configure Railway/Render dashboard monitoring
  - Configure email/Discord/Slack alerts for errors
  - Set up UptimeRobot for uptime monitoring (free tier)
  - Create Google Sheets dashboard for job tracking
  - _Requirements: 9.5_

- [ ]* 30.1 Write property test for free tier quota monitoring
  - **Property 82: Free tier quota monitoring**
  - **Validates: Requirements 9.2, 9.6**

- [ ] 31. Test complete pipeline in production

  - Upload test video through production UI
  - Verify all pipeline stages execute successfully
  - Verify Wasabi video link is generated and accessible
  - Verify graceful degradation when approaching free tier limits
  - _Requirements: 9.2, 9.6_

- [ ] 32. Create production documentation

  - Document production URLs (frontend, API)
  - Document how to monitor jobs and errors
  - Document how to scale up when needed
  - Document cost optimization strategies
  - Document troubleshooting guide for common issues
  - _Requirements: 9.5_

- [ ] 33. Final checkpoint - Production ready

  - Verify all services are running
  - Verify monitoring is working
  - Verify documentation is complete
  - Ask the user if questions arise.

## Phase 7: Professional Editing Orchestration

**Note**: All building blocks already exist (Auto Editor, transitions, text templates, animations). This phase focuses on intelligent orchestration through LLM prompt engineering and brand kit integration.

- [x] 34. Implement sound effects service






  - Integrate Freesound API or Epidemic Sound API
  - Create sound effect search and download functionality
  - Implement local caching for downloaded sound effects
  - Add sound effect categorization (whoosh, pop, transition, zoom, text-appear)
  - Implement automatic volume adjustment (20-30% of main audio peak)
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ]* 34.1 Write property test for sound effect volume levels
  - **Property 36: Sound effect volume levels**
  - **Validates: Requirements 13.5**

- [x] 35. Implement brand kit and style guide system







  - Create brand kit JSON schema (colors, fonts, animation preferences)
  - Implement brand kit loader from config file
  - Add style guide generation based on brand kit + video metadata
  - Create style consistency validation for editing plans
  - The effects should be stylesed and professional
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_
  - _Note: Uses existing templates/transitions, just enforces consistent selection, and update for more professional and stylished_

- [ ]* 35.1 Write property test for style guide compliance
  - **Property 51: Style guide compliance**
  - **Validates: Requirements 16.5**

- [ ] 36. Implement zoom effects for Remotion







  - Add zoom transform logic to Remotion rendering (scale 1.0 → 1.2 → 1.0)
  - Configure zoom timing (400ms duration, ease-in-out)
  - Add zoom effect overlap detection and resolution
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ]* 36.1 Write property test for zoom scale and duration
  - **Property 43: Zoom scale and duration**
  - **Validates: Requirements 15.2**

- [ ]* 36.2 Write property test for no overlapping zoom effects
  - **Property 46: No overlapping zoom effects**
  - **Validates: Requirements 15.5**

- [ ] 37. Implement FFmpeg cut filters service

  - Create video quality analysis (brightness, color temperature, resolution)
  - Implement FFmpeg color grading filters
  - Add exposure correction and contrast/saturation enhancement
  - Add sharpening filter for videos below 1080p
  - Implement subtle vignette effect (10-15% edge darkening)
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [ ]* 37.1 Write property test for saturation limits
  - **Property 63: Saturation limits**
  - **Validates: Requirements 19.3**

- [x] 38. Update LLM prompt for professional editing orchestration






  - Load brand kit and available templates/transitions into prompt
  - Add instructions for consistent style selection (one transition type, one animation family)
  - Add B-roll limits (max 1 per 30 seconds, only at highlights, max 5s duration)
  - Add zoom effect generation for all highlights
  - Add sound effect selection for text/zoom/transitions
  - Add text highlight timing rules (300ms before audio, min 1s duration, 500ms gaps)
  - Add transition timing rules (300-500ms duration)
  - Add cut filter settings based on video quality
  - Validate generated plan against all rules
  - _Requirements: 12.5, 13.1, 13.2, 13.3, 14.1, 14.2, 14.3, 14.4, 15.1, 16.1, 17.1, 19.1_

- [ ]* 38.1 Write property test for B-roll frequency limit
  - **Property 37: B-roll frequency limit**
  - **Validates: Requirements 14.1**

- [ ]* 38.2 Write property test for B-roll duration limit
  - **Property 39: B-roll duration limit**
  - **Validates: Requirements 14.3**

- [ ]* 38.3 Write property test for transition duration bounds
  - **Property 32: Transition duration bounds**
  - **Validates: Requirements 12.5**

- [ ]* 38.4 Write property test for text appears before audio
  - **Property 52: Text appears before audio**
  - **Validates: Requirements 17.1**

- [ ]* 38.5 Write property test for consistent animation style family
  - **Property 47: Consistent animation style family**
  - **Validates: Requirements 16.1**

- [ ]* 38.6 Write property test for consistent transition types
  - **Property 50: Consistent transition types**
  - **Validates: Requirements 16.4**

- [ ] 39. Update Remotion rendering pipeline





  - Apply zoom effects from editing plan
  - Integrate sound effects with visual elements (FFmpeg audio mixing)
  - Apply cut filters during video processing
  - Render text highlights with early timing (300ms before audio)
  - Use only text highlights from editing plan (no continuous subtitles)
  - Apply brand kit styling to all text elements
  - _Requirements: 12.5, 13.5, 15.4, 16.5, 17.2, 18.1, 18.2, 18.3, 18.4, 19.5_

- [ ]* 39.1 Write property test for no continuous subtitles
  - **Property 56: No continuous subtitles**
  - **Validates: Requirements 18.1**

- [ ]* 39.2 Write property test for only highlighted text rendered
  - **Property 57: Only highlighted text rendered**
  - **Validates: Requirements 18.2**

- [ ] 40. Checkpoint - Professional editing orchestration complete

  - Test complete pipeline with brand kit
  - Verify smooth cuts (Auto Editor)
  - Verify consistent transitions (300-500ms, same type throughout)
  - Verify sound effects synchronized with visuals
  - Verify B-roll limited and strategic (max 1 per 30s, at highlights)
  - Verify zoom effects on all highlights (120%, 400ms)
  - Verify consistent styling (brand kit applied)
  - Verify text appears 300ms before audio
  - Verify no subtitles, only stylized text highlights
  - Verify professional cut filters applied
  - Ask the user if questions arise.

- [ ] 41. Update configuration and documentation

  - Add sound effects API configuration to .env
  - Add brand kit configuration example
  - Document LLM prompt engineering approach
  - Document rendering parameters (zoom, text timing, filters)
  - Create professional editing features guide
  - _Requirements: 10.2, 10.4_

- [ ] 42. Final checkpoint - Professional YouTube video automation complete

  - Upload test video with brand kit and verify all features
  - Verify final video is professionally edited with consistent style
  - Ask the user if questions arise.

## Phase 8: Export & Integration APIs

- [x] 43. Implement export and integration API endpoints



  - Create exportRoutes.ts for external integrations
  - Implement Google Sheets export service for SRT subtitles
  - Create shareable link generation for videos and SRT files
  - Implement webhook registration system for external apps
  - Add API documentation for integration endpoints
  - _Requirements: 1.4, 3.3, 8.2, 9.7_

- [x] 43.1 Create Google Sheets export endpoint


  - Implement POST /api/export/sheets endpoint
  - Parse SRT file from job storage
  - Format subtitles for Google Sheets (timestamp, text, duration columns)
  - Use Google Sheets API to create/update spreadsheet
  - Return shareable Google Sheets URL
  - _Requirements: 3.3_


- [ ] 43.2 Create shareable links endpoint

  - Implement GET /api/jobs/:jobId/share endpoint
  - Generate signed URLs for video download (7-day expiry)
  - Generate signed URLs for SRT file download (7-day expiry)
  - Return JSON with all shareable links and metadata
  - _Requirements: 1.4, 9.7_


- [ ] 43.3 Create SRT download endpoint

  - Implement GET /api/jobs/:jobId/srt endpoint
  - Support both raw SRT format and JSON format (query param: ?format=json)
  - Return proper content-type headers

  - _Requirements: 3.2_

- [x] 43.4 Implement webhook system (FUTURE ENHANCEMENT)



  - Create webhook registration endpoint: POST /api/webhooks/register
  - Store webhook URLs with job IDs and event types
  - Implement webhook trigger on job completion/failure
  - Add retry logic for failed webhook deliveries (3 attempts)
  - Support events: "completed", "failed", "stage_completed"
  - _Requirements: 1.5, 8.3_
  - _Note: Deferred to future release. Use polling for now._

- [ ]* 43.5 Write property test for webhook delivery
  - **Property 83: Webhook delivery on completion**
  - **Validates: Requirements 8.3**

- [ ]* 43.6 Write property test for SRT export format
  - **Property 84: SRT export format validity**
  - **Validates: Requirements 3.2, 3.3**

- [ ] 44. Create integration documentation

  - Document all export API endpoints with examples
  - Create Zapier/Make.com integration guide
  - Document webhook payload formats
  - Add example code for common integrations (Notion, Slack, Discord)
  - Create Postman collection for API testing
  - _Requirements: 10.2_

- [ ] 45. Checkpoint - Integration APIs complete

  - Test Google Sheets export with sample job
  - Test shareable link generation and access
  - Test webhook delivery to test endpoint
  - Verify API documentation is complete
  - Ask the user if questions arise.

