# Video Automation Project

This project automates video production by combining a Python backend for plan generation with a Remotion frontend for video rendering. The goal is to streamline the creation of dynamic videos with automated segmenting, transitions, highlights, and sound effects.

## 🚀 High-Level Architecture

The pipeline consists of two main parts:

1.  **Python Backend (`python-be/`):**
    *   Analyzes an input video and its transcript (SRT).
    *   Utilizes the Gemini LLM to generate a detailed `plan.json` which includes video segment boundaries, highlight metadata, and animation details.
    *   Enriches the `plan.json` with B-roll assignments, motion cues, and Call-to-Action (CTA) highlights.
    *   Copies the processed video and the final `plan.json` to a shared `public/input/` directory.

2.  **Remotion Frontend (`remotion-app/`):**
    *   Reads the `input.mp4` and `plan.json` from the shared `public/input/` directory.
    *   Renders the final video by:
        *   Splitting the video into segments.
        *   Applying smooth transitions (crossfade, slide, zoom, etc.).
        *   Rendering animated text highlights (typewriter, note boxes, section titles, icons).
        *   Synchronizing sound effects (SFX) with highlights and transitions.
    *   Outputs the final video (`final.mp4`).

## 🛠️ Setup and Installation

To get started with the project, follow these steps:

### 1. Clone the Repository

```bash
git clone [repository-url]
cd video-automation-305612bee70cbd82156f355f87250e7e2561c0ca
```

### 2. Python Backend Setup

Navigate to the Python backend directory and set up its environment:

```bash
cd python-be
python -m venv .venv
source .venv/bin/activate        # On Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

**Environment Variables:**
Create a `.env` file in the `python-be/` directory. This file should contain your `GEMINI_API_KEY` and optionally `GEMINI_MODEL`.

```dotenv
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
GEMINI_MODEL="gemini-1.5-flash" # Optional: specify a different Gemini model
```

### 3. Remotion Frontend Setup

Navigate to the Remotion application directory and install its dependencies:

```bash
cd ../remotion-app
npm install
```

### 4. Prepare Input Data

Place your source video in `public/input/input.mp4`. The Python pipeline will process this video.

## 🚀 Running the Application

### 1. Run the Python Pipeline

This script will process your input video, generate a transcript, create an editing plan using Gemini, and enrich it with additional metadata.

```bash
# From the project root directory:
cd python-be
./run_all.sh                     # On Windows: run_all.bat
```

This script performs the following:
*   **Auto-Editor:** Removes silence from `input.mp4` to create `outputs/stage1_cut.mp4`.
*   **Whisper:** Generates an SRT transcript from `outputs/stage1_cut.mp4` to `outputs/stage1_cut.srt`.
*   **Scene Map Generation:** `scripts/generate_scene_map.py` analyzes the SRT to create `outputs/scene_map.json` with topics, highlight scores, CTA flags, and motion/SFX hints.
*   **Gemini Plan Generation:** `scripts/make_plan_gemini.py` uses the SRT and `scene_map.json` to generate `outputs/plan.json` via Gemini.
*   **Plan Enrichment:** `scripts/enrich_plan.py` further enhances `outputs/plan.json` with B-roll assignments, motion cues, and CTA highlights, saving it as `outputs/plan_enriched.json`.
*   **Asset Sync:** Copies `stage1_cut.mp4` and `plan_enriched.json` to `public/input/input.mp4` and `public/input/plan.json` respectively, making them accessible to the Remotion app.

### 2. Preview and Render with Remotion

After the Python pipeline completes, you can preview or render the video using Remotion.

```bash
# From the project root directory:
cd remotion-app
npm start          # Launch Remotion Studio preview in your browser
# or
npm run render     # Produce the final video file: out/final.mp4
```

The exported video will be saved to `remotion-app/out/final.mp4`.

## 📂 Project Structure

*   **`assets/`**: Contains shared media files like B-roll footage, sound effects (SFX), and motion rules.
    *   `broll_catalog.json`: Catalog of available B-roll assets.
    *   `sfx_catalog.json`: Catalog of available sound effects.
    *   `motion_rules.json`: Rules for applying motion cues.
*   **`public/input/`**: Shared workspace for input video (`input.mp4`) and the generated plan (`plan.json`) consumed by Remotion.
*   **`python-be/`**: Python backend for video processing and plan generation.
    *   `.env.example`: Example environment variables.
    *   `requirements.txt`: Python dependencies.
    *   `run_all.bat`, `run_all.sh`: Scripts to run the full Python pipeline.
    *   `outputs/`: Directory for intermediate and final outputs (e.g., `scene_map.json`, `plan_enriched.json`).
    *   `scripts/`: Python scripts for various pipeline stages:
        *   `make_plan_gemini.py`: Generates the initial plan using Gemini.
        *   `enrich_plan.py`: Enriches the plan with B-roll, motion, and CTA.
        *   `generate_scene_map.py`: Creates a scene map from SRT transcripts.
        *   `generate_sfx_catalog.py`: Generates the SFX catalog for Remotion.
        *   `apply_plan_moviepy.py`: (Optional) Applies a plan using MoviePy for non-Remotion rendering.
*   **`remotion-app/`**: Remotion frontend for video rendering.
    *   `package.json`: Node.js dependencies and scripts.
    *   `src/`: Source code for the Remotion application.
        *   `src/types.ts`: Shared TypeScript types for the plan structure.
        *   `src/config.ts`: Global configuration for Remotion (video dimensions, FPS, audio, brand).
        *   `src/data/planSchema.ts`: Zod schema for validating the `plan.json`.
        *   `src/hooks/usePlan.ts`: React hook to load and validate the plan.
        *   `src/components/`: Reusable React components for rendering video elements:
            *   `FinalComposition.tsx`: The main composition component.
            *   `SegmentClip.tsx`: Renders individual video segments.
            *   `HighlightsLayer.tsx`: Manages rendering of all highlights.
            *   `SfxLayer.tsx`: Manages playing sound effects.
            *   `TextHighlightVariants.tsx`: Renders different text highlight styles.
            *   `IconEffect.tsx`: Renders animated icons.
            *   `Transitions.tsx`: Logic for visual and audio transitions.
            *   `VideoTimeline.tsx`: Orchestrates video segments on the timeline.
        *   `src/Root.tsx`: Registers the main Remotion composition.
        *   `src/index.ts`: Entry point for Remotion.

## 💡 Development Notes

*   **Adding New Assets:** Place shared assets (B-roll, SFX) in the `assets/` directory. The Remotion `pre*` scripts automatically sync these to `public/assets/`.
*   **Customizing Configuration:** Adjust values in `remotion-app/src/config.ts` for global settings.
*   **Extending Functionality:**
    *   Modify Python scripts in `python-be/scripts/` to enhance plan generation logic.
    *   Add new React components in `remotion-app/src/components/` to introduce new visual effects or highlight types.
    *   Update `remotion-app/src/types.ts` and `remotion-app/src/data/planSchema.ts` when changing the plan structure.
*   **Troubleshooting:**
    *   Ensure all dependencies are installed (`pip install -r requirements.txt` and `npm install`).
    *   Verify `GEMINI_API_KEY` is correctly set in `python-be/.env`.
    *   Check console output for errors during Python script execution or Remotion rendering.

## ✅ Quality Checklist

*   No black frames appear between segments.
*   Transitions are smooth, and highlights appear on time with matching SFX.
*   Animations stay concise to match the desired video style.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
