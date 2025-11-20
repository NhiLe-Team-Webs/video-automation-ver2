# YouTube Video Automation System

Automated YouTube video editing system that transforms raw video uploads into professionally edited videos.

## Project Structure

```
.
├── src/
│   ├── api/                    # REST API routes
│   ├── config/                 # Configuration management
│   ├── models/                 # Data models
│   ├── utils/                  # Utility functions (logging, errors)
│   ├── remotion/               # Video rendering templates & animations
│   ├── services/               # Business logic services (organized by domain)
│   │   ├── video-processing/   # Auto Editor service
│   │   ├── transcription/      # Whisper & Google Sheets storage
│   │   ├── content-analysis/   # Highlight detection & LLM editing plan
│   │   ├── media/              # B-roll service
│   │   ├── upload/             # Video upload handler
│   │   └── pipeline/           # Pipeline orchestration & job management
│   ├── server.ts               # API server entry point
│   └── worker.ts               # Worker node entry point
├── scripts/                    # Utility scripts
├── docs/                       # Documentation
├── dist/                       # Compiled TypeScript output
├── temp/                       # Temporary file storage
├── cache/                      # Cached resources (B-roll, etc.)
├── logs/                       # Application logs
├── Dockerfile.api              # API server Docker configuration
├── Dockerfile.worker           # Worker node Docker configuration
├── docker-compose.yml          # Local development setup
└── .env.example                # Environment variable template
```

### Services Architecture

Services are organized by domain for better maintainability:

- **video-processing**: Auto Editor integration for removing silence/filler
- **transcription**: Whisper transcription + Google Sheets storage
- **content-analysis**: Highlight detection + Gemini LLM editing plan generation
- **media**: B-roll footage search and download (Pexels API)
- **upload**: Video upload handling and validation
- **pipeline**: Job orchestration, queue management, and status tracking

Each service folder contains:
- Main service implementation
- Unit tests
- Property-based tests (where applicable)
- Example/manual test files

## Setup
1. **Install dependencies:**
```bash
npm install
pip install -U openai-whisper auto-editor
```

2. **Create file .env:**
```bash
# Dùng file local đơn giản cho development
cp .env.local.example .env
```

3. **Config API keys:**
   
**5 Required Stacks:**
- ✅ Gemini API (AI editing plan)
- ✅ Pexels API (B-roll footage)
- ✅ Google Sheets API (lưu transcript)
- ✅ YouTube API (upload video)
- ✅ Whisper (local)

**Technical:**
- 🏗️ [Setup Info](SETUP_INSTRUCTION.md) - Technical instructions

## Development

Run in development mode:
```bash
npm run dev
```

Build TypeScript:
```bash
npm run build
```

Run tests:
```bash
npm test
```

## Docker Deployment

Start all services:
```bash
docker-compose up
```

Build and start in detached mode:
```bash
docker-compose up -d --build
```

## Architecture

The system uses a pipeline architecture with the following stages:
1. Video Upload & Validation
2. Auto Editor (filler removal)
3. Transcription (Whisper)
4. Storage (Google Sheets)
5. Highlight Detection
6. LLM Editing Plan (Gemini)
7. Rendering (Remotion)
8. YouTube Upload

## Requirements

- Node.js 18+
- Redis
- Python 3 (for Auto Editor and Whisper)
- FFmpeg
- Docker (for containerized deployment)

### Python Dependencies

The system uses local Whisper (open-source) instead of OpenAI API:

```bash
pip install -U openai-whisper auto-editor
```

Available Whisper models:
- `tiny` - Fastest, least accurate (~1GB)
- `base` - Good balance (default, ~1GB)
- `small` - Better accuracy (~2GB)
- `medium` - High accuracy (~5GB)
- `large` - Best accuracy (~10GB)

