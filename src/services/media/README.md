# Media Services

This directory contains services for managing media assets used in video production.

## Services

### B-roll Service (`brollService.ts`)

Handles searching, downloading, and caching B-roll footage from Pexels API.

**Features:**
- Search for B-roll videos by keyword
- Download and cache videos locally
- Support for different orientations (landscape, portrait, square)
- Automatic transition generation
- Graceful fallback for missing B-roll

**Usage:**
```typescript
import brollService from './services/media/brollService';

// Search for B-roll
const result = await brollService.searchVideos('nature', {
  minDuration: 3,
  orientation: 'landscape',
});

// Download B-roll
const download = await brollService.downloadVideo(result.videos[0]);
```

### Sound Effects Service (`soundEffectsService.ts`)

Handles searching, downloading, and caching sound effects from Freesound API.

**Features:**
- Search for sound effects by category
- Download and cache sound effects locally
- Automatic volume adjustment (20-30% of main audio peak)
- Support for multiple categories: whoosh, pop, transition, zoom, text-appear
- Volume validation

**Categories:**
- `whoosh`: Swoosh, swish, air movement sounds
- `pop`: Pop, bubble, click, snap sounds
- `transition`: Transition, slide, move sounds
- `zoom`: Zoom, fast, speed sounds
- `text-appear`: Pop, appear, notification, ding, chime sounds

**Usage:**
```typescript
import soundEffectsService from './services/media/soundEffectsService';

// Get sound effect for a category
const result = await soundEffectsService.getSoundEffectForCategory('whoosh', 1.0);

// Validate volume levels
const validation = soundEffectsService.validateVolumeLevels(mainAudio, sfxAudio);
if (!validation.isValid) {
  console.log(`Recommended volume: ${validation.recommendedSfxVolume}`);
}

// Download multiple sound effects
const categories = ['whoosh', 'pop', 'text-appear'];
const effects = await soundEffectsService.downloadMultipleSoundEffects(categories);
```

**Volume Management:**

The service automatically ensures sound effects are at the correct volume level:
- Target: 20-30% of main audio peak volume
- Validates volume levels before applying
- Provides recommended volume adjustments

## Configuration

Both services require API keys configured in environment variables:

```bash
# B-roll
PEXELS_API_KEY=your_pexels_api_key

# Sound Effects
PIXABAY_API_KEY=your_pixabay_api_key
SOUND_EFFECTS_PROVIDER=pixabay
SOUND_EFFECTS_CACHE_ENABLED=true
```

## Caching

Both services implement local caching to avoid re-downloading media:

- **B-roll cache**: `./cache/broll/`
- **Sound effects cache**: `./cache/sfx/`

Cache files are named using MD5 hashes of the source URLs for efficient lookup.

## API Providers

### Pexels (B-roll)
- Free API with generous limits
- High-quality stock footage
- Get API key: https://www.pexels.com/api/

### Pixabay (Sound Effects)
- Free API with high-quality sound effects
- Same API key works for images and sound effects
- Get API key: https://pixabay.com/api/docs/
- Free tier: 5,000 requests/hour

## Error Handling

Both services implement robust error handling:
- Network failures are logged and re-thrown
- Failed downloads are cleaned up automatically
- Missing media is handled gracefully with fallbacks
- All errors include context for debugging
