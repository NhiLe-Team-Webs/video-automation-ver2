# Wasabi Storage Service

Service quản lý object storage sử dụng Wasabi (S3-compatible).

## Tính năng

### 1. Upload Video
- Upload video cuối cùng lên Wasabi storage
- Tự động kiểm tra trùng lặp bằng MD5 hash
- Tạo signed URL để download (có thời hạn)

### 2. Quản lý B-roll
- Upload B-roll lên storage
- Tracking B-roll đã tải để tránh trùng lặp
- Tự động tìm B-roll đã có sẵn theo hash

### 3. Quản lý Sound Effects
- Upload sound effects lên storage
- Tracking SFX đã tải để tránh trùng lặp
- Phân loại theo category

### 4. Deduplication
- Tính MD5 hash cho mỗi file
- Kiểm tra file đã tồn tại trước khi upload
- Tiết kiệm storage và bandwidth

## Cấu trúc Storage

```
video-automation-bucket/
├── videos/
│   ├── final/          # Video cuối cùng đã render
│   ├── raw/            # Video gốc upload
│   └── edited/         # Video đã auto-edit
├── broll/              # B-roll footage
│   └── {search-term}-{hash}.mp4
├── sfx/                # Sound effects
│   ├── whoosh/
│   ├── pop/
│   ├── transition/
│   ├── zoom/
│   └── text-appear/
└── images/             # Hình ảnh (future)
```

## Sử dụng

### Upload Video
```typescript
import wasabiStorageService from './services/storage/wasabiStorageService';

// Upload video cuối cùng
const result = await wasabiStorageService.uploadVideo(
  '/path/to/video.mp4',
  'job-123',
  'final'
);

// Tạo signed URL để download (valid 7 ngày)
const downloadUrl = await wasabiStorageService.getSignedUrl(result.key, {
  expiresIn: 7 * 24 * 60 * 60
});
```

### Upload B-roll
```typescript
// Upload B-roll (tự động check trùng lặp)
const result = await wasabiStorageService.uploadBroll(
  '/path/to/broll.mp4',
  'nature landscape'
);

// Nếu B-roll đã tồn tại, sẽ trả về key của file cũ
```

### Upload Sound Effect
```typescript
// Upload SFX (tự động check trùng lặp)
const result = await wasabiStorageService.uploadSoundEffect(
  '/path/to/whoosh.mp3',
  'whoosh'
);
```

### Cleanup
```typescript
// Xóa file cũ hơn 30 ngày
const deletedCount = await wasabiStorageService.deleteOldFiles(
  'videos/raw/',
  30
);
```

## Cấu hình

Thêm vào `.env`:

```bash
# Wasabi Storage
WASABI_BUCKET=video-automation-bucket
WASABI_REGION=us-east-1
WASABI_ACCESS_KEY_ID=your_access_key_id
WASABI_SECRET_ACCESS_KEY=your_secret_access_key
```

## Setup Wasabi

1. Đăng ký tài khoản: https://wasabi.com/
   - 30-day free trial
   - 1TB storage
   - Không cần credit card

2. Tạo bucket:
   - Tên: `video-automation-bucket`
   - Region: `us-east-1`

3. Tạo Access Keys:
   - Vào Settings > Access Keys
   - Create New Access Key
   - Lưu Access Key ID và Secret Access Key

4. Cấu hình CORS (optional):
   ```json
   {
     "CORSRules": [
       {
         "AllowedOrigins": ["*"],
         "AllowedMethods": ["GET", "PUT", "POST"],
         "AllowedHeaders": ["*"],
         "MaxAgeSeconds": 3000
       }
     ]
   }
   ```

## Chi phí

- **Free Trial**: 30 ngày, 1TB storage, không giới hạn bandwidth
- **Sau trial**: $6.99/month minimum (1TB storage)
- **Bandwidth**: Miễn phí (không tính phí egress)

## Lợi ích so với YouTube Upload

1. **Không cần OAuth**: Không cần setup YouTube OAuth flow phức tạp
2. **Linh hoạt hơn**: Có thể upload lên nhiều nơi (YouTube, TikTok, etc.)
3. **Kiểm soát tốt hơn**: Quản lý file trực tiếp
4. **Deduplication**: Tránh upload trùng lặp, tiết kiệm storage
5. **Tracking**: Theo dõi B-roll và SFX đã tải

## Tích hợp với Pipeline

Pipeline đã được cập nhật:
- Stage 8: Upload lên Wasabi thay vì YouTube
- B-roll service: Tự động upload lên Wasabi khi download
- SFX service: Tự động upload lên Wasabi khi download
- Notification: Gửi link download từ Wasabi thay vì YouTube link
