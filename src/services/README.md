# Services Setup Guide

## Transcription Service

The transcription service supports two modes:

### 1. Local Whisper (Recommended for Development)

**Requirements:**
- Python 3.8+
- FFmpeg

**Installation:**

```bash
# Install openai-whisper
pip install -U openai-whisper

# Verify installation
python -m whisper --help
```

**Configuration:**
```env
WHISPER_USE_LOCAL=true
WHISPER_MODEL=base
```

**Available Models:**
- `tiny` - Fastest, least accurate (~1GB)
- `base` - Good balance (~1GB) **[Recommended]**
- `small` - Better accuracy (~2GB)
- `medium` - High accuracy (~5GB)
- `large` - Best accuracy (~10GB)

### 2. OpenAI Whisper API (Recommended for Production)

**Requirements:**
- OpenAI API key

**Configuration:**
```env
WHISPER_USE_LOCAL=false
OPENAI_API_KEY=your_openai_api_key
```

**Advantages:**
- No local installation required
- Faster processing (cloud-based)
- Always uses latest model
- Automatic retry with exponential backoff

## Auto Editor Service

**Requirements:**
- Python 3.8+
- FFmpeg

**Installation:**

```bash
# Install auto-editor
pip install auto-editor

# Verify installation
python -m auto_editor --help
```

## FFmpeg Installation

### Windows
```bash
# Using Chocolatey
choco install ffmpeg

# Or download from: https://ffmpeg.org/download.html
```

### macOS
```bash
brew install ffmpeg
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install ffmpeg
```

## Testing Services

Run unit tests:
```bash
npm test -- src/services/transcriptionService.test.ts
```

Run all service tests:
```bash
npm test -- src/services/
```
