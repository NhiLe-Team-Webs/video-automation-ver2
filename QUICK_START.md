# Quick Start - 5 Phút Setup

Hướng dẫn nhanh để chạy được project trong 5 phút! ⚡

## Bước 1: Cài Đặt Dependencies (2 phút)

```bash
# Node.js packages
npm install

# Python packages
pip install -U openai-whisper auto-editor

# FFmpeg
# Windows:
choco install ffmpeg
# macOS:
brew install ffmpeg
# Linux:
sudo apt install ffmpeg

# Redis (dùng Docker - dễ nhất)
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

## Bước 2: Tạo File .env (2 phút)

```bash
cp .env.example .env
```

Mở `.env` và điền **TỐI THIỂU** các thông tin này:

```bash
# 1. Gemini API (MIỄN PHÍ)
# Lấy tại: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=AIzaSy...

# 2. Pexels API (MIỄN PHÍ)
# Lấy tại: https://www.pexels.com/api/
PEXELS_API_KEY=563492ad...

# 3. Google Sheets (CẦN SETUP)
# Xem: docs/HUONG_DAN_ENV.md phần Google Sheets
GOOGLE_SHEETS_SPREADSHEET_ID=1BxiMVs...
GOOGLE_SHEETS_CREDENTIALS=./google-credentials.json

# 4. YouTube API (CẦN SETUP)
# Xem: docs/HUONG_DAN_ENV.md phần YouTube
YOUTUBE_CLIENT_ID=123456789-xxx.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=GOCSPX-xxx
YOUTUBE_REDIRECT_URI=http://localhost:3000/oauth/callback

# 5. Notification (TÙY CHỌN - có thể bỏ qua)
NOTIFICATION_METHOD=webhook
NOTIFICATION_ENDPOINT=https://discord.com/api/webhooks/xxx

# Các biến khác để mặc định
```

**⚠️ Lưu ý:** Google Sheets và YouTube cần setup phức tạp hơn. Xem hướng dẫn chi tiết tại [docs/HUONG_DAN_ENV.md](docs/HUONG_DAN_ENV.md)

## Bước 3: Chạy (1 phút)

### Cách 1: Docker Compose (Khuyến nghị)

```bash
docker-compose up
```

Xong! Mở browser: http://localhost:3000

### Cách 2: Manual

**Terminal 1 - API Server:**
```bash
npm run dev
```

**Terminal 2 - Worker:**
```bash
npm run worker
```

## Kiểm Tra

```bash
# Test Redis
redis-cli ping
# Phải trả về: PONG

# Test FFmpeg
ffmpeg -version

# Test Whisper
whisper --help

# Test API
curl http://localhost:3000/health
```

## Test Upload Video

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "video=@test-video.mp4" \
  -F "userId=test-user"
```

## Nếu Gặp Lỗi

### Redis không chạy
```bash
docker start redis
```

### Port 3000 đã được dùng
Đổi trong `.env`:
```bash
PORT=3001
```

### Thiếu biến môi trường
Xem file `.env.example` và so sánh với `.env` của bạn

## Hướng Dẫn Chi Tiết

- 📖 [Hướng dẫn đầy đủ](HUONG_DAN.md)
- 🔧 [Setup .env chi tiết](docs/HUONG_DAN_ENV.md)
- 🎤 [Setup Whisper](docs/WHISPER_SETUP.md)

## Các API Keys Miễn Phí

### 1. Gemini (1 phút)
1. Vào: https://makersuite.google.com/app/apikey
2. Đăng nhập Google
3. Click "Create API Key"
4. Copy và paste vào `.env`

### 2. Pexels (2 phút)
1. Vào: https://www.pexels.com/api/
2. Đăng ký tài khoản
3. Vào "Your API Key"
4. Copy và paste vào `.env`

### 3. Google Sheets (5-10 phút)
Phức tạp hơn, xem hướng dẫn chi tiết: [docs/HUONG_DAN_ENV.md](docs/HUONG_DAN_ENV.md#-3-google-sheets-lưu-transcript)

### 4. YouTube API (5-10 phút)
Phức tạp hơn, xem hướng dẫn chi tiết: [docs/HUONG_DAN_ENV.md](docs/HUONG_DAN_ENV.md#-5-youtube-api-upload-video)

## Checklist Setup

- [ ] Node.js 18+ đã cài
- [ ] Python 3.8+ đã cài
- [ ] FFmpeg đã cài
- [ ] Redis đang chạy
- [ ] Whisper đã cài (`pip install openai-whisper`)
- [ ] Auto Editor đã cài (`pip install auto-editor`)
- [ ] File `.env` đã tạo
- [ ] Gemini API key đã có
- [ ] Pexels API key đã có
- [ ] Google Sheets đã setup
- [ ] YouTube API đã setup
- [ ] Server chạy được (`npm run dev`)

## Xong! 🎉

Bây giờ bạn có thể:
1. Upload video qua API
2. Xem logs trong `logs/`
3. Nhận YouTube link khi xong

**Cần trợ giúp?** Xem [HUONG_DAN.md](HUONG_DAN.md) hoặc [docs/HUONG_DAN_ENV.md](docs/HUONG_DAN_ENV.md)
