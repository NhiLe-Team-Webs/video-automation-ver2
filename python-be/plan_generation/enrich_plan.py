#!/usr/bin/env python3
"""Enrich an existing Gemini plan with B-roll assignments, motion cues and CTA highlights.

This post-processor consumes:
  - plan.json produced by make_plan_gemini.py
  - scene_map.json generated from the transcript
  - asset catalogs (B-roll, SFX) and motion rules

It augments each segment with:
  * `kind` (defaults to "normal")
  * `broll` metadata referencing items from assets/broll_catalog.json when appropriate
  * `motionCue` in camelCase respecting configured frequency limits
  * optional `notes` describing auto decisions (useful for debugging)

It also:
  * appends a CTA highlight if the scene map flagged any CTA segment but the plan lacks one
  * reports timing gaps between consecutive segments
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from collections import Counter
from dataclasses import dataclass
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "been",
    "but",
    "by",
    "can",
    "could",
    "did",
    "do",
    "does",
    "for",
    "from",
    "had",
    "has",
    "have",
    "here",
    "if",
    "in",
    "into",
    "is",
    "it",
    "its",
    "just",
    "may",
    "might",
    "of",
    "on",
    "or",
    "our",
    "out",
    "should",
    "so",
    "that",
    "the",
    "their",
    "them",
    "then",
    "there",
    "these",
    "they",
    "this",
    "those",
    "to",
    "up",
    "very",
    "was",
    "we",
    "were",
    "what",
    "when",
    "where",
    "which",
    "who",
    "will",
    "with",
    "would",
    "you",
    "your",
}
IMPORTANT_SHORT_TOKENS = {"ai", "ms", "ebv", "cta"}
BLACKLIST_PHRASES = {
    "thanks for watching",
    "thank you for watching",
    "see you in the next",
    "see you next",
    "i hope you enjoyed",
    "bye",
    "goodbye",
}


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------


def load_json(path: Path) -> Dict[str, Any]:
    """
    Loads a JSON file from the given path.

    Args:
        path: The path to the JSON file.

    Returns:
        A dictionary containing the JSON data.

    Raises:
        FileNotFoundError: If the JSON file does not exist.
    """
    if not path.exists():
        raise FileNotFoundError(f"JSON file not found: {path}")
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(data: Dict[str, Any], path: Path) -> None:
    """
    Writes a dictionary to a JSON file with pretty-printing.
    Ensures the parent directory exists.

    Args:
        data: The dictionary to write.
        path: The path to the output JSON file.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def camel_case_motion(name: str) -> str:
    """
    Converts a string to camelCase, typically used for motion cue names.
    E.g., "zoom-in" -> "zoomIn", "slide up" -> "slideUp".

    Args:
        name: The input string.

    Returns:
        The camelCase version of the string.
    """
    normalized = name.strip().replace("-", "_").replace(" ", "_").lower()
    parts = [part for part in normalized.split("_") if part]
    if not parts:
        return ""
    first, *rest = parts
    return first + "".join(part.title() for part in rest)


def overlap_seconds(a_start: float, a_end: float, b_start: float, b_end: float) -> float:
    """
    Calculates the overlap duration in seconds between two time intervals.

    Args:
        a_start: Start time of interval A.
        a_end: End time of interval A.
        b_start: Start time of interval B.
        b_end: End time of interval B.

    Returns:
        The duration of the overlap in seconds. Returns 0.0 if there is no overlap.
    """
    return max(0.0, min(a_end, b_end) - max(a_start, b_start))


def parse_timestamp_to_seconds(value: Any) -> Optional[float]:
    """
    Converts a timestamp string (e.g. "12:34") or numeric value into seconds.
    Supports "MM:SS" and "HH:MM:SS" formats.
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        numeric = float(value)
        return numeric if numeric >= 0 else None

    if not isinstance(value, str):
        return None

    token = value.strip()
    if not token:
        return None

    parts = token.split(':')
    try:
        numeric_parts = [float(part) for part in parts]
    except ValueError:
        return None

    if len(numeric_parts) == 1:
        seconds = numeric_parts[0]
    elif len(numeric_parts) == 2:
        minutes, seconds = numeric_parts
        seconds += minutes * 60
    elif len(numeric_parts) == 3:
        hours, minutes, seconds = numeric_parts
        seconds += minutes * 60 + hours * 3600
    else:
        return None

    return seconds if seconds >= 0 else None


def sanitize_text(value: Any) -> Optional[str]:
    """Returns a trimmed string if available, otherwise None."""
    if not isinstance(value, str):
        return None
    text = value.strip()
    return text or None


def derive_duration_seconds(entry: Dict[str, Any], element: Dict[str, Any], fallback: float = 3.0) -> float:
    """
    Resolves a duration in seconds from element or entry metadata, with dynamic adjustments.
    Accepts common keys like 'duration', 'length', or 'duration_seconds'.
    """
    base_duration = fallback
    for container in (element, entry):
        for key in ('duration_seconds', 'duration', 'length'):
            candidate = container.get(key)
            if isinstance(candidate, (int, float)) and candidate > 0:
                base_duration = float(candidate)
                break
        if base_duration != fallback:
            break

    # Dynamic adjustment based on text length
    text_content = sanitize_text(element.get('content')) or sanitize_text(entry.get('text'))
    if text_content:
        word_count = len(text_content.split())
        # Adjust duration: 0.5 seconds per word, min 1.5s, max 5.0s
        dynamic_duration = max(1.5, min(word_count * 0.5, 5.0))
        return max(base_duration, dynamic_duration)

    return base_duration


def condense_text(value: str, max_words: int = 3, max_chars: int = 42) -> str:
    """Condenses a string to a maximum number of words and characters, in uppercase."""
    tokens = [token for token in value.split() if token.lower() not in STOP_WORDS]
    if not tokens:
        # If all words are stop words, use original value but still condense
        tokens = [token for token in value.split() if token]

    selected = tokens[:max_words]
    condensed = " ".join(selected).upper()
    if len(condensed) > max_chars:
        condensed = condensed[: max_chars - 1].rstrip() + "…"
    return condensed


def normalize_phrase(words: List[str], max_words: int, max_chars: int = 48) -> str:
    """Normalizes a list of words into a phrase, applying stop word filtering and length limits."""
    meaningful_words = [w for w in words if w.lower() not in STOP_WORDS or w.lower() in IMPORTANT_SHORT_TOKENS]
    if not meaningful_words:
        meaningful_words = words # Fallback if all are stop words

    phrase = " ".join(meaningful_words[:max_words]).upper()
    if len(phrase) > max_chars:
        phrase = phrase[: max_chars - 1].rstrip() + "…"
    return phrase


def split_words_for_supporting(words: List[str]) -> Tuple[List[str], List[str]]:
    if len(words) <= 3:
        return words, []

    split_tokens = {"and", "but", "versus", "vs", "while", "because", "so", "then", "what", "that", "which", "where", "who"}
    for idx, token in enumerate(words):
        if token.lower() in split_tokens and 2 <= idx <= len(words) - 3:
            return words[:idx], words[idx:]

    midpoint = max(2, len(words) // 2)
    return words[:midpoint], words[midpoint:]


def parse_srt_timestamp(value: str) -> Optional[float]:
    match = re.match(r"^(\d{2}):(\d{2}):(\d{2}),(\d{3})$", value)
    if not match:
        return None
    hours, minutes, seconds, milliseconds = match.groups()
    total_seconds = (
        int(hours) * 3600 + int(minutes) * 60 + int(seconds) + int(milliseconds) / 1000
    )
    return total_seconds


def parse_srt_file(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []

    with path.open("r", encoding="utf-8") as handle:
        raw = handle.read()

    raw = raw.replace("\ufeff", "").strip()
    if not raw:
        return []

    entries: List[Dict[str, Any]] = []
    blocks = re.split(r"\r?\n\r?\n", raw)
    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if len(lines) < 2:
            continue

        index_str = lines[0]
        time_line = lines[1]
        text_lines = lines[2:] if len(lines) > 2 else []

        time_match = re.match(
            r"(\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2},\d{3})", time_line
        )
        if not time_match:
            continue

        start_seconds = parse_srt_timestamp(time_match.group(1))
        end_seconds = parse_srt_timestamp(time_match.group(2))
        if start_seconds is None or end_seconds is None or end_seconds <= start_seconds:
            continue

        try:
            index = int(index_str)
        except ValueError:
            index = len(entries) + 1

        text = " ".join(text_lines).strip()
        if not text:
            continue

        entries.append(
            {
                "index": index,
                "start": start_seconds,
                "end": end_seconds,
                "duration": end_seconds - start_seconds,
                "text": text,
            }
        )

    return entries


def build_highlight_from_overlay(
    entry_index: int,
    entry: Dict[str, Any],
    element_index: int,
    element: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """
    Converts a single text overlay element into a HighlightPlan-compatible dictionary.
    """
    if element.get('type') != 'text_overlay':
        return None

    timestamp = parse_timestamp_to_seconds(entry.get('timestamp'))
    if timestamp is None:
        return None

    content = element.get('content')
    main_text: Optional[str] = None
    supporting: Dict[str, str] = {}

    if isinstance(content, str):
        main_text = sanitize_text(content)
    elif isinstance(content, dict):
        main_text = (
            sanitize_text(content.get('keyword'))
            or sanitize_text(content.get('title'))
            or sanitize_text(content.get('heading'))
            or sanitize_text(content.get('label'))
        )

        items = content.get('items')
        if isinstance(items, list) and items:
            first = sanitize_text(items[0])
            second = sanitize_text(items[1]) if len(items) > 1 else None
            if first and not supporting.get('topLeft'):
                supporting['topLeft'] = first
            if second and not supporting.get('topRight'):
                supporting['topRight'] = second
            if not main_text:
                main_text = sanitize_text(items[-1]) or first

        for source_key, target_key in (
            ('top_left', 'topLeft'),
            ('topLeft', 'topLeft'),
            ('left', 'topLeft'),
            ('primary', 'topLeft'),
            ('top_right', 'topRight'),
            ('topRight', 'topRight'),
            ('right', 'topRight'),
            ('secondary', 'topRight'),
            ('top_center', 'topCenter'),
            ('topCenter', 'topCenter'),
        ):
            value = sanitize_text(content.get(source_key))
            if value and target_key not in supporting:
                supporting[target_key] = value
    else:
        main_text = sanitize_text(entry.get('script'))

    if not main_text:
        main_text = sanitize_text(entry.get('script'))
    if not main_text:
        return None

    supporting = {key: condense_text(value) for key, value in supporting.items() if value}
    duration = derive_duration_seconds(entry, element)

    layout: Optional[str] = None
    supporting_clean: Dict[str, str] = {}
    left_value = supporting.get('topLeft') or supporting.get('topCenter')
    right_value = supporting.get('topRight') or supporting.get('topCenter')

    if left_value:
        supporting_clean['topLeft'] = left_value
    if right_value and right_value != left_value:
        supporting_clean['topRight'] = right_value

    # Normalize single string content as bottom banner
    is_primary = isinstance(element.get('content'), str)
    if is_primary:
        layout = 'bottom'

    highlight: Dict[str, Any] = {
        'id': f'kb-{entry_index:03d}-{element_index:02d}',
        'type': 'noteBox',
        'start': round(timestamp, 2),
        'duration': round(duration, 2),
    }

    if layout == 'bottom':
        highlight['text'] = condense_text(main_text, 3)
        highlight['keyword'] = highlight['text']
        highlight['layout'] = 'bottom'
        highlight['importance'] = 'primary'
        highlight['position'] = 'bottom'
        highlight['side'] = 'bottom'
    else:
        highlight['keyword'] = condense_text(main_text, 3)
        highlight['importance'] = 'supporting'
        highlight['position'] = 'top'
        if supporting_clean:
            highlight['supportingTexts'] = supporting_clean
            if 'topLeft' in supporting_clean and 'topRight' in supporting_clean:
                highlight['layout'] = 'dual'
            elif 'topLeft' in supporting_clean:
                highlight['layout'] = 'left'
                highlight['side'] = 'left'
            elif 'topRight' in supporting_clean:
                highlight['layout'] = 'right'
                highlight['side'] = 'right'
            else:
                highlight['layout'] = 'left'
        else:
            highlight['layout'] = 'bottom'
            highlight['importance'] = 'primary'
            highlight['position'] = 'bottom'
            highlight['side'] = 'bottom'
            highlight['text'] = condense_text(main_text, 3)

    return highlight




BROLL_RULES: List[Tuple[set[str], str]] = [
    (set(["digital marketing", "marketing", "online marketing"]), "marketing_automation"),
    (set(["strategy", "tactics", "plan", "framework"]), "business_strategy"),
    (set(["seo", "search engine optimization"]), "data_visualization"),
    (set(["social media", "facebook", "instagram", "linkedin"]), "digital_network"),
    (set(["ppc", "paid ads", "google ads"]), "data_visualization"),
    (set(["email marketing", "email campaigns"]), "digital_network"),
    (set(["web optimization", "website", "landing page"]), "digital_transformation"),
    (set(["audience", "segmentation", "target", "customer"]), "ai_brain"),
    (set(["learning", "education", "course", "training"]), "education_training"),
    (set(["career", "job", "growth", "specialise"]), "modern_office"),
    (set(["credibility", "authority", "expert"]), "innovation_lightbulb"),
    (set(["data", "analytics", "metrics", "insights"]), "data_visualization"),
    (set(["content", "blog", "video", "post"]), "digital_network"),
    (set(["organic", "paid", "promotion"]), "data_visualization"),
    (set(["brand awareness", "direct response"]), "business_strategy"),
    (set(["products", "services"]), "modern_office"),
    (set(["b2b", "b2c", "business to business", "business to consumer"]), "business_strategy"),
]


def match_broll_id(text: str) -> Optional[str]:
    lowered = text.lower()
    for keywords, broll_id in BROLL_RULES:
        if any(keyword in lowered for keyword in keywords):
            return broll_id
    return None


def ensure_broll_from_highlights(
    plan: Dict[str, Any],
    broll_catalog: Dict[str, Any] | None,
) -> None:
    if not broll_catalog:
        return

    catalog_items = {item.get("id"): item for item in broll_catalog.get("items", [])}
    if not catalog_items:
        return

    segments = plan.get("segments", [])
    if not segments:
        return

    highlights = plan.get("highlights", [])
    if not highlights:
        return

    def locate_segment(timecode: float) -> Optional[Dict[str, Any]]:
        for segment in segments:
            start = float(segment.get("sourceStart", 0.0))
            end = start + float(segment.get("duration", 0.0))
            if start <= timecode <= end:
                return segment
        return None

    assigned_ids: set[str] = set()

    for highlight in highlights:
        start = highlight.get("start")
        if not isinstance(start, (int, float)):
            continue

        segment = locate_segment(start)
        if not segment or segment.get("broll"):
            continue

        text_sources = [highlight.get("keyword") or ""]
        supporting = highlight.get("supportingTexts") or {}
        text_sources.extend(supporting.values())
        full_text = " ".join(filter(None, text_sources))
        if not full_text:
            continue

        broll_id = match_broll_id(full_text)
        if not broll_id or broll_id in assigned_ids:
            continue

        item = catalog_items.get(broll_id)
        if not item:
            continue

        segment["broll"] = {
            "id": item.get("id"),
            "file": item.get("file"),
            "mode": "overlay",
            "confidence": 2.0,
            "reasons": ["Highlight keyword match"],
        }
        segment.setdefault("notes", []).append(
            f"B-roll injected via highlight keyword: {item.get('id')}"
        )
        assigned_ids.add(broll_id)


def ensure_motion_from_highlights(
    plan: Dict[str, Any],
    motion_rules: Dict[str, Any] | None,
) -> None:
    if not motion_rules:
        motion_rules = {}

    segments = plan.get("segments", [])
    highlights = plan.get("highlights", [])
    if not segments or not highlights:
        return

    def locate_segment(timecode: float) -> Optional[Dict[str, Any]]:
        for segment in segments:
            start = float(segment.get("sourceStart", 0.0))
            end = start + float(segment.get("duration", 0.0))
            if start <= timecode <= end:
                return segment
        return None

    max_motions = max(1, math.ceil(len(segments) * float(motion_rules.get("motion_frequency", 0.5))))
    assigned = sum(1 for segment in segments if segment.get("motionCue"))

    for highlight in highlights:
        if assigned >= max_motions:
            break

        start = highlight.get("start")
        if not isinstance(start, (int, float)):
            continue

        segment = locate_segment(start)
        if not segment or segment.get("motionCue"):
            continue

        text_parts = [highlight.get("keyword") or ""]
        supporting = highlight.get("supportingTexts") or {}
        text_parts.extend(supporting.values())
        combined_text = " ".join(filter(None, text_parts)).lower()

        motion: Optional[str] = None
        if highlight.get("importance") == "primary" or any(ch.isdigit() for ch in combined_text):
            motion = "zoomIn"
        elif any(word in combined_text for word in motion_rules.get("zoom_out_keywords", [])):
            motion = "zoomOut"
        elif any(word in combined_text for word in motion_rules.get("pan_keywords", [])):
            motion = "pan"
        elif any(word in combined_text for word in motion_rules.get("shake_keywords", [])):
            motion = "shake"

        if not motion:
            continue

        segment["motionCue"] = motion
        segment.setdefault("notes", []).append(f"Motion cue injected from highlight: {motion}")
        assigned += 1
def augment_highlights_from_catalog(
    plan: Dict[str, Any],
    catalog: Dict[str, Any],
    min_gap: float = 0.4,
) -> List[Dict[str, Any]]:
    """
    Generates additional highlight entries from a structured catalog (e.g., video2.json)
    and appends them to the plan while avoiding duplicates.
    """
    timeline = catalog.get('video_timeline') or catalog.get('timeline') or []
    if not isinstance(timeline, list) or not timeline:
        return []

    highlights = plan.setdefault('highlights', [])
    existing_starts = [h.get('start') for h in highlights if isinstance(h.get('start'), (int, float))]

    injected: List[Dict[str, Any]] = []
    side_toggle = False
    for entry_index, entry in enumerate(timeline):
        elements = entry.get('elements') or []
        if not isinstance(elements, list):
            continue

        for element_index, element in enumerate(elements):
            highlight = build_highlight_from_overlay(entry_index, entry, element_index, element)
            if not highlight:
                continue

            start_time = highlight.get('start')
            if start_time is None:
                continue

            duplicate = any(abs(start_time - existing) <= min_gap for existing in existing_starts)
            if duplicate:
                continue

            layout = highlight.get('layout')

            if layout in {'left', 'right'} and isinstance(highlight.get('supportingTexts'), dict):
                desired = 'left' if not side_toggle else 'right'
                texts = highlight['supportingTexts']
                value = texts.get('topLeft') or texts.get('topRight')
                if value and desired != layout:
                    if desired == 'left':
                        highlight['supportingTexts'] = {'topLeft': value}
                        highlight['layout'] = 'left'
                        highlight['side'] = 'left'
                    else:
                        highlight['supportingTexts'] = {'topRight': value}
                        highlight['layout'] = 'right'
                        highlight['side'] = 'right'
                else:
                    highlight['side'] = layout
                side_toggle = not side_toggle
                highlight.setdefault('position', 'top')
            elif layout == 'dual':
                highlight.setdefault('position', 'top')
                highlight.pop('side', None)
            elif layout == 'bottom':
                highlight['side'] = 'bottom'
                highlight['position'] = 'bottom'

            highlights.append(highlight)
            injected.append(highlight)
            existing_starts.append(start_time)

    if injected:
        highlights.sort(key=lambda item: item.get('start', 0.0) or 0.0)

    return injected






def build_highlight_override(entry: Dict[str, Any], text_lower: str, start: float, duration: float) -> Optional[Dict[str, Any]]:
    highlight_id = f'srt-{entry["index"]:04d}'
    if 'epstein-barr' in text_lower:
        right = '32X MS RISK' if '32' in text_lower else ('THE KISSING DISEASE' if 'kissing' in text_lower else 'MONONUCLEOSIS')
        return {
            'id': highlight_id,
            'type': 'noteBox',
            'start': round(start, 2),
            'duration': round(duration, 2),
            'importance': 'supporting',
            'position': 'top',
            'layout': 'dual',
            'keyword': 'EPSTEIN-BARR VIRUS',
            'supportingTexts': {
                'topLeft': 'EPSTEIN-BARR VIRUS',
                'topRight': right,
            },
        }
    if "didn't know what caused" in text_lower:
        return {
            'id': highlight_id,
            'type': 'noteBox',
            'start': round(start, 2),
            'duration': round(duration, 2),
            'importance': 'supporting',
            'position': 'top',
            'layout': 'dual',
            'keyword': 'UNKNOWN CAUSE',
            'supportingTexts': {
                'topLeft': 'UNKNOWN CAUSE',
                'topRight': 'HARD TO TREAT',
            },
        }
    if '10 million' in text_lower and '20 year' in text_lower:
        return {
            'id': highlight_id,
            'type': 'noteBox',
            'start': round(start, 2),
            'duration': round(duration, 2),
            'importance': 'supporting',
            'position': 'top',
            'layout': 'dual',
            'keyword': '10 MILLION PEOPLE',
            'supportingTexts': {
                'topLeft': '10 MILLION PEOPLE',
                'topRight': '20 YEARS',
            },
        }
    if 'direct link' in text_lower and 'multiple sclerosis' in text_lower:
        return {
            'id': highlight_id,
            'type': 'noteBox',
            'start': round(start, 2),
            'duration': round(duration, 2),
            'importance': 'primary',
            'position': 'bottom',
            'side': 'bottom',
            'layout': 'bottom',
            'text': 'DIRECT LINK: EBV ? MS',
            'keyword': 'DIRECT LINK: EBV ? MS',
        }
    if 'multiple sclerosis' in text_lower and '32' in text_lower:
        return {
            'id': highlight_id,
            'type': 'noteBox',
            'start': round(start, 2),
            'duration': round(duration, 2),
            'importance': 'primary',
            'position': 'bottom',
            'side': 'bottom',
            'layout': 'bottom',
            'text': '32X MS RISK',
            'keyword': '32X MS RISK',
        }
    return None
def augment_highlights_from_srt(
    plan: Dict[str, Any],
    srt_path: Path,
    min_gap: float = 0.5,
) -> List[Dict[str, Any]]:
    entries = parse_srt_file(srt_path)
    if not entries:
        return []

    highlights = plan.setdefault('highlights', [])
    existing_starts = [
        h.get('start')
        for h in highlights
        if isinstance(h.get('start'), (int, float))
    ]

    injected: List[Dict[str, Any]] = []
    side_toggle = False
    bottom_cooldown = 0
    recent_phrases: set[str] = set()

    for entry in entries:
        start = max(0.0, entry['start'])
        duration = derive_duration_seconds(entry, entry) # Use dynamic duration

        # Check for overlap with existing highlights
        if any(overlap_seconds(start, start + duration, existing, existing + (h.get('duration') or 0.0)) > 0.0 for existing, h in zip(existing_starts, highlights)):
            continue

        # Check for phrases to blacklist
        if any(phrase in text_lower for phrase in BLACKLIST_PHRASES):
            continue

        if start < 0.6:
            continue

        raw_text = entry['text']
        clean = re.sub(r"[^A-Za-z0-9\s'%-]", " ", raw_text)
        words = [w for w in clean.split() if w]
        if not words:
            continue

        normalized_sentence = " ".join(words).lower()
        if normalized_sentence in recent_phrases:
            continue
        recent_phrases.add(normalized_sentence)
        text_lower = raw_text.lower()

        override = build_highlight_override(entry, text_lower, start, duration)
        if override:
            highlights.append(override)
            injected.append(override)
            existing_starts.append(start)
            bottom_cooldown = 0
            side_toggle = False
            continue
            continue

        contains_number = any(any(ch.isdigit() for ch in token) for token in words)
        contains_question = '?' in raw_text

        full_phrase = normalize_phrase(words, max_words=min(8, len(words)), max_chars=52)
        primary_text = normalize_phrase(words, max_words=4, max_chars=36)

        left_words, right_words = split_words_for_supporting(words)
        left_text = normalize_phrase(left_words, max_words=4, max_chars=32)
        right_text = normalize_phrase(right_words, max_words=4, max_chars=32) if right_words else ''

        if 'epstein-barr' in text_lower:
            left_text = 'EPSTEIN-BARR VIRUS'
            right_text = '32X MS RISK' if '32' in text_lower else ('THE KISSING DISEASE' if 'kissing' in text_lower else 'MONONUCLEOSIS')
        elif "didn't know what caused" in text_lower:
            left_text = 'UNKNOWN CAUSE'
            right_text = 'HARD TO TREAT'
        elif '10 million' in text_lower and '20 year' in text_lower:
            left_text = '10 MILLION PEOPLE'
            right_text = '20 YEARS'
        elif 'direct link' in text_lower and 'multiple sclerosis' in text_lower:
            left_text = 'DIRECT LINK'
            right_text = 'EBV ? MS'

        supporting: Dict[str, str] = {}
        should_bottom = contains_number or contains_question or len(words) <= 4
        if not should_bottom and (len(left_text) < 3 or left_text == right_text):
            should_bottom = True

        highlight: Dict[str, Any] = {
            'id': f'srt-{entry["index"]:04d}',
            'type': 'noteBox',
            'start': round(start, 2),
            'duration': round(duration, 2),
        }

        if should_bottom:
            highlight.update(
                {
                    'layout': 'bottom',
                    'importance': 'primary',
                    'position': 'bottom',
                    'side': 'bottom',
                    'text': full_phrase,
                    'keyword': full_phrase,
                }
            )
            bottom_cooldown = 0
        else:
            highlight['importance'] = 'supporting'
            highlight['position'] = 'top'
            highlight['keyword'] = primary_text

            if right_text:
                supporting['topLeft'] = left_text
                supporting['topRight'] = right_text
                highlight['supportingTexts'] = supporting
                highlight['layout'] = 'dual'
                highlight.pop('side', None)
            else:
                supporting_key = 'topLeft' if not side_toggle else 'topRight'
                supporting[supporting_key] = left_text
                highlight['supportingTexts'] = supporting
                highlight['layout'] = 'left' if not side_toggle else 'right'
                highlight['side'] = 'left' if not side_toggle else 'right'
                side_toggle = not side_toggle

            bottom_cooldown += 1

        highlights.append(highlight)
        injected.append(highlight)
        existing_starts.append(start)

    if injected:
        highlights.sort(key=lambda item: item.get('start', 0.0) or 0.0)

    return injected
BROLL_RULES: List[Tuple[set[str], str]] = [
    (set(["immune", "immune system", "autoimmune", "cells", "antibody"]), "digital_brain"),
    (set(["virus", "epstein", "barr", "infection", "mono"]), "digital_network"),
    (set(["study", "data", "million", "years", "research", "analysis"]), "data_analysis"),
    (set(["treatment", "therapy", "medicine", "care"]), "education_training"),
]


def match_broll_id(text: str) -> Optional[str]:
    lowered = text.lower()
    for keywords, broll_id in BROLL_RULES:
        if any(keyword in lowered for keyword in keywords):
            return broll_id
    return None


def ensure_broll_from_highlights(
    plan: Dict[str, Any],
    broll_catalog: Dict[str, Any] | None,
) -> None:
    if not broll_catalog:
        return

    catalog_items = {item.get("id"): item for item in broll_catalog.get("items", [])}
    if not catalog_items:
        return

    segments = plan.get("segments", [])
    if not segments:
        return

    highlights = plan.get("highlights", [])
    if not highlights:
        return

    def locate_segment(timecode: float) -> Optional[Dict[str, Any]]:
        for segment in segments:
            start = float(segment.get("sourceStart", 0.0))
            end = start + float(segment.get("duration", 0.0))
            if start <= timecode <= end:
                return segment
        return None

    assigned_ids: set[str] = set()

    for highlight in highlights:
        start = highlight.get("start")
        if not isinstance(start, (int, float)):
            continue

        segment = locate_segment(start)
        if not segment or segment.get("broll"):
            continue

        text_sources = [highlight.get("keyword") or ""]
        supporting = highlight.get("supportingTexts") or {}
        text_sources.extend(supporting.values())
        full_text = " ".join(filter(None, text_sources))
        if not full_text:
            continue

        broll_id = match_broll_id(full_text)
        if not broll_id or broll_id in assigned_ids:
            continue

        item = catalog_items.get(broll_id)
        if not item:
            continue

        segment["broll"] = {
            "id": item.get("id"),
            "file": item.get("file"),
            "mode": "overlay",
            "confidence": 2.0,
            "reasons": ["Highlight keyword match"],
        }
        segment.setdefault("notes", []).append(
            f"B-roll injected via highlight keyword: {item.get('id')}"
        )
        assigned_ids.add(broll_id)


def ensure_motion_from_highlights(
    plan: Dict[str, Any],
    motion_rules: Dict[str, Any] | None,
) -> None:
    if not motion_rules:
        motion_rules = {}

    segments = plan.get("segments", [])
    highlights = plan.get("highlights", [])
    if not segments or not highlights:
        return

    def locate_segment(timecode: float) -> Optional[Dict[str, Any]]:
        for segment in segments:
            start = float(segment.get("sourceStart", 0.0))
            end = start + float(segment.get("duration", 0.0))
            if start <= timecode <= end:
                return segment
        return None

    max_motions = max(1, math.ceil(len(segments) * float(motion_rules.get("motion_frequency", 0.5))))
    assigned = sum(1 for segment in segments if segment.get("motionCue"))

    for highlight in highlights:
        if assigned >= max_motions:
            break

        start = highlight.get("start")
        if not isinstance(start, (int, float)):
            continue

        segment = locate_segment(start)
        if not segment or segment.get("motionCue"):
            continue

        text_parts = [highlight.get("keyword") or ""]
        supporting = highlight.get("supportingTexts") or {}
        text_parts.extend(supporting.values())
        combined_text = " ".join(filter(None, text_parts)).lower()

        motion: Optional[str] = None
        if highlight.get("importance") == "primary" or any(ch.isdigit() for ch in combined_text):
            motion = "zoomIn"
        elif any(word in combined_text for word in motion_rules.get("zoom_out_keywords", [])):
            motion = "zoomOut"
        elif any(word in combined_text for word in motion_rules.get("pan_keywords", [])):
            motion = "pan"
        elif any(word in combined_text for word in motion_rules.get("shake_keywords", [])):
            motion = "shake"

        if not motion:
            continue

        segment["motionCue"] = motion
        segment.setdefault("notes", []).append(f"Motion cue injected from highlight: {motion}")
        assigned += 1
def augment_highlights_from_catalog(
    plan: Dict[str, Any],
    catalog: Dict[str, Any],
    min_gap: float = 0.4,
) -> List[Dict[str, Any]]:
    """
    Generates additional highlight entries from a structured catalog (e.g., video2.json)
    and appends them to the plan while avoiding duplicates.
    """
    timeline = catalog.get('video_timeline') or catalog.get('timeline') or []
    if not isinstance(timeline, list) or not timeline:
        return []

    highlights = plan.setdefault('highlights', [])
    existing_starts = [h.get('start') for h in highlights if isinstance(h.get('start'), (int, float))]

    injected: List[Dict[str, Any]] = []
    side_toggle = False
    for entry_index, entry in enumerate(timeline):
        elements = entry.get('elements') or []
        if not isinstance(elements, list):
            continue

        for element_index, element in enumerate(elements):
            highlight = build_highlight_from_overlay(entry_index, entry, element_index, element)
            if not highlight:
                continue

            start_time = highlight.get('start')
            if start_time is None:
                continue

            duplicate = any(abs(start_time - existing) <= min_gap for existing in existing_starts)
            if duplicate:
                continue

            layout = highlight.get('layout')

            if layout in {'left', 'right'} and isinstance(highlight.get('supportingTexts'), dict):
                desired = 'left' if not side_toggle else 'right'
                texts = highlight['supportingTexts']
                value = texts.get('topLeft') or texts.get('topRight')
                if value and desired != layout:
                    if desired == 'left':
                        highlight['supportingTexts'] = {'topLeft': value}
                        highlight['layout'] = 'left'
                        highlight['side'] = 'left'
                    else:
                        highlight['supportingTexts'] = {'topRight': value}
                        highlight['layout'] = 'right'
                        highlight['side'] = 'right'
                else:
                    highlight['side'] = layout
                side_toggle = not side_toggle
                highlight.setdefault('position', 'top')
            elif layout == 'dual':
                highlight.setdefault('position', 'top')
                highlight.pop('side', None)
            elif layout == 'bottom':
                highlight['side'] = 'bottom'
                highlight['position'] = 'bottom'

            highlights.append(highlight)
            injected.append(highlight)
            existing_starts.append(start_time)

    if injected:
        highlights.sort(key=lambda item: item.get('start', 0.0) or 0.0)

    return injected


def augment_highlights_from_srt(
    plan: Dict[str, Any],
    srt_path: Path,
    min_gap: float = 0.5,
) -> List[Dict[str, Any]]:
    entries = parse_srt_file(srt_path)
    if not entries:
        return []

    highlights = plan.setdefault('highlights', [])
    # Sort existing highlights by start time for efficient overlap checking
    highlights.sort(key=lambda h: h.get('start', 0.0))

    existing_starts = [
        h.get('start')
        for h in highlights
        if isinstance(h.get('start'), (int, float))
    ]

    injected: List[Dict[str, Any]] = []
    side_toggle = False
    bottom_cooldown = 0
    recent_phrases: set[str] = set()

    for entry in entries:
        start = max(0.0, entry['start'])
        duration = derive_duration_seconds(entry, entry) # Use dynamic duration

        # Check for overlap with existing highlights
        if any(overlap_seconds(start, start + duration, existing, existing + (h.get('duration') or 0.0)) > 0.0 for existing, h in zip(existing_starts, highlights)):
            continue

        # Skip highlights too early in the video
        if start < 0.6:
            continue

        raw_text = entry['text']
        text_lower = raw_text.lower()

        # Check for phrases to blacklist
        if any(phrase in text_lower for phrase in BLACKLIST_PHRASES):
            continue

        clean = re.sub(r"[^A-Za-z0-9\s'%-]", " ", raw_text)
        words = [w for w in clean.split() if w]
        if not words:
            continue

        normalized_sentence = " ".join(words).lower()
        if normalized_sentence in recent_phrases:
            continue
        recent_phrases.add(normalized_sentence)

        override = build_highlight_override(entry, text_lower, start, duration)
        if override:
            highlights.append(override)
            injected.append(override)
            existing_starts.append(start)
            bottom_cooldown = 0
            side_toggle = False
            continue

        contains_number = any(any(ch.isdigit() for ch in token) for token in words)
        contains_question = "?" in raw_text

        full_phrase = normalize_phrase(words, max_words=min(8, len(words)), max_chars=52)
        primary_text = normalize_phrase(words, max_words=4, max_chars=36)

        left_words, right_words = split_words_for_supporting(words)
        left_text = normalize_phrase(left_words, max_words=4, max_chars=32)
        right_text = normalize_phrase(right_words, max_words=4, max_chars=32) if right_words else ""

        supporting: Dict[str, str] = {}
        should_bottom = contains_number or contains_question or len(words) <= 4 or bottom_cooldown >= 2
        if not should_bottom and (len(left_text) < 3 or left_text == right_text):
            should_bottom = True

        highlight: Dict[str, Any] = {
            'id': f'srt-{entry["index"]:04d}',
            'type': 'noteBox',
            'start': round(start, 2),
            'duration': round(duration, 2),
        }

        if should_bottom:
            highlight.update(
                {
                    'layout': 'bottom',
                    'importance': 'primary',
                    'position': 'bottom',
                    'side': 'bottom',
                    'text': full_phrase,
                    'keyword': full_phrase,
                }
            )
            bottom_cooldown = 0
        else:
            highlight['importance'] = 'supporting'
            highlight['position'] = 'top'
            highlight['keyword'] = primary_text

            if right_text:
                supporting['topLeft'] = left_text
                supporting['topRight'] = right_text
                highlight['supportingTexts'] = supporting
                highlight['layout'] = 'dual'
                highlight.pop('side', None)
            else:
                supporting_key = 'topLeft' if not side_toggle else 'topRight'
                supporting[supporting_key] = left_text
                highlight['supportingTexts'] = supporting
                highlight['layout'] = 'left' if not side_toggle else 'right'
                highlight['side'] = 'left' if not side_toggle else 'right'
                side_toggle = not side_toggle

            bottom_cooldown += 1

        highlights.append(highlight)
        injected.append(highlight)
        existing_starts.append(start)

    if injected:
        highlights.sort(key=lambda item: item.get('start', 0.0) or 0.0)

    return injected


def strip_non_section_sfx(plan: Dict[str, Any]) -> None:
    """
    Removes sound effect metadata from non-section highlights to keep overlays subtle.
    """
    for highlight in plan.get('highlights', []):
        if highlight.get('type') != 'sectionTitle':
            highlight.pop('sfx', None)
            highlight.pop('gain', None)
            highlight.pop('ducking', None)


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------


@dataclass
class SceneSummary:
    """
    Represents a summary of a scene, aggregating various metadata from scene map segments.

    Attributes:
        start: The start time of the scene segment in seconds.
        end: The end time of the scene segment in seconds.
        topics: A list of dominant topics in the scene.
        highlight_score: A numerical score indicating the highlight potential of the scene.
        motion_candidates: A list of potential motion cues for the scene.
        tokens: A list of important tokens/keywords from the scene's transcript.
        text: The combined transcript text for the scene.
        cta: A boolean flag indicating if the scene contains a Call-to-Action.
        sfx_hints: A list of suggested SFX categories for the scene.
    """
    start: float
    end: float
    topics: List[str]
    highlight_score: float
    motion_candidates: List[str]
    tokens: List[str]
    text: str
    cta: bool
    sfx_hints: List[str]

    @property
    def duration(self) -> float:
        """Calculates the duration of the scene summary."""
        return max(0.0, self.end - self.start)


# ---------------------------------------------------------------------------
# Scene aggregation
# ---------------------------------------------------------------------------


def aggregate_scene_for_segment(
    plan_segment: Dict[str, Any], scene_segments: Iterable[Dict[str, Any]]
) -> SceneSummary | None:
    start = float(plan_segment.get("sourceStart", 0.0))
    end = start + float(plan_segment.get("duration", 0.0))
    if end <= start:
        return None

    topics_counter: Counter[str] = Counter()
    motion_candidates: List[str] = []
    tokens_counter: Counter[str] = Counter()
    sfx_hints_counter: Counter[str] = Counter()

    highlight_score_total = 0.0
    total_weight = 0.0
    texts: List[str] = []
    cta_flag = False

    for scene in scene_segments:
        scene_start = float(scene.get("start", 0.0))
        scene_end = float(scene.get("end", scene_start))
        weight = overlap_seconds(start, end, scene_start, scene_end)
        if weight <= 0:
            continue

        topics_counter.update(scene.get("topics") or [])
        for candidate in scene.get("motionCandidates") or []:
            motion_name = camel_case_motion(candidate)
            if motion_name and motion_name not in motion_candidates:
                motion_candidates.append(motion_name)
        tokens_counter.update(scene.get("tokens") or [])
        sfx_hints_counter.update(scene.get("sfxHints") or [])

        highlight_score = float(scene.get("highlightScore", 0.0))
        highlight_score_total += highlight_score * weight
        total_weight += weight

        if scene.get("textOneLine"):
            texts.append(scene["textOneLine"])
        cta_flag = cta_flag or bool(scene.get("cta"))

    if total_weight == 0:
        return None

    combined_text = " ".join(texts)
    averaged_highlight = highlight_score_total / total_weight if total_weight else 0.0

    tokens_sorted = [token for token, _ in tokens_counter.most_common(24)]
    sfx_hints = [hint for hint, _ in sfx_hints_counter.most_common(8)]

    return SceneSummary(
        start=start,
        end=end,
        topics=[topic for topic, _ in topics_counter.most_common(6)],
        highlight_score=averaged_highlight,
        motion_candidates=motion_candidates,
        tokens=tokens_sorted,
        text=combined_text,
        cta=cta_flag,
        sfx_hints=sfx_hints,
    )


# ---------------------------------------------------------------------------
# B-roll selection
# ---------------------------------------------------------------------------


def score_broll_item(item: Dict[str, Any], scene: SceneSummary) -> Tuple[float, List[str]]:
    score = 0.0
    reasons: List[str] = []

    item_topics = [topic.lower() for topic in item.get("topics") or []]
    scene_topics = [topic.lower() for topic in scene.topics]
    topic_overlap = set(item_topics) & set(scene_topics)
    if topic_overlap:
        score += 2.5 * len(topic_overlap)
        reasons.append(f"topics match {sorted(topic_overlap)}")

    keywords = [kw.lower() for kw in item.get("keywords") or []]
    token_hits = set(scene.tokens) & set(keywords)
    if token_hits:
        score += 1.0 * len(token_hits)
        reasons.append(f"keywords hit {sorted(token_hits)}")

    moods = [m.lower() for m in item.get("mood") or []]
    if scene.highlight_score >= 0.7 and moods:
        score += 0.4
        reasons.append("highlight scene prefers mood assets")

    if item.get("mediaType") == "video":
        score += 0.3
    if item.get("orientation") == "landscape":
        score += 0.1

    if not reasons:
        reasons.append("fallback")
    return score, reasons


def select_broll(scene: SceneSummary, catalog: Dict[str, Any], threshold: float) -> Dict[str, Any] | None:
    items = catalog.get("items") or []
    if not items:
        return None

    # Filter out items that are too short for the scene duration
    filtered_items = [item for item in items if float(item.get("duration", 0.0)) >= scene.duration * 0.8]
    if not filtered_items:
        return None

    best_item: Optional[Dict[str, Any]] = None
    best_score = 0.0
    best_reasons: List[str] = []

    for item in filtered_items:
        score, reasons = score_broll_item(item, scene)
        if score > best_score:
            best_item = item
            best_score = score
            best_reasons = reasons

    # Only select b-roll if the score is above the threshold and it's a high-impact scene
    if not best_item or best_score < threshold or scene.highlight_score < 0.6:
        return None

    return {
        "id": best_item.get("id"),
        "file": best_item.get("file"),
        "confidence": round(best_score, 2),
        "reasons": best_reasons,
        "mediaType": best_item.get("mediaType"),
        "orientation": best_item.get("orientation"),
    }


# ---------------------------------------------------------------------------
# Motion cue selection
# ---------------------------------------------------------------------------


def select_motion_cue(
    scene: SceneSummary,
    *,
    motion_rules: Dict[str, Any],
    assigned_so_far: int,
    total_segments: int,
) -> str | None:
    frequency = float(motion_rules.get("motion_frequency", 0.0))
    max_segments = math.ceil(total_segments * frequency) if frequency > 0 else total_segments
    if assigned_so_far >= max_segments:
        return None

    candidate = None
    # Prioritize explicit motion candidates from scene map
    if scene.motion_candidates:
        candidate = scene.motion_candidates[0]
    # Assign zoomIn for high-impact scenes (high highlight score)
    elif scene.highlight_score >= float(motion_rules.get("highlight_rate", 0.0)):
        candidate = "zoomIn"
    # Assign pan for scenes with moderate highlight score and longer duration
    elif scene.highlight_score >= 0.4 and scene.duration > 5.0:
        candidate = "pan"
    # Assign zoomOut for scenes with lower highlight score or as a contrast to zoomIn
    elif scene.highlight_score < 0.4 and scene.duration > 3.0:
        candidate = "zoomOut"

    return candidate


# ---------------------------------------------------------------------------
# CTA highlight logic
# ---------------------------------------------------------------------------


def ensure_cta_highlight(
    plan: Dict[str, Any],
    cta_candidates: List[Tuple[Dict[str, Any], SceneSummary]],
    sfx_catalog: Dict[str, Any] | None,
) -> None:
    highlights = plan.setdefault("highlights", [])
    if any("cta" in (h.get("id") or "").lower() or (h.get("type") == "cta") for h in highlights):
        return

    if not cta_candidates:
        return

    # pick the last CTA candidate (usually near outro)
    segment, scene = cta_candidates[-1]
    start = max(scene.start, segment.get("sourceStart", 0.0))
    duration = max(2.5, min(5.0, segment.get("duration", 4.0)))
    highlight_start = max(start, start + segment.get("duration", duration) - 3.0)

    applause_sfx = None
    if sfx_catalog:
        for category in sfx_catalog.get("categories", []):
            for item in category.get("items", []):
                if "applause" in (item.get("id") or ""):
                    applause_sfx = item.get("file") or f"assets/sfx/{category.get('id')}/{item.get('id')}"
                    break
            if applause_sfx:
                break

    highlights.append(
        {
            "id": "cta_subscribe",
            "type": "sectionTitle",
            "text": "Dang ky kenh de nhan video moi!",
            "start": round(highlight_start, 2),
            "duration": round(duration, 2),
            "position": "center",
            "animation": "float",
            "variant": "brand",
            "sfx": applause_sfx or "assets/sfx/emotion/applause.mp3",
            "volume": 0.7,
        }
    )


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------


def compute_timing_warnings(segments: List[Dict[str, Any]], tolerance: float = 0.05) -> List[str]:
    warnings: List[str] = []
    for prev, current in zip(segments, segments[1:]):
        prev_end = float(prev.get("sourceStart", 0.0)) + float(prev.get("duration", 0.0))
        gap = float(current.get("sourceStart", 0.0)) - prev_end
        if gap > tolerance:
            warnings.append(
                f"Gap of {gap:.2f}s between {prev.get('id')} and {current.get('id')}; consider extending previous duration."
            )
        elif gap < -tolerance:
            warnings.append(
                f"Overlap of {-gap:.2f}s between {prev.get('id')} and {current.get('id')}; verify segment timings."
            )
    return warnings


# ---------------------------------------------------------------------------
# Main enrichment workflow
# ---------------------------------------------------------------------------


def enrich_plan(
    plan: Dict[str, Any],
    scene_map: Dict[str, Any],
    *,
    broll_catalog: Dict[str, Any] | None,
    sfx_catalog: Dict[str, Any] | None,
    motion_rules: Dict[str, Any] | None,
    broll_threshold: float = 1.5,
) -> Tuple[Dict[str, Any], List[str]]:
    segments = plan.get("segments") or []
    scene_segments = scene_map.get("segments") or []
    motion_rules = motion_rules or {}

    total_segments = len(segments)
    assigned_motion = 0
    cta_candidates: List[Tuple[Dict[str, Any], SceneSummary]] = []
    warnings: List[str] = []

    for segment in segments:
        segment.setdefault("kind", "normal")

        scene_summary = aggregate_scene_for_segment(segment, scene_segments)
        if not scene_summary:
            segment.setdefault(
                "notes",
                []
            ).append("No matching scene metadata; skipped B-roll and motion cue.")
            continue

        notes: List[str] = []

        if broll_catalog:
            broll = select_broll(scene_summary, broll_catalog, broll_threshold)
            if broll:
                segment["broll"] = {
                    "id": broll["id"],
                    "file": broll["file"],
                    "mode": "overlay" if scene_summary.highlight_score < 0.85 else "full",
                    "confidence": broll["confidence"],
                    "reasons": broll["reasons"],
                }
                notes.append(f"B-roll assigned: {broll['id']} ({', '.join(broll['reasons'])})")
            else:
                notes.append("No B-roll match above threshold.")

        if motion_rules:
            motion_cue = select_motion_cue(
                scene_summary,
                motion_rules=motion_rules,
                assigned_so_far=assigned_motion,
                total_segments=total_segments,
            )
            if motion_cue:
                segment["motionCue"] = motion_cue
                assigned_motion += 1
                notes.append(f"Motion cue assigned: {motion_cue}")

        if scene_summary.cta:
            cta_candidates.append((segment, scene_summary))

        if scene_summary.sfx_hints and "sfxHints" not in segment:
            segment["sfxHints"] = scene_summary.sfx_hints
            notes.append(f"SFX hints propagated: {', '.join(scene_summary.sfx_hints)}")

        if notes:
            segment.setdefault("notes", []).extend(notes)

    ensure_cta_highlight(plan, cta_candidates, sfx_catalog)

    warnings.extend(compute_timing_warnings(segments))
    if warnings:
        plan.setdefault("meta", {}).setdefault("warnings", warnings)
    return plan, warnings


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main(argv: List[str] | None = None) -> int:
    """
    Main entry point for the script. Parses arguments, loads data,
    enriches the plan, and writes the output.

    Args:
        argv: Optional. A list of command-line arguments. Defaults to sys.argv.

    Returns:
        An exit code (0 for success, 1 for failure).
    """
    parser = argparse.ArgumentParser(description="Enrich plan.json with B-roll and motion cues.")
    parser.add_argument("plan_path", type=Path, help="Input plan.json from Gemini")
    parser.add_argument("output_path", type=Path, help="Output path for enriched plan")
    parser.add_argument(
        "--scene-map",
        dest="scene_map_path",
        type=Path,
        required=True,
        help="scene_map.json generated by generate_scene_map.py",
    )
    parser.add_argument(
        "--broll-catalog",
        dest="broll_catalog_path",
        type=Path,
        default=Path("assets/broll_catalog.json"),
        help="Path to broll_catalog.json (default: repo_root/assets/broll_catalog.json)",
    )
    parser.add_argument(
        "--sfx-catalog",
        dest="sfx_catalog_path",
        type=Path,
        default=Path("assets/sfx_catalog.json"),
        help="Path to sfx_catalog.json (default: repo_root/assets/sfx_catalog.json)",
    )
    parser.add_argument(
        "--motion-rules",
        dest="motion_rules_path",
        type=Path,
        default=Path("assets/motion_rules.json"),
        help="Path to motion_rules.json (default: repo_root/assets/motion_rules.json)",
    )
    parser.add_argument(
        "--highlight-catalog",
        dest="highlight_catalog_path",
        type=Path,
        help="Optional path to a structured text highlight catalog (e.g., video2.json)",
    )
    parser.add_argument(
        "--highlight-srt",
        dest="highlight_srt_path",
        type=Path,
        help="Optional path to an SRT file used to generate highlight captions",
    )
    parser.add_argument(
        "--broll-threshold",
        dest="broll_threshold",
        type=float,
        default=1.5,
        help="Minimum score required to attach B-roll (default: 1.5)",
    )

    args = parser.parse_args(argv)

    # Load input plan and scene map
    plan = load_json(args.plan_path)
    scene_map = load_json(args.scene_map_path)

    # Resolve repository root for loading catalogs
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent.parent

    def resolve(path: Path) -> Path:
        """Helper to resolve absolute or relative paths against the repository root."""
        return path if path.is_absolute() else (repo_root / path)

    # Load optional catalogs and rules
    broll_catalog = load_json(resolve(args.broll_catalog_path)) if args.broll_catalog_path else None
    sfx_catalog = load_json(resolve(args.sfx_catalog_path)) if args.sfx_catalog_path else None
    motion_rules = load_json(resolve(args.motion_rules_path)) if args.motion_rules_path else None
    highlight_catalog = (
        load_json(resolve(args.highlight_catalog_path))
        if args.highlight_catalog_path
        else None
    )
    highlight_srt_path = (
        resolve(args.highlight_srt_path)
        if args.highlight_srt_path
        else None
    )

    # Enrich the plan
    enriched_plan, warnings = enrich_plan(
        plan,
        scene_map,
        broll_catalog=broll_catalog,
        sfx_catalog=sfx_catalog,
        motion_rules=motion_rules,
        broll_threshold=args.broll_threshold,
    )

    if highlight_catalog:
        injected = augment_highlights_from_catalog(enriched_plan, highlight_catalog)
        if injected:
            enriched_plan.setdefault("meta", {}).setdefault(
                "highlightCatalog",
                str(args.highlight_catalog_path),
            )
            print(
                f"[INFO] Injected {len(injected)} highlight(s) from {args.highlight_catalog_path}"
            )

    if highlight_srt_path and highlight_srt_path.exists():
        injected_srt = augment_highlights_from_srt(enriched_plan, highlight_srt_path)
        if injected_srt:
            enriched_plan.setdefault("meta", {}).setdefault(
                "highlightSrt",
                str(highlight_srt_path),
            )
            print(
                f"[INFO] Injected {len(injected_srt)} SRT highlight(s) from {highlight_srt_path}"
            )

    ensure_broll_from_highlights(enriched_plan, broll_catalog)
    ensure_motion_from_highlights(enriched_plan, motion_rules)
    strip_non_section_sfx(enriched_plan)

    # Write the enriched plan to output
    write_json(enriched_plan, args.output_path)

    # Report any warnings
    if warnings:
        print("[WARN] Issues detected:")
        for warning in warnings:
            print(f"  - {warning}")
    print(f"[PLAN] Enriched plan written to {args.output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
