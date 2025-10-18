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
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


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

    best_item: Optional[Dict[str, Any]] = None
    best_score = 0.0
    best_reasons: List[str] = []

    for item in items:
        score, reasons = score_broll_item(item, scene)
        if score > best_score:
            best_item = item
            best_score = score
            best_reasons = reasons

    if not best_item or best_score < threshold:
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
    if scene.motion_candidates:
        candidate = scene.motion_candidates[0]
    elif scene.highlight_score >= float(motion_rules.get("highlight_rate", 0.0)):
        candidate = "zoomIn"

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

    # Enrich the plan
    enriched_plan, warnings = enrich_plan(
        plan,
        scene_map,
        broll_catalog=broll_catalog,
        sfx_catalog=sfx_catalog,
        motion_rules=motion_rules,
        broll_threshold=args.broll_threshold,
    )

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
