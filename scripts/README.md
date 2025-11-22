# Pipeline Scripts

Các script để chạy pipeline xử lý video, có thể chạy toàn bộ hoặc từng bước riêng lẻ.

## Chạy Toàn Bộ Pipeline

Chạy pipeline hoàn chỉnh từ đầu đến cuối:

```bash
npm run pipeline:full -- --video <đường-dẫn-video> --userId <user-id>
```

**Ví dụ:**
```bash
npm run pipeline:full -- --video ./temp/uploads/video.mp4 --userId user123
```

## Chạy Từng Bước Riêng Lẻ

### 1. Auto Edit (Cắt Bỏ Phần Im Lặng)

```bash
npm run pipeline:auto-edit -- --video <đường-dẫn-video>
```

**Ví dụ:**
```bash
npm run pipeline:auto-edit -- --video ./temp/uploads/video.mp4
```

**Output:** Video đã được cắt bỏ phần im lặng và filler content

---

### 2. Transcription (Tạo Phụ Đề)

```bash
npm run pipeline:transcribe -- --video <đường-dẫn-video>
```

**Ví dụ:**
```bash
npm run pipeline:transcribe -- --video ./temp/auto-edited/video.mp4
```

**Output:** File SRT chứa phụ đề với timestamp

---

### 3. Highlight Detection (Phát Hiện Điểm Nhấn)

```bash
npm run pipeline:highlights -- --srt <đường-dẫn-srt>
```

**Ví dụ:**
```bash
npm run pipeline:highlights -- --srt ./temp/transcripts/video.srt
```

**Output:** Danh sách các điểm nhấn quan trọng trong video

---

### 4. Editing Plan Generation (Tạo Kế Hoạch Chỉnh Sửa)

```bash
npm run pipeline:editing-plan -- --srt <đường-dẫn-srt> --duration <giây> [--output <đường-dẫn-output>]
```

**Ví dụ:**
```bash
npm run pipeline:editing-plan -- --srt ./temp/transcripts/video.srt --duration 120 --output ./temp/editing-plans/plan.json
```

**Output:** File JSON chứa kế hoạch chỉnh sửa (animations, transitions, B-roll, zoom effects)

---

### 5. Rendering (Render Video Cuối Cùng)

```bash
npm run pipeline:render -- --video <đường-dẫn-video> --plan <đường-dẫn-plan> --output <đường-dẫn-output> [--srt <đường-dẫn-srt>]
```

**Ví dụ:**
```bash
npm run pipeline:render -- --video ./temp/auto-edited/video.mp4 --plan ./temp/editing-plans/plan.json --output ./temp/final/video.mp4 --srt ./temp/transcripts/video.srt
```

**Output:** Video cuối cùng với tất cả hiệu ứng, animations, và B-roll

---

### 6. YouTube Upload (Upload Lên YouTube)

```bash
npm run pipeline:upload -- --video <đường-dẫn-video> --title <tiêu-đề> [--description <mô-tả>]
```

**Ví dụ:**
```bash
npm run pipeline:upload -- --video ./temp/final/video.mp4 --title "My Awesome Video" --description "Automatically edited video"
```

**Output:** YouTube URL của video đã upload

---

### 7. Resume Pipeline (Tiếp Tục Pipeline Bị Gián Đoạn)

```bash
npm run pipeline:resume -- --jobId <job-id>
```

**Ví dụ:**
```bash
npm run pipeline:resume -- --jobId job-1234567890
```

**Output:** Hiển thị trạng thái và hướng dẫn tiếp tục

---

## Workflow Ví Dụ

### Chạy Toàn Bộ Pipeline:
```bash
npm run pipeline:full -- --video ./input/video.mp4 --userId user123
```

### Hoặc Chạy Từng Bước:

```bash
# Bước 1: Auto Edit
npm run pipeline:auto-edit -- --video ./input/video.mp4
# Output: ./temp/auto-edited/video-xxx.mp4

# Bước 2: Transcription
npm run pipeline:transcribe -- --video ./temp/auto-edited/video-xxx.mp4
# Output: ./temp/transcripts/video-xxx.srt

# Bước 3: Highlight Detection
npm run pipeline:highlights -- --srt ./temp/transcripts/video-xxx.srt
# Output: Console log với danh sách highlights

# Bước 4: Editing Plan
npm run pipeline:editing-plan -- --srt ./temp/transcripts/video-xxx.srt --duration 120 --output ./temp/editing-plans/plan-xxx.json
# Output: ./temp/editing-plans/plan-xxx.json

# Bước 5: Rendering
npm run pipeline:render -- --video ./temp/auto-edited/video-xxx.mp4 --plan ./temp/editing-plans/plan-xxx.json --output ./temp/final/video-xxx.mp4 --srt ./temp/transcripts/video-xxx.srt
# Output: ./temp/final/video-xxx.mp4

# Bước 6: YouTube Upload
npm run pipeline:upload -- --video ./temp/final/video-xxx.mp4 --title "My Video Title"
# Output: YouTube URL
```

## Lợi Ích Của Việc Chạy Từng Bước

1. **Debug dễ dàng hơn**: Nếu một bước bị lỗi, bạn chỉ cần chạy lại bước đó
2. **Tiết kiệm thời gian**: Không cần chạy lại toàn bộ pipeline từ đầu
3. **Testing**: Test từng component riêng lẻ
4. **Flexibility**: Có thể chỉnh sửa output của một bước trước khi chạy bước tiếp theo
5. **Development**: Phát triển và test từng service độc lập

## Lưu Ý

- Đảm bảo tất cả environment variables đã được cấu hình trong file `.env`
- Các API keys cần thiết: GEMINI_API_KEY, WHISPER_API_KEY, YOUTUBE_CLIENT_ID, PEXELS_API_KEY
- Đảm bảo đã cài đặt: FFmpeg, Auto Editor (`pip install auto-editor`)
- Các thư mục temp sẽ được tạo tự động nếu chưa tồn tại

## Troubleshooting

### Lỗi "Command not found"
```bash
npm install
npm run build
```

### Lỗi API Key
Kiểm tra file `.env` và đảm bảo tất cả API keys đã được cấu hình đúng.

### Lỗi FFmpeg
Đảm bảo FFmpeg đã được cài đặt và có trong PATH:
```bash
ffmpeg -version
```

### Lỗi Auto Editor
Cài đặt Auto Editor:
```bash
pip install auto-editor
```
