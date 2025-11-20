# Hướng Dẫn Sử Dụng - YouTube Video Automation

Chào mừng bạn đến với hệ thống tự động hóa editing video YouTube! 🎬

## 📚 Mục Lục

1. [Giới Thiệu](#giới-thiệu)
2. [Yêu Cầu Hệ Thống](#yêu-cầu-hệ-thống)
3. [Cài Đặt](#cài-đặt)
4. [Cấu Hình](#cấu-hình)
5. [Chạy Ứng Dụng](#chạy-ứng-dụng)
6. [Cách Hoạt Động](#cách-hoạt-động)
7. [Troubleshooting](#troubleshooting)

---

## Giới Thiệu

Hệ thống này tự động biến video thô thành video chuyên nghiệp với:
- ✂️ Tự động cắt bỏ phần im lặng và filler
- 📝 Tạo phụ đề tự động
- 🎨 Thêm hiệu ứng và animation
- 🎬 Chèn B-roll footage
- 📺 Upload lên YouTube tự động

**Quy trình:**
```
Video thô → Cắt filler → Tạo phụ đề → Phát hiện highlight 
→ AI tạo kế hoạch editing → Render video → Upload YouTube
```

---

## Yêu Cầu Hệ Thống

### Phần Cứng Tối Thiểu

- **CPU:** Intel i5 hoặc tương đương
- **RAM:** 8GB (khuyến nghị 16GB)
- **Ổ cứng:** 20GB trống
- **GPU:** Không bắt buộc (nhưng giúp Whisper nhanh hơn)

### Phần Mềm

- **Node.js:** 18 trở lên
- **Python:** 3.8 trở lên
- **FFmpeg:** Phiên bản mới nhất
- **Redis:** 7.0 trở lên
- **Docker:** (Tùy chọn, cho deployment)

---

## Cài Đặt

### Bước 1: Clone Project

```bash
git clone <repository-url>
cd video-automation-ver2
```

### Bước 2: Cài Đặt Node.js Dependencies

```bash
npm install
```

### Bước 3: Cài Đặt Python Dependencies

```bash
pip install -U openai-whisper auto-editor
```

**Lưu ý cho Windows:**
- Nên dùng Python từ python.org (không phải Microsoft Store)
- Có thể cần cài Visual C++ Build Tools

### Bước 4: Cài Đặt FFmpeg

**Windows:**
```bash
# Dùng Chocolatey
choco install ffmpeg

# Hoặc download từ: https://ffmpeg.org/download.html
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Kiểm tra:**
```bash
ffmpeg -version
```

### Bước 5: Cài Đặt Redis

**Cách 1: Dùng Docker (Khuyến nghị)**
```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

**Cách 2: Cài đặt trực tiếp**

**Windows:**
```bash
# Dùng WSL
wsl --install
# Trong WSL:
sudo apt install redis-server
sudo service redis-server start
```

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt install redis-server
sudo systemctl start redis
```

**Kiểm tra:**
```bash
redis-cli ping
# Phải trả về: PONG
```

---

## Cấu Hình

### Bước 1: Tạo File .env

```bash
cp .env.example .env
```

### Bước 2: Điền Thông Tin

Mở file `.env` và điền các thông tin cần thiết.

**📖 Xem hướng dẫn chi tiết:** [docs/HUONG_DAN_ENV.md](docs/HUONG_DAN_ENV.md)

### Các Biến Bắt Buộc

✅ Phải có ngay:
- `GEMINI_API_KEY` - AI để tạo kế hoạch editing
- `GOOGLE_SHEETS_SPREADSHEET_ID` - Lưu transcript
- `GOOGLE_SHEETS_CREDENTIALS` - File JSON credentials
- `PEXELS_API_KEY` - Download B-roll
- `YOUTUBE_CLIENT_ID` - Upload YouTube
- `YOUTUBE_CLIENT_SECRET` - Upload YouTube

⚙️ Có thể để mặc định:
- `WHISPER_MODEL=base` - Model transcription
- `REDIS_HOST=localhost` - Redis server
- `PORT=3000` - Cổng API server

### Bước 3: Tạo Thư Mục

```bash
mkdir temp cache logs
```

---

## Chạy Ứng Dụng

### Development Mode

**Terminal 1 - API Server:**
```bash
npm run dev
```

**Terminal 2 - Worker:**
```bash
npm run worker
```

### Production Mode

**Build:**
```bash
npm run build
```

**Start:**
```bash
# Terminal 1
npm start

# Terminal 2
npm run worker
```

### Dùng Docker Compose (Khuyến nghị)

```bash
# Start tất cả services
docker-compose up

# Chạy background
docker-compose up -d

# Xem logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## Cách Hoạt Động

### 1. Upload Video

```bash
POST /api/upload
Content-Type: multipart/form-data

{
  "video": <file>,
  "userId": "user123"
}
```

**Response:**
```json
{
  "jobId": "job_abc123",
  "status": "queued"
}
```

### 2. Kiểm Tra Trạng Thái

```bash
GET /api/status/:jobId
```

**Response:**
```json
{
  "jobId": "job_abc123",
  "status": "processing",
  "currentStage": "transcribing",
  "progress": 35
}
```

### 3. Nhận Kết Quả

Khi hoàn thành, bạn sẽ nhận được:
- Thông báo qua webhook/email
- Link YouTube video

**Response khi hoàn thành:**
```json
{
  "jobId": "job_abc123",
  "status": "completed",
  "youtubeUrl": "https://www.youtube.com/watch?v=xxxxx"
}
```

---

## Pipeline Stages

Hệ thống xử lý video qua các giai đoạn:

### 1️⃣ Upload & Validation (5s)
- Kiểm tra format video
- Validate file integrity
- Tạo job ID

### 2️⃣ Auto Editing (1-5 phút)
- Phát hiện im lặng
- Cắt bỏ filler content
- Giữ nguyên chất lượng

### 3️⃣ Transcription (2-10 phút)
- Trích xuất audio
- Whisper tạo transcript
- Tạo file SRT

### 4️⃣ Storage (10s)
- Lưu transcript vào Google Sheets
- Index theo job ID

### 5️⃣ Highlight Detection (30s)
- Phân tích transcript
- Tìm moments quan trọng
- Tạo timestamp ranges

### 6️⃣ AI Planning (1-2 phút)
- Gemini phân tích content
- Tạo kế hoạch editing
- Chọn animations và transitions

### 7️⃣ Rendering (5-15 phút)
- Apply animations
- Chèn B-roll
- Thêm subtitles
- Render final video

### 8️⃣ YouTube Upload (2-5 phút)
- Upload video
- Set metadata
- Lấy video link

**Tổng thời gian:** 15-40 phút tùy độ dài video

---

## Logs và Monitoring

### Xem Logs

```bash
# Logs tổng hợp
tail -f logs/combined.log

# Chỉ errors
tail -f logs/error.log

# Logs của Docker
docker-compose logs -f
```

### Log Format

Logs được lưu dạng JSON:
```json
{
  "timestamp": "2024-01-20 10:30:45",
  "level": "info",
  "message": "Video processing started",
  "context": "PipelineOrchestrator",
  "jobId": "job_abc123",
  "stage": "auto-editing"
}
```

---

## Troubleshooting

### ❌ Lỗi: "Missing required environment variable"

**Nguyên nhân:** Thiếu biến trong file `.env`

**Giải pháp:**
1. Kiểm tra file `.env` có tồn tại
2. So sánh với `.env.example`
3. Đảm bảo không có khoảng trắng thừa

### ❌ Lỗi: "ECONNREFUSED" Redis

**Nguyên nhân:** Redis không chạy

**Giải pháp:**
```bash
# Kiểm tra
redis-cli ping

# Start Redis
docker start redis
# hoặc
brew services start redis
# hoặc
sudo systemctl start redis
```

### ❌ Lỗi: "ffmpeg not found"

**Nguyên nhân:** FFmpeg chưa cài hoặc không trong PATH

**Giải pháp:**
```bash
# Kiểm tra
ffmpeg -version

# Cài đặt
# Windows:
choco install ffmpeg

# macOS:
brew install ffmpeg

# Linux:
sudo apt install ffmpeg
```

### ❌ Lỗi: Whisper "Out of memory"

**Nguyên nhân:** Model quá lớn cho RAM

**Giải pháp:**
Giảm model size trong `.env`:
```bash
WHISPER_MODEL=tiny  # hoặc base
```

### ❌ Lỗi: Google Sheets "Permission denied"

**Nguyên nhân:** Chưa share sheet với service account

**Giải pháp:**
1. Mở `google-credentials.json`
2. Copy `client_email`
3. Share Google Sheet với email đó (quyền Editor)

### ❌ Video bị lỗi sau khi render

**Nguyên nhân:** Có thể do:
- Thiếu B-roll footage
- Animation template không tồn tại
- Lỗi trong editing plan

**Giải pháp:**
1. Xem logs chi tiết: `logs/error.log`
2. Kiểm tra editing plan có hợp lệ
3. Thử với video ngắn hơn để test

---

## Performance Tips

### 🚀 Tăng Tốc Whisper

1. **Dùng GPU:**
   - NVIDIA: Cài CUDA toolkit
   - Apple Silicon: Tự động dùng MPS
   
2. **Giảm model size:**
   ```bash
   WHISPER_MODEL=tiny  # Nhanh nhất
   ```

3. **Batch processing:**
   - Xử lý nhiều video cùng lúc
   - Worker sẽ tự động phân chia

### 💾 Tiết Kiệm Dung Lượng

1. **Tự động dọn dẹp:**
   ```bash
   # Xóa temp files cũ (>7 ngày)
   find ./temp -mtime +7 -delete
   ```

2. **Cache B-roll:**
   - B-roll đã download sẽ được cache
   - Tái sử dụng cho video khác

### ⚡ Scale Production

1. **Tăng số workers:**
   ```yaml
   # docker-compose.yml
   worker:
     deploy:
       replicas: 4  # Tăng từ 2 lên 4
   ```

2. **Dùng Redis Cluster:**
   - Cho high availability
   - Handle nhiều jobs hơn

---

## Tài Liệu Bổ Sung

- 📖 [Hướng dẫn cấu hình .env chi tiết](docs/HUONG_DAN_ENV.md)
- 🎤 [Setup Whisper](docs/WHISPER_SETUP.md)
- 🏗️ [Thông tin setup project](SETUP.md)
- 📚 [README](README.md)

---

## FAQ

### Q: Có tốn phí không?

**A:** Phần lớn miễn phí:
- ✅ Whisper: Miễn phí (chạy local)
- ✅ Pexels: Miễn phí (20k requests/tháng)
- ⚠️ Gemini: Miễn phí có giới hạn (60 req/phút)
- ⚠️ YouTube: Miễn phí (có quota limit)
- ⚠️ Google Sheets: Miễn phí (có quota limit)

### Q: Xử lý được video dài bao nhiêu?

**A:** 
- Không giới hạn về mặt kỹ thuật
- Thực tế: 5-30 phút là tối ưu
- Video >1 giờ có thể mất nhiều thời gian

### Q: Có thể chạy offline không?

**A:**
- ❌ Không hoàn toàn (cần API: Gemini, YouTube, Pexels)
- ✅ Whisper chạy offline
- ✅ Auto Editor chạy offline

### Q: Hỗ trợ ngôn ngữ nào?

**A:**
- Whisper hỗ trợ 99+ ngôn ngữ
- Tiếng Việt: ✅ Hỗ trợ tốt
- Set trong Whisper config nếu cần

### Q: Có thể customize animations không?

**A:**
- ✅ Có thể thêm templates mới
- ✅ Có thể chỉnh CSS animations
- Xem thư mục `planning/reference/animation/`

---

## Liên Hệ & Hỗ Trợ

Nếu gặp vấn đề:
1. Kiểm tra phần Troubleshooting
2. Xem logs: `logs/error.log`
3. Tạo issue trên GitHub với:
   - Mô tả lỗi
   - Log files
   - Các bước tái hiện

---

## License

MIT License - Xem file LICENSE để biết thêm chi tiết.

---

**Chúc bạn sử dụng thành công! 🎉**

Nếu thấy hữu ích, đừng quên ⭐ star project nhé!
