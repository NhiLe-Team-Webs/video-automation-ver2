"""Utilities for converting knowledge-base assets into structured documents and embeddings."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Dict, Iterable, List, Sequence

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

from .markdown_parser import extract_headings, parse_markdown_document
from .models import (
    ElementDefinition,
    ExampleSnippet,
    GlossaryTerm,
    GuidelineRule,
    KnowledgeDocument,
    VectorisedChunk,
    DocumentType,
)
from .paths import (
    EMBEDDINGS_DATA_PATH,
    KNOWLEDGE_BASE_ROOT,
    OUTPUT_ROOT,
    SCHEMA_CACHE_PATH,
    STRUCTURED_DATA_PATH,
    ensure_output_dirs,
)
from .vector_store import Vectoriser


class KnowledgeBaseIngestor:
    def __init__(self, knowledge_root: Path | None = None) -> None:
        self.knowledge_root = knowledge_root or KNOWLEDGE_BASE_ROOT
        self.vectoriser = Vectoriser()

    def load(self) -> Dict[str, List[KnowledgeDocument]]:
        documents: Dict[str, List[KnowledgeDocument]] = {"markdown": [], "json": []}
        for path in sorted(self.knowledge_root.rglob("*")):
            if path.is_dir():
                continue
            if path.suffix.lower() == ".md":
                documents["markdown"].append(self._process_markdown(path))
            elif path.suffix.lower() == ".json":
                documents["json"].append(self._process_json(path))
        return documents

    def _process_markdown(self, path: Path) -> KnowledgeDocument:
        text = path.read_text(encoding="utf-8")
        metadata, sections = parse_markdown_document(text)
        headings = extract_headings(sections)
        processed_sections = [section.content for section in sections]
        return KnowledgeDocument(
            identifier=str(path.relative_to(self.knowledge_root)),
            title=metadata.get("title") or path.stem.replace("_", " ").title(),
            doc_type=DocumentType.MARKDOWN,
            path=str(path),
            headings=headings,
            sections=processed_sections,
            metadata=metadata,
        )

    def _process_json(self, path: Path) -> KnowledgeDocument:
        text = path.read_text(encoding="utf-8")
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON in {path}: {exc}") from exc

        if path.name.endswith("schema.json"):
            Draft202012Validator.check_schema(data)
        return KnowledgeDocument(
            identifier=str(path.relative_to(self.knowledge_root)),
            title=path.stem.replace("_", " ").title(),
            doc_type=DocumentType.JSON,
            path=str(path),
            metadata={"hash": hashlib.sha256(text.encode("utf-8")).hexdigest()},
        )

    def vectorise(self, documents: Iterable[KnowledgeDocument]) -> List[VectorisedChunk]:
        chunks: List[VectorisedChunk] = []
        for doc in documents:
            for idx, section in enumerate(doc.sections):
                if not section.strip():
                    continue
                vector = self.vectoriser.encode(section)
                chunk_id = f"{doc.identifier}::section_{idx}"
                chunks.append(
                    VectorisedChunk(
                        doc_id=doc.identifier,
                        chunk_id=chunk_id,
                        text=section,
                        metadata={
                            "title": doc.title,
                            "heading": doc.headings[idx][0] if idx < len(doc.headings) else "",
                            "path": doc.path,
                        },
                        vector=vector,
                    )
                )
        return chunks

    def persist(
        self,
        documents: Dict[str, List[KnowledgeDocument]],
        vector_chunks: Sequence[VectorisedChunk],
    ) -> None:
        ensure_output_dirs()
        STRUCTURED_DATA_PATH.write_text(
            json.dumps(
                {
                    "markdown": [doc.model_dump() for doc in documents["markdown"]],
                    "json": [doc.model_dump() for doc in documents["json"]],
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        EMBEDDINGS_DATA_PATH.write_text(
            json.dumps([chunk.__dict__ for chunk in vector_chunks], indent=2),
            encoding="utf-8",
        )
        SCHEMA_CACHE_PATH.write_text(
            json.dumps(
                {
                    doc.identifier: doc.metadata["hash"]
                    for doc in documents["json"]
                    if "hash" in doc.metadata
                },
                indent=2,
            ),
            encoding="utf-8",
        )


def sync_knowledge_base() -> Dict[str, List[KnowledgeDocument]]:
    ingestor = KnowledgeBaseIngestor()
    documents = ingestor.load()
    chunks = ingestor.vectorise(documents["markdown"])
    ingestor.persist(documents, chunks)
    return documents
