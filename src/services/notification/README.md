# Notification Service

Service để gửi thông báo cho người dùng và system operator về trạng thái xử lý video.

## Các phương thức thông báo được hỗ trợ

1. **Telegram Bot** (Khuyến nghị - Dễ setup nhất)
2. **Webhook** (Discord, Slack, etc.)
3. **Email** (Chưa implement)
4. **SMS** (Chưa implement)

## Setup Telegram Bot

### Bước 1: Tạo Telegram Bot

1. Mở Telegram và tìm kiếm `@BotFather`
2. Gửi lệnh `/newbot`
3. Đặt tên cho bot của bạn (ví dụ: "Video Automation Bot")
4. Đặt username cho bot (phải kết thúc bằng "bot", ví dụ: "my_video_automation_bot")
5. BotFather sẽ trả về một **Bot Token** (ví dụ: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
6. Lưu token này lại

### Bước 2: Lấy Chat ID

Có 2 cách để lấy Chat ID:

#### Cách 1: Gửi tin nhắn cho bot

1. Tìm bot của bạn trên Telegram (bằng username vừa tạo)
2. Nhấn "Start" hoặc gửi bất kỳ tin nhắn nào
3. Truy cập URL sau (thay `<YOUR_BOT_TOKEN>` bằng token của bạn):
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
4. Tìm giá trị `"chat":{"id":123456789}` trong response
5. Số `123456789` chính là Chat ID của bạn

#### Cách 2: Sử dụng bot @userinfobot

1. Tìm và start bot `@userinfobot` trên Telegram
2. Bot sẽ trả về thông tin của bạn, bao gồm Chat ID

### Bước 3: Cấu hình trong .env

Thêm các dòng sau vào file `.env`:

```bash
NOTIFICATION_METHOD=telegram
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

### Bước 4: Test thông báo

Chạy một job xử lý video và kiểm tra xem bot có gửi thông báo không.

## Các loại thông báo

### 1. User Notifications

Gửi cho người dùng khi:
- ✅ Video xử lý hoàn tất (kèm link YouTube)
- ❌ Xử lý thất bại (kèm thông tin lỗi)
- 📊 Cập nhật trạng thái (optional)

### 2. Operator Alerts

Gửi cho system operator khi:
- 🚨 Lỗi nghiêm trọng trong pipeline
- ⚠️ Cảnh báo (ví dụ: xử lý chậm)
- ℹ️ Thông tin quan trọng

## Ví dụ tin nhắn

### Completion Notification
```
✅ Video Processing Complete

📋 Job ID: `abc-123-def`
💬 Your video has been successfully processed and uploaded to YouTube!

🎬 Xem video trên YouTube
```

### Error Notification
```
❌ Processing Error

📋 Job ID: `abc-123-def`
💬 Video processing failed at rendering stage: Out of memory

```

### Operator Alert
```
🚨 Operator Alert: ERROR

📋 Job ID: `abc-123-def`
🔧 Stage: rendering
💬 Pipeline stage failed: Out of memory
⏰ 2024-01-01T00:00:00.000Z
```

## Setup Webhook (Alternative)

Nếu bạn muốn dùng webhook thay vì Telegram:

```bash
NOTIFICATION_METHOD=webhook
NOTIFICATION_ENDPOINT=https://discord.com/api/webhooks/your-webhook-id
```

### Discord Webhook

1. Vào Discord server settings
2. Chọn "Integrations" → "Webhooks"
3. Tạo webhook mới và copy URL
4. Paste URL vào `NOTIFICATION_ENDPOINT`

### Slack Webhook

1. Vào Slack App settings
2. Tạo Incoming Webhook
3. Copy webhook URL
4. Paste URL vào `NOTIFICATION_ENDPOINT`

## API Reference

### NotificationService.notifyUser()

```typescript
await notificationService.notifyUser(userId: string, message: NotificationMessage);

interface NotificationMessage {
  type: 'completion' | 'error' | 'status';
  jobId: string;
  youtubeUrl?: string;
  message: string;
}
```

### NotificationService.notifyOperator()

```typescript
await notificationService.notifyOperator(alert: OperatorAlert);

interface OperatorAlert {
  severity: 'error' | 'warning' | 'info';
  jobId: string;
  stage: string;
  message: string;
  timestamp: Date;
}
```

## Troubleshooting

### Bot không gửi tin nhắn

1. Kiểm tra Bot Token có đúng không
2. Kiểm tra Chat ID có đúng không
3. Đảm bảo bạn đã start bot (gửi tin nhắn `/start`)
4. Kiểm tra logs để xem có lỗi gì không

### Lỗi "Chat not found"

- Chat ID sai hoặc bạn chưa start bot
- Thử gửi tin nhắn cho bot trước

### Lỗi "Unauthorized"

- Bot Token sai
- Kiểm tra lại token từ BotFather

## Retry Logic

Service tự động retry 1 lần nếu gửi thông báo thất bại:
- Delay: 2 giây
- Nếu retry thất bại, log error nhưng không làm fail job

## Future Enhancements

- [ ] Email notifications (SendGrid, AWS SES)
- [ ] SMS notifications (Twilio, AWS SNS)
- [ ] Push notifications (Firebase)
- [ ] Multiple notification channels per user
- [ ] Notification preferences/settings
- [ ] Rate limiting
- [ ] Notification templates
