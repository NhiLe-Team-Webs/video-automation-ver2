from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple

import frontmatter
from markdown_it import MarkdownIt
from mdit_py_plugins.front_matter import front_matter_plugin


@dataclass
class MarkdownSection:
    heading: str
    level: int
    content: str


def _build_parser() -> MarkdownIt:
    md = MarkdownIt("commonmark", {"breaks": False, "html": False})
    md.enable(["table", "linkify"])
    md.use(front_matter_plugin)
    return md


MD = _build_parser()


def parse_markdown_document(raw_text: str) -> Tuple[Dict[str, str], List[MarkdownSection]]:
    """
    Parse markdown text into metadata and sections.
    Supports YAML front matter and heading-based sections.
    """
    post = frontmatter.loads(raw_text)
    tokens = MD.parse(post.content)
    sections: List[MarkdownSection] = []

    current_heading: str = ""
    current_level: int = 0
    buffer: List[str] = []

    def flush() -> None:
        if current_heading or buffer:
            sections.append(
                MarkdownSection(
                    heading=current_heading or "",
                    level=current_level,
                    content="\n".join(buffer).strip(),
                )
            )

    for token in tokens:
        if token.type == "heading_open":
            flush()
            buffer = []
            current_level = int(token.tag[1])
        elif token.type == "heading_close":
            continue
        elif token.type == "inline" and token.map:
            if tokens[tokens.index(token) - 1].type == "heading_open":
                current_heading = token.content.strip()
            else:
                buffer.append(token.content)
        elif token.children:
            buffer.append(token.content)

    flush()
    filtered_sections = [section for section in sections if section.content]
    return {str(k): str(v) for k, v in post.metadata.items()}, filtered_sections


def extract_headings(sections: Iterable[MarkdownSection]) -> List[Tuple[str, int]]:
    return [(section.heading, section.level) for section in sections if section.heading]
