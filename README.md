# Video Automation Pipeline

This project stitches together Remotion, MoviePy, Auto-Editor, Whisper, and a generated planning file (`plan.json`) to automate end-to-end video production. The repository contains two coordinated workspaces:

- `python-be/`: Python pipeline that trims the source video, generates transcripts, and produces a `plan.json` tailored for Remotion.
- `remotion-app/`: Remotion project that renders the final video based on the processed assets.

## High-level architecture

1. The Python/AI pipeline analyzes `input.mp4` and generates `plan.json`, which includes segment boundaries, highlight metadata, and animation details.
2. Remotion reads `input.mp4`, `plan.json`, and the shared `/assets` directory to assemble the timeline:
   - Split the video into segments.
   - Apply eased transitions (crossfade/slide/zoom).
   - Render animated text highlights (blurred backdrops, brand cutaways, typewriter, etc.).
   - Layer sound effects that correspond to each highlight.
3. Render the final cut (`final.mp4`) with `npx remotion render`.

## Prepare the input data

1. **Recommended: run the Python pipeline**
   ```bash
   cd python-be
   ./run_all.sh                     # or run_all.sh on Windows
   ```
   The script generates `outputs/plan.json`, copies it to `public/input/plan.json`, and copies the trimmed video to `public/input/input.mp4` so Remotion can pick them up automatically.
   Shared media (SFX, b-roll, fonts) live in the repository-level `assets/` directory so both pipelines stay in sync.

2. **Manual data prep**
   If you prefer to supply assets manually, place your video and plan file inside the shared `public/input/` folder. It includes `plan.sample.json` as a reference:

```json
{
  "segments": [
    {
      "id": "intro",
      "sourceStart": 0,
      "duration": 18,
      "transitionOut": {"type": "crossfade", "duration": 1},
      "cameraMovement": "zoomIn"
    },
    {
      "id": "demo",
      "sourceStart": 28,
      "duration": 32,
      "transitionIn": {"type": "crossfade", "duration": 1},
      "transitionOut": {"type": "slide", "duration": 0.75, "direction": "left"},
      "cameraMovement": "zoomOut"
    }
  ],
  "highlights": [
    {
      "id": "hook",
      "text": "Tăng gấp đôi hiệu suất với workflow tự động hoá.",
      "start": 4.5,
      "duration": 4,
      "position": "center",
      "animation": "fade",
      "variant": "blurred",
      "sfx": "ui/pop.mp3"
    },
    {
      "id": "cta",
      "text": "Đăng ký demo ngay hôm nay",
      "start": 68,
      "duration": 5,
      "position": "center",
      "animation": "typewriter",
      "variant": "typewriter",
      "sfx": "tech/notification.mp3"
    }
  ]
}
```

3. Place your sound-effect files (and other shared media) in the repository-level `assets/` directory. The Remotion sync script links `assets/` into the shared `public/assets/` workspace, and both pipelines resolve SFX using paths such as `assets/sfx/ui/pop.mp3`.

> **Note:** Remotion automatically loads `input/plan.json` and `input/input.mp4` from the shared `public/` folder. If you want to render from a different location, pass custom props when running the Remotion CLI:
>
> ```bash
> npx remotion render src/Root.tsx FinalVideo out/final.mp4 --props '{"planPath":"custom-plan.json","inputVideo":"custom-input.mp4"}'
> ```

If the final video is longer than 15 minutes, update `DEFAULT_DURATION_IN_FRAMES` in `remotion-app/src/config.ts` to match the new duration.

## Preview and render

```bash
cd remotion-app
npm install
npm start          # Launch Remotion Studio preview
# or
npm run render     # Produce out/final.mp4
```

The exported video is saved to `remotion-app/out/final.mp4`.

> **Tip:** The Remotion `pre*` scripts automatically sync the repository-level `assets/` folder into `public/assets/` and link `remotion-app/public` to the shared workspace before previewing or rendering.

## Remotion structure

- `src/types.ts`: Shared types for segments, highlights, and transitions.
- `src/data/planSchema.ts`: Zod schema definition and example plan data.
- `src/hooks/usePlan.ts`: Hook that loads and validates `plan.json`.
- `src/components/VideoTimeline.tsx`: Splits video into segments and handles transitions.
- `src/components/Transitions.tsx`: Shared easing logic for visual/audio transitions.
- `src/components/HighlightCallout.tsx` + `TextHighlightVariants.tsx`: Animated text overlays.
- `src/components/SfxLayer.tsx`: Synchronizes SFX with highlight timing.
- `src/components/FinalComposition.tsx`: Combines all timeline layers.
- `src/Root.tsx`: Registers the Remotion composition.

## Extend the pipeline

- Connect the Python pipeline to Auto-Editor/MoviePy for automated plan generation.
- Integrate Whisper to generate transcripts and highlight suggestions automatically.
- Add background music by extending `FinalComposition` with an audio layer.
- Use metadata (for example, a `cameraMovement` tag) inside `plan.json` to drive advanced animations.

## Quality checklist

- No black frames appear between segments.
- Transitions are smooth, and highlights appear on time with matching SFX.
- Animations stay concise to match the YouTube-inspired style.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
