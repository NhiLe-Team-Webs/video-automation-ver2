﻿@echo off
setlocal ENABLEEXTENSIONS

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: Default input chuyển sang public\input thay vì python-be\inputs
set "SOURCE_VIDEO=%~1"
if "%SOURCE_VIDEO%"=="" set "SOURCE_VIDEO=%SCRIPT_DIR%..\public\input\input.mp4"

set "OUTPUT_DIR=%SCRIPT_DIR%outputs"
set "PUBLIC_ROOT=%SCRIPT_DIR%..\public"
set "PUBLIC_INPUT=%PUBLIC_ROOT%\input"
set "AUTO_EDITOR_OUTPUT=%OUTPUT_DIR%\stage1_cut.mp4"
set "WHISPER_SRT=%OUTPUT_DIR%\stage1_cut.srt"
set "PLAN_TMP=%OUTPUT_DIR%\plan.json"
set "PLAN_MAPPING=%SCRIPT_DIR%plan\mapping.json"

if not exist "%SOURCE_VIDEO%" (
  echo [ERROR] Khong tim thay video dau vao: %SOURCE_VIDEO%
  exit /b 1
)

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"
if not exist "%PUBLIC_INPUT%" mkdir "%PUBLIC_INPUT%"

echo [STEP] Auto-Editor: loai bo khoang lang => %AUTO_EDITOR_OUTPUT%
python -m auto_editor "%SOURCE_VIDEO%" -o "%AUTO_EDITOR_OUTPUT%" ^
  --edit audio:threshold=0.06 ^
  --margin "0.75s,1s" ^
  --silent-speed 4 ^
  --video-speed 1 ^
  --video-codec libx264 ^
  --audio-codec aac ^
  --quiet

echo [STEP] Whisper: tao transcript SRT => %WHISPER_SRT%
python -m whisper "%AUTO_EDITOR_OUTPUT%" ^
  --model small ^
  --language en ^
  --task transcribe ^
  --output_format srt ^
  --output_dir "%OUTPUT_DIR%"

if not exist "%WHISPER_SRT%" (
  echo [ERROR] Whisper khong tao duoc file %WHISPER_SRT%
  exit /b 1
)

echo [STEP] Sinh plan Remotion (uu tien Gemini)
python scripts\make_plan_gemini.py "%WHISPER_SRT%" "%PLAN_TMP%"
if errorlevel 1 (
  echo [WARN] Gemini planner unavailable, fallback mapping.json
  python scripts\make_plan_from_srt.py "%WHISPER_SRT%" "%PLAN_MAPPING%" "%PLAN_TMP%"
) else (
  echo [INFO] Gemini plan generated successfully.
)

copy /Y "%AUTO_EDITOR_OUTPUT%" "%PUBLIC_INPUT%\input.mp4" >nul
copy /Y "%PLAN_TMP%" "%PUBLIC_INPUT%\plan.json" >nul

echo [DONE] Da copy du lieu sang public\input\
echo        - Video: public\input\input.mp4
echo        - Plan:  public\input\plan.json
echo [NEXT] Chay: cd ..\remotion-app ^&^& npm install ^&^& npm run render
pause