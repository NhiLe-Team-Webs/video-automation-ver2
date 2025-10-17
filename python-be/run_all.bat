@echo off
setlocal ENABLEEXTENSIONS

:: Get the directory where the script is located and navigate to it.
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: Define SOURCE_VIDEO:
:: If an argument is provided, use it as the source video.
:: Otherwise, default to 'input.mp4' in the 'public\input' directory.
set "SOURCE_VIDEO=%~1"
if "%SOURCE_VIDEO%"=="" set "SOURCE_VIDEO=%SCRIPT_DIR%..\public\input\input.mp4"

:: Define output and public directories.
set "OUTPUT_DIR=%SCRIPT_DIR%outputs"
set "PUBLIC_ROOT=%SCRIPT_DIR%..\public"
set "PUBLIC_INPUT=%PUBLIC_ROOT%\input"

:: Define paths for intermediate and final output files.
set "AUTO_EDITOR_OUTPUT=%OUTPUT_DIR%\stage1_cut.mp4"
set "WHISPER_SRT=%OUTPUT_DIR%\stage1_cut.srt"
set "PLAN_TMP=%OUTPUT_DIR%\plan.json"
set "PLAN_ENRICHED=%OUTPUT_DIR%\plan_enriched.json"
set "SCENE_MAP=%OUTPUT_DIR%\scene_map.json"

:: Check if the source video file exists. If not, print an error and exit.
if not exist "%SOURCE_VIDEO%" (
  echo [ERROR] Khong tim thay video dau vao: %SOURCE_VIDEO%
  exit /b 1
)

:: Create output directories if they don't already exist.
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"
if not exist "%PUBLIC_INPUT%" mkdir "%PUBLIC_INPUT%"

echo [STEP] Auto-Editor: loai bo khoang lang => %AUTO_EDITOR_OUTPUT%
:: Use Auto-Editor to remove silent sections from the video.
:: --edit audio:threshold=0.06: Sets the audio threshold for silence detection.
:: --margin "0.75s,1s": Adds a margin of 0.75s before and 1s after detected speech.
:: --silent-speed 4: Speeds up silent sections by 4x.
:: --video-speed 1: Keeps video speed in non-silent sections at 1x.
:: --video-codec libx264, --audio-codec aac: Specifies codecs for output.
:: --quiet: Suppresses verbose output from Auto-Editor.
python -m auto_editor "%SOURCE_VIDEO%" -o "%AUTO_EDITOR_OUTPUT%" ^
  --edit audio:threshold=0.06 ^
  --margin "0.75s,1s" ^
  --silent-speed 4 ^
  --video-speed 1 ^
  --video-codec libx264 ^
  --audio-codec aac ^
  --quiet

echo [STEP] Whisper: tao transcript SRT => %WHISPER_SRT%
:: Use OpenAI Whisper to generate an SRT transcript from the processed video.
:: --model small: Uses the 'small' Whisper model.
:: --language en: Specifies English language for transcription.
:: --task transcribe: Sets the task to transcription.
:: --output_format srt: Outputs the transcript in SRT format.
:: --output_dir "%OUTPUT_DIR%": Saves the output SRT file to the defined output directory.
python -m whisper "%AUTO_EDITOR_OUTPUT%" ^
  --model small ^
  --language en ^
  --task transcribe ^
  --output_format srt ^
  --output_dir "%OUTPUT_DIR%"

:: Check if the SRT file was successfully created.
if not exist "%WHISPER_SRT%" (
  echo [ERROR] Whisper khong tao duoc file %WHISPER_SRT%
  exit /b 1
)

echo [STEP] Generate Scene Map
:: Generate a structured scene map from the SRT transcript.
:: This script analyzes the transcript to identify key scenes, topics, and potential highlights.
python python-be\data_processing\generate_scene_map.py "%WHISPER_SRT%" -o "%SCENE_MAP%"

echo [STEP] Sinh plan Remotion (ưu tiên Gemini)
:: Generate the initial Remotion plan using the Gemini LLM.
:: This script takes the SRT transcript and outputs a basic plan.json.
python python-be\plan_generation\make_plan_gemini.py "%WHISPER_SRT%" "%PLAN_TMP%"
if errorlevel 1 (
  echo [ERROR] Gemini plan generation failed.
  exit /b 1
)
echo [INFO] Gemini plan generated successfully.

echo [STEP] Enriching Remotion plan
:: Enrich the generated Remotion plan with B-roll assignments, motion cues, and CTA highlights.
:: It uses the temporary plan, the enriched plan output path, and the scene map for context.
python python-be\plan_generation\enrich_plan.py "%PLAN_TMP%" "%PLAN_ENRICHED%" --scene-map "%SCENE_MAP%"

:: Copy the enriched plan to the public input directory for the Remotion app.
copy /Y "%PLAN_ENRICHED%" "%PUBLIC_INPUT%\plan.json" >nul

:: Copy the auto-edited video and the temporary plan to the public input directory.
:: These files are used by the Remotion frontend.
copy /Y "%AUTO_EDITOR_OUTPUT%" "%PUBLIC_INPUT%\input.mp4" >nul
copy /Y "%PLAN_TMP%" "%PUBLIC_INPUT%\plan.json" >nul

echo [DONE] Da copy du lieu sang public\input\
echo        - Video: public\input\input.mp4
echo        - Plan:  public\input\plan.json
echo [NEXT] Chay: cd ..\remotion-app ^&^& npm install ^&^& npm run render
pause