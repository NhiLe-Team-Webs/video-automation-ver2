#!/bin/bash
set -euo pipefail

# Get the directory where the script is located and navigate to it.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Define SOURCE_VIDEO:
# If an argument is provided, use it as the source video.
# Otherwise, default to 'input.mp4' in the 'public/input' directory.
SOURCE_VIDEO="${1:-$SCRIPT_DIR/../public/input/input.mp4}"

# Define output and public directories.
OUTPUT_DIR="$SCRIPT_DIR/outputs"
PUBLIC_ROOT="$SCRIPT_DIR/../public"
PUBLIC_INPUT="$PUBLIC_ROOT/input"

# Define paths for intermediate and final output files.
AUTO_EDITOR_OUTPUT="$OUTPUT_DIR/stage1_cut.mp4"
WHISPER_SRT="$OUTPUT_DIR/stage1_cut.srt"
PLAN_TMP="$OUTPUT_DIR/plan.json"
PLAN_ENRICHED="$OUTPUT_DIR/plan_enriched.json"
SCENE_MAP="$OUTPUT_DIR/scene_map.json"

# Check if the source video file exists. If not, print an error and exit.
if [ ! -f "$SOURCE_VIDEO" ]; then
  echo "[ERROR] Không tìm thấy video đầu vào: $SOURCE_VIDEO" >&2
  exit 1
fi

# Create output directories if they don't already exist.
mkdir -p "$OUTPUT_DIR" "$PUBLIC_INPUT"

echo "[STEP] Auto-Editor: loại bỏ khoảng lặng => $AUTO_EDITOR_OUTPUT"
# Use Auto-Editor to remove silent sections from the video.
# --edit audio:threshold=0.06: Sets the audio threshold for silence detection.
# --margin "0.75s,1s": Adds a margin of 0.75s before and 1s after detected speech.
# --silent-speed 4: Speeds up silent sections by 4x.
# --video-speed 1: Keeps video speed in non-silent sections at 1x.
# --video-codec libx264, --audio-codec aac: Specifies codecs for output.
# --quiet: Suppresses verbose output from Auto-Editor.
python -m auto_editor "$SOURCE_VIDEO" -o "$AUTO_EDITOR_OUTPUT" \
  --edit audio:threshold=0.06 \
  --margin "0.75s,1s" \
  --silent-speed 4 \
  --video-speed 1 \
  --video-codec libx264 \
  --audio-codec aac \
  --quiet

echo "[STEP] Whisper: tạo transcript SRT => $WHISPER_SRT"
# Use OpenAI Whisper to generate an SRT transcript from the processed video.
# --model small: Uses the 'small' Whisper model.
# --language en: Specifies English language for transcription.
# --task transcribe: Sets the task to transcription.
# --output_format srt: Outputs the transcript in SRT format.
# --output_dir "$OUTPUT_DIR": Saves the output SRT file to the defined output directory.
python -m whisper "$AUTO_EDITOR_OUTPUT" \
  --model small \
  --language en \
  --task transcribe \
  --output_format srt \
  --output_dir "$OUTPUT_DIR"

# Check if the SRT file was successfully created.
if [ ! -f "$WHISPER_SRT" ]; then
  echo "[ERROR] Whisper không tạo được file $WHISPER_SRT" >&2
  exit 1
fi

echo "[STEP] Generate Scene Map"
# Generate a structured scene map from the SRT transcript.
# This script analyzes the transcript to identify key scenes, topics, and potential highlights.
python python-be/data_processing/generate_scene_map.py "$WHISPER_SRT" -o "$SCENE_MAP"

echo "[STEP] Sinh plan Remotion (ưu tiên Gemini)"
# Generate the initial Remotion plan using the Gemini LLM.
# This script takes the SRT transcript and outputs a basic plan.json.
if ! python python-be/plan_generation/make_plan_gemini.py "$WHISPER_SRT" "$PLAN_TMP"; then
  echo "[ERROR] Gemini plan generation failed." >&2
  exit 1
fi
echo "[INFO] Gemini plan generated successfully."

echo "[STEP] Enriching Remotion plan"
# Enrich the generated Remotion plan with B-roll assignments, motion cues, and CTA highlights.
# It uses the temporary plan, the enriched plan output path, and the scene map for context.
python python-be/plan_generation/enrich_plan.py "$PLAN_TMP" "$PLAN_ENRICHED" --scene-map "$SCENE_MAP"

# Copy the enriched plan to the public input directory for the Remotion app.
cp "$PLAN_ENRICHED" "$PUBLIC_INPUT/plan.json"

# Copy the auto-edited video and the temporary plan to the public input directory.
# These files are used by the Remotion frontend.
cp "$AUTO_EDITOR_OUTPUT" "$PUBLIC_INPUT/input.mp4"
cp "$PLAN_TMP" "$PUBLIC_INPUT/plan.json"

echo "[DONE] Đã copy dữ liệu sang public/input/"
echo "       - Video: public/input/input.mp4"
echo "       - Plan:  public/input/plan.json"
echo "[NEXT] Chạy: cd ../remotion-app && npm install && npm run render"