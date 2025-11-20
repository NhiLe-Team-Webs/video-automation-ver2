# Highlight Detection Service

Service để phát hiện các highlight moments trong video bằng cách wrap **videogrep CLI**.

## Videogrep Integration

Service này sử dụng [videogrep](https://github.com/antiboredom/videogrep) - một Python tool mạnh mẽ để search và extract clips từ video dựa trên subtitle.

### Installation

```bash
pip install videogrep
```

### How It Works

1. **With Video File**: Gọi videogrep CLI trực tiếp
   ```bash
   videogrep --input video.mp4 --search "important" --demo
   ```

2. **Without Video File**: Fallback to SRT-only analysis
   - Parse SRT file
   - Search keywords trong transcript
   - Extract matching segments

## Features

### Default Highlight Detection

Tự động detect highlights dựa trên default keywords:
- `important`, `critical`, `essential`, `key`
- `breakthrough`, `discover`, `reveal`
- `amazing`, `incredible`
- `best`, `worst`
- `problem`, `solution`
- `conclusion`, `summary`, `remember`

```typescript
const highlights = await service.detectHighlights('video.srt');
```

### Custom Pattern Search

Search với custom patterns (videogrep-style):

```typescript
// Search single pattern
const highlights = await service.searchHighlights('video.srt', ['machine learning']);

// Search multiple patterns
const highlights = await service.searchHighlights('video.srt', [
  'artificial intelligence',
  'neural network',
  'deep learning'
]);

// Search with regex
const highlights = await service.searchHighlights('video.srt', [/\$\d+/]);
```

## Usage Examples

### Example 1: Basic Detection

```typescript
import { HighlightDetectionService } from './highlightDetectionService';

const service = new HighlightDetectionService();
const highlights = await service.detectHighlights('temp/video.srt');

console.log(`Found ${highlights.length} highlights`);
highlights.forEach(h => {
  console.log(`${h.startTime}s - ${h.endTime}s: ${h.reason}`);
});
```

### Example 2: Custom Search

```typescript
// Search for specific topics
const highlights = await service.searchHighlights('temp/video.srt', [
  'tutorial',
  'example',
  'demonstration'
]);
```

### Example 3: With Real Video File

Khi có video file, videogrep sẽ được gọi trực tiếp:

```bash
# Ensure video and SRT have same name
temp/
  video.mp4
  video.srt
```

```typescript
const highlights = await service.detectHighlights('temp/video.srt');
// videogrep CLI will be called automatically
```

## Output Format

```typescript
interface Highlight {
  startTime: number;      // Seconds
  endTime: number;        // Seconds
  confidence: number;     // 0-1 (videogrep matches = 1.0)
  reason: string;         // "matched: keyword1, keyword2"
}
```

## Testing

### Unit Tests
```bash
npm test highlightDetectionService.test.ts
```

### Manual Test
```bash
npx tsx src/services/highlightDetectionService.manual-test.ts
```

## Videogrep Commands Reference

### Search for keywords
```bash
videogrep --input video.mp4 --search "important" --demo
```

### Multiple searches
```bash
videogrep --input video.mp4 \
  --search "important" \
  --search "critical" \
  --search "breakthrough" \
  --demo
```

### Export clips
```bash
videogrep --input video.mp4 --search "important" --output highlights.mp4
```

### Show ngrams (common phrases)
```bash
videogrep --input video.mp4 --ngrams 2
```

## Requirements

- Python 3.6-3.10
- videogrep (`pip install videogrep`)
- Video file + matching SRT file (same name)

## Fallback Behavior

Nếu video file không tồn tại, service sẽ:
1. Log warning
2. Fall back to SRT-only analysis
3. Search keywords trực tiếp trong SRT
4. Return highlights based on text matching

## Integration with Pipeline

```
Transcription → Highlight Detection → LLM Editing Plan → Rendering
                (videogrep)
```

Highlights được gửi đến LLM để tạo editing plan với animations và effects.
