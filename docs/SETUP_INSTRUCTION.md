# Hướng Dẫn Cấu Hình Environment Variables (.env)

Đây là hướng dẫn chi tiết từng bước để setup các biến môi trường cho dự án. Đừng lo lắng nếu đây là lần đầu bạn làm việc với chúng!

## Bước 1: Tạo File .env

1. Copy file mẫu:
```bash
cp .env.example .env
```

2. Mở file `.env` bằng text editor (VS Code, Notepad++, v.v.)

## Bước 2: Cấu Hình Từng Phần

### 🤖 1. GEMINI API (Bắt buộc)

Gemini là AI của Google dùng để tạo kế hoạch editing thông minh.

```bash
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-pro
```

**Cách lấy API key:**

1. Truy cập: https://makersuite.google.com/app/apikey
2. Đăng nhập bằng Google account
3. Click "Create API Key"
4. Copy key và paste vào `.env`

**Ví dụ:**
```bash
GEMINI_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_MODEL=gemini-pro
```

**Lưu ý:**
- API key miễn phí có giới hạn 60 requests/phút
- Đủ cho development và testing
- Không share API key với ai!

---

### 🎤 2. WHISPER (Transcription)

Whisper chạy local, không cần API key!

```bash
WHISPER_MODEL=base
```

**Chọn model phù hợp:**

| Model | RAM cần | Tốc độ | Độ chính xác | Khuyến nghị |
|-------|---------|--------|--------------|-------------|
| tiny  | ~1GB    | Rất nhanh | Thấp | Testing nhanh |
| base  | ~1GB    | Nhanh | Tốt | **Khuyến nghị cho bắt đầu** |
| small | ~2GB    | Trung bình | Tốt hơn | Production nhỏ |
| medium| ~5GB    | Chậm | Cao | Production có GPU |
| large | ~10GB   | Rất chậm | Rất cao | Chỉ khi có GPU mạnh |

**Ví dụ:**
```bash
WHISPER_MODEL=base
```

**Cài đặt Whisper:**
```bash
pip install -U openai-whisper
```

---

### 📊 3. GOOGLE SHEETS (Lưu transcript)

Google Sheets dùng để lưu trữ transcript của video.

```bash
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SHEETS_CREDENTIALS=path_to_credentials.json
```

**Bước setup chi tiết:**

#### 3.1. Tạo Google Cloud Project

1. Truy cập: https://console.cloud.google.com/
2. Click "Select a project" → "New Project"
3. Đặt tên project (vd: "video-automation")
4. Click "Create"

#### 3.2. Enable Google Sheets API

1. Vào menu → "APIs & Services" → "Library"
2. Tìm "Google Sheets API"
3. Click "Enable"

#### 3.3. Tạo Service Account

1. Vào "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Đặt tên (vd: "video-automation-service")
4. Click "Create and Continue"
5. Role: chọn "Editor"
6. Click "Done"

#### 3.4. Tạo Key File

1. Click vào service account vừa tạo
2. Tab "Keys" → "Add Key" → "Create new key"
3. Chọn "JSON"
4. File JSON sẽ tự động download
5. Đổi tên file thành `google-credentials.json`
6. Copy vào thư mục project

#### 3.5. Tạo Google Sheet

1. Truy cập: https://sheets.google.com/
2. Tạo sheet mới
3. Copy ID từ URL:
   ```
   https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
   ```
4. Share sheet với email của service account (trong file JSON, field `client_email`)

**Ví dụ trong .env:**
```bash
GOOGLE_SHEETS_SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
GOOGLE_SHEETS_CREDENTIALS=./google-credentials.json
```

---

### 🎬 4. PEXELS API (B-roll footage)

Pexels cung cấp video stock miễn phí cho B-roll.

```bash
PEXELS_API_KEY=your_pexels_api_key
```

**Cách lấy API key:**

1. Truy cập: https://www.pexels.com/api/
2. Click "Get Started"
3. Đăng ký tài khoản (miễn phí)
4. Vào "Your API Key"
5. Copy key

**Ví dụ:**
```bash
PEXELS_API_KEY=563492ad6f91700001000001xxxxxxxxxxxxxxxx
```

**Giới hạn miễn phí:**
- 200 requests/giờ
- 20,000 requests/tháng
- Đủ cho hầu hết use cases

---

### 📺 5. YOUTUBE API (Upload video)

YouTube API để upload video tự động lên YouTube.

```bash
YOUTUBE_CLIENT_ID=your_youtube_client_id
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/oauth/callback
```

**Bước setup chi tiết:**

#### 5.1. Tạo OAuth 2.0 Credentials

1. Truy cập: https://console.cloud.google.com/
2. Chọn project (hoặc dùng project đã tạo ở bước Google Sheets)
3. Vào "APIs & Services" → "Library"
4. Tìm "YouTube Data API v3"
5. Click "Enable"

#### 5.2. Tạo OAuth Client

1. Vào "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Nếu chưa có OAuth consent screen:
   - Click "Configure Consent Screen"
   - Chọn "External"
   - Điền tên app (vd: "Video Automation")
   - Email support: email của bạn
   - Click "Save and Continue"
   - Scopes: bỏ qua, click "Save and Continue"
   - Test users: thêm email YouTube của bạn
   - Click "Save and Continue"

4. Quay lại "Create OAuth client ID":
   - Application type: "Web application"
   - Name: "Video Automation Client"
   - Authorized redirect URIs: thêm `http://localhost:3000/oauth/callback`
   - Click "Create"

5. Copy Client ID và Client Secret

**Ví dụ:**
```bash
YOUTUBE_CLIENT_ID=123456789-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
YOUTUBE_REDIRECT_URI=http://localhost:3000/oauth/callback
```

**Lưu ý:**
- Lần đầu chạy sẽ cần authorize qua browser
- Token sẽ được lưu để dùng lại

---

### 📧 6. NOTIFICATIONS (Thông báo)

Hệ thống gửi thông báo khi video hoàn thành.

```bash
NOTIFICATION_METHOD=webhook
NOTIFICATION_ENDPOINT=https://your-webhook-url.com
NOTIFICATION_OPERATOR_EMAIL=operator@example.com
```

**Các options:**

#### Option 1: Webhook (Khuyến nghị)

Dùng webhook để nhận thông báo qua Discord, Slack, v.v.

**Discord Webhook:**
1. Vào Discord server → Settings → Integrations
2. Click "Create Webhook"
3. Copy Webhook URL
4. Paste vào NOTIFICATION_ENDPOINT

```bash
NOTIFICATION_METHOD=webhook
NOTIFICATION_ENDPOINT=https://discord.com/api/webhooks/123456789/xxxxxxxxxx
```

**Slack Webhook:**
1. Vào https://api.slack.com/apps
2. Create New App → From scratch
3. Incoming Webhooks → Activate
4. Add New Webhook to Workspace
5. Copy Webhook URL

```bash
NOTIFICATION_METHOD=webhook
NOTIFICATION_ENDPOINT=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX
```

#### Option 2: Email

```bash
NOTIFICATION_METHOD=email
NOTIFICATION_ENDPOINT=your-email@gmail.com
NOTIFICATION_OPERATOR_EMAIL=operator@example.com
```

**Lưu ý:** Cần cấu hình SMTP server (sẽ implement sau)

#### Option 3: SMS

```bash
NOTIFICATION_METHOD=sms
NOTIFICATION_ENDPOINT=+84123456789
```

**Lưu ý:** Cần tích hợp Twilio hoặc service tương tự (sẽ implement sau)

---

### 💾 7. STORAGE (Lưu trữ file)

Đường dẫn lưu file tạm và cache.

```bash
TEMP_DIR=./temp
CACHE_DIR=./cache
```

**Giải thích:**
- `TEMP_DIR`: Lưu file tạm trong quá trình xử lý
- `CACHE_DIR`: Lưu B-roll đã download để tái sử dụng

**Khuyến nghị:**
- Development: dùng thư mục local (như trên)
- Production: dùng cloud storage (S3, GCS)

**Ví dụ:**
```bash
TEMP_DIR=./temp
CACHE_DIR=./cache
```

Thư mục sẽ tự động được tạo khi chạy app.

---

### 🔴 8. REDIS (Job Queue)

Redis dùng để quản lý hàng đợi xử lý video.

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Cài đặt Redis:**

**Windows:**
```bash
# Dùng Docker (khuyến nghị)
docker run -d -p 6379:6379 redis:7-alpine

# Hoặc dùng WSL
wsl --install
# Sau đó trong WSL:
sudo apt update
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
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
```

**Kiểm tra Redis:**
```bash
redis-cli ping
# Nếu trả về "PONG" là thành công
```

**Ví dụ:**
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Nếu dùng Docker Compose:**
Redis sẽ tự động start, không cần cài đặt thêm!

---

### ⚙️ 9. SERVER (Cấu hình server)

```bash
PORT=3000
NODE_ENV=development
```

**Giải thích:**
- `PORT`: Cổng chạy API server
- `NODE_ENV`: Môi trường (development/production)

**Ví dụ:**
```bash
PORT=3000
NODE_ENV=development
```

**Lưu ý:**
- Development: `NODE_ENV=development` (log chi tiết)
- Production: `NODE_ENV=production` (log tối ưu)

---

## File .env Hoàn Chỉnh

Đây là ví dụ file `.env` đã điền đầy đủ:

```bash
# LLM Configuration
GEMINI_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_MODEL=gemini-pro

# Transcription (Local Whisper)
WHISPER_MODEL=base

# Google Sheets
GOOGLE_SHEETS_SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
GOOGLE_SHEETS_CREDENTIALS=./google-credentials.json

# Pexels API
PEXELS_API_KEY=563492ad6f91700001000001xxxxxxxxxxxxxxxx

# YouTube API
YOUTUBE_CLIENT_ID=123456789-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
YOUTUBE_REDIRECT_URI=http://localhost:3000/oauth/callback

# Notifications
NOTIFICATION_METHOD=webhook
NOTIFICATION_ENDPOINT=https://discord.com/api/webhooks/123456789/xxxxxxxxxx
NOTIFICATION_OPERATOR_EMAIL=your-email@gmail.com

# Storage
TEMP_DIR=./temp
CACHE_DIR=./cache

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Server
PORT=3000
NODE_ENV=development
```

---

## Kiểm Tra Cấu Hình

Sau khi setup xong, chạy lệnh này để kiểm tra:

```bash
npm run build
npm start
```

Nếu không có lỗi về missing environment variables là thành công! ✅

---

## Troubleshooting

### Lỗi: "Missing required environment variable: XXX"

**Nguyên nhân:** Thiếu biến môi trường bắt buộc

**Giải pháp:**
1. Kiểm tra file `.env` có tồn tại không
2. Kiểm tra tên biến có đúng không (phân biệt hoa thường)
3. Kiểm tra không có khoảng trắng thừa

### Lỗi: "ECONNREFUSED" khi connect Redis

**Nguyên nhân:** Redis chưa chạy

**Giải pháp:**
```bash
# Kiểm tra Redis
redis-cli ping

# Nếu không chạy, start Redis
# Windows (Docker):
docker run -d -p 6379:6379 redis:7-alpine

# macOS:
brew services start redis

# Linux:
sudo systemctl start redis
```

### Lỗi: Google Sheets API "Permission denied"

**Nguyên nhân:** Chưa share sheet với service account

**Giải pháp:**
1. Mở file `google-credentials.json`
2. Copy email trong field `client_email`
3. Vào Google Sheet → Share
4. Paste email và cho quyền "Editor"

### Lỗi: YouTube API "Access denied"

**Nguyên nhân:** Chưa thêm email vào test users

**Giải pháp:**
1. Vào Google Cloud Console
2. APIs & Services → OAuth consent screen
3. Test users → Add users
4. Thêm email YouTube của bạn

---

## Bảo Mật

⚠️ **QUAN TRỌNG:**

1. **KHÔNG** commit file `.env` lên Git
2. **KHÔNG** share API keys với ai
3. **KHÔNG** để file `.env` trong thư mục public
4. Thêm `.env` vào `.gitignore` (đã có sẵn)

File `.gitignore` đã bao gồm:
```
.env
google-credentials.json
```

---

## Tài Nguyên Tham Khảo

- [Gemini API Docs](https://ai.google.dev/docs)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [YouTube API](https://developers.google.com/youtube/v3)
- [Pexels API](https://www.pexels.com/api/documentation/)
- [Whisper GitHub](https://github.com/openai/whisper)

---

## Cần Trợ Giúp?

Nếu gặp vấn đề, hãy:
1. Đọc lại phần Troubleshooting
2. Kiểm tra logs trong thư mục `logs/`
3. Tạo issue trên GitHub với thông tin lỗi chi tiết

Chúc bạn setup thành công! 🚀
