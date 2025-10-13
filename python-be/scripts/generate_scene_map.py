#!/usr/bin/env python3
"""Generate a structured scene map from an SRT transcript.

The output consolidates timing, topical tags, highlight heuristics, CTA flags,
and motion cue candidates so downstream planners (LLM or deterministic rules)
can orchestrate B-roll, SFX, and animations consistently.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

TIMECODE_RE = re.compile(
    r"^(?P<start>\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(?P<end>\d{2}:\d{2}:\d{2},\d{3})$"
)
TOKEN_RE = re.compile(r"[A-Za-zÀ-ỹ0-9]+" , re.UNICODE)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


@dataclass
class SrtEntry:
    index: int
    start: str
    end: str
    text: str

    @property
    def text_one_line(self) -> str:
        return " ".join(line.strip() for line in self.text.splitlines() if line.strip())


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------


def parse_timecode(value: str) -> float:
    hours, minutes, remainder = value.split(":")
    seconds, millis = remainder.split(",")
    return (
        int(hours) * 3600
        + int(minutes) * 60
        + int(seconds)
        + int(millis) / 1000
    )


def parse_srt(path: Path) -> List[SrtEntry]:
    content = path.read_text(encoding="utf-8")
    blocks = re.split(r"\n\s*\n", content.strip())
    entries: List[SrtEntry] = []

    for block in blocks:
        lines = [line for line in block.splitlines() if line.strip()]
        if len(lines) < 2:
            continue
        try:
            idx = int(lines[0])
        except ValueError:
            idx = len(entries) + 1

        time_match = TIMECODE_RE.match(lines[1])
        if not time_match:
            continue

        text = "\n".join(lines[2:]) if len(lines) > 2 else ""
        entries.append(
            SrtEntry(
                index=idx,
                start=time_match.group("start"),
                end=time_match.group("end"),
                text=text,
            )
        )

    return entries


def load_json(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def build_topic_index(broll_catalog: Dict[str, Any]) -> Dict[str, Iterable[str]]:
    topic_map: Dict[str, set[str]] = defaultdict(set)

    for item in broll_catalog.get("items", []):
        topics = item.get("topics") or []
        keywords = item.get("keywords") or []
        title = item.get("title", "")
        for topic in topics:
            topic_lower = topic.lower()
            topic_map[topic_lower].add(topic_lower)
            for word in TOKEN_RE.findall(topic_lower):
                topic_map[topic_lower].add(word)
            for keyword in keywords:
                for word in TOKEN_RE.findall(keyword.lower()):
                    topic_map[topic_lower].add(word)
            for word in TOKEN_RE.findall(title.lower()):
                topic_map[topic_lower].add(word)

    return topic_map


def normalize_text(text: str) -> str:
    return text.lower()


def tokenize(text: str) -> List[str]:
    return [token.lower() for token in TOKEN_RE.findall(text)]


def detect_topics(text_tokens: List[str], topic_index: Dict[str, Iterable[str]]) -> Tuple[List[str], Dict[str, int]]:
    counter: Dict[str, int] = {}
    text_token_set = Counter(text_tokens)

    for topic, keywords in topic_index.items():
        score = sum(text_token_set.get(keyword, 0) for keyword in keywords)
        if score:
            counter[topic] = score

    sorted_topics = sorted(counter.items(), key=lambda item: item[1], reverse=True)
    return [topic for topic, _ in sorted_topics[:5]], counter


def detect_emotion(text: str) -> Tuple[str, List[str]]:
    emotion_keywords = {
        "hype": ["amazing", "incredible", "thành công", "bứt phá", "đột phá", "celebrate", "thành tựu"],
        "confidence": ["tin tưởng", "chắc chắn", "đảm bảo", "guarantee", "bảo chứng"],
        "urgent": ["ngay", "ngay lập tức", "đừng bỏ lỡ", "right now", "deadline"],
        "serious": ["thách thức", "khó khăn", "trở ngại", "challenge"],
        "informative": ["thống kê", "số liệu", "data", "analytics"],
        "surprise": ["bất ngờ", "shock", "surprise", "không ngờ"],
    }

    hits: Dict[str, List[str]] = defaultdict(list)
    lowered = text.lower()
    for emotion, keywords in emotion_keywords.items():
        for keyword in keywords:
            if keyword in lowered:
                hits[emotion].append(keyword)

    if not hits:
        return "neutral", []

    best_emotion = max(hits.items(), key=lambda item: len(item[1]))[0]
    return best_emotion, [kw for kws in hits.values() for kw in kws]


def compute_highlight_score(text: str) -> Tuple[float, List[str]]:
    highlight_keywords = [
        "quan trọng",
        "key",
        "điểm chính",
        "đặc biệt",
        "chìa khóa",
        "kết quả",
        "giải pháp",
        "lợi ích",
        "đột phá",
        "chiến lược",
        "số liệu",
        "target",
        "goal",
        "kêu gọi",
        "nhớ",
        "focus",
        "highlight",
    ]
    lowered = text.lower()
    hits = [kw for kw in highlight_keywords if kw in lowered]
    numbers = re.findall(r"\b\d+(?:[\.,]\d+)?%?\b", text)
    exclamations = lowered.count("!") + lowered.count("!!!")

    score = 0.0
    score += min(len(hits) * 0.18, 0.6)
    score += min(len(numbers) * 0.15, 0.3)
    score += min(exclamations * 0.1, 0.2)

    return min(score, 1.0), hits + numbers


def detect_cta(text: str) -> Tuple[bool, List[str]]:
    cta_keywords = [
        "đăng ký",
        "subscribe",
        "theo dõi",
        "liên hệ",
        "đăng nhập",
        "đăng ký kênh",
        "call to action",
        "cta",
        "kêu gọi",
        "sign up",
        "subscribe now",
        "hành động ngay",
    ]
    lowered = text.lower()
    triggers = [kw for kw in cta_keywords if kw in lowered]
    return bool(triggers), triggers


def load_motion_rules(root: Path) -> Dict[str, Any]:
    motion_path = root / "assets" / "motion_rules.json"
    motion_rules = load_json(motion_path)
    motion_keywords: Dict[str, List[str]] = {}

    for key, value in motion_rules.items():
        if key.endswith("_keywords") and isinstance(value, list):
            cue = key.replace("_keywords", "")
            motion_keywords[cue] = [item.lower() for item in value]

    motion_rules["_motion_keywords"] = motion_keywords
    return motion_rules


def detect_motion_cues(text: str, motion_rules: Dict[str, Any]) -> List[str]:
    lowered = text.lower()
    candidates: List[str] = []
    motion_keywords: Dict[str, List[str]] = motion_rules.get("_motion_keywords", {})
    for cue, keywords in motion_keywords.items():
        if any(keyword in lowered for keyword in keywords):
            candidates.append(cue)
    return candidates


def detect_sfx_hints(text: str, highlight_score: float, cta_flag: bool) -> List[str]:
    lowered = text.lower()
    hints: List[str] = []
    if highlight_score >= 0.55:
        hints.append("emphasis")
    if any(word in lowered for word in ["wow", "whoa", "bất ngờ", "surprise"]):
        hints.append("whoosh")
    if any(word in lowered for word in ["chúc mừng", "celebrate", "thành công", "chiến thắng"]):
        hints.append("emotion")
    if any(word in lowered for word in ["click", "nhấp", "button", "giao diện", "ứng dụng"]):
        hints.append("ui")
    if any(word in lowered for word in ["công nghệ", "ai", "digital", "robot"]):
        hints.append("tech")
    if cta_flag:
        hints.append("cta")
    if not hints and "?" in text:
        hints.append("question")
    return sorted(set(hints))


# ---------------------------------------------------------------------------
# Core generation logic
# ---------------------------------------------------------------------------


def generate_scene_map(
    entries: List[SrtEntry],
    *,
    topic_index: Dict[str, Iterable[str]],
    motion_rules: Dict[str, Any],
    fps: float,
) -> Dict[str, Any]:
    scenes: List[Dict[str, Any]] = []
    topic_totals: Counter[str] = Counter()
    highlight_count = 0
    cta_count = 0

    parallax_enabled = bool(motion_rules.get("parallax"))
    motion_frequency = float(motion_rules.get("motion_frequency", 0.0))
    highlight_rate = float(motion_rules.get("highlight_rate", 0.0))

    for entry in entries:
        text_one_line = entry.text_one_line
        text_tokens = tokenize(text_one_line)
        topics, topic_scores = detect_topics(text_tokens, topic_index)
        emotion, emotion_hits = detect_emotion(text_one_line)
        highlight_score, highlight_hits = compute_highlight_score(text_one_line)
        cta_flag, cta_hits = detect_cta(text_one_line)
        motion_candidates = detect_motion_cues(text_one_line, motion_rules)
        sfx_hints = detect_sfx_hints(text_one_line, highlight_score, cta_flag)

        start_seconds = parse_timecode(entry.start)
        end_seconds = parse_timecode(entry.end)
        duration = max(end_seconds - start_seconds, 0.0)

        start_frame = int(round(start_seconds * fps))
        end_frame = int(round(end_seconds * fps))

        topic_totals.update(topics)
        if highlight_score >= highlight_rate:
            highlight_count += 1
        if cta_flag:
            cta_count += 1

        scenes.append(
            {
                "id": entry.index,
                "start": start_seconds,
                "end": end_seconds,
                "duration": duration,
                "startFrame": start_frame,
                "endFrame": end_frame,
                "text": entry.text,
                "textOneLine": text_one_line,
                "tokens": text_tokens,
                "topics": topics,
                "topicScores": topic_scores,
                "emotion": emotion,
                "emotionTriggers": emotion_hits,
                "highlightScore": round(highlight_score, 4),
                "highlightTriggers": highlight_hits,
                "cta": cta_flag,
                "ctaTriggers": cta_hits,
                "motionCandidates": motion_candidates,
                "parallaxEligible": parallax_enabled and highlight_score >= highlight_rate,
                "sfxHints": sfx_hints,
                "rawTextLength": len(text_one_line),
            }
        )

    total_duration = entries[-1].end if entries else "00:00:00,000"
    summary = {
        "totalSegments": len(scenes),
        "estimatedDurationSeconds": parse_timecode(total_duration) if entries else 0.0,
        "highlightSegments": highlight_count,
        "ctaSegments": cta_count,
        "motionFrequencyConfig": motion_frequency,
        "highlightRateConfig": highlight_rate,
        "topTopics": [
            {"topic": topic, "count": count}
            for topic, count in topic_totals.most_common(8)
        ],
    }

    return {
        "version": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "fps": fps,
        "motionRules": {
            "parallax": parallax_enabled,
            "motion_frequency": motion_frequency,
            "highlight_rate": highlight_rate,
        },
        "segments": scenes,
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def resolve_output_path(input_path: Path, output_arg: Path | None) -> Path:
    if output_arg:
        target = output_arg
    else:
        target = input_path.with_suffix(".scene_map.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    return target


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate scene_map.json from SRT transcript.")
    parser.add_argument("srt_path", type=Path, help="Input SRT file")
    parser.add_argument(
        "-o",
        "--output",
        dest="output_path",
        type=Path,
        help="Destination JSON path (default: alongside SRT)",
    )
    parser.add_argument(
        "--fps",
        type=float,
        default=30.0,
        help="Frame rate used to derive frame counts (default: 30)",
    )

    args = parser.parse_args(argv)
    if not args.srt_path.exists():
        parser.error(f"SRT file not found: {args.srt_path}")

    entries = parse_srt(args.srt_path)
    if not entries:
        parser.error("No valid entries found in SRT")

    repo_root = Path(__file__).resolve().parents[2]
    broll_catalog = load_json(repo_root / "assets" / "broll_catalog.json")
    topic_index = build_topic_index(broll_catalog)

    motion_rules = load_motion_rules(repo_root)

    scene_map = generate_scene_map(
        entries,
        topic_index=topic_index,
        motion_rules=motion_rules,
        fps=args.fps,
    )

    scene_map["source"] = str(args.srt_path)
    scene_map["catalogs"] = {
        "broll": bool(broll_catalog),
        "motionRules": bool(motion_rules),
    }

    output_path = resolve_output_path(args.srt_path, args.output_path)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(scene_map, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    print(f"[SCENE MAP] Saved to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
