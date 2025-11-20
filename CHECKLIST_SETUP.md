# ✅ Checklist Setup - YouTube Video Automation

Sử dụng checklist này để đảm bảo bạn đã setup đầy đủ mọi thứ!

## 📦 Phần 1: Cài Đặt Phần Mềm

### Node.js & NPM
- [ ] Node.js 18+ đã cài đặt
  ```bash
  node --version  # Phải >= v18.0.0
  ```
- [ ] NPM dependencies đã cài
  ```bash
  npm install
  ```

### Python & Packages
- [ ] Python 3.8+ đã cài đặt
  ```bash
  python --version  # Phải >= 3.8
  ```
- [ ] Whisper đã cài đặt
  ```bash
  pip install -U openai-whisper
  whisper --help
  ```
- [ ] Auto Editor đã cài đặt
  ```bash
  pip install auto-editor
  auto-editor --help
  ```

### FFmpeg
- [ ] FFmpeg đã cài đặt
  ```bash
  ffmpeg -version
  ```
- [ ] FFmpeg có trong PATH (chạy được từ terminal)

### Redis
- [ ] Redis đã cài đặt/chạy
  ```bash
  redis-cli ping  # Phải trả về: PONG
  ```
- [ ] Redis chạy trên port 6379 (hoặc port đã cấu hình)

### Docker (Tùy chọn)
- [ ] Docker đã cài đặt (nếu dùng Docker)
  ```bash
  docker --version
  ```
- [ ] Docker Compose đã cài đặt
  ```bash
  docker-compose --version
  ```

---

## 🔑 Phần 2: API Keys & Credentials

### Gemini API (Bắt buộc)
- [ ] Đã tạo tài khoản Google
- [ ] Đã truy cập https://makersuite.google.com/app/apikey
- [ ] Đã tạo API key
- [ ] Đã copy key vào `.env`:
  ```bash
  GEMINI_API_KEY=AIzaSy...
  ```
- [ ] Test API key hoạt động

### Pexels API (Bắt buộc)
- [ ] Đã đăng ký tài khoản Pexels
- [ ] Đã truy cập https://www.pexels.com/api/
- [ ] Đã lấy API key
- [ ] Đã copy key vào `.env`:
  ```bash
  PEXELS_API_KEY=563492ad...
  ```

### Google Sheets API (Bắt buộc)
- [ ] Đã tạo Google Cloud Project
- [ ] Đã enable Google Sheets API
- [ ] Đã tạo Service Account
- [ ] Đã download credentials JSON file
- [ ] File JSON đã đặt trong project folder
- [ ] Đã tạo Google Sheet mới
- [ ] Đã copy Spreadsheet ID vào `.env`:
  ```bash
  GOOGLE_SHEETS_SPREADSHEET_ID=1BxiMVs...
  ```
- [ ] Đã share Sheet với service account email
- [ ] Đã set đường dẫn credentials trong `.env`:
  ```bash
  GOOGLE_SHEETS_CREDENTIALS=./google-credentials.json
  ```

### YouTube API (Bắt buộc)
- [ ] Đã enable YouTube Data API v3
- [ ] Đã tạo OAuth 2.0 Client ID
- [ ] Đã cấu hình OAuth Consent Screen
- [ ] Đã thêm email vào Test Users
- [ ] Đã thêm Redirect URI: `http://localhost:3000/oauth/callback`
- [ ] Đã copy Client ID vào `.env`:
  ```bash
  YOUTUBE_CLIENT_ID=123456789-xxx.apps.googleusercontent.com
  ```
- [ ] Đã copy Client Secret vào `.env`:
  ```bash
  YOUTUBE_CLIENT_SECRET=GOCSPX-xxx
  ```

---

## ⚙️ Phần 3: Cấu Hình File .env

### File Setup
- [ ] Đã tạo file `.env` từ `.env.example`
  ```bash
  cp .env.example .env
  ```
- [ ] File `.env` có trong `.gitignore` (không commit lên Git)

### Whisper Configuration
- [ ] Đã chọn model phù hợp:
  ```bash
  WHISPER_MODEL=base  # tiny/base/small/medium/large
  ```

### Notification Setup (Tùy chọn)
- [ ] Đã chọn phương thức thông báo (webhook/email/sms)
- [ ] Đã cấu hình endpoint:
  ```bash
  NOTIFICATION_METHOD=webhook
  NOTIFICATION_ENDPOINT=https://...
  ```

### Storage Configuration
- [ ] Đã set đường dẫn temp và cache:
  ```bash
  TEMP_DIR=./temp
  CACHE_DIR=./cache
  ```

### Redis Configuration
- [ ] Đã cấu hình Redis host và port:
  ```bash
  REDIS_HOST=localhost
  REDIS_PORT=6379
  ```

### Server Configuration
- [ ] Đã set port cho API server:
  ```bash
  PORT=3000
  NODE_ENV=development
  ```

---

## 📁 Phần 4: Thư Mục & Files

### Project Structure
- [ ] Thư mục `temp/` đã tạo (hoặc sẽ tự tạo)
- [ ] Thư mục `cache/` đã tạo (hoặc sẽ tự tạo)
- [ ] Thư mục `logs/` đã tạo (hoặc sẽ tự tạo)
- [ ] File `google-credentials.json` đã có trong project root

### Build
- [ ] TypeScript đã compile thành công:
  ```bash
  npm run build
  ```
- [ ] Thư mục `dist/` đã được tạo
- [ ] Không có lỗi compilation

---

## 🧪 Phần 5: Testing

### Unit Tests
- [ ] Tất cả tests pass:
  ```bash
  npm test
  ```
- [ ] Không có test failures

### Service Tests
- [ ] Redis connection test:
  ```bash
  redis-cli ping
  ```
- [ ] FFmpeg test:
  ```bash
  ffmpeg -version
  ```
- [ ] Whisper test:
  ```bash
  whisper --help
  ```

### API Tests
- [ ] Server khởi động thành công:
  ```bash
  npm run dev
  ```
- [ ] Không có lỗi "Missing environment variable"
- [ ] Logs hiển thị "API server started successfully"

---

## 🚀 Phần 6: Chạy Ứng Dụng

### Development Mode
- [ ] API Server chạy được:
  ```bash
  npm run dev
  ```
- [ ] Worker chạy được:
  ```bash
  npm run worker
  ```
- [ ] Cả hai không có errors

### Docker Mode (Nếu dùng)
- [ ] Docker Compose chạy được:
  ```bash
  docker-compose up
  ```
- [ ] Tất cả services (redis, api, worker) đều healthy
- [ ] Logs không có errors

### Health Check
- [ ] API endpoint phản hồi:
  ```bash
  curl http://localhost:3000/health
  ```

---

## 📚 Phần 7: Tài Liệu

### Đã Đọc
- [ ] [QUICK_START.md](QUICK_START.md) - Quick start guide
- [ ] [HUONG_DAN.md](HUONG_DAN.md) - Hướng dẫn đầy đủ
- [ ] [docs/HUONG_DAN_ENV.md](docs/HUONG_DAN_ENV.md) - Setup .env chi tiết
- [ ] [docs/WHISPER_SETUP.md](docs/WHISPER_SETUP.md) - Setup Whisper
- [ ] [README.md](README.md) - Project overview

### Hiểu Rõ
- [ ] Hiểu pipeline xử lý video
- [ ] Biết cách check logs
- [ ] Biết cách troubleshoot lỗi cơ bản

---

## ✨ Phần 8: Ready to Go!

### Final Checks
- [ ] Tất cả checkboxes ở trên đã tick ✅
- [ ] Không có errors khi start server
- [ ] Redis đang chạy
- [ ] Đã test upload một video mẫu (nếu có)

### Nếu Tất Cả OK
🎉 **Chúc mừng! Bạn đã setup xong!**

Bây giờ bạn có thể:
1. Upload video qua API
2. Monitor progress qua logs
3. Nhận YouTube link khi hoàn thành

---

## 🆘 Nếu Có Vấn Đề

### Checklist Troubleshooting
- [ ] Đã đọc phần Troubleshooting trong [HUONG_DAN.md](HUONG_DAN.md)
- [ ] Đã check logs trong `logs/error.log`
- [ ] Đã verify tất cả environment variables
- [ ] Đã restart services
- [ ] Đã check Redis đang chạy
- [ ] Đã verify API keys còn valid

### Vẫn Không Được?
1. Đọc kỹ error message
2. Search error trong docs
3. Check logs chi tiết
4. Tạo issue trên GitHub với:
   - Mô tả lỗi
   - Log files
   - Các bước đã thử

---

## 📊 Progress Tracker

**Tổng quan tiến độ:**

```
Phần 1: Cài Đặt Phần Mềm     [ ] 0/6
Phần 2: API Keys              [ ] 0/4
Phần 3: Cấu Hình .env         [ ] 0/6
Phần 4: Thư Mục & Files       [ ] 0/3
Phần 5: Testing               [ ] 0/3
Phần 6: Chạy Ứng Dụng         [ ] 0/3
Phần 7: Tài Liệu              [ ] 0/2
Phần 8: Ready to Go!          [ ] 0/2

Tổng: 0/29 ✅
```

**Cập nhật progress khi hoàn thành mỗi phần!**

---

**Good luck! 🚀**
