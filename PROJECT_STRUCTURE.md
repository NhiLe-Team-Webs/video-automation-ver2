# Project Structure: Video Automation

This document outlines the directory and file structure of the Video Automation project.

```
.
├── .gitignore
├── LICENSE
├── PROJECT_OVERVIEW.md
├── PROJECT_STRUCTURE.md
├── README.md
├── tree.txt
├── assets/
│   ├── broll_catalog.json
│   ├── motion_rules.json
│   ├── sfx_catalog.json
│   ├── broll/
│   │   ├── ai_brain.jpg
│   │   ├── business_strategy.jpg
│   │   ├── data_visualization.jpg
│   │   ├── digital_network.jpg
│   │   ├── digital_transformation.jpg
│   │   ├── education_training.jpg
│   │   ├── innovation_lightbulb.jpg
│   │   ├── marketing_automation.jpg
│   │   └── modern_office.jpg
│   └── sfx/
│       ├── cartoon/
│       │   ├── boing.mp3
│       │   ├── cartoon-slip.mp3
│       │   └── throw.mp3
│       ├── emotion/
│       │   ├── applause.mp3
│       │   ├── disapointed.mp3
│       │   └── shock.mp3
│       ├── emphasis/
│       │   └── ding.mp3
│       ├── tech/
│       │   ├── camera-click.mp3
│       │   └── notification.mp3
│       ├── ui/
│       │   ├── bubble-pop.mp3
│       │   ├── keyboard-typing.mp3
│       │   ├── mouse-click.mp3
│       │   ├── notification.mp3
│       │   ├── pop.mp3
│       │   └── swipe.mp3
│       └── whoosh/
│           └── woosh.mp3
├── public/
│   └── input/
├── python-be/
│   ├── .env.example
│   ├── README.md
│   ├── requirements.txt
│   ├── run_all.bat
│   ├── run_all.sh
│   ├── data_processing/
│   │   ├── generate_scene_map.py
│   │   ├── generate_sfx_catalog.py
│   │   └── README.md
│   ├── outputs/
│   │   ├── plan_enriched.json
│   │   ├── README.md
│   │   └── scene_map.json
│   └── plan_generation/
│       ├── enrich_plan.py
│       ├── make_plan_gemini.py
│       └── README.md
└── remotion-app/
    ├── .prettierrc
    ├── eslint.config.mjs
    ├── package-lock.json
    ├── package.json
    ├── postcss.config.mjs
    ├── README.md
    ├── remotion.config.ts
    ├── tsconfig.json
    ├── scripts/
    │   └── sync-assets.mjs
    └── src/
        ├── config.ts
        ├── index.ts
        ├── Root.tsx
        ├── types.ts
        ├── components/
        │   ├── BrollPlaceholder.tsx
        │   ├── FinalComposition.tsx
        │   ├── HighlightCallout.tsx
        │   ├── HighlightsLayer.tsx
        │   ├── IconEffect.tsx
        │   ├── SegmentClip.tsx
        │   ├── SfxLayer.tsx
        │   ├── TextHighlightVariants.tsx
        │   ├── timeline.ts
        │   ├── Transitions.tsx
        │   └── VideoTimeline.tsx
        ├── data/
        │   ├── planSchema.ts
        │   └── sfxCatalog.ts
        ├── design/
        │   └── brand.ts
        ├── hooks/
        │   └── usePlan.ts
        └── icons/
            └── registry.ts
```

## Top-Level Files and Directories:

*   `.gitignore`: Specifies intentionally untracked files to ignore.
*   `LICENSE`: Project licensing information.
*   `PROJECT_OVERVIEW.md`: Overview of the project and technologies used.
*   `PROJECT_STRUCTURE.md`: This document, detailing the project's file structure.
*   `README.md`: General project information and setup instructions.
*   `tree.txt`: A generated file showing the directory tree (likely from a `tree` command).
*   `assets/`: Contains static assets like b-roll footage, sound effects, and their catalogs.
*   `public/`: Publicly accessible files, potentially including input data.
*   `python-be/`: The backend Python application.
*   `remotion-app/`: The frontend Remotion application.

## `assets/` Directory:

*   `broll_catalog.json`: Catalog of available b-roll footage.
*   `motion_rules.json`: Rules for motion graphics or animations.
*   `sfx_catalog.json`: Catalog of available sound effects.
*   `broll/`: Directory containing various b-roll image files.
*   `sfx/`: Directory containing categorized sound effect audio files.

## `public/` Directory:

*   `input/`: Placeholder for input data files.

## `python-be/` Directory (Backend):

*   `.env.example`: Example environment variables file.
*   `README.md`: README specific to the Python backend.
*   `requirements.txt`: Python dependencies.
*   `run_all.bat`: Windows batch script to run all backend processes.
*   `run_all.sh`: Shell script to run all backend processes.
*   `data_processing/`: Contains scripts for processing data.
    *   `generate_scene_map.py`: Script to generate scene mapping.
    *   `generate_sfx_catalog.py`: Script to generate sound effects catalog.
    *   `README.md`: README specific to data processing.
*   `outputs/`: Stores output files from backend processing.
    *   `plan_enriched.json`: Enriched video plan output.
    *   `README.md`: README specific to outputs.
    *   `scene_map.json`: Generated scene map.
*   `plan_generation/`: Contains scripts for generating video plans.
    *   `enrich_plan.py`: Script to enrich the video plan.
    *   `make_plan_gemini.py`: Script to generate a plan using Google Gemini.
    *   `README.md`: README specific to plan generation.

## `remotion-app/` Directory (Frontend):

*   `.prettierrc`: Prettier configuration for code formatting.
*   `eslint.config.mjs`: ESLint configuration for code linting.
*   `package-lock.json`: Records the exact dependency tree.
*   `package.json`: Project metadata and npm scripts.
*   `postcss.config.mjs`: PostCSS configuration (likely for Tailwind CSS).
*   `README.md`: README specific to the Remotion application.
*   `remotion.config.ts`: Remotion specific configuration.
*   `tsconfig.json`: TypeScript configuration.
*   `scripts/`: Utility scripts for the Remotion app.
    *   `sync-assets.mjs`: Script to synchronize assets.
*   `src/`: Source code for the Remotion application.
    *   `config.ts`: Application configuration.
    *   `index.ts`: Entry point for the Remotion application.
    *   `Root.tsx`: The main Remotion composition component.
    *   `types.ts`: TypeScript type definitions.
    *   `components/`: Reusable React components for video compositions.
        *   `BrollPlaceholder.tsx`: Component for b-roll placeholders.
        *   `FinalComposition.tsx`: The final video composition component.
        *   `HighlightCallout.tsx`: Component for highlight callouts.
        *   `HighlightsLayer.tsx`: Layer component for highlights.
        *   `IconEffect.tsx`: Component for icon effects.
        *   `SegmentClip.tsx`: Component for individual video segments.
        *   `SfxLayer.tsx`: Layer component for sound effects.
        *   `TextHighlightVariants.tsx`: Component for text highlight variations.
        *   `timeline.ts`: Timeline related utilities.
        *   `Transitions.tsx`: Components for video transitions.
        *   `VideoTimeline.tsx`: Component for video timeline visualization.
    *   `data/`: Data-related files for the frontend.
        *   `planSchema.ts`: TypeScript schema for the video plan.
        *   `sfxCatalog.ts`: TypeScript representation of the sound effects catalog.
    *   `design/`: Design-related files.
        *   `brand.ts`: Branding related constants/styles.
    *   `hooks/`: Custom React hooks.
        *   `usePlan.ts`: Custom hook for accessing video plan data.
    *   `icons/`: Icon related files.
        *   `registry.ts`: Icon registry.