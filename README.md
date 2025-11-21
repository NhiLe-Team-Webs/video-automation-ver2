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

### Quick Start

1. **Install dependencies:**
```bash
npm install
pip install -U openai-whisper auto-editor
```

2. **Create environment file:**
```bash
cp .env.local.example .env
```

3. **Configure API keys:**

**5 Required Services:**
- ✅ Gemini API (AI editing plan)
- ✅ Pexels API (B-roll footage)
- ✅ Google Sheets API (transcript storage)
- ✅ YouTube API (video upload)
- ✅ Whisper (local transcription)

**Documentation:**
- 📖 [Local Testing Guide](docs/LOCAL_TESTING_GUIDE.md) - Complete setup and testing instructions
- 🔧 [Setup Instructions](docs/SETUP_INSTRUCTION.md) - Detailed API configuration
- 🧪 [Testing Pipeline Stages](docs/TESTING_PIPELINE_STAGES.md) - Test individual components

### Detailed Setup

See [docs/LOCAL_TESTING_GUIDE.md](docs/LOCAL_TESTING_GUIDE.md) for:
- Step-by-step API key acquisition
- Environment configuration
- Testing individual pipeline stages
- Troubleshooting common issues

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

## 🚀 Quick Start - Chạy Pipeline Hoàn Chỉnh

### Cách Nhanh Nhất (1 lệnh)

**Windows:**
```bash
start-all.bat
```

**macOS/Linux:**
```bash
./start-all.sh
```

Script sẽ tự động:
1. ✅ Start Redis
2. ✅ Build project
3. ✅ Start API Server
4. ✅ Start Worker
5. ✅ Mở web interface

### Hoặc Chạy Thủ Công (3 terminals)

**Terminal 1 - Redis:**
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

**Terminal 2 - API Server:**
```bash
npm run dev
```

**Terminal 3 - Worker:**
```bash
npm run worker
```

### Upload Video

Mở browser: **http://localhost:3000/upload.html**

1. Chọn video file (mp4, mov, avi, mkv)
2. Click "Upload Video"
3. Đợi pipeline xử lý (5-15 phút)
4. Nhận YouTube link + download video final

### Xem Hướng Dẫn Chi Tiết

📖 **[Hướng Dẫn Chạy Pipeline (Tiếng Việt)](docs/HUONG_DAN_CHAY_PIPELINE.md)**

Bao gồm:
- ✅ Hướng dẫn từng bước chi tiết
- ✅ Xử lý lỗi thường gặp
- ✅ Monitor và debug
- ✅ Tùy chỉnh pipeline
- ✅ Tips & tricks

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

