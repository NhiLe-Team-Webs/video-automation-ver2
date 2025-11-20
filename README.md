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

### Quick Start (5 phút)

Xem hướng dẫn nhanh: [QUICK_START.md](QUICK_START.md)

### Hướng Dẫn Đầy Đủ

1. **Cài đặt dependencies:**
```bash
npm install
pip install -U openai-whisper auto-editor
```

2. **Tạo file .env:**
```bash
# Dùng file local đơn giản cho development
cp .env.local.example .env
```

3. **Cấu hình API keys:**

📖 **Xem hướng dẫn chi tiết từng bước:** [docs/HUONG_DAN_ENV.md](docs/HUONG_DAN_ENV.md)

**5 API keys bắt buộc:**
- ✅ Gemini API (AI editing plan)
- ✅ Pexels API (B-roll footage)
- ✅ Google Sheets API (lưu transcript)
- ✅ YouTube API (upload video)
- ✅ Whisper (local, không cần API key)

**Optional (có thể bỏ qua khi dev local):**
- ⚪ Notifications (Discord/Slack webhooks)

4. **Cài đặt Redis:**
```bash
# Dùng Docker (khuyến nghị)
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

### 📚 Tài Liệu (Tiếng Việt)

**❓ Không biết bắt đầu từ đâu?** → [BAT_DAU_O_DAU.md](BAT_DAU_O_DAU.md) ⭐

**Bắt đầu tại đây:**
- 🚀 [Quick Start](QUICK_START.md) - Setup trong 5 phút
- ✅ [Checklist Setup](CHECKLIST_SETUP.md) - Track progress từng bước

**Hướng dẫn chi tiết:**
- 📖 [Hướng dẫn đầy đủ](HUONG_DAN.md) - Hướng dẫn toàn diện bằng tiếng Việt
- 🔧 [Cấu hình .env](docs/HUONG_DAN_ENV.md) - Setup từng biến môi trường ⭐
- 🎤 [Setup Whisper](docs/WHISPER_SETUP.md) - Cài đặt và tối ưu Whisper

**Tài nguyên:**
- 🔗 [Links Hữu Ích](docs/LINKS_HUU_ICH.md) - 100+ links API, tools, tutorials
- 📑 [Chỉ Mục Docs](docs/INDEX.md) - Navigate tất cả tài liệu
- 📊 [Tổng Quan](TAI_LIEU_OVERVIEW.md) - Overview tất cả docs

**Technical:**
- 🏗️ [Setup Info](SETUP.md) - Thông tin kỹ thuật về project structure

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
