# Whisper Local Setup

Hệ thống sử dụng Whisper open-source (chạy local) thay vì OpenAI API để tiết kiệm chi phí và có toàn quyền kiểm soát.

## Cài đặt

### 1. Cài đặt Whisper

```bash
pip install -U openai-whisper
```

### 2. Cài đặt FFmpeg (nếu chưa có)

**Windows:**
```bash
choco install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt update && sudo apt install ffmpeg
```

## Chọn Model

Whisper có nhiều model với độ chính xác và tốc độ khác nhau:

| Model  | Size | VRAM | Speed | Accuracy |
|--------|------|------|-------|----------|
| tiny   | ~1GB | ~1GB | Fastest | Lowest |
| base   | ~1GB | ~1GB | Fast | Good |
| small  | ~2GB | ~2GB | Medium | Better |
| medium | ~5GB | ~5GB | Slow | High |
| large  | ~10GB| ~10GB| Slowest | Best |

### Cấu hình trong .env

```bash
# Chọn model phù hợp với phần cứng của bạn
WHISPER_MODEL=base
```

**Khuyến nghị:**
- **Development/Testing**: `tiny` hoặc `base`
- **Production (CPU)**: `base` hoặc `small`
- **Production (GPU)**: `medium` hoặc `large`

## Sử dụng

Whisper sẽ tự động:
1. Download model lần đầu tiên (lưu vào cache)
2. Sử dụng GPU nếu có (CUDA/MPS)
3. Fallback về CPU nếu không có GPU

### Kiểm tra cài đặt

```bash
whisper --help
```

### Test transcription

```bash
whisper audio.mp3 --model base --language vi
```

## Performance Tips

### 1. Sử dụng GPU

Whisper tự động sử dụng GPU nếu có:
- **NVIDIA**: Cài đặt CUDA toolkit
- **Apple Silicon**: Tự động dùng MPS
- **AMD**: Sử dụng ROCm (Linux)

### 2. Batch Processing

Xử lý nhiều file cùng lúc để tận dụng GPU:

```python
import whisper

model = whisper.load_model("base")
results = [model.transcribe(audio) for audio in audio_files]
```

### 3. Optimize Memory

Nếu gặp lỗi out of memory:
- Giảm model size (large → medium → small)
- Chia audio thành chunks nhỏ hơn
- Tăng RAM/VRAM

## So sánh với OpenAI API

| Feature | Local Whisper | OpenAI API |
|---------|--------------|------------|
| Cost | Free | $0.006/minute |
| Privacy | 100% local | Data sent to OpenAI |
| Speed | Depends on hardware | Fast |
| Setup | Requires installation | Just API key |
| Offline | ✅ Works offline | ❌ Requires internet |

## Troubleshooting

### Lỗi: "No module named 'whisper'"

```bash
pip install -U openai-whisper
```

### Lỗi: "ffmpeg not found"

Cài đặt FFmpeg (xem phần cài đặt ở trên)

### Lỗi: Out of memory

Giảm model size trong .env:
```bash
WHISPER_MODEL=tiny
```

### Transcription chậm

- Sử dụng GPU nếu có
- Giảm model size
- Tăng RAM/VRAM
