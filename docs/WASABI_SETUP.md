# Hướng dẫn Setup Wasabi Storage

Wasabi là dịch vụ object storage tương thích S3, cung cấp 30 ngày dùng thử miễn phí với 1TB storage.

## Tại sao dùng Wasabi?

1. **Miễn phí 30 ngày**: Không cần credit card
2. **Chi phí thấp**: $6.99/tháng cho 1TB sau trial
3. **Bandwidth miễn phí**: Không tính phí download
4. **S3-compatible**: Dùng AWS SDK
5. **Đơn giản hơn YouTube**: Không cần OAuth flow phức tạp

## Bước 1: Đăng ký tài khoản

1. Truy cập: https://wasabi.com/
2. Click "Start Free Trial"
3. Điền thông tin:
   - Email
   - Password
   - Company name (có thể để tên cá nhân)
   - Phone number
4. Xác nhận email
5. Đăng nhập vào console: https://console.wasabisys.com/

## Bước 2: Tạo Bucket

1. Trong Wasabi Console, click "Buckets" ở menu bên trái
2. Click "Create Bucket"
3. Cấu hình:
   - **Bucket Name**: `video-automation-bucket` (hoặc tên khác)
   - **Region**: `us-east-1` (khuyến nghị)
   - **Bucket Logging**: Disabled (không cần)
   - **Bucket Versioning**: Disabled (không cần)
4. Click "Create Bucket"

## Bước 3: Tạo Access Keys

1. Click vào tên user ở góc trên bên phải
2. Chọn "Access Keys"
3. Click "Create New Access Key"
4. Lưu lại:
   - **Access Key ID**: Ví dụ `AKIAIOSFODNN7EXAMPLE`
   - **Secret Access Key**: Ví dụ `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`
   
   ⚠️ **Quan trọng**: Secret Access Key chỉ hiển thị 1 lần, hãy lưu lại ngay!

## Bước 4: Cấu hình CORS (Optional)

Nếu bạn muốn upload trực tiếp từ browser:

1. Chọn bucket vừa tạo
2. Click tab "Settings"
3. Scroll xuống "CORS Configuration"
4. Click "Edit"
5. Paste cấu hình sau:

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000,
      "ExposeHeaders": ["ETag"]
    }
  ]
}
```

6. Click "Save"

## Bước 5: Cấu hình Environment Variables

Thêm vào file `.env`:

```bash
# Wasabi Storage
WASABI_BUCKET=video-automation-bucket
WASABI_REGION=us-east-1
WASABI_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
WASABI_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

Thay thế các giá trị bằng thông tin thực tế của bạn.

## Bước 6: Test Connection

Chạy script test để kiểm tra kết nối:

```bash
npm run test:wasabi
```

Hoặc test thủ công:

```typescript
import wasabiStorageService from './src/services/storage/wasabiStorageService';

// Test upload
const result = await wasabiStorageService.uploadFile(
  './test-video.mp4',
  'test/video.mp4'
);

console.log('Upload successful:', result);

// Test signed URL
const url = await wasabiStorageService.getSignedUrl(result.key);
console.log('Download URL:', url);
```

## Cấu trúc Storage

Sau khi setup, bucket sẽ có cấu trúc:

```
video-automation-bucket/
├── videos/
│   ├── final/          # Video cuối cùng (gửi cho user)
│   │   └── job-123.mp4
│   ├── raw/            # Video gốc (có thể xóa sau khi xử lý)
│   │   └── job-123.mp4
│   └── edited/         # Video đã auto-edit
│       └── job-123.mp4
├── broll/              # B-roll footage (cache, tránh tải lại)
│   ├── nature-abc123.mp4
│   └── city-def456.mp4
└── sfx/                # Sound effects (cache, tránh tải lại)
    ├── whoosh/
    │   └── abc123.mp3
    ├── pop/
    │   └── def456.mp3
    └── transition/
        └── ghi789.mp3
```

## Lifecycle Policy (Tự động xóa file cũ)

Để tiết kiệm storage, bạn có thể setup lifecycle policy:

1. Chọn bucket
2. Click tab "Lifecycle"
3. Click "Add Rule"
4. Cấu hình:
   - **Rule Name**: `delete-old-raw-videos`
   - **Prefix**: `videos/raw/`
   - **Expiration**: 30 days
5. Click "Save"

Điều này sẽ tự động xóa video gốc sau 30 ngày.

## Chi phí

### Free Trial (30 ngày)
- 1TB storage
- Unlimited bandwidth
- Không cần credit card

### Sau Trial
- **Storage**: $6.99/tháng cho 1TB đầu tiên
- **Bandwidth**: Miễn phí (không giới hạn)
- **API Requests**: Miễn phí

### Ước tính chi phí
- 100 video/tháng × 500MB = 50GB → $6.99/tháng
- 1000 video/tháng × 500MB = 500GB → $6.99/tháng
- 2000 video/tháng × 500MB = 1TB → $6.99/tháng

## Troubleshooting

### Lỗi: "Access Denied"
- Kiểm tra Access Key ID và Secret Access Key
- Kiểm tra bucket name và region
- Kiểm tra bucket policy (nếu có)

### Lỗi: "Bucket not found"
- Kiểm tra bucket name chính xác
- Kiểm tra region đúng
- Đảm bảo bucket đã được tạo

### Lỗi: "Invalid credentials"
- Tạo lại Access Keys
- Kiểm tra không có khoảng trắng thừa trong .env
- Restart server sau khi thay đổi .env

### Upload chậm
- Kiểm tra kết nối internet
- Thử region khác gần hơn
- Nén video trước khi upload

## So sánh với YouTube Upload

| Tính năng | Wasabi | YouTube |
|-----------|--------|---------|
| Setup | Đơn giản | Phức tạp (OAuth) |
| Chi phí | $6.99/tháng | Miễn phí |
| Linh hoạt | Cao | Thấp |
| Deduplication | Có | Không |
| Tracking | Có | Không |
| Download speed | Nhanh | Trung bình |
| Expiration | Tùy chỉnh | Không |

## Kết luận

Wasabi là lựa chọn tốt cho MVP vì:
- Setup đơn giản
- Chi phí thấp
- Linh hoạt hơn YouTube
- Hỗ trợ deduplication và tracking
- Không cần OAuth phức tạp

Sau khi có nhiều user, bạn có thể:
- Thêm YouTube upload như một option
- Dùng CDN để tăng tốc download
- Setup lifecycle policy để tối ưu chi phí
