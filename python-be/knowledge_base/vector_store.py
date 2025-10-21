"""Embedding encoder and in-memory vector similarity search utilities."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable, List, Sequence

import numpy as np

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None  # type: ignore[assignment]


@dataclass
class VectorSearchResult:
    chunk_id: str
    score: float
    text: str
    metadata: dict


class Vectoriser:
    """
    Encode text into dense vectors.
    Falls back to a simple TF-IDF-like hashing if SentenceTransformer is unavailable.
    """

    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2") -> None:
        self.model_name = model_name
        self._model = None

    @property
    def model(self) -> SentenceTransformer | None:
        if self._model is None and SentenceTransformer is not None:
            try:
                self._model = SentenceTransformer(self.model_name)
            except Exception:
                self._model = None
        return self._model

    def encode(self, text: str) -> List[float]:
        if self.model is not None:
            vector = self.model.encode(text, normalize_embeddings=True)
            return vector.tolist()
        # simple hashing fallback
        tokens = text.lower().split()
        vec = np.zeros(512, dtype=np.float32)
        for token in tokens:
            idx = hash(token) % 512
            vec[idx] += 1
        norm = np.linalg.norm(vec)
        if norm == 0:
            return vec.tolist()
        return (vec / norm).tolist()


class InMemoryVectorStore:
    def __init__(self) -> None:
        self._vectors: List[np.ndarray] = []
        self._payload: List[dict] = []

    def add(self, vector: Sequence[float], metadata: dict) -> None:
        self._vectors.append(np.array(vector, dtype=np.float32))
        self._payload.append(metadata)

    def extend(self, vectors: Iterable[Sequence[float]], metadatas: Iterable[dict]) -> None:
        for vector, metadata in zip(vectors, metadatas):
            self.add(vector, metadata)

    def search(self, query_vector: Sequence[float], top_k: int = 5) -> List[VectorSearchResult]:
        if not self._vectors:
            return []
        query = np.array(query_vector, dtype=np.float32)
        query_norm = np.linalg.norm(query)
        if query_norm == 0:
            return []
        scores: List[VectorSearchResult] = []
        for vector, metadata in zip(self._vectors, self._payload):
            denom = np.linalg.norm(vector) * query_norm
            if denom == 0:
                continue
            score = float(np.dot(vector, query) / denom)
            scores.append(
                VectorSearchResult(
                    chunk_id=metadata.get("chunk_id", ""),
                    score=score,
                    text=metadata.get("text", ""),
                    metadata=metadata,
                )
            )
        scores.sort(key=lambda item: item.score, reverse=True)
        return scores[:top_k]
