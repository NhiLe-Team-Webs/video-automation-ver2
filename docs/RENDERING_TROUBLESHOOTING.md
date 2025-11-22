# Rendering Troubleshooting

Hướng dẫn xử lý các lỗi khi render video với Remotion.

## Lỗi: EMFILE - Too Many Open Files

### Mô tả
```
Error: EMFILE: too many open files, open 'path/to/video.mp4'
```

### Nguyên nhân
- Remotion mở quá nhiều file handles cùng lúc khi render
- Giới hạn file handles của hệ điều hành bị vượt quá
- Thường xảy ra với video dài (> 2 phút) hoặc nhiều B-roll

### Giải pháp

#### 1. Giảm concurrency (ĐÃ TRIỂN KHAI)
Service đã set `concurrency: 2` để giảm số file handles:
```typescript
await renderMedia({
  // ...
  concurrency: 2, // Thay vì default (50% CPU cores)
});
```

#### 2. Tăng giới hạn file handles (Windows)

**Cách 1: Tạm thời (cho session hiện tại)**
```bash
# Không có cách trực tiếp trên Windows
# Restart Node.js process thường giải quyết
```

**Cách 2: Restart server**
```bash
# Stop server
Ctrl+C

# Start lại
npm run dev
```

#### 3. Tăng giới hạn file handles (Linux/Mac)
```bash
# Xem giới hạn hiện tại
ulimit -n

# Tăng lên 4096
ulimit -n 4096

# Hoặc thêm vào ~/.bashrc
echo "ulimit -n 4096" >> ~/.bashrc
```

#### 4. Giảm độ dài video
- Split video thành nhiều phần ngắn hơn
- Render từng phần riêng
- Merge lại sau

#### 5. Giảm số B-roll
Trong editing plan, giới hạn B-roll:
```typescript
// Trong editingPlanService.ts
const maxBrollPlacements = 5; // Thay vì 10+
```

### Monitoring

Xem số file handles đang mở:

**Windows:**
```powershell
# Xem processes
Get-Process node | Select-Object Handles
```

**Linux/Mac:**
```bash
# Xem file handles của Node.js
lsof -p $(pgrep node) | wc -l
```

## Lỗi: Out of Memory

### Mô tả
```
JavaScript heap out of memory
FATAL ERROR: Reached heap limit
```

### Nguyên nhân
- Video quá dài hoặc resolution quá cao
- Quá nhiều animations/effects
- Memory leak trong Remotion

### Giải pháp

#### 1. Tăng memory limit
```bash
# Tăng lên 4GB
NODE_OPTIONS="--max-old-space-size=4096" npm run dev

# Hoặc 8GB
NODE_OPTIONS="--max-old-space-size=8192" npm run dev
```

#### 2. Giảm resolution
```typescript
// Trong remotion/config.ts
export const REMOTION_CONFIG = {
  width: 1280, // Thay vì 1920
  height: 720, // Thay vì 1080
  fps: 30,
};
```

#### 3. Render từng phần
- Split video thành chunks
- Render riêng
- Merge với FFmpeg

## Lỗi: Render Timeout

### Mô tả
```
Render timed out after X seconds
```

### Nguyên nhân
- Video quá dài
- CPU chậm
- Quá nhiều effects

### Giải pháp

#### 1. Tăng timeout
```typescript
await renderMedia({
  // ...
  timeoutInMilliseconds: 600000, // 10 phút thay vì 5 phút
});
```

#### 2. Giảm quality
```typescript
await renderMedia({
  // ...
  codec: 'h264',
  crf: 23, // Tăng lên 28 để render nhanh hơn (quality thấp hơn)
});
```

## Lỗi: FFmpeg Not Found

### Mô tả
```
Error: FFmpeg not found
```

### Giải pháp

**Windows:**
```bash
# Download FFmpeg từ: https://ffmpeg.org/download.html
# Thêm vào PATH
```

**Linux:**
```bash
sudo apt-get install ffmpeg
```

**Mac:**
```bash
brew install ffmpeg
```

## Lỗi: Bundle Failed

### Mô tả
```
Failed to bundle Remotion project
```

### Nguyên nhân
- Lỗi syntax trong template
- Missing dependencies
- Webpack error

### Giải pháp

#### 1. Kiểm tra templates
```bash
# Test templates
npm run preview
```

#### 2. Clear cache
```bash
# Xóa cache
rm -rf node_modules/.cache
rm -rf temp/remotion-bundle-*
```

#### 3. Reinstall dependencies
```bash
npm install
```

## Best Practices

### 1. Giới hạn độ dài video
```typescript
const MAX_VIDEO_DURATION = 300; // 5 phút

if (videoDuration > MAX_VIDEO_DURATION) {
  throw new Error('Video too long, max 5 minutes');
}
```

### 2. Giới hạn số effects
```typescript
const MAX_ANIMATIONS = 20;
const MAX_BROLL = 5;
const MAX_ZOOM_EFFECTS = 10;
```

### 3. Monitor memory usage
```typescript
logger.info('Memory usage', {
  heapUsed: process.memoryUsage().heapUsed / 1024 / 1024,
  heapTotal: process.memoryUsage().heapTotal / 1024 / 1024,
});
```

### 4. Cleanup temp files
```typescript
// Sau khi render xong
await fs.rm(bundleLocation, { recursive: true, force: true });
```

### 5. Use concurrency wisely
```typescript
// Development: concurrency = 1 (debug dễ hơn)
// Production: concurrency = 2-4 (balance speed vs stability)
const concurrency = process.env.NODE_ENV === 'production' ? 2 : 1;
```

## Performance Tips

### 1. Optimize video input
```bash
# Nén video trước khi xử lý
ffmpeg -i input.mp4 -c:v libx264 -crf 23 -preset medium output.mp4
```

### 2. Reduce B-roll resolution
```typescript
// Download B-roll ở resolution thấp hơn
const brollResolution = { width: 1280, height: 720 };
```

### 3. Limit animation complexity
- Dùng CSS animations thay vì JavaScript
- Tránh nhiều layers chồng lên nhau
- Giảm số particles/effects

### 4. Batch rendering
Nếu có nhiều video, render tuần tự thay vì song song:
```typescript
for (const video of videos) {
  await renderVideo(video);
  // Cleanup memory
  if (global.gc) global.gc();
}
```

## Emergency Actions

### Nếu render bị stuck
1. Ctrl+C để stop
2. Xóa temp files: `rm -rf temp/remotion-bundle-*`
3. Restart server
4. Thử lại với concurrency thấp hơn

### Nếu server crash liên tục
1. Giảm concurrency xuống 1
2. Tăng memory limit
3. Giảm video duration/quality
4. Check logs để tìm pattern

## Monitoring

### Check render progress
```bash
# Xem logs
tail -f logs/combined.log | grep "Remotion render"

# Count successful renders
grep "Remotion render completed" logs/combined.log | wc -l

# Count failed renders
grep "Remotion render failed" logs/combined.log | wc -l
```

### Check temp disk usage
```bash
# Windows
dir temp\remotion-bundle-* /s

# Linux/Mac
du -sh temp/remotion-bundle-*
```

## Tóm tắt

| Lỗi | Giải pháp nhanh |
|-----|-----------------|
| EMFILE | Restart server, concurrency=2 |
| Out of Memory | NODE_OPTIONS="--max-old-space-size=4096" |
| Timeout | Tăng timeoutInMilliseconds |
| FFmpeg Not Found | Install FFmpeg |
| Bundle Failed | Clear cache, reinstall |

Service đã được optimize để handle các lỗi phổ biến, nhưng với video rất dài hoặc phức tạp, có thể cần adjust settings thủ công.
