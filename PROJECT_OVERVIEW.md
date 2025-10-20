# Project Overview: Video Automation

This project is a video automation system designed to generate videos programmatically. It consists of a Python backend responsible for planning and data processing, and a Remotion-based frontend for rendering the video compositions.

## Key Features:
*   **AI-Powered Plan Generation:** Utilizes a large language model (e.g., Google Gemini) to create a video plan based on input data.
*   **Data Processing:** Processes raw data to generate scene maps and sound effect catalogs.
*   **Modular Video Composition:** Renders video segments, highlights, and sound effects using a declarative React-based framework.
*   **Asset Management:** Manages b-roll footage and sound effects for dynamic video creation.

## Technologies Used:

### Backend (Python)
*   **Python:** The primary programming language for backend logic.
*   **Google Gemini API:** Used for generating video plans.
*   **`requirements.txt`:** Manages Python dependencies.

### Frontend (Remotion/TypeScript/React)
*   **Remotion:** A React-based framework for creating videos programmatically.
*   **TypeScript:** Provides type safety and enhanced developer experience for the frontend.
*   **React:** The core library for building user interfaces (video compositions in this case).
*   **Node.js/npm:** Used for package management and running Remotion development/build processes.

### Other Tools & Formats
*   **JSON:** Used extensively for data interchange, including video plans, scene maps, and asset catalogs.
*   **Git:** For version control (implied by `.gitignore` and `LICENSE`).