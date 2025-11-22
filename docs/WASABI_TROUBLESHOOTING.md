# Wasabi Storage Troubleshooting

Hướng dẫn xử lý các lỗi thường gặp khi sử dụng Wasabi storage.

## Lỗi: ECONNRESET

### Mô tả
```
Failed to upload file to Wasabi
error: "write ECONNRESET"
```

### Nguyên nhân
- Kết nối bị gián đoạn trong quá trình upload
- File quá lớn và timeout
- Mạng không ổn định
- Wasabi server tạm thời không phản hồi

### Giải pháp

#### 1. Retry tự động (ĐÃ TRIỂN KHAI)
Service đã có retry logic với 3 lần thử:
- Lần 1: Thử ngay
- Lần 2: Đợi 1 giây
- Lần 3: Đợi 2 giây
- Lần 4: Đợi 4 giây

#### 2. Kiểm tra kết nối mạng
```bash
# Test kết nối đến Wasabi
ping s3.us-east-1.wasabisys.com

# Test DNS resolution
nslookup s3.us-east-1.wasabisys.com
```

#### 3. Kiểm tra file size
```bash
# Xem kích thước file
ls -lh temp/uploads/*.mp4
```

Nếu file > 500MB, có thể cần tăng timeout hoặc dùng multipart upload.

#### 4. Thử upload thủ công
```typescript
import wasabiStorageService from './src/services/storage/wasabiStorageService';

// Test upload file nhỏ
const result = await wasabiStorageService.uploadFile(
  './test-small.mp4',
  'test/small.mp4'
);
console.log('Success:', result);
```

#### 5. Kiểm tra credentials
```bash
# Verify credentials trong .env
cat .env | grep WASABI
```

Đảm bảo:
- `WASABI_ACCESS_KEY_ID` đúng
- `WASABI_SECRET_ACCESS_KEY` đúng
- Không có khoảng trắng thừa

## Lỗi: Access Denied

### Mô tả
```
Failed to upload file to Wasabi
error: "Access Denied"
```

### Nguyên nhân
- Access Key ID hoặc Secret Access Key sai
- Bucket policy không cho phép upload
- Access key đã bị revoke

### Giải pháp

#### 1. Tạo lại Access Keys
1. Đăng nhập Wasabi Console
2. Click tên user > Access Keys
3. Delete old key
4. Create New Access Key
5. Cập nhật `.env`

#### 2. Kiểm tra bucket policy
1. Chọn bucket trong Wasabi Console
2. Click tab "Policies"
3. Đảm bảo policy cho phép PutObject

#### 3. Test credentials
```bash
# Test với AWS CLI (Wasabi compatible)
aws s3 ls s3://video-automation-bucket \
  --endpoint-url=https://s3.us-east-1.wasabisys.com \
  --profile wasabi
```

## Lỗi: NoSuchBucket

### Mô tả
```
Failed to upload file to Wasabi
error: "The specified bucket does not exist"
```

### Nguyên nhân
- Bucket chưa được tạo
- Bucket name sai
- Region sai

### Giải pháp

#### 1. Kiểm tra bucket tồn tại
1. Đăng nhập Wasabi Console
2. Click "Buckets"
3. Verify bucket name chính xác

#### 2. Kiểm tra region
```bash
# Trong .env
WASABI_REGION=us-east-1  # Phải khớp với region của bucket
```

#### 3. Tạo bucket nếu chưa có
1. Wasabi Console > Buckets
2. Create Bucket
3. Tên: `video-automation-bucket`
4. Region: `us-east-1`

## Lỗi: Timeout

### Mô tả
```
Failed to upload file to Wasabi
error: "socket hang up" hoặc "ETIMEDOUT"
```

### Nguyên nhân
- File quá lớn
- Mạng chậm
- Wasabi server quá tải

### Giải pháp

#### 1. Tăng timeout (nếu cần)
Hiện tại service không set timeout cụ thể, AWS SDK dùng default.

#### 2. Nén video trước khi upload
```bash
# Nén video với ffmpeg
ffmpeg -i input.mp4 -c:v libx264 -crf 23 -preset medium output.mp4
```

#### 3. Upload file nhỏ hơn
- Giới hạn upload size trong UI
- Hoặc split video thành nhiều phần

## Lỗi: Out of Memory

### Mô tả
```
JavaScript heap out of memory
```

### Nguyên nhân
- Đọc toàn bộ file vào memory (buffer)
- File quá lớn (> 1GB)

### Giải pháp

#### 1. Tăng memory limit
```bash
# Chạy với memory cao hơn
NODE_OPTIONS="--max-old-space-size=4096" npm run dev
```

#### 2. Sử dụng streaming (TODO)
Hiện tại service đọc file thành buffer. Với file rất lớn, nên dùng streaming.

## Best Practices

### 1. Kiểm tra file size trước upload
```typescript
const stats = await fs.stat(videoPath);
const sizeMB = stats.size / (1024 * 1024);

if (sizeMB > 1000) {
  logger.warn('File very large, upload may take time', { sizeMB });
}
```

### 2. Log chi tiết
Service đã log đầy đủ:
- File size
- Upload attempts
- Errors với stack trace

### 3. Graceful degradation
Upload Wasabi là non-critical:
```typescript
try {
  await wasabiStorageService.uploadVideo(...);
} catch (error) {
  logger.warn('Wasabi upload failed (non-critical)');
  // Continue processing
}
```

### 4. Monitor upload success rate
```bash
# Xem logs
tail -f logs/combined.log | grep "Wasabi"

# Count successes vs failures
grep "File uploaded successfully" logs/combined.log | wc -l
grep "Failed to upload file to Wasabi" logs/combined.log | wc -l
```

## Performance Tips

### 1. Upload song song
Nếu có nhiều file nhỏ (B-roll, SFX), upload song song:
```typescript
await Promise.all([
  wasabiStorageService.uploadBroll(broll1, 'nature'),
  wasabiStorageService.uploadBroll(broll2, 'city'),
  wasabiStorageService.uploadSoundEffect(sfx1, 'whoosh'),
]);
```

### 2. Cache metadata
Service đã cache metadata trong memory để tránh list objects nhiều lần.

### 3. Deduplication
Service tự động check hash trước khi upload để tránh upload trùng.

## Monitoring

### Check upload status
```bash
# Xem tất cả uploads trong 1 giờ qua
grep "Uploading file to Wasabi" logs/combined.log | tail -20

# Xem uploads thành công
grep "File uploaded successfully" logs/combined.log | tail -10

# Xem uploads thất bại
grep "Failed to upload file to Wasabi" logs/combined.log | tail -10
```

### Check storage usage
1. Wasabi Console > Buckets
2. Click bucket name
3. Xem "Storage Used"

### Check bandwidth
Wasabi không tính phí bandwidth, nhưng có thể xem usage:
1. Wasabi Console > Analytics
2. Xem "Data Transfer"

## Emergency Actions

### Nếu Wasabi down hoàn toàn
1. Service sẽ log warning nhưng tiếp tục xử lý
2. Video vẫn lưu local trong `temp/`
3. Có thể upload lại sau khi Wasabi phục hồi

### Nếu hết storage quota
1. Xóa video cũ:
```typescript
await wasabiStorageService.deleteOldFiles('videos/raw/', 30);
```

2. Hoặc upgrade plan trong Wasabi Console

### Nếu cần migrate sang S3/CloudFlare R2
Code tương thích S3, chỉ cần đổi endpoint:
```typescript
// Trong wasabiStorageService.ts
endpoint: `https://s3.amazonaws.com` // AWS S3
// hoặc
endpoint: `https://<account-id>.r2.cloudflarestorage.com` // CloudFlare R2
```

## Support

### Wasabi Support
- Email: support@wasabi.com
- Portal: https://wasabi.com/support/
- Response time: 24-48 hours

### Check Wasabi Status
- Status page: https://status.wasabi.com/
- Twitter: @wasabi_cloud

## Tóm tắt

Các lỗi phổ biến và cách xử lý:

| Lỗi | Nguyên nhân | Giải pháp |
|-----|-------------|-----------|
| ECONNRESET | Kết nối gián đoạn | Retry tự động (đã có) |
| Access Denied | Credentials sai | Tạo lại Access Keys |
| NoSuchBucket | Bucket không tồn tại | Tạo bucket |
| Timeout | File quá lớn | Nén video hoặc tăng timeout |
| Out of Memory | File quá lớn | Tăng memory limit |

Service đã được thiết kế để handle các lỗi này gracefully và không làm gián đoạn pipeline.
