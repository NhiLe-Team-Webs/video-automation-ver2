"""Generate a flexible edit plan via Gemini LLM."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import google.generativeai as genai
from dotenv import load_dotenv

try:
    from .knowledge import KnowledgeService
except Exception:  # pragma: no cover - optional dependency at runtime
    KnowledgeService = None  # type: ignore[assignment]

TIMECODE_RE = re.compile(r"^(?P<start>\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(?P<end>\d{2}:\d{2}:\d{2},\d{3})$")
JSON_BLOCK_RE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)

SFX_EXTENSIONS = {".mp3", ".wav", ".ogg"}

MAX_SCENE_CONTEXT_ITEMS = 32
MAX_BROLL_SUMMARY_ITEMS = 20
MAX_SFX_ITEMS_PER_CATEGORY = 5


def load_json_if_exists(path: Path | None) -> Dict[str, Any]:
    """
    Loads a JSON file from the given path if it exists, otherwise returns an empty dictionary.
    Handles JSON decoding and OS errors gracefully.

    Args:
        path: The path to the JSON file.

    Returns:
        A dictionary containing the JSON data, or an empty dictionary if the file
        does not exist or cannot be parsed/read.
    """
    if not path:
        return {}
    if not path.exists():
        return {}
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError:
        print(f"[WARN] Could not parse JSON file: {path}", file=sys.stderr)
    except OSError:
        print(f"[WARN] Could not read JSON file: {path}", file=sys.stderr)
    return {}


def _safe_float(value: Any, default: float = 0.0) -> float:
    """
    Safely converts a value to a float. If conversion fails, returns a default value.

    Args:
        value: The value to convert.
        default: The default value to return if conversion fails.

    Returns:
        The float representation of the value, or the default if conversion fails.
    """
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _humanize_sfx_description(relative_path: Path) -> str:
    """
    Generates a human-readable description for an SFX asset based on its relative path.
    For example, 'ui/pop.mp3' becomes 'UI: Pop'.

    Args:
        relative_path: The Path object representing the SFX asset's relative path.

    Returns:
        A human-readable string description of the SFX.
    """
    # Determine the category from the parent directory name
    category = relative_path.parent.name if relative_path.parent != Path(".") else "mix"
    # Extract the base name and replace separators with spaces
    base = relative_path.stem.replace("-", " ").replace("_", " ")
    # Capitalize category and base for better readability
    category_title = category.replace("-", " ").replace("_", " ").title()
    base_title = base.title()
    return f"{category_title}: {base_title}"


def discover_available_sfx() -> Dict[str, str]:
    """
    Discovers all available SFX files in the 'assets/sfx' directory and creates
    a dictionary mapping their relative paths (and prefixed paths) to human-readable descriptions.

    Returns:
        A dictionary where keys are SFX paths (e.g., 'ui/pop.mp3', 'assets/sfx/ui/pop.mp3')
        and values are their descriptions.
    """
    # Resolve the root directory of the repository
    root_dir = Path(__file__).resolve().parents[3]
    sfx_dir = root_dir / "assets" / "sfx"
    available: Dict[str, str] = {}

    # If the SFX directory does not exist, return an empty dictionary
    if not sfx_dir.exists():
        return available

    # Iterate over all files in the SFX directory and its subdirectories
    for asset in sorted(sfx_dir.rglob("*")):
        # Skip if it's not a file or if the extension is not a recognized SFX extension
        if not asset.is_file() or asset.suffix.lower() not in SFX_EXTENSIONS:
            continue
        # Get the path relative to the SFX directory
        relative_path = asset.relative_to(sfx_dir)
        # Use POSIX-style path for consistency
        key = relative_path.as_posix()
        # Generate a human-readable description
        description = _humanize_sfx_description(relative_path)
        # Add both the relative path and the full prefixed path to the available SFX
        available[key] = description
        prefixed_key = f"assets/sfx/{key}"
        available[prefixed_key] = description

    return available


AVAILABLE_SFX: Dict[str, str] = discover_available_sfx() or {
    "ui/pop.mp3": "UI: Pop punchy nhấn mạnh",
    "whoosh/whoosh.mp3": "Whoosh chuyển cảnh mượt",
    "emphasis/ding.mp3": "Ding sạch cho số liệu quan trọng",
    "emotion/applause.mp3": "Applause nhanh cho thành tựu",
    "tech/camera-click.mp3": "Tiếng chụp ảnh nhấn mạnh demo",
}


def _build_sfx_lookup() -> Dict[str, str]:
    """
    Builds a lookup dictionary for SFX assets, allowing retrieval by various normalized keys
    (e.g., full path, filename, stem). This helps in robustly matching SFX names from LLM output.

    Returns:
        A dictionary mapping normalized SFX keys to their canonical paths.
    """
    lookup: Dict[str, str] = {}
    for key in AVAILABLE_SFX.keys():
        # Store the original key in lowercase
        lower_key = key.lower()
        lookup.setdefault(lower_key, key)
        # Store by filename (lowercase)
        name = Path(key).name.lower()
        lookup.setdefault(name, key)
        # Store by filename stem (lowercase, without extension)
        stem = Path(key).stem.lower()
        lookup.setdefault(stem, key)
    return lookup


SFX_LOOKUP = _build_sfx_lookup()
TRANSITION_TYPES = ["cut", "crossfade", "slide", "zoom", "scale", "rotate", "blur"]
TRANSITION_DIRECTIONS = ["left", "right", "up", "down"]
HIGHLIGHT_POSITIONS = ["top", "center", "bottom"]
HIGHLIGHT_ANIMATIONS = [
    "fade",
    "zoom",
    "slide",
    "bounce",
    "float",
    "flip",
    "typewriter",
    "pulse",
    "spin",
    "pop",
]
HIGHLIGHT_VARIANTS = ["callout", "blurred", "brand", "cutaway", "typewriter"]
MAX_HIGHLIGHTS = 6
DEFAULT_HIGHLIGHT_DURATION = 2.6


@dataclass
class SrtEntry:
    index: int
    start: str
    end: str
    text: str

    @property
    def text_one_line(self) -> str:
        return " ".join(line.strip() for line in self.text.splitlines() if line.strip())


def seconds_from_timecode(value: str) -> float:
    """
    Converts an SRT timecode string (HH:MM:SS,mmm) into total seconds (float).

    Args:
        value: The timecode string.

    Returns:
        The total time in seconds as a float.
    """
    # Split the timecode into hours, minutes, and the remaining part (seconds,milliseconds)
    hours, minutes, remainder = value.split(":")
    # Split the remainder into seconds and milliseconds
    seconds, millis = remainder.split(",")
    # Calculate total seconds
    return int(hours) * 3600 + int(minutes) * 60 + int(seconds) + int(millis) / 1000


def parse_srt(path: Path, *, max_entries: int | None = None) -> List[SrtEntry]:
    """
    Parses an SRT file and extracts subtitle entries.

    Args:
        path: The path to the SRT file.
        max_entries: Optional. The maximum number of entries to parse.

    Returns:
        A list of SrtEntry objects.
    """
    content = path.read_text(encoding="utf-8")
    # Split the content into blocks based on double newlines
    blocks = re.split(r"\n\s*\n", content.strip())
    entries: List[SrtEntry] = []
    for block in blocks:
        # Filter out empty lines from the block
        lines = [line for line in block.splitlines() if line.strip()]
        if len(lines) < 2:
            # A valid SRT block needs at least an index and a timecode line
            continue
        try:
            # The first line is usually the index
            idx = int(lines[0])
        except ValueError:
            # Fallback to sequential index if parsing fails
            idx = len(entries) + 1
        # The second line is the timecode
        match = TIMECODE_RE.match(lines[1])
        if not match:
            continue
        # The rest of the lines form the text
        text = "\n".join(lines[2:]) if len(lines) > 2 else ""
        entries.append(SrtEntry(index=idx, start=match.group("start"), end=match.group("end"), text=text))
        # Stop parsing if max_entries limit is reached
        if max_entries and len(entries) >= max_entries:
            break
    return entries


def _format_available(values: Iterable[str]) -> str:
    """
    Formats an iterable of strings into a comma-separated string.

    Args:
        values: An iterable of strings.

    Returns:
        A single string with values joined by ", ".
    """
    return ", ".join(values)


def summarize_scene_map(scene_map: Dict[str, Any], limit: int = MAX_SCENE_CONTEXT_ITEMS) -> str:
    """
    Generates a concise summary of the scene map, including overall statistics and
    details for a limited number of initial segments. This summary is used to provide
    context to the LLM.

    Args:
        scene_map: The dictionary representing the scene map.
        limit: The maximum number of segments to include in the detailed summary.

    Returns:
        A formatted string summarizing the scene map.
    """
    segments = scene_map.get("segments") or []
    if not segments:
        return ""

    lines: List[str] = []
    summary = scene_map.get("summary") or {}
    summary_parts: List[str] = []

    # Add overall summary statistics
    total_segments = summary.get("totalSegments")
    if total_segments is not None:
        summary_parts.append(f"segments={total_segments}")
    duration = summary.get("estimatedDurationSeconds")
    if duration is not None:
        summary_parts.append(f"duration~{_safe_float(duration):.1f}s")
    highlight_segments = summary.get("highlightSegments")
    if highlight_segments is not None:
        summary_parts.append(f"highlight>=threshold={highlight_segments}")
    cta_segments = summary.get("ctaSegments")
    if cta_segments is not None:
        summary_parts.append(f"cta={cta_segments}")
    motion_freq = summary.get("motionFrequencyConfig")
    if motion_freq is not None:
        summary_parts.append(f"motion_frequency={_safe_float(motion_freq):.2f}")
    highlight_rate = summary.get("highlightRateConfig")
    if highlight_rate is not None:
        summary_parts.append(f"highlight_rate={_safe_float(highlight_rate):.2f}")

    top_topics = summary.get("topTopics") or []
    if top_topics:
        topic_summary = ", ".join(
            f"{topic_entry.get('topic','?')}({topic_entry.get('count',0)})"
            for topic_entry in top_topics[:6]
        )
        summary_parts.append(f"top_topics={topic_summary}")

    if summary_parts:
        lines.append("Summary: " + " | ".join(summary_parts))

    # Add detailed summary for individual segments (up to limit)
    for idx, segment in enumerate(segments[:limit], start=1):
        seg_id = segment.get("id", idx)
        start = _safe_float(segment.get("start"))
        end = _safe_float(segment.get("end"))
        topics = ", ".join(segment.get("topics", [])[:3]) or "-"
        emotion = segment.get("emotion", "neutral")
        highlight_score = _safe_float(segment.get("highlightScore"))
        motion_candidates = ", ".join(segment.get("motionCandidates", [])[:3]) or "-"
        sfx_hints = ", ".join(segment.get("sfxHints", [])[:3]) or "-"
        flags: List[str] = []
        if segment.get("cta"):
            flags.append("cta")
        if segment.get("parallaxEligible"):
            flags.append("parallax")
        flag_suffix = f" | flags={','.join(flags)}" if flags else ""
        lines.append(
            f"{seg_id}: {start:.2f}-{end:.2f}s | topics={topics} | emotion={emotion} "
            f"| highlight={highlight_score:.2f} | motion={motion_candidates} | sfx={sfx_hints}{flag_suffix}"
        )

    # Indicate if more segments are omitted
    remaining = len(segments) - limit
    if remaining > 0:
        lines.append(f"... {remaining} additional segments omitted")

    return "\n".join(lines)


def summarize_broll_catalog(catalog: Dict[str, Any], limit: int = MAX_BROLL_SUMMARY_ITEMS) -> str:
    """
    Generates a concise summary of the B-roll catalog, including details for a
    limited number of initial items. This summary is used to provide context to the LLM.

    Args:
        catalog: The dictionary representing the B-roll catalog.
        limit: The maximum number of B-roll items to include in the summary.

    Returns:
        A formatted string summarizing the B-roll catalog.
    """
    items = catalog.get("items") or []
    if not items:
        return ""

    lines: List[str] = []
    for item in items[:limit]:
        item_id = item.get("id", "?")
        media_type = item.get("mediaType", "video")
        orientation = item.get("orientation", "landscape")
        topics = ", ".join(item.get("topics", [])[:3]) or "-"
        mood = ", ".join(item.get("mood", [])[:2]) or "-"
        usage = ", ".join(item.get("recommendedUsage", [])[:2]) or "-"
        lines.append(
            f"{item_id}: {media_type}/{orientation} | topics={topics} | mood={mood} | usage={usage}"
        )

    remaining = len(items) - limit
    if remaining > 0:
        lines.append(f"... {remaining} additional B-roll items available")

    return "\n".join(lines)


def summarize_sfx_catalog(catalog: Dict[str, Any], max_items: int = MAX_SFX_ITEMS_PER_CATEGORY) -> str:
    """
    Generates a concise summary of the SFX catalog, categorizing SFX and listing
    a limited number of items per category. This summary is used to provide context to the LLM.

    Args:
        catalog: The dictionary representing the SFX catalog.
        max_items: The maximum number of SFX items to list per category.

    Returns:
        A formatted string summarizing the SFX catalog.
    """
    categories = catalog.get("categories") or []
    if not categories:
        return ""

    lines: List[str] = []
    for category in categories:
        label = category.get("label") or category.get("id") or "misc"
        items = category.get("items") or []
        if not items:
            continue

        entries: List[str] = []
        for item in items[:max_items]:
            item_id = item.get("id", "?")
            usage = item.get("usage") or []
            usage_text = "/".join(usage[:2]) if usage else ""
            if usage_text:
                entries.append(f"{item_id} ({usage_text})")
            else:
                entries.append(item_id)

        remaining = len(items) - max_items
        if remaining > 0:
            entries.append(f"+{remaining} more")

        lines.append(f"{label}: {', '.join(entries)}")

    return "\n".join(lines)


def summarize_motion_rules(motion_rules: Dict[str, Any]) -> str:
    """
    Generates a concise summary of the motion rules, including target frequencies
    and highlight thresholds. This summary is used to provide context to the LLM.

    Args:
        motion_rules: The dictionary representing the motion rules.

    Returns:
        A formatted string summarizing the motion rules.
    """
    if not motion_rules:
        return ""

    lines: List[str] = []
    motion_freq = motion_rules.get("motion_frequency")
    highlight_rate = motion_rules.get("highlight_rate")
    if motion_freq is not None:
        lines.append(f"Target motion frequency <= {motion_freq}")
    if highlight_rate is not None:
        lines.append(f"Highlight threshold >= {highlight_rate}")

    # Summarize motion cue keywords
    for key, value in motion_rules.items():
        if key.endswith("_keywords") and isinstance(value, list):
            cue = key.replace("_keywords", "").replace("_", " ")
            lines.append(f"{cue}: {', '.join(value)}")

    return "\n".join(lines)


def build_prompt(
    entries: Iterable[SrtEntry],
    *,
    extra_instructions: str | None = None,
    scene_map: Dict[str, Any] | None = None,
    broll_catalog: Dict[str, Any] | None = None,
    sfx_catalog: Dict[str, Any] | None = None,
    motion_rules: Dict[str, Any] | None = None,
    knowledge_service: Optional["KnowledgeService"] = None,
) -> str:
    """
    Constructs the full prompt for the Gemini LLM, including transcript segments,
    schema hints, rules, and supplemental context from various catalogs.

    Args:
        entries: An iterable of SrtEntry objects representing the transcript.
        extra_instructions: Optional. Additional free-form instructions from the user.
        scene_map: Optional. Dictionary containing scene metadata.
        broll_catalog: Optional. Dictionary containing B-roll asset catalog.
        sfx_catalog: Optional. Dictionary containing SFX asset catalog.
        motion_rules: Optional. Dictionary containing motion cue rules.

    Returns:
        A formatted string representing the complete prompt for the LLM.
    """
    # Format transcript entries into a readable section
    timeline_lines = [
        f"{entry.index}. [{entry.start} -> {entry.end}] {entry.text_one_line}"
        for entry in entries
    ]
    transcript_section = "\n".join(timeline_lines)

    # Define a schema hint to guide the LLM's output structure
    schema_hint = {
        "segments": [
            {
                "id": "intro",
                "sourceStart": 0.0,
                "duration": 6.4,
                "transitionOut": {"type": "crossfade", "duration": 0.6},
            },
            {
                "id": "demo",
                "sourceStart": 6.4,
                "duration": 9.1,
                "transitionIn": {"type": "crossfade", "duration": 0.6},
                "transitionOut": {"type": "slide", "duration": 0.5, "direction": "left"},
            },
        ],
        "highlights": [
            {
                "id": "hook",
                "text": "KEY IDEA: Stay consistent",
                "start": 2.4,
                "duration": 2.6,
                "position": "center",
                "animation": "zoom",
                "sfx": "ui/pop.mp3",
                "volume": 0.75,
            }
        ],
    }

    schema_hint_json = json.dumps(schema_hint, indent=2)

    # Format available options for rules section
    sfx_names = _format_available(sorted(AVAILABLE_SFX.keys()))
    sfx_notes = "; ".join(f"{name}: {desc}" for name, desc in AVAILABLE_SFX.items())
    transition_types = _format_available(TRANSITION_TYPES)
    transition_directions = _format_available(TRANSITION_DIRECTIONS)
    highlight_positions = _format_available(HIGHLIGHT_POSITIONS)
    highlight_animations = _format_available(HIGHLIGHT_ANIMATIONS)

    # Base instruction for the LLM
    instruction_text = (
        "You are a detail-oriented video editor. Build a Remotion JSON plan with concise segments, smooth transitions, and purposeful highlights/SFX. "
        "Maintain a cinematic rhythm and avoid overusing effects."
    )
    if extra_instructions:
        instruction_text += f" Extra guidance from user: {extra_instructions.strip()}"

    # Define a list of rules for the LLM to follow
    rules_lines = [
        "- `segments` describe consecutive portions of the trimmed video with `sourceStart` (seconds) and `duration`. Use `label` for short context if helpful.",
        f"- `transitionIn`/`transitionOut` types may be: {transition_types}; slides can add `direction` ({transition_directions}); zoom/scale/rotate/blur may include `intensity` between 0.1 and 0.35.",
        "- Trim or merge sentences when silence exceeds ~0.7s unless a pause is intentionally required.",
        f"- Emit at most {MAX_HIGHLIGHTS} standout highlights; keep each roughly 2-4 seconds.",
        f"- Populate `highlights` with `type` (noteBox/typewriter/sectionTitle/icon/etc.), `text`, `start`, `duration`, plus `position` ({highlight_positions}) and `animation` ({highlight_animations}).",
        "- For `type: \"icon\"` include `name` (short label) and optional icon/colors/animation; attach SFX when it enhances energy.",
        f"- Always pick SFX from `assets/sfx` with relative paths (for example assets/sfx/ui/pop.mp3). Available options: {sfx_names}. Key notes: {sfx_notes}.",
        "- When highlights include SFX, align `start` with the moment and set `volume` between 0-1 if needed.",
        "- Segments must touch end-to-start with no gaps in the source timeline.",
        "- Respond with JSON inside a single fenced code block.",
    ]

    # Add conditional rules based on provided context
    highlight_rate_value = None
    if motion_rules:
        highlight_rate_value = motion_rules.get("highlight_rate")
        rules_lines.append("- Motion cues must follow the keywords and frequency found in the motion rules context.")
    if highlight_rate_value is not None:
        rules_lines.append(
            f"- Treat segments with `highlightScore` >= {highlight_rate_value} as prime candidates for visual emphasis, B-roll, and SFX."
        )
    if scene_map:
        rules_lines.append("- Use the scene map insights below to align B-roll, CTA moments, motion cues, and SFX hints per segment.")
    if broll_catalog:
        rules_lines.append("- Choose B-roll IDs from the catalog context, matching topics/mood and keeping framing consistent.")

    # Build supplemental context sections
    context_sections: List[str] = []
    if scene_map:
        scene_summary = summarize_scene_map(scene_map)
        if scene_summary:
            context_sections.append("Scene map insights:\n" + scene_summary)
    if broll_catalog:
        broll_summary = summarize_broll_catalog(broll_catalog)
        if broll_summary:
            context_sections.append("B-roll catalog (id / media / topics):\n" + broll_summary)
    if motion_rules:
        motion_summary = summarize_motion_rules(motion_rules)
        if motion_summary:
            context_sections.append("Motion cue rules:\n" + motion_summary)
    if sfx_catalog:
        sfx_summary = summarize_sfx_catalog(sfx_catalog)
        if sfx_summary:
            context_sections.append("SFX catalog overview:\n" + sfx_summary)

    # Assemble all parts of the prompt
    prompt_parts = [
        instruction_text,
        "Use this schema template (update with real values):",
        schema_hint_json,
        "Rules:",
        "\n".join(rules_lines),
    ]
    knowledge_snippets: List[str] = []
    if knowledge_service is not None:
        transcript_excerpt = " ".join(entry.text_one_line for entry in entries)[:1500]
        knowledge_snippets = knowledge_service.guideline_summaries(
            transcript_excerpt, top_k=5
        )
    if knowledge_snippets:
        context_sections.append(
            "Knowledge base guidelines:\n" + "\n".join(f"- {snippet}" for snippet in knowledge_snippets)
        )

    context_block = "\n\n".join(context_sections)

    if context_block:
        prompt_parts.append("Supplemental context:\n" + context_block)
    prompt_parts.append("Transcript segments (ordered):\n" + transcript_section)

    # Join prompt parts and ensure a trailing newline
    prompt = "\n\n".join(part for part in prompt_parts if part) + "\n"
    return prompt


def extract_plan_json(text: str) -> dict:
    """
    Extracts a JSON object from a given text, typically an LLM response.
    It looks for JSON within fenced code blocks first, then attempts to parse the raw text.

    Args:
        text: The input string, potentially containing a JSON block.

    Returns:
        The parsed JSON dictionary.

    Raises:
        ValueError: If no valid JSON can be extracted from the text.
    """
    candidates: List[str] = []
    # Search for JSON within fenced code blocks (```json ... ```)
    for match in JSON_BLOCK_RE.finditer(text):
        candidates.append(match.group(1).strip())
    if not candidates:
        # If no fenced block is found, assume the entire text might be JSON
        candidates.append(text.strip())

    last_error: Exception | None = None
    for candidate in candidates:
        # Try parsing with and without carriage returns
        for cleaned in (candidate, candidate.replace("\r", "")):
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError as exc:
                last_error = exc
                continue
    raise ValueError(f"Could not parse JSON from LLM response: {last_error}")


def ensure_float(value: Any, default: float = 0.0) -> float:
    """
    Ensures a value is a float, providing a default if conversion fails.

    Args:
        value: The value to convert.
        default: The default float value to return on failure.

    Returns:
        The converted float or the default value.
    """
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def ensure_bool(value: Any, default: bool = False) -> bool:
    """
    Ensures a value is a boolean, handling various string/numeric representations.

    Args:
        value: The value to convert.
        default: The default boolean value to return on failure or empty string.

    Returns:
        The converted boolean or the default value.
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        normalized = value.strip().lower()
        if not normalized:
            return default
        if normalized in {"true", "1", "yes", "y", "on"}:
            return True
        if normalized in {"false", "0", "no", "n", "off"}:
            return False
        return default
    return bool(value) if value is not None else default


def normalize_segment_kind(value: Any) -> str | None:
    """
    Normalizes a segment 'kind' value to a standard string ('broll' or 'normal').

    Args:
        value: The raw segment kind value.

    Returns:
        "broll", "normal", or None if the input is invalid.
    """
    if value is None:
        return None
    if isinstance(value, str):
        normalized = value.strip().lower().replace("-", "").replace("_", "").replace(" ", "")
        if not normalized:
            return None
        if normalized in {"broll", "brollplaceholder", "placeholderbroll"}:
            return "broll"
        # If "broll" is part of the normalized string, assume it's a broll segment
        return "broll" if "broll" in normalized else "normal"
    return "normal"


def normalize_sfx_name(value: Any) -> str | None:
    """
    Normalizes an SFX name from various input formats to a canonical path
    (e.g., 'assets/sfx/ui/pop.mp3') using the SFX_LOOKUP.

    Args:
        value: The raw SFX name or path.

    Returns:
        The normalized SFX path or None if no match is found.
    """
    if value is None:
        return None
    candidate = str(value).strip()
    if not candidate:
        return None
    # Normalize path separators and remove leading './'
    candidate_normalized = candidate.replace("\\", "/").lstrip("./")
    # Remove 'assets/' or 'sfx/' prefixes if present
    if candidate_normalized.startswith("assets/"):
        candidate_normalized = candidate_normalized[7:]
    if candidate_normalized.startswith("sfx/"):
        candidate_normalized = candidate_normalized[4:]

    # Check various forms of the candidate against the SFX lookup
    checks = [
        candidate_normalized.lower(),  # Full normalized path
        Path(candidate_normalized).name.lower(),  # Filename only
        Path(candidate_normalized).stem.lower(),  # Filename stem (without extension)
    ]

    for key in checks:
        if not key:
            continue
        match = SFX_LOOKUP.get(key)
        if match:
            return match

    return None


def normalize_camera_movement(value: Any) -> str | None:
    """
    Normalizes camera movement descriptions to standard values ("zoomIn", "zoomOut").

    Args:
        value: The raw camera movement description.

    Returns:
        "zoomIn", "zoomOut", or None if no match.
    """
    if value is None:
        return None
    normalized = str(value).strip().lower().replace(" ", "").replace("-", "").replace("_", "")
    if normalized in {"zoomin", "pushin", "push"}:
        return "zoomIn"
    if normalized in {"zoomout", "pullback", "pull"}:
        return "zoomOut"
    return None


def normalize_transition(value: Any) -> Dict[str, Any] | None:
    """
    Normalizes a raw transition definition into a structured dictionary.
    Handles various input formats for type, direction, duration, and intensity.

    Args:
        value: The raw transition definition (string or dictionary).

    Returns:
        A dictionary representing the normalized transition, or None if the input is invalid.
    """
    if value is None:
        return None

    transition_type = None
    direction = None
    duration_value = None
    intensity_value = None

    if isinstance(value, str):
        transition_type = value.lower()
    elif isinstance(value, dict):
        transition_type = (value.get("type") or value.get("style") or "").lower()
        direction = (value.get("direction") or value.get("dir") or "").lower() or None
        duration_value = ensure_float(value.get("duration", value.get("length", 0.0)), 0.0)
        intensity_value = ensure_float(value.get("intensity", value.get("strength", 0.0)), 0.0)
    else:
        return None

    # Map common transition aliases to standard types
    if transition_type in {"fade", "dissolve"}:
        transition_type = "crossfade"
    elif transition_type in {"slide-left", "slide-right", "slide-up", "slide-down"}:
        for candidate in TRANSITION_DIRECTIONS:
            if candidate in transition_type:
                direction = candidate
                break
        transition_type = "slide"
    elif transition_type in {"zoom-in", "zoom-out", "push", "push-in", "push-out", "punch", "punch-in", "punch-out"}:
        transition_type = "zoom"
    elif transition_type in {"scale-up", "scale-down", "grow", "shrink"}:
        transition_type = "scale"
    elif transition_type in {"spin", "twist", "turn"}:
        transition_type = "rotate"
    elif transition_type in {"focus", "defocus", "dream", "soft-focus", "soften"}:
        transition_type = "blur"

    # Default to "cut" if the type is not recognized
    if transition_type not in TRANSITION_TYPES:
        transition_type = "cut"

    # "cut" transitions don't need further properties
    if transition_type == "cut":
        return {"type": "cut"}

    # Set default and clamp duration
    duration_value = duration_value if duration_value and duration_value > 0 else 0.6
    duration_value = max(0.1, min(duration_value, 3.0))

    # Clamp and round intensity if provided
    if intensity_value is not None and intensity_value <= 0:
        intensity_value = None
    if intensity_value is not None:
        intensity_value = round(max(0.05, min(float(intensity_value), 0.6)), 3)

    transition: Dict[str, Any] = {
        "type": transition_type,
        "duration": round(duration_value, 3),
    }

    # Add direction for slide transitions
    if transition_type == "slide" and direction in TRANSITION_DIRECTIONS:
        transition["direction"] = direction

    # Add intensity for specific transition types
    if transition_type in {"zoom", "scale", "rotate", "blur"} and intensity_value:
        transition["intensity"] = intensity_value

    return transition


def normalize_highlight_item(raw: Dict[str, Any], index: int) -> Dict[str, Any] | None:
    """
    Normalizes a raw highlight item definition into a structured dictionary.
    Handles various input formats for type, text, timing, position, animation, and other properties.

    Args:
        raw: The raw highlight item dictionary.
        index: The index of the highlight, used for generating a default ID.

    Returns:
        A dictionary representing the normalized highlight item, or None if the input is invalid.
    """
    if not isinstance(raw, dict):
        return None

    highlight_type_raw = raw.get("type") or raw.get("kind") or raw.get("layout")
    highlight_type: str | None = None
    if isinstance(highlight_type_raw, str):
        type_key = highlight_type_raw.strip().lower().replace(" ", "").replace("-", "").replace("_", "")
        type_map = {
            "highlight": "noteBox",
            "caption": "noteBox",
            "callout": "noteBox",
            "notebox": "noteBox",
            "notecard": "noteBox",
            "quote": "noteBox",
            "typewriter": "typewriter",
            "section": "sectionTitle",
            "sectiontitle": "sectionTitle",
            "titlecard": "sectionTitle",
            "chapter": "sectionTitle",
            "icon": "icon",
            "iconhighlight": "icon",
        }
        highlight_type = type_map.get(type_key, highlight_type_raw.strip())

    # Extract and strip various text fields
    text = (raw.get("text") or raw.get("caption") or "").strip()
    title = (raw.get("title") or "").strip()
    subtitle = (raw.get("subtitle") or "").strip()
    badge = (raw.get("badge") or "").strip()
    name = (raw.get("name") or raw.get("label") or "").strip()
    icon_value = (raw.get("icon") or raw.get("iconName") or "").strip()

    # Determine if it's an icon type if not explicitly set
    has_icon_marker = bool(icon_value or (name and not highlight_type))
    resolved_highlight_type = highlight_type or ("icon" if has_icon_marker else None)

    # If no content is provided, this is not a valid highlight
    if not any([text, title, subtitle, badge, name, icon_value]):
        return None

    # Normalize start time
    start = ensure_float(raw.get("start", raw.get("time", 0.0)), 0.0)
    start = max(0.0, start)

    # Normalize duration, with fallback and clamping
    duration = ensure_float(raw.get("duration", raw.get("length", 0.0)), DEFAULT_HIGHLIGHT_DURATION)
    if duration <= 0:
        end_time = ensure_float(raw.get("end"))
        if end_time > start:
            duration = end_time - start
    if duration <= 0:
        duration = DEFAULT_HIGHLIGHT_DURATION
    duration = max(1.5, min(duration, 5.0))

    # Normalize position
    position = (raw.get("position") or raw.get("placement") or "center").lower()
    if position not in HIGHLIGHT_POSITIONS:
        position = "center"

    # Normalize animation, with default based on type
    animation_raw = raw.get("animation") or raw.get("style") or raw.get("motion")
    animation_default = "pop" if resolved_highlight_type == "icon" else "fade"
    animation_key = ""
    if isinstance(animation_raw, str):
        animation_key = animation_raw.strip().lower().replace(" ", "").replace("-", "").replace("_", "")
    animation_map = {
        "fade": "fade", "fadein": "fade",
        "zoom": "zoom", "zoomin": "zoom",
        "punch": "pop", "punchin": "pop", "pop": "pop", "popin": "pop",
        "bounce": "bounce",
        "float": "float", "floating": "float",
        "flip": "flip",
        "spin": "spin", "rotate": "spin",
        "typewriter": "typewriter",
        "pulse": "pulse", "breath": "pulse", "beat": "pulse",
        "slide": "slide", "slideup": "slide", "slidedown": "slide", "slideleft": "slide", "slideright": "slide",
    }
    animation = animation_map.get(animation_key, animation_default)

    # Construct the base highlight dictionary
    highlight: Dict[str, Any] = {
        "id": str(raw.get("id") or f"highlight-{index + 1:02d}"),
        "start": round(start, 3),
        "duration": round(duration, 3),
        "position": position,
        "animation": animation,
    }

    # Add type, defaulting to noteBox if text is present and type is not set
    if resolved_highlight_type:
        highlight["type"] = resolved_highlight_type
    elif text:
        highlight["type"] = "noteBox"

    # Add text fields if present
    if text:
        highlight["text"] = text
    if title:
        highlight["title"] = title
    if subtitle:
        highlight["subtitle"] = subtitle
    if badge:
        highlight["badge"] = badge
    if name:
        highlight["name"] = name
    if icon_value:
        highlight["icon"] = icon_value

    # Add asset path if present
    asset = (raw.get("asset") or raw.get("media") or "").strip()
    if asset:
        highlight["asset"] = asset

    # Normalize and add variant
    variant_raw = raw.get("variant") or raw.get("layout") or raw.get("styleVariant")
    if variant_raw:
        variant_key = str(variant_raw).strip().lower().replace(" ", "").replace("-", "").replace("_", "")
        variant_map = {
            "callout": "callout", "default": "callout", "bubble": "callout",
            "blur": "blurred", "blurred": "blurred", "blurredbackdrop": "blurred",
            "brand": "brand", "brandpanel": "brand",
            "cutaway": "cutaway", "black": "cutaway",
            "typewriter": "typewriter",
        }
        normalized_variant = variant_map.get(variant_key)
        if normalized_variant in HIGHLIGHT_VARIANTS:
            highlight["variant"] = normalized_variant

    # Normalize and add SFX
    sfx_value = raw.get("sfx") or raw.get("asset") or raw.get("sound")
    sfx_name = normalize_sfx_name(sfx_value)
    if sfx_name:
        # Ensure SFX path is prefixed correctly
        if not sfx_name.lower().startswith("assets/"):
            if sfx_name.lower().startswith("sfx/"):
                sfx_name = f"assets/{sfx_name}"
            else:
                sfx_name = f"assets/sfx/{sfx_name}"
        highlight["sfx"] = sfx_name

    # Add color properties if present
    accent_color = raw.get("accentColor") or raw.get("accent")
    if isinstance(accent_color, str) and accent_color.strip():
        highlight["accentColor"] = accent_color.strip()

    background_color = raw.get("backgroundColor") or raw.get("background") or raw.get("bg")
    if isinstance(background_color, str) and background_color.strip():
        highlight["backgroundColor"] = background_color.strip()

    icon_color = raw.get("iconColor") or raw.get("iconColour")
    if isinstance(icon_color, str) and icon_color.strip():
        highlight["iconColor"] = icon_color.strip()

    # Add side alignment
    side = (raw.get("side") or raw.get("alignment") or "").strip().lower()
    if side in {"top", "bottom", "left", "right"}:
        highlight["side"] = side

    # Add radius if valid
    radius = raw.get("radius")
    if radius is not None:
        try:
            radius_float = float(radius)
        except (TypeError, ValueError):
            radius_float = None
        if radius_float is not None and radius_float > 0:
            highlight["radius"] = round(radius_float, 3)

    # Add volume if valid
    volume = raw.get("volume")
    if volume is not None:
        try:
            volume_float = float(volume)
        except (TypeError, ValueError):
            volume_float = None
        if volume_float is not None:
            volume_float = max(0.0, min(volume_float, 1.0))
            highlight["volume"] = round(volume_float, 3)

    return highlight


def normalize_plan(plan: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizes the entire plan dictionary, processing segments and highlights.
    This function ensures consistency and applies default values where necessary.

    Args:
        plan: The raw plan dictionary from the LLM.

    Returns:
        A normalized plan dictionary.

    Raises:
        ValueError: If the input plan is not a dictionary.
    """
    if not isinstance(plan, dict):
        raise ValueError("Plan must be a JSON object.")

    segment_items: List[tuple[float, Dict[str, Any]]] = []
    raw_segments = plan.get("segments")
    if isinstance(raw_segments, list):
        for index, raw_segment in enumerate(raw_segments):
            if not isinstance(raw_segment, dict):
                continue
            
            # Normalize sourceStart and duration
            source_start = ensure_float(
                raw_segment.get("sourceStart", raw_segment.get("start", 0.0)),
                0.0,
            )
            duration = ensure_float(raw_segment.get("duration"))
            if duration <= 0:
                end_value = ensure_float(raw_segment.get("end"))
                start_value = ensure_float(raw_segment.get("start", source_start))
                if end_value > start_value:
                    duration = end_value - start_value
            if duration <= 0:
                length_value = ensure_float(raw_segment.get("length"))
                if length_value > 0:
                    duration = length_value
            if duration <= 0:
                continue

            segment_plan: Dict[str, Any] = {
                "id": str(raw_segment.get("id") or f"segment-{index + 1:02d}"),
                "sourceStart": round(source_start, 3),
                "duration": round(duration, 3),
            }

            # Tạm thời vô hiệu hóa gắn nhãn segment `broll` để tránh chèn placeholder B-roll.
            # if "kind" in raw_segment:
            #     kind_value = normalize_segment_kind(raw_segment.get("kind"))
            #     if kind_value:
            #         segment_plan["kind"] = kind_value

            # Add label if present
            label = (raw_segment.get("label") or raw_segment.get("title") or "").strip()
            if label:
                segment_plan["label"] = label

            # Add title if present
            title_value = raw_segment.get("title")
            if isinstance(title_value, str):
                title_clean = title_value.strip()
                if title_clean:
                    segment_plan["title"] = title_clean

            # Normalize silenceAfter property
            silence_after_raw = None
            for key in ("silenceAfter", "silence_after"):
                if key in raw_segment:
                    silence_after_raw = raw_segment.get(key)
                    break
            if silence_after_raw is not None:
                segment_plan["silenceAfter"] = ensure_bool(silence_after_raw)
            else:
                segment_plan["silenceAfter"] = False

            # Normalize gapAfter property
            gap_after_raw = None
            for key in ("gapAfter", "gap_after"):
                if key in raw_segment:
                    gap_after_raw = raw_segment.get(key)
                    break
            if gap_after_raw is not None:
                segment_plan["gapAfter"] = ensure_bool(gap_after_raw)

            # Normalize playbackRate
            playback_raw = raw_segment.get("playbackRate", raw_segment.get("speed"))
            if playback_raw is not None:
                playback_rate = ensure_float(playback_raw, 1.0)
                if playback_rate <= 0:
                    playback_rate = 1.0
                if abs(playback_rate - 1.0) > 1e-3:
                    segment_plan["playbackRate"] = round(playback_rate, 3)

            # Normalize transitionIn
            transition_in = normalize_transition(
                raw_segment.get("transitionIn")
                or raw_segment.get("transition_in")
                or raw_segment.get("enterTransition")
            )
            if transition_in:
                segment_plan["transitionIn"] = transition_in

            # Normalize transitionOut
            transition_out = normalize_transition(
                raw_segment.get("transitionOut")
                or raw_segment.get("transition_out")
                or raw_segment.get("exitTransition")
            )
            if transition_out:
                segment_plan["transitionOut"] = transition_out

            # Normalize cameraMovement
            metadata_raw = raw_segment.get("metadata")
            metadata_camera = metadata_raw.get("cameraMovement") if isinstance(metadata_raw, dict) else None
            camera_movement = normalize_camera_movement(
                raw_segment.get("cameraMovement")
                or raw_segment.get("camera_movement")
                or metadata_camera
            )
            if camera_movement:
                segment_plan["cameraMovement"] = camera_movement

            # Add metadata if present
            if isinstance(metadata_raw, dict) and metadata_raw:
                segment_plan["metadata"] = metadata_raw

            # Store timeline start for sorting
            timeline_start = ensure_float(
                raw_segment.get("timelineStart", raw_segment.get("timeline_start")),
                source_start,
            )
            segment_items.append((timeline_start, segment_plan))

    # Sort segments by timeline start and source start
    segment_items.sort(key=lambda item: (item[0], item[1]["sourceStart"]))
    normalized_segments = [item[1] for item in segment_items]

    # Process raw highlights
    raw_highlights: List[Any] = []
    if isinstance(plan.get("highlights"), list):
        raw_highlights = list(plan["highlights"])
    elif isinstance(plan.get("actions"), list): # Support older "actions" key
        for action in plan.get("actions", []):
            if not isinstance(action, dict):
                continue
            action_type = (action.get("type") or action.get("kind") or "").lower()
            if action_type in {"caption", "highlight", "icon", "notebox", "typewriter", "section", "sectiontitle"}:
                raw_highlights.append(action)

    normalized_highlights: List[Dict[str, Any]] = []
    for idx, raw_highlight in enumerate(raw_highlights):
        normalized = normalize_highlight_item(raw_highlight, idx)
        if normalized:
            normalized_highlights.append(normalized)
        if len(normalized_highlights) >= MAX_HIGHLIGHTS:
            break

    # Sort highlights by start time
    normalized_highlights.sort(key=lambda item: item.get("start", 0.0))

    normalized_plan: Dict[str, Any] = {
        "segments": normalized_segments,
        "highlights": normalized_highlights,
    }

    # Add meta information if present
    if "meta" in plan:
        normalized_plan["meta"] = plan["meta"]

    return normalized_plan


def configure_client(model_name: str | None = None) -> genai.GenerativeModel:
    """
    Configures and returns a Gemini GenerativeModel client.
    Loads API key from .env file or environment variables.

    Args:
        model_name: Optional. The name of the Gemini model to use. Defaults to "gemini-1.5-flash".

    Returns:
        A configured google.generativeai.GenerativeModel instance.

    Raises:
        RuntimeError: If GEMINI_API_KEY is not found.
    """
    # Load environment variables from .env files
    root_dir = Path(__file__).resolve().parents[1]
    load_dotenv(root_dir / ".env")
    load_dotenv()  # load defaults if present

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing GEMINI_API_KEY. Add it to .env or environment variables.")

    genai.configure(api_key=api_key)
    resolved_model = model_name or os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    return genai.GenerativeModel(resolved_model)


def dump_plan(plan: dict, output_path: Path) -> None:
    """
    Dumps the generated plan to a JSON file with pretty-printing.
    Ensures the output directory exists.

    Args:
        plan: The plan dictionary to save.
        output_path: The path to the output JSON file.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(plan, handle, indent=2)
        handle.write("\n")


def main(argv: List[str] | None = None) -> int:
    """
    Main entry point for the script. Parses arguments, builds the prompt,
    calls the Gemini LLM, normalizes the response, and saves the plan.

    Args:
        argv: Optional. A list of command-line arguments. Defaults to sys.argv.

    Returns:
        An exit code (0 for success, 1 for failure).
    """
    parser = argparse.ArgumentParser(description="Generate edit plan with Gemini")
    parser.add_argument("srt_path", type=Path, help="Input SRT transcript")
    parser.add_argument("output_plan", type=Path, help="Destination JSON plan file")
    parser.add_argument("--model", dest="model_name", help="Override Gemini model name")
    parser.add_argument(
        "--max-entries",
        type=int,
        default=160,
        help="Limit number of SRT entries sent to Gemini",
    )
    parser.add_argument(
        "--extra",
        dest="extra_instructions",
        help="Optional free-form instructions appended to the prompt",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the prompt without calling Gemini",
    )
    parser.add_argument(
        "--scene-map",
        dest="scene_map_path",
        type=Path,
        help="Optional scene_map.json to enrich the prompt with precomputed metadata",
    )

    args = parser.parse_args(argv)

    # Validate SRT input path
    if not args.srt_path.exists():
        parser.error(f"SRT file not found: {args.srt_path}")

    # Parse SRT and validate entries
    entries = parse_srt(args.srt_path, max_entries=args.max_entries)
    if not entries:
        parser.error("No valid entries found in SRT")

    # Load optional scene map data
    scene_map_data: Dict[str, Any] | None = None
    if args.scene_map_path:
        if not args.scene_map_path.exists():
            parser.error(f"Scene map not found: {args.scene_map_path}")
        scene_map_data = load_json_if_exists(args.scene_map_path)
        if not scene_map_data:
            print(f"[WARN] Scene map is empty or invalid: {args.scene_map_path}", file=sys.stderr)
            scene_map_data = None

    # Resolve repository root and load asset catalogs/motion rules
    repo_root = Path(__file__).resolve().parents[3]
    broll_catalog = load_json_if_exists(repo_root / "assets" / "broll_catalog.json") or None
    sfx_catalog = load_json_if_exists(repo_root / "assets" / "sfx_catalog.json") or None
    motion_rules = load_json_if_exists(repo_root / "assets" / "motion_rules.json") or None

    # Initialize KnowledgeService
    knowledge_service: Optional[KnowledgeService] = None
    if KnowledgeService is not None:
        try:
            knowledge_service = KnowledgeService()
        except Exception as exc:
            print(f"[WARN] Could not initialize KnowledgeService: {exc}", file=sys.stderr)

    # Build the prompt for the LLM
    prompt = build_prompt(
        entries,
        extra_instructions=args.extra_instructions,
        scene_map=scene_map_data,
        broll_catalog=broll_catalog,
        sfx_catalog=sfx_catalog,
        motion_rules=motion_rules,
        knowledge_service=knowledge_service, # Pass the initialized service
    )

    # If dry-run, print prompt and exit
    if args.dry_run:
        print(prompt)
        return 0

    # Configure Gemini client
    try:
        model = configure_client(args.model_name)
    except Exception as exc:  # noqa: BLE001 - surface friendly message
        print(f"[ERROR] {exc}")
        return 1

    # Generate content from Gemini
    try:
        response = model.generate_content(prompt)
    except Exception as exc:  # noqa: BLE001 - Gemini client may raise many types
        print(f"[ERROR] Gemini request failed: {exc}")
        return 1

    raw_text = getattr(response, "text", None)
    if not raw_text:
        print("[ERROR] Empty response from Gemini")
        return 1

    # Extract and normalize the plan from LLM response
    try:
        plan = extract_plan_json(raw_text)
        plan = normalize_plan(plan)
    except ValueError as exc:
        print(f"[ERROR] {exc}")
        print("--- Gemini response ---")
        print(raw_text)
        print("--- end response ---")
        return 1

    # Dump the final plan to output file
    dump_plan(plan, args.output_plan)
    print(f"[PLAN] Saved Gemini plan to {args.output_plan}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
