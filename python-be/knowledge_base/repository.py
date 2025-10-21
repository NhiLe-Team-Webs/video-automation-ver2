"""Convenience layer for loading cached knowledge documents and running retrieval/validation helpers."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from .graph import build_knowledge_graph
from .models import KnowledgeDocument, ValidationReport, ValidationIssue
from .paths import (
    EMBEDDINGS_DATA_PATH,
    OUTPUT_ROOT,
    STRUCTURED_DATA_PATH,
    ensure_output_dirs,
)
from .vector_store import InMemoryVectorStore, Vectoriser, VectorSearchResult


class KnowledgeRepository:
    def __init__(self, output_root: Path | None = None) -> None:
        self.output_root = output_root or OUTPUT_ROOT
        ensure_output_dirs()
        self._documents: Dict[str, List[KnowledgeDocument]] | None = None
        self._vector_store: Optional[InMemoryVectorStore] = None
        self._vectoriser = Vectoriser()

    @property
    def documents(self) -> Dict[str, List[KnowledgeDocument]]:
        if self._documents is None:
            if not STRUCTURED_DATA_PATH.exists():
                raise FileNotFoundError(
                    "Structured knowledge data not found. Run sync_knowledge_base first."
                )
            raw = json.loads(STRUCTURED_DATA_PATH.read_text(encoding="utf-8"))
            self._documents = {
                key: [KnowledgeDocument.model_validate(doc) for doc in value]
                for key, value in raw.items()
            }
        return self._documents

    @property
    def vector_store(self) -> InMemoryVectorStore:
        if self._vector_store is None:
            store = InMemoryVectorStore()
            if EMBEDDINGS_DATA_PATH.exists():
                raw = json.loads(EMBEDDINGS_DATA_PATH.read_text(encoding="utf-8"))
                for chunk in raw:
                    store.add(
                        chunk["vector"],
                        {
                            "chunk_id": chunk["chunk_id"],
                            "text": chunk["text"],
                            **chunk.get("metadata", {}),
                        },
                    )
            self._vector_store = store
        return self._vector_store

    def search(self, query: str, top_k: int = 5) -> List[VectorSearchResult]:
        vector = self._vectoriser.encode(query)
        return self.vector_store.search(vector, top_k=top_k)

    def all_guidelines(self) -> Iterable[KnowledgeDocument]:
        for doc in self.documents.get("markdown", []):
            if doc.identifier.endswith("planning_guidelines.md"):
                yield doc

    def validation_report(self, issues: Iterable[ValidationIssue]) -> ValidationReport:
        issues_list = list(issues)
        return ValidationReport(is_valid=not any(issue.severity == "error" for issue in issues_list), issues=issues_list)

    def knowledge_graph(self):
        import networkx as nx

        return build_knowledge_graph(self.documents.get("markdown", []))
