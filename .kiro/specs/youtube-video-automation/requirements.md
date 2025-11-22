# Requirements Document

## Introduction

This document specifies requirements for an automated YouTube video editing system that transforms raw video uploads into professionally edited videos. The system processes videos through a pipeline that includes automatic editing, transcription, highlight detection, AI-driven planning, animation application, and YouTube upload. The system leverages existing open-source technologies and is designed for cloud deployment.

## Glossary

- **System**: The automated YouTube video editing system
- **User**: A person who uploads raw video content to be processed
- **Raw Video**: Unedited video content uploaded by the user
- **Auto Editor**: A component that removes filler content and silence from videos
- **Whisper**: An AI transcription service that converts speech to text
- **Transcript**: Text representation of spoken content in the video with timestamps
- **Google Sheet**: Cloud-based spreadsheet service used for storing transcripts
- **Highlight Detection**: Technology that identifies important moments in video content
- **Highlight**: A significant moment or segment in the video worthy of emphasis
- **LLM**: Large Language Model (Gemini) used for generating editing plans
- **Editing Plan**: AI-generated instructions for applying highlights, animations, and transitions
- **B-roll**: Supplementary footage inserted to enhance the main video content
- **Animation**: Visual effects applied to enhance video presentation
- **Transition**: Visual effect used between video segments
- **Remotion**: A framework for creating videos programmatically using React
- **Final Video**: The fully processed and edited video ready for upload
- **YouTube Upload**: The process of publishing the final video to YouTube platform
- **SRT File**: SubRip Subtitle file format containing timestamped transcription data
- **Cloud Deployment**: Running the system on cloud infrastructure for scalability
- **Sound Effect (SFX)**: Audio elements added to enhance visual effects and transitions
- **Cut Filter**: Color grading and visual enhancement applied to video segments
- **Zoom Effect**: Dynamic scaling animation applied to emphasize content
- **Text Highlight**: Stylized text overlay displaying key phrases from the transcript
- **Frame Duplication**: Unintended repetition of video frames at cut boundaries
- **Audio-Video Synchronization**: Alignment of audio and video tracks at precise timestamps
- **Style Guide**: Defined parameters for consistent visual aesthetics across the video
- **Easing Function**: Mathematical function controlling animation acceleration and deceleration
- **Color Grading**: Process of adjusting color temperature, contrast, and saturation
- **Vignette Effect**: Subtle darkening of image edges to focus attention on center content

## Requirements

### Requirement 1

**User Story:** As a user, I want to upload raw video content to the system, so that I can receive a professionally edited video without manual editing work.

#### Acceptance Criteria

1. WHEN a user uploads a video file THEN the System SHALL accept the file and initiate the processing pipeline
2. WHEN the video upload is complete THEN the System SHALL validate the video format and file integrity
3. WHEN an invalid video file is uploaded THEN the System SHALL reject the file and notify the user with a clear error message
4. WHEN the processing pipeline completes THEN the System SHALL provide the user with a YouTube link to the final video
5. WHERE the user requests processing status THEN the System SHALL display the current pipeline stage and progress

### Requirement 2

**User Story:** As a system operator, I want the system to automatically remove filler content from raw videos, so that the final output is concise and engaging.

#### Acceptance Criteria

1. WHEN a raw video enters the pipeline THEN the System SHALL process it through Auto Editor to remove silence and filler content
2. WHEN Auto Editor completes processing THEN the System SHALL produce a trimmed video with filler segments removed
3. WHEN the trimmed video is generated THEN the System SHALL preserve the original video quality and resolution
4. WHEN Auto Editor encounters processing errors THEN the System SHALL log the error and notify the system operator

### Requirement 3

**User Story:** As a system operator, I want the system to generate accurate transcripts from video audio, so that I can enable highlight detection and content analysis.

#### Acceptance Criteria

1. WHEN the trimmed video is ready THEN the System SHALL extract audio and send it to Whisper for transcription
2. WHEN Whisper completes transcription THEN the System SHALL generate an SRT file with timestamped text
3. WHEN the SRT file is generated THEN the System SHALL store the transcript in Google Sheet for persistence
4. WHEN transcription fails THEN the System SHALL retry up to three times before reporting failure
5. WHEN the transcript is stored THEN the System SHALL maintain synchronization between timestamps and video segments

### Requirement 4

**User Story:** As a system operator, I want the system to identify highlight moments in videos, so that important content can be emphasized in the final edit.

#### Acceptance Criteria

1. WHEN the SRT file is available THEN the System SHALL analyze it using Highlight Detection technology
2. WHEN Highlight Detection completes THEN the System SHALL produce a list of timestamp ranges identifying highlight moments
3. WHEN highlights are identified THEN the System SHALL validate that each highlight has valid start and end timestamps
4. WHEN no highlights are detected THEN the System SHALL proceed with default editing parameters
5. Use technology in planning\reference\highligh-detection to use.

### Requirement 5

**User Story:** As a system operator, I want an LLM to generate intelligent editing plans, so that videos receive appropriate animations, transitions, and B-roll placement.

#### Acceptance Criteria

1. WHEN highlights are identified THEN the System SHALL send the highlight data and transcript to the LLM (Gemini)
2. WHEN the LLM processes the input THEN the System SHALL generate an editing plan specifying highlight placements, animations, transitions, and B-roll insertions
3. WHEN the editing plan is generated THEN the System SHALL validate that all specified effects reference available animation templates
4. WHEN the LLM API fails THEN the System SHALL retry with exponential backoff up to three attempts
5. WHERE the editing plan includes B-roll THEN the System SHALL ensure B-roll placement logic follows patterns from MoneyPrinterTurbo reference implementation

### Requirement 6

**User Story:** As a system operator, I want the system to apply animations and effects to videos, so that the final output is visually engaging and professional.

#### Acceptance Criteria

1. WHEN the editing plan is ready THEN the System SHALL apply specified animations using Remotion framework
2. WHEN applying animations THEN the System SHALL use pre-existing templates from the remotion-templates reference without rebuilding from scratch
3. WHEN applying CSS animations THEN the System SHALL reuse animation-css reference implementations without rebuilding from scratch
4. WHEN rendering the final video THEN the System SHALL ensure all animations are synchronized with the audio timeline
5. WHEN animation rendering fails THEN the System SHALL log detailed error information and halt the pipeline

### Requirement 7

**User Story:** As a system operator, I want the system to insert B-roll footage intelligently, so that videos are more engaging and visually diverse.

#### Acceptance Criteria

1. WHEN the editing plan specifies B-roll insertion THEN the System SHALL insert B-roll footage at the designated timestamps
2. WHEN inserting B-roll THEN the System SHALL follow the API calling logic from MoneyPrinterTurbo reference implementation
3. WHEN B-roll is inserted THEN the System SHALL ensure smooth transitions between main content and B-roll footage
4. WHEN B-roll footage is unavailable THEN the System SHALL proceed without B-roll and log the missing resource
5. Read the source code to learn how it works: planning\reference\MoneyPrinterTurbo

### Requirement 8

**User Story:** As a system operator, I want the system to upload finished videos to YouTube automatically, so that users can access their content immediately.

#### Acceptance Criteria

1. WHEN the final video is rendered THEN the System SHALL upload it to YouTube using YouTube API
2. WHEN the upload completes THEN the System SHALL retrieve and store the YouTube video link
3. WHEN the YouTube link is obtained THEN the System SHALL send it to the user through the configured notification method
4. WHEN YouTube upload fails THEN the System SHALL retry up to three times before reporting failure to the user
5. WHEN the upload succeeds THEN the System SHALL mark the processing job as complete

### Requirement 9

**User Story:** As a system administrator, I want to deploy the system to serverless/PaaS infrastructure with minimal cost, so that I can run an MVP without expensive cloud bills.

#### Acceptance Criteria

1. THE System SHALL be deployable to serverless or PaaS platforms (Vercel, Railway, Fly.io, Render) with documented procedures
2. THE System SHALL optimize for free tier constraints including cold starts, compute limits, and storage quotas
3. THE System SHALL separate frontend, API, and worker components for independent scaling
4. WHEN multiple videos are uploaded concurrently THEN the System SHALL queue and process them without conflicts using serverless-compatible queue systems
5. THE System SHALL include deployment documentation for Vercel (frontend), Railway/Render (API + workers), Cloudflare R2/Backblaze B2 (storage), and Upstash Redis (queue)
6. THE System SHALL support graceful degradation when free tier limits are reached
7. THE System SHALL use object storage (R2, B2, S3) instead of local filesystem for video files

### Requirement 10

**User Story:** As a developer, I want the system to have a simple and maintainable codebase, so that I can understand, modify, and extend it easily.

#### Acceptance Criteria

1. THE System SHALL reuse existing open-source technologies without rebuilding components from scratch
2. THE System SHALL have a clear modular architecture separating pipeline stages
3. THE System SHALL include code documentation explaining integration points with reference implementations
4. THE System SHALL use environment variables for all external service configurations
5. THE System SHALL include error handling and logging at each pipeline stage

### Requirement 11

**User Story:** As a developer, I want to preview videos with animations, transitions, and effects during development, so that I can easily test and refine the editing features.

#### Acceptance Criteria

1. THE System SHALL provide a development preview interface for viewing rendered videos
2. WHEN a developer applies an animation THEN the System SHALL display a real-time preview of the animation effect
3. WHEN a developer applies a transition THEN the System SHALL display a preview showing the transition between video segments
4. WHEN a developer applies effects THEN the System SHALL display a preview of the effect on the video
5. THE System SHALL allow developers to preview individual components (animations, transitions, effects) in isolation before applying them to the full video

### Requirement 12

**User Story:** As a content creator, I want smooth transitions between video segments without stuttering or duplicate content, so that the final video flows naturally and professionally.

#### Acceptance Criteria

1. WHEN the System cuts between video segments THEN the System SHALL ensure no frame duplication occurs at cut points
2. WHEN the System applies transitions between scenes THEN the System SHALL maintain consistent frame timing without stuttering
3. WHEN the Auto Editor removes segments THEN the System SHALL preserve audio-video synchronization at all cut boundaries
4. WHEN rendering the final video THEN the System SHALL validate that no repeated words or phrases occur across cut boundaries
5. WHEN applying scene transitions THEN the System SHALL use smooth transition effects with consistent duration between 300ms and 500ms

### Requirement 13

**User Story:** As a content creator, I want appropriate sound effects synchronized with visual elements, so that the video is more engaging and professional.

#### Acceptance Criteria

1. WHEN the editing plan includes text highlights THEN the System SHALL add synchronized sound effects for text appearance
2. WHEN the editing plan includes zoom effects THEN the System SHALL add synchronized whoosh or zoom sound effects
3. WHEN the editing plan includes transitions THEN the System SHALL add appropriate transition sound effects
4. WHEN selecting sound effects THEN the System SHALL use an API service to access a diverse library of professional sound effects
5. WHEN applying sound effects THEN the System SHALL ensure sound effect volume does not overpower the main audio track

### Requirement 14

**User Story:** As a content creator, I want B-roll footage inserted only at strategic moments, so that the video remains focused without excessive visual clutter.

#### Acceptance Criteria

1. WHEN the LLM generates an editing plan THEN the System SHALL limit B-roll insertions to a maximum of one per 30 seconds of video
2. WHEN selecting B-roll placement THEN the System SHALL prioritize moments identified as highlights or key points
3. WHEN inserting B-roll THEN the System SHALL ensure B-roll duration does not exceed 5 seconds per insertion
4. WHEN B-roll is inserted THEN the System SHALL apply smooth fade transitions at both entry and exit points
5. WHEN the video contains multiple topics THEN the System SHALL distribute B-roll placements evenly across different topics

### Requirement 15

**User Story:** As a content creator, I want dynamic zoom effects applied during highlight moments, so that important content receives visual emphasis.

#### Acceptance Criteria

1. WHEN a highlight moment is detected THEN the System SHALL apply a zoom-in effect at the highlight start timestamp
2. WHEN a zoom-in effect is applied THEN the System SHALL zoom to 120% scale over a duration of 400ms
3. WHEN a highlight moment ends THEN the System SHALL apply a zoom-out effect returning to 100% scale
4. WHEN applying zoom effects THEN the System SHALL use smooth easing functions to avoid jarring motion
5. WHEN multiple highlights occur in sequence THEN the System SHALL ensure zoom effects do not overlap or conflict

### Requirement 16

**User Story:** As a content creator, I want all animations, effects, and transitions to follow a consistent visual style, so that the video appears professionally edited with a cohesive aesthetic.

#### Acceptance Criteria

1. WHEN the LLM generates an editing plan THEN the System SHALL select animations from a single consistent style family
2. WHEN applying text animations THEN the System SHALL use consistent font, color scheme, and animation timing throughout the video
3. WHEN applying visual effects THEN the System SHALL maintain consistent effect intensity and duration across all applications
4. WHEN applying transitions THEN the System SHALL use the same transition type for similar scene changes throughout the video
5. WHEN rendering the final video THEN the System SHALL validate that all visual elements follow the defined style guide parameters

### Requirement 17

**User Story:** As a content creator, I want text highlights to appear slightly before the corresponding spoken words, so that viewers can read the text as the point is being made.

#### Acceptance Criteria

1. WHEN the editing plan includes text highlights THEN the System SHALL display text 300ms before the corresponding audio timestamp
2. WHEN text appears on screen THEN the System SHALL maintain the text display for the full duration of the spoken phrase plus 200ms
3. WHEN multiple text highlights occur in sequence THEN the System SHALL ensure a minimum gap of 500ms between consecutive text displays
4. WHEN text timing is calculated THEN the System SHALL account for average reading speed to ensure text is readable
5. WHEN the spoken phrase is very short THEN the System SHALL extend text display duration to a minimum of 1 second

### Requirement 18

**User Story:** As a content creator, I want the final video to exclude full subtitles and only show text highlights with sound effects, so that the video is cleaner and more engaging.

#### Acceptance Criteria

1. WHEN rendering the final video THEN the System SHALL not include continuous subtitle overlays
2. WHEN the editing plan includes highlights THEN the System SHALL render only highlighted text phrases as visual overlays
3. WHEN text highlights are rendered THEN the System SHALL apply stylized text effects rather than standard subtitle formatting
4. WHEN text highlights appear THEN the System SHALL synchronize sound effects with text appearance
5. WHEN the video contains no highlights THEN the System SHALL render the video without any text overlays

### Requirement 19

**User Story:** As a content creator, I want professional cut filters applied to video segments, so that the final video has a polished, high-quality appearance.

#### Acceptance Criteria

1. WHEN rendering video segments THEN the System SHALL apply color grading filters to maintain consistent color temperature
2. WHEN the video contains varying lighting conditions THEN the System SHALL apply exposure correction to normalize brightness
3. WHEN applying filters THEN the System SHALL enhance contrast and saturation within professional limits to avoid oversaturation
4. WHEN the video resolution is below 1080p THEN the System SHALL apply sharpening filters to improve perceived quality
5. WHEN rendering the final video THEN the System SHALL apply a subtle vignette effect to focus viewer attention on the center content

### Requirement 20

**User Story:** As an API consumer, I want to authenticate using API keys, so that I can programmatically access the video automation service.

#### Acceptance Criteria

1. WHEN a user requests an API key THEN the System SHALL generate a unique key with format `va_{random_64_hex_chars}`
2. WHEN an API request is made THEN the System SHALL validate the API key from the `X-API-Key` header
3. WHEN an invalid API key is provided THEN the System SHALL reject the request with HTTP 401 status
4. WHEN a valid API key is used THEN the System SHALL track usage count and last used timestamp
5. WHEN a user revokes an API key THEN the System SHALL immediately invalidate it for future requests

### Requirement 21

**User Story:** As an API consumer, I want rate limiting protection, so that the service remains available and prevents abuse.

#### Acceptance Criteria

1. WHEN API requests exceed 100 per hour per API key THEN the System SHALL reject additional requests with HTTP 429 status
2. WHEN rate limit is reached THEN the System SHALL include `Retry-After` header indicating when requests can resume
3. WHEN rate limit resets THEN the System SHALL allow requests to proceed normally
4. THE System SHALL apply rate limits per API key independently
5. THE System SHALL exclude health check endpoints from rate limiting

### Requirement 22

**User Story:** As an API consumer, I want webhook notifications for job completion, so that I can integrate video processing into my workflow without polling.

#### Acceptance Criteria

1. WHEN a user registers a webhook URL THEN the System SHALL validate the URL format and store it
2. WHEN a job completes successfully THEN the System SHALL send a POST request to the registered webhook with job details and YouTube URL
3. WHEN a job fails THEN the System SHALL send a POST request to the webhook with error information
4. WHEN webhook delivery fails THEN the System SHALL retry up to 3 times with exponential backoff
5. WHEN webhook delivery fails after all retries THEN the System SHALL log the failure and mark the webhook as inactive

### Requirement 23

**User Story:** As a system administrator, I want API keys and webhooks stored in Google Sheets, so that I can leverage existing free storage infrastructure.

#### Acceptance Criteria

1. WHEN an API key is generated THEN the System SHALL store the hashed key, user ID, name, and metadata in Google Sheets
2. WHEN validating an API key THEN the System SHALL query Google Sheets by hashed key value
3. WHEN a webhook is registered THEN the System SHALL store the webhook URL, user ID, and status in Google Sheets
4. WHEN API key usage is tracked THEN the System SHALL update the usage count and last used timestamp in Google Sheets
5. THE System SHALL use a separate sheet tab for API keys and another for webhooks within the same spreadsheet
