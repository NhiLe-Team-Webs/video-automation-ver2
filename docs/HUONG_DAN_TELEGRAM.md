# Hướng dẫn Setup Telegram Bot để nhận thông báo

## Tại sao nên dùng Telegram?

- ✅ **Miễn phí hoàn toàn**
- ✅ **Setup nhanh chóng** (chỉ 5 phút)
- ✅ **Nhận thông báo realtime** trên điện thoại và máy tính
- ✅ **Không cần server** hay email service
- ✅ **Hỗ trợ rich formatting** (emoji, markdown, links)

## Bước 1: Tạo Telegram Bot

### 1.1. Mở Telegram và tìm BotFather

- Mở app Telegram trên điện thoại hoặc máy tính
- Tìm kiếm `@BotFather` (bot chính thức của Telegram)
- Nhấn "Start" để bắt đầu

![BotFather](https://core.telegram.org/file/811140184/1/zlN4goPTupk/9ff2f2f01c4bd1b013)

### 1.2. Tạo bot mới

Gửi lệnh sau cho BotFather:
```
/newbot
```

### 1.3. Đặt tên cho bot

BotFather sẽ hỏi tên bot. Ví dụ:
```
Video Automation Bot
```

### 1.4. Đặt username cho bot

Username phải:
- Kết thúc bằng `bot`
- Không có khoảng trắng
- Là duy nhất (chưa ai dùng)

Ví dụ:
```
my_video_automation_bot
```

### 1.5. Lưu Bot Token

BotFather sẽ trả về một **Bot Token** như thế này:
```
123456789:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890
```

⚠️ **QUAN TRỌNG**: Lưu token này lại, bạn sẽ cần nó ở bước sau!

## Bước 2: Lấy Chat ID

### 2.1. Start bot của bạn

- Tìm bot vừa tạo trên Telegram (bằng username, ví dụ: `@my_video_automation_bot`)
- Nhấn "Start" hoặc gửi tin nhắn `/start`

### 2.2. Lấy Chat ID

Có 2 cách:

#### Cách 1: Dùng API Telegram (Khuyến nghị)

1. Mở trình duyệt web
2. Truy cập URL sau (thay `<YOUR_BOT_TOKEN>` bằng token của bạn):
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
   
   Ví dụ:
   ```
   https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz/getUpdates
   ```

3. Bạn sẽ thấy response JSON như thế này:
   ```json
   {
     "ok": true,
     "result": [
       {
         "update_id": 123456789,
         "message": {
           "message_id": 1,
           "from": {
             "id": 987654321,
             "is_bot": false,
             "first_name": "Your Name"
           },
           "chat": {
             "id": 987654321,
             "first_name": "Your Name",
             "type": "private"
           },
           "date": 1234567890,
           "text": "/start"
         }
       }
     ]
   }
   ```

4. Tìm giá trị `"chat":{"id":987654321}` - số `987654321` chính là **Chat ID** của bạn

#### Cách 2: Dùng @userinfobot

1. Tìm và start bot `@userinfobot` trên Telegram
2. Bot sẽ tự động trả về thông tin của bạn:
   ```
   Id: 987654321
   First name: Your Name
   Username: @yourusername
   ```
3. Số `987654321` chính là Chat ID của bạn

## Bước 3: Cấu hình trong project

### 3.1. Mở file .env

Mở file `.env` trong thư mục gốc của project

### 3.2. Thêm cấu hình Telegram

Thêm hoặc cập nhật các dòng sau:

```bash
# Notification method
NOTIFICATION_METHOD=telegram

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890
TELEGRAM_CHAT_ID=987654321
```

Thay:
- `123456789:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890` bằng Bot Token của bạn
- `987654321` bằng Chat ID của bạn

### 3.3. Lưu file

Lưu file `.env` lại

## Bước 4: Test thông báo

### 4.1. Khởi động server

```bash
npm run dev
```

### 4.2. Upload một video test

Upload video qua API hoặc web interface

### 4.3. Kiểm tra Telegram

Bạn sẽ nhận được thông báo từ bot khi:
- Video bắt đầu xử lý
- Video xử lý xong (kèm link YouTube)
- Có lỗi xảy ra

## Các loại thông báo bạn sẽ nhận được

### ✅ Thông báo hoàn thành

```
✅ Video Processing Complete

📋 Job ID: abc-123-def
💬 Your video has been successfully processed and uploaded to YouTube!

🎬 Xem video trên YouTube
```

### ❌ Thông báo lỗi

```
❌ Processing Error

📋 Job ID: abc-123-def
💬 Video processing failed at rendering stage: Out of memory
```

### 🚨 Cảnh báo cho operator (nếu bạn là admin)

```
🚨 Operator Alert: ERROR

📋 Job ID: abc-123-def
🔧 Stage: rendering
💬 Pipeline stage failed: Out of memory
⏰ 2024-01-01T00:00:00.000Z
```

## Troubleshooting

### ❓ Bot không gửi tin nhắn

**Nguyên nhân có thể:**
1. Bot Token sai
2. Chat ID sai
3. Chưa start bot (chưa gửi `/start`)

**Cách fix:**
1. Kiểm tra lại Bot Token từ BotFather
2. Kiểm tra lại Chat ID bằng cách truy cập URL getUpdates
3. Đảm bảo đã gửi tin nhắn `/start` cho bot
4. Kiểm tra logs của server: `npm run dev`

### ❓ Lỗi "Chat not found"

**Nguyên nhân:**
- Chat ID sai hoặc chưa start bot

**Cách fix:**
1. Gửi tin nhắn `/start` cho bot
2. Lấy lại Chat ID bằng URL getUpdates
3. Cập nhật lại trong file `.env`

### ❓ Lỗi "Unauthorized"

**Nguyên nhân:**
- Bot Token sai

**Cách fix:**
1. Kiểm tra lại token từ BotFather
2. Nếu mất token, dùng lệnh `/token` với BotFather để lấy lại
3. Cập nhật lại trong file `.env`

### ❓ Muốn gửi thông báo cho nhiều người

**Cách làm:**
1. Tạo một Telegram Group
2. Thêm bot vào group (Add Members → tìm bot)
3. Lấy Group Chat ID (tương tự cách lấy Chat ID cá nhân)
4. Cập nhật `TELEGRAM_CHAT_ID` trong `.env`

**Lưu ý:** Group Chat ID thường là số âm, ví dụ: `-123456789`

## Tips & Tricks

### 💡 Tùy chỉnh tên và avatar bot

Gửi các lệnh sau cho BotFather:
- `/setname` - Đổi tên bot
- `/setdescription` - Thêm mô tả
- `/setabouttext` - Thêm thông tin "About"
- `/setuserpic` - Đổi avatar bot

### 💡 Tắt thông báo tạm thời

Nếu không muốn nhận thông báo:
```bash
# Trong file .env
NOTIFICATION_METHOD=none
```

Hoặc comment out:
```bash
# NOTIFICATION_METHOD=telegram
```

### 💡 Gửi thông báo qua nhiều kênh

Bạn có thể setup cả Telegram và Webhook cùng lúc bằng cách:
1. Giữ nguyên config Telegram
2. Thêm webhook endpoint
3. Code sẽ tự động gửi qua cả 2 kênh

## Câu hỏi thường gặp

### ❓ Bot có miễn phí không?

Có, hoàn toàn miễn phí. Telegram không tính phí cho bot API.

### ❓ Có giới hạn số lượng tin nhắn không?

Có, nhưng rất cao:
- 30 tin nhắn/giây cho mỗi chat
- Đủ cho hầu hết use case

### ❓ Bot có thể gửi file không?

Có, bot có thể gửi:
- Text messages
- Photos
- Videos
- Documents
- Audio files

Hiện tại chúng ta chỉ gửi text, nhưng có thể mở rộng sau.

### ❓ Làm sao để bot gửi cho nhiều người?

Có 2 cách:
1. **Telegram Group**: Tạo group, add bot và tất cả thành viên
2. **Broadcast**: Lưu nhiều Chat ID và gửi riêng cho từng người (cần code thêm)

### ❓ Bot có an toàn không?

Có, nếu bạn:
- ✅ Không share Bot Token với ai
- ✅ Không commit token vào Git (dùng `.env`)
- ✅ Chỉ add bot vào group tin tưởng

## Tài liệu tham khảo

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [BotFather Commands](https://core.telegram.org/bots#6-botfather)
- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)

## Cần hỗ trợ?

Nếu gặp vấn đề, hãy:
1. Kiểm tra logs: `npm run dev`
2. Đọc lại hướng dẫn này
3. Tìm trong phần Troubleshooting
4. Mở issue trên GitHub

---

**Chúc bạn setup thành công! 🎉**
