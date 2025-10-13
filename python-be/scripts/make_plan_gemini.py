﻿"""Generate a flexible edit plan via Gemini LLM."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List

import google.generativeai as genai
from dotenv import load_dotenv

TIMECODE_RE = re.compile(r"^(?P<start>\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(?P<end>\d{2}:\d{2}:\d{2},\d{3})$")
JSON_BLOCK_RE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)

SFX_EXTENSIONS = {".mp3", ".wav", ".ogg"}


def _humanize_sfx_description(relative_path: Path) -> str:
    category = relative_path.parent.name if relative_path.parent != Path(".") else "mix"
    base = relative_path.stem.replace("-", " ").replace("_", " ")
    category_title = category.replace("-", " ").replace("_", " ").title()
    base_title = base.title()
    return f"{category_title}: {base_title}"


def discover_available_sfx() -> Dict[str, str]:
    root_dir = Path(__file__).resolve().parents[2]
    sfx_dir = root_dir / "assets" / "sfx"
    available: Dict[str, str] = {}

    if not sfx_dir.exists():
        return available

    for asset in sorted(sfx_dir.rglob("*")):
        if not asset.is_file() or asset.suffix.lower() not in SFX_EXTENSIONS:
            continue
        relative_path = asset.relative_to(sfx_dir)
        key = relative_path.as_posix()
        description = _humanize_sfx_description(relative_path)
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
    lookup: Dict[str, str] = {}
    for key in AVAILABLE_SFX.keys():
        lower_key = key.lower()
        lookup.setdefault(lower_key, key)
        name = Path(key).name.lower()
        lookup.setdefault(name, key)
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
    hours, minutes, remainder = value.split(":")
    seconds, millis = remainder.split(",")
    return int(hours) * 3600 + int(minutes) * 60 + int(seconds) + int(millis) / 1000


def parse_srt(path: Path, *, max_entries: int | None = None) -> List[SrtEntry]:
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
        match = TIMECODE_RE.match(lines[1])
        if not match:
            continue
        text = "\n".join(lines[2:]) if len(lines) > 2 else ""
        entries.append(SrtEntry(index=idx, start=match.group("start"), end=match.group("end"), text=text))
        if max_entries and len(entries) >= max_entries:
            break
    return entries


def _format_available(values: Iterable[str]) -> str:
    return ", ".join(values)


def build_prompt(entries: Iterable[SrtEntry], *, extra_instructions: str | None = None) -> str:
    timeline_lines = []
    for entry in entries:
        snippet = entry.text_one_line
        timeline_lines.append(f"{entry.index}. [{entry.start} -> {entry.end}] {snippet}")
    transcript_section = "\n".join(timeline_lines)

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

    sfx_names = _format_available(AVAILABLE_SFX.keys())
    sfx_notes = "; ".join(f"{name}: {desc}" for name, desc in AVAILABLE_SFX.items())
    transition_types = _format_available(TRANSITION_TYPES)
    transition_directions = _format_available(TRANSITION_DIRECTIONS)
    highlight_positions = _format_available(HIGHLIGHT_POSITIONS)
    highlight_animations = _format_available(HIGHLIGHT_ANIMATIONS)

    instructions = (
        "Bạn là editor phụ trợ. Tạo JSON plan cho Remotion với các segment cắt gọn, transition mượt, highlight text và SFX hợp lý. "
        "Giữ tổng thể cinematic, tránh spam hiệu ứng."
    )
    if extra_instructions:
        instructions += f" Extra guidance from user: {extra_instructions.strip()}"

    prompt = (
        f"{instructions}\n\n"
        "Xuất JSON hợp lệ đúng schema (ví dụ dưới chỉ minh họa, hãy cập nhật giá trị thực tế):\n"
        f"{json.dumps(schema_hint, indent=2)}\n\n"
        "Rules:\n"
        "- `segments` chứa các đoạn theo timeline với `sourceStart` (giây trong video gốc) và `duration`. Có thể thêm `label` mô tả ngắn.\n"
        "- `transitionIn`/`transitionOut` dùng `type` thuộc: "
        + transition_types
        + "; nếu `type` là `slide` có thể thêm `direction`: "
        + transition_directions
        + "; với `zoom`/`scale`/`rotate`/`blur` có thể set `intensity` trong khoảng 0.1-0.35 để kiểm soát độ mạnh.\n"
        "- Trim/merge câu khi khoảng lặng > ~0.7s trừ khi cần giữ nhịp cảm xúc.\n"
        f"- Chỉ tạo tối đa {MAX_HIGHLIGHTS} highlight mạnh nhất. Duy trì mỗi highlight 2-4s.\n"
        "- `highlights` mô tả khoảnh khắc cần nhấn mạnh. Với highlight chữ, cung cấp `type` (noteBox/typewriter/sectionTitle), `text`, `start`, `duration`, `position` ("
        + highlight_positions
        + "), `animation` ("
        + highlight_animations
        + "), `variant` (blurred/brand/cutaway/typewriter) và `sfx` nếu cần.\n"
        "- Để tạo highlight icon, dùng `type: \"icon\"` với `name` (tiêu đề ngắn), `icon` (ví dụ: `launch`, `fa:robot`), tùy chọn `accentColor`, `backgroundColor`, `iconColor`, `animation` ("
        + highlight_animations
        + ") cùng `sfx`/`volume` nếu phù hợp.\n"
        "- Luon chen it nhat mot highlight `type: \"icon\"` neu transcript co diem gioi thieu san pham, thanh tuu hoac closing cam xuc; chon icon phu hop va giu animation gon gang (float/pulse/pop).\n"
        "- SFX phải chọn từ thư viện assets/sfx với path tương đối (vd: assets/sfx/ui/pop.mp3 hoặc ui/pop.mp3). Danh sách: "
        + sfx_names
        + ". Gợi ý: "
        + sfx_notes
        + "\n"
        "- Nếu highlight có SFX, đặt `start` khớp moment cần nhấn và cân nhắc `volume` (0-1).\n"
        "- Đảm bảo các segment nối tiếp nhau không bị gap thời gian.\n"
        "- Chỉ trả về JSON trong một code block.\n\n"
        "Transcript segments (ordered):\n"
        f"{transcript_section}\n"
    )
    return prompt


def extract_plan_json(text: str) -> dict:
    candidates: List[str] = []
    for match in JSON_BLOCK_RE.finditer(text):
        candidates.append(match.group(1).strip())
    if not candidates:
        candidates.append(text.strip())

    last_error: Exception | None = None
    for candidate in candidates:
        for cleaned in (candidate, candidate.replace("\r", "")):
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError as exc:
                last_error = exc
                continue
    raise ValueError(f"Could not parse JSON from LLM response: {last_error}")


def ensure_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def ensure_bool(value: Any, default: bool = False) -> bool:
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
    if value is None:
        return None
    if isinstance(value, str):
        normalized = value.strip().lower().replace("-", "").replace("_", "").replace(" ", "")
        if not normalized:
            return None
        if normalized in {"broll", "brollplaceholder", "placeholderbroll"}:
            return "broll"
        return "broll" if "broll" in normalized else "normal"
    return "normal"


def normalize_sfx_name(value: Any) -> str | None:
    if value is None:
        return None
    candidate = str(value).strip()
    if not candidate:
        return None
    candidate_normalized = candidate.replace("\\", "/").lstrip("./")
    if candidate_normalized.startswith("assets/"):
        candidate_normalized = candidate_normalized[7:]
    if candidate_normalized.startswith("sfx/"):
        candidate_normalized = candidate_normalized[4:]

    checks = [
        candidate_normalized.lower(),
        Path(candidate_normalized).name.lower(),
        Path(candidate_normalized).stem.lower(),
    ]

    for key in checks:
        if not key:
            continue
        match = SFX_LOOKUP.get(key)
        if match:
            return match

    return None


def normalize_camera_movement(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip().lower().replace(" ", "").replace("-", "").replace("_", "")
    if normalized in {"zoomin", "pushin", "push"}:
        return "zoomIn"
    if normalized in {"zoomout", "pullback", "pull"}:
        return "zoomOut"
    return None


def normalize_transition(value: Any) -> Dict[str, Any] | None:
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

    if transition_type not in TRANSITION_TYPES:
        transition_type = "cut"

    if transition_type == "cut":
        return {"type": "cut"}

    duration_value = duration_value if duration_value and duration_value > 0 else 0.6
    duration_value = max(0.1, min(duration_value, 3.0))

    if intensity_value is not None and intensity_value <= 0:
        intensity_value = None
    if intensity_value is not None:
        intensity_value = round(max(0.05, min(float(intensity_value), 0.6)), 3)

    transition: Dict[str, Any] = {
        "type": transition_type,
        "duration": round(duration_value, 3),
    }

    if transition_type == "slide" and direction in TRANSITION_DIRECTIONS:
        transition["direction"] = direction

    if transition_type in {"zoom", "scale", "rotate", "blur"} and intensity_value:
        transition["intensity"] = intensity_value

    return transition


def normalize_highlight_item(raw: Dict[str, Any], index: int) -> Dict[str, Any] | None:
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

    text = (raw.get("text") or raw.get("caption") or "").strip()
    title = (raw.get("title") or "").strip()
    subtitle = (raw.get("subtitle") or "").strip()
    badge = (raw.get("badge") or "").strip()
    name = (raw.get("name") or raw.get("label") or "").strip()
    icon_value = (raw.get("icon") or raw.get("iconName") or "").strip()

    has_icon_marker = bool(icon_value or (name and not highlight_type))
    resolved_highlight_type = highlight_type or ("icon" if has_icon_marker else None)

    if not any([text, title, subtitle, badge, name, icon_value]):
        return None

    start = ensure_float(raw.get("start", raw.get("time", 0.0)), 0.0)
    start = max(0.0, start)

    duration = ensure_float(raw.get("duration", raw.get("length", 0.0)), DEFAULT_HIGHLIGHT_DURATION)
    if duration <= 0:
        end_time = ensure_float(raw.get("end"))
        if end_time > start:
            duration = end_time - start
    if duration <= 0:
        duration = DEFAULT_HIGHLIGHT_DURATION
    duration = max(1.5, min(duration, 5.0))

    position = (raw.get("position") or raw.get("placement") or "center").lower()
    if position not in HIGHLIGHT_POSITIONS:
        position = "center"

    animation_raw = raw.get("animation") or raw.get("style") or raw.get("motion")
    animation_default = "pop" if resolved_highlight_type == "icon" else "fade"
    animation_key = ""
    if isinstance(animation_raw, str):
        animation_key = animation_raw.strip().lower().replace(" ", "").replace("-", "").replace("_", "")
    animation_map = {
        "fade": "fade",
        "fadein": "fade",
        "zoom": "zoom",
        "zoomin": "zoom",
        "punch": "pop",
        "punchin": "pop",
        "pop": "pop",
        "popin": "pop",
        "bounce": "bounce",
        "float": "float",
        "floating": "float",
        "flip": "flip",
        "spin": "spin",
        "rotate": "spin",
        "typewriter": "typewriter",
        "pulse": "pulse",
        "breath": "pulse",
        "beat": "pulse",
        "slide": "slide",
        "slideup": "slide",
        "slidedown": "slide",
        "slideleft": "slide",
        "slideright": "slide",
    }
    animation = animation_map.get(animation_key, animation_default)

    highlight: Dict[str, Any] = {
        "id": str(raw.get("id") or f"highlight-{index + 1:02d}"),
        "start": round(start, 3),
        "duration": round(duration, 3),
        "position": position,
        "animation": animation,
    }

    if resolved_highlight_type:
        highlight["type"] = resolved_highlight_type
    elif text:
        highlight["type"] = "noteBox"

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

    asset = (raw.get("asset") or raw.get("media") or "").strip()
    if asset:
        highlight["asset"] = asset

    variant_raw = raw.get("variant") or raw.get("layout") or raw.get("styleVariant")
    if variant_raw:
        variant_key = str(variant_raw).strip().lower().replace(" ", "").replace("-", "").replace("_", "")
        variant_map = {
            "callout": "callout",
            "default": "callout",
            "bubble": "callout",
            "blur": "blurred",
            "blurred": "blurred",
            "blurredbackdrop": "blurred",
            "brand": "brand",
            "brandpanel": "brand",
            "cutaway": "cutaway",
            "black": "cutaway",
            "typewriter": "typewriter",
        }
        normalized_variant = variant_map.get(variant_key)
        if normalized_variant in HIGHLIGHT_VARIANTS:
            highlight["variant"] = normalized_variant

    sfx_value = raw.get("sfx") or raw.get("asset") or raw.get("sound")
    sfx_name = normalize_sfx_name(sfx_value)
    if sfx_name:
        if not sfx_name.lower().startswith("assets/"):
            if sfx_name.lower().startswith("sfx/"):
                sfx_name = f"assets/{sfx_name}"
            else:
                sfx_name = f"assets/sfx/{sfx_name}"
        highlight["sfx"] = sfx_name

    accent_color = raw.get("accentColor") or raw.get("accent")
    if isinstance(accent_color, str) and accent_color.strip():
        highlight["accentColor"] = accent_color.strip()

    background_color = raw.get("backgroundColor") or raw.get("background") or raw.get("bg")
    if isinstance(background_color, str) and background_color.strip():
        highlight["backgroundColor"] = background_color.strip()

    icon_color = raw.get("iconColor") or raw.get("iconColour")
    if isinstance(icon_color, str) and icon_color.strip():
        highlight["iconColor"] = icon_color.strip()

    side = (raw.get("side") or raw.get("alignment") or "").strip().lower()
    if side in {"top", "bottom", "left", "right"}:
        highlight["side"] = side

    radius = raw.get("radius")
    if radius is not None:
        try:
            radius_float = float(radius)
        except (TypeError, ValueError):
            radius_float = None
        if radius_float is not None and radius_float > 0:
            highlight["radius"] = round(radius_float, 3)

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
    if not isinstance(plan, dict):
        raise ValueError("Plan must be a JSON object.")

    segment_items: List[tuple[float, Dict[str, Any]]] = []
    raw_segments = plan.get("segments")
    if isinstance(raw_segments, list):
        for index, raw_segment in enumerate(raw_segments):
            if not isinstance(raw_segment, dict):
                continue
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

            label = (raw_segment.get("label") or raw_segment.get("title") or "").strip()
            if label:
                segment_plan["label"] = label

            title_value = raw_segment.get("title")
            if isinstance(title_value, str):
                title_clean = title_value.strip()
                if title_clean:
                    segment_plan["title"] = title_clean

            silence_after_raw = None
            for key in ("silenceAfter", "silence_after"):
                if key in raw_segment:
                    silence_after_raw = raw_segment.get(key)
                    break
            if silence_after_raw is not None:
                segment_plan["silenceAfter"] = ensure_bool(silence_after_raw)
            else:
                segment_plan["silenceAfter"] = False

            gap_after_raw = None
            for key in ("gapAfter", "gap_after"):
                if key in raw_segment:
                    gap_after_raw = raw_segment.get(key)
                    break
            if gap_after_raw is not None:
                segment_plan["gapAfter"] = ensure_bool(gap_after_raw)

            playback_raw = raw_segment.get("playbackRate", raw_segment.get("speed"))
            if playback_raw is not None:
                playback_rate = ensure_float(playback_raw, 1.0)
                if playback_rate <= 0:
                    playback_rate = 1.0
                if abs(playback_rate - 1.0) > 1e-3:
                    segment_plan["playbackRate"] = round(playback_rate, 3)

            transition_in = normalize_transition(
                raw_segment.get("transitionIn")
                or raw_segment.get("transition_in")
                or raw_segment.get("enterTransition")
            )
            if transition_in:
                segment_plan["transitionIn"] = transition_in

            transition_out = normalize_transition(
                raw_segment.get("transitionOut")
                or raw_segment.get("transition_out")
                or raw_segment.get("exitTransition")
            )
            if transition_out:
                segment_plan["transitionOut"] = transition_out

            metadata_raw = raw_segment.get("metadata")
            metadata_camera = metadata_raw.get("cameraMovement") if isinstance(metadata_raw, dict) else None
            camera_movement = normalize_camera_movement(
                raw_segment.get("cameraMovement")
                or raw_segment.get("camera_movement")
                or metadata_camera
            )
            if camera_movement:
                segment_plan["cameraMovement"] = camera_movement

            if isinstance(metadata_raw, dict) and metadata_raw:
                segment_plan["metadata"] = metadata_raw

            timeline_start = ensure_float(
                raw_segment.get("timelineStart", raw_segment.get("timeline_start")),
                source_start,
            )
            segment_items.append((timeline_start, segment_plan))

    segment_items.sort(key=lambda item: (item[0], item[1]["sourceStart"]))
    normalized_segments = [item[1] for item in segment_items]

    raw_highlights: List[Any] = []
    if isinstance(plan.get("highlights"), list):
        raw_highlights = list(plan["highlights"])
    elif isinstance(plan.get("actions"), list):
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

    normalized_highlights.sort(key=lambda item: item.get("start", 0.0))

    normalized_plan: Dict[str, Any] = {
        "segments": normalized_segments,
        "highlights": normalized_highlights,
    }

    if "meta" in plan:
        normalized_plan["meta"] = plan["meta"]

    return normalized_plan


def configure_client(model_name: str | None = None) -> genai.GenerativeModel:
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
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(plan, handle, indent=2)
        handle.write("\n")


def main(argv: List[str] | None = None) -> int:
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

    args = parser.parse_args(argv)

    if not args.srt_path.exists():
        parser.error(f"SRT file not found: {args.srt_path}")

    entries = parse_srt(args.srt_path, max_entries=args.max_entries)
    if not entries:
        parser.error("No valid entries found in SRT")

    prompt = build_prompt(entries, extra_instructions=args.extra_instructions)

    if args.dry_run:
        print(prompt)
        return 0

    try:
        model = configure_client(args.model_name)
    except Exception as exc:  # noqa: BLE001 - surface friendly message
        print(f"[ERROR] {exc}")
        return 1

    try:
        response = model.generate_content(prompt)
    except Exception as exc:  # noqa: BLE001 - Gemini client may raise many types
        print(f"[ERROR] Gemini request failed: {exc}")
        return 1

    raw_text = getattr(response, "text", None)
    if not raw_text:
        print("[ERROR] Empty response from Gemini")
        return 1

    try:
        plan = extract_plan_json(raw_text)
        plan = normalize_plan(plan)
    except ValueError as exc:
        print(f"[ERROR] {exc}")
        print("--- Gemini response ---")
        print(raw_text)
        print("--- end response ---")
        return 1

    dump_plan(plan, args.output_plan)
    print(f"[PLAN] Saved Gemini plan to {args.output_plan}")
    return 0


if __name__ == "__main__":
    sys.exit(main())



