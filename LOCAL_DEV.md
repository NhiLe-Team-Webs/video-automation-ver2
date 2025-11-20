# 🏠 Local Development Guide

Hướng dẫn setup và chạy pipeline ở local (không cần deploy).

---

## 🎯 Mục Tiêu

Chạy toàn bộ pipeline ở máy local để:
- ✅ Test và debug dễ dàng
- ✅ Không tốn phí cloud
- ✅ Phát triển nhanh hơn
- ✅ Kiểm soát hoàn toàn

---

## 📋 Checklist Nhanh

- [ ] Node.js 18+ đã cài
- [ ] Python 3.8+ đã cài
- [ ] FFmpeg đã cài
- [ ] Redis đang chạy (Docker hoặc local)
- [ ] Whisper đã cài (`pip install openai-whisper`)
- [ ] 5 API keys đã có (Gemini, Pexels, Google Sheets, YouTube)
- [ ] File `.env` đã tạo và điền đầy đủ

---

## 🚀 Quick Setup

### 1. Clone & Install

```bash
git clone https://github.com/NhiLe-Team-Webs/video-automation-ver2.git
cd video-automation-ver2
npm install
pip install openai-whisper auto-editor
```

### 2. Setup Environment

```bash
# Copy file env cho local
cp .env.local.example .env

# Edit file .env và điền 5 API keys
```

**5 API keys cần thiết:**
1. `GEMINI_API_KEY` - https://makersuite.google.com/app/apikey
2. `PEXELS_API_KEY` - https://www.pexels.com/api/
3. `GOOGLE_SHEETS_SPREADSHEET_ID` + `GOOGLE_SHEETS_CREDENTIALS`
4. `YOUTUBE_CLIENT_ID` + `YOUTUBE_CLIENT_SECRET`

📖 **Chi tiết:** [docs/HUONG_DAN_ENV.md](docs/HUONG_DAN_ENV.md)

### 3. Start Redis

```bash
# Dùng Docker (khuyến nghị)
docker run -d -p 6379:6379 --name redis redis:7-alpine

# Kiểm tra
redis-cli ping  # Phải trả về: PONG
```

### 4. Run Application

**Terminal 1 - API Server:**
```bash
npm run dev
```

**Terminal 2 - Worker:**
```bash
npm run worker
```

---

## 📁 File Structure cho Local

```
video-automation-ver2/
├── .env                        # Config local (KHÔNG commit)
├── google-credentials.json     # Google service account (KHÔNG commit)
├── temp/                       # Video đang xử lý
├── cache/                      # B-roll đã download
├── logs/                       # Application logs
│   ├── combined.log
│   └── error.log
└── src/                        # Source code
```

---

## ⚙️ Environment Variables cho Local

### Bắt Buộc

```bash
# AI & APIs
GEMINI_API_KEY=xxx
PEXELS_API_KEY=xxx
GOOGLE_SHEETS_SPREADSHEET_ID=xxx
GOOGLE_SHEETS_CREDENTIALS=./google-credentials.json
YOUTUBE_CLIENT_ID=xxx
YOUTUBE_CLIENT_SECRET=xxx
YOUTUBE_REDIRECT_URI=http://localhost:3000/oauth/callback

# Whisper (local)
WHISPER_MODEL=base

# Local Storage
TEMP_DIR=./temp
CACHE_DIR=./cache

# Redis (local)
REDIS_HOST=localhost
REDIS_PORT=6379

# Server
PORT=3000
NODE_ENV=development
```

### Optional (Có thể bỏ qua)

```bash
# Notifications - Uncomment nếu muốn nhận thông báo
# NOTIFICATION_METHOD=webhook
# NOTIFICATION_ENDPOINT=https://discord.com/api/webhooks/xxx
```

### KHÔNG CẦN cho Local

Các biến này chỉ cần khi deploy production:
- ❌ AWS credentials
- ❌ Cloud Redis URL
- ❌ Sentry/Datadog monitoring
- ❌ Cloud storage configs

---

## 🧪 Testing Local

### Run Tests

```bash
npm test
```

### Test Individual Components

```bash
# Test config
npm test src/config/index.test.ts

# Test logger
npm test src/utils/logger.test.ts

# Test errors
npm test src/utils/errors.test.ts
```

### Manual Testing

```bash
# Test Redis
redis-cli ping

# Test FFmpeg
ffmpeg -version

# Test Whisper
whisper --help

# Test API server
curl http://localhost:3000/health
```

---

## 📊 Monitoring Local

### Xem Logs

```bash
# Real-time logs
tail -f logs/combined.log

# Chỉ errors
tail -f logs/error.log

# Logs của specific service
grep "PipelineOrchestrator" logs/combined.log
```

### Check Redis

```bash
# Connect to Redis
redis-cli

# Xem tất cả keys
KEYS *

# Xem job queue
LRANGE bull:video-processing:wait 0 -1

# Monitor real-time
MONITOR
```

---

## 🐛 Troubleshooting Local

### Lỗi: "ECONNREFUSED" Redis

**Nguyên nhân:** Redis không chạy

**Giải pháp:**
```bash
# Check Redis
redis-cli ping

# Start Redis (Docker)
docker start redis

# Hoặc start Redis service
# macOS:
brew services start redis
# Linux:
sudo systemctl start redis
```

### Lỗi: "Missing required environment variable"

**Nguyên nhân:** Thiếu biến trong `.env`

**Giải pháp:**
```bash
# So sánh với file mẫu
diff .env .env.local.example

# Hoặc copy lại
cp .env.local.example .env
# Rồi điền lại API keys
```

### Lỗi: "ffmpeg not found"

**Nguyên nhân:** FFmpeg chưa cài hoặc không trong PATH

**Giải pháp:**
```bash
# Windows:
choco install ffmpeg

# macOS:
brew install ffmpeg

# Linux:
sudo apt install ffmpeg

# Verify:
ffmpeg -version
```

### Lỗi: Whisper "Out of memory"

**Nguyên nhân:** Model quá lớn cho RAM

**Giải pháp:**
```bash
# Giảm model size trong .env
WHISPER_MODEL=tiny  # hoặc base
```

### Port 3000 đã được dùng

**Giải pháp:**
```bash
# Đổi port trong .env
PORT=3001

# Hoặc kill process đang dùng port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux:
lsof -ti:3000 | xargs kill -9
```

---

## 🚀 Performance Tips cho Local

### 1. Tăng Tốc Whisper

```bash
# Dùng model nhỏ hơn
WHISPER_MODEL=tiny  # Nhanh nhất

# Hoặc dùng GPU nếu có
# NVIDIA: Cài CUDA toolkit
# Apple Silicon: Tự động dùng MPS
```

### 2. Giảm Dung Lượng

```bash
# Tự động xóa temp files cũ
find ./temp -mtime +7 -delete

# Xóa cache B-roll cũ
find ./cache -mtime +30 -delete
```

### 3. Optimize Redis

```bash
# Tăng memory limit (nếu cần)
docker run -d -p 6379:6379 --name redis \
  redis:7-alpine redis-server --maxmemory 256mb
```

---

## 📝 Development Workflow

### 1. Bắt Đầu Ngày Làm Việc

```bash
# Start Redis
docker start redis

# Start API server
npm run dev

# Start worker (terminal khác)
npm run worker
```

### 2. Làm Việc

- Edit code trong `src/`
- Hot reload tự động (nhờ `tsx watch`)
- Check logs trong `logs/`
- Test với `npm test`

### 3. Kết Thúc Ngày

```bash
# Stop servers (Ctrl+C)

# Optional: Stop Redis
docker stop redis

# Commit changes
git add .
git commit -m "feat: your changes"
git push
```

---

## 🔄 Update Dependencies

```bash
# Update Node packages
npm update

# Update Python packages
pip install -U openai-whisper auto-editor

# Check for outdated
npm outdated
pip list --outdated
```

---

## 📚 Tài Liệu Liên Quan

- 🚀 [QUICK_START.md](QUICK_START.md) - Setup nhanh
- 🔧 [docs/HUONG_DAN_ENV.md](docs/HUONG_DAN_ENV.md) - Setup .env chi tiết
- 📖 [HUONG_DAN.md](HUONG_DAN.md) - Hướng dẫn đầy đủ
- ✅ [CHECKLIST_SETUP.md](CHECKLIST_SETUP.md) - Checklist setup

---

## 💡 Tips

1. **Dùng Docker cho Redis** - Dễ nhất, không cần cài đặt phức tạp
2. **Dùng model Whisper nhỏ** - `tiny` hoặc `base` cho dev
3. **Check logs thường xuyên** - Phát hiện lỗi sớm
4. **Test từng component** - Dễ debug hơn test toàn bộ
5. **Backup .env** - Nhưng KHÔNG commit lên Git!

---

## 🎯 Ready for Production?

Khi pipeline chạy ổn định ở local, xem:
- 🐳 [docker-compose.yml](docker-compose.yml) - Deploy với Docker
- 📋 [SETUP.md](SETUP.md) - Production deployment guide

---

**Happy local development! 🏠**
