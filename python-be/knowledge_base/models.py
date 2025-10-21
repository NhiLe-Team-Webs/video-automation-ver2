from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Sequence, Tuple

from pydantic import BaseModel, Field


class DocumentType(str, Enum):
    MARKDOWN = "markdown"
    JSON = "json"


class KnowledgeDocument(BaseModel):
    identifier: str
    title: str
    doc_type: DocumentType
    path: str
    headings: List[Tuple[str, int]] = Field(default_factory=list)
    sections: List[str] = Field(default_factory=list)
    metadata: Dict[str, str] = Field(default_factory=dict)


class GuidelineRule(BaseModel):
    id: str
    title: str
    description: str
    rationale: Optional[str] = None
    related_sections: Sequence[str] = ()


class ElementDefinition(BaseModel):
    element_type: str
    purpose: str
    layer: str
    key_fields: Sequence[str]
    defaults: Optional[str] = None


class GlossaryTerm(BaseModel):
    term: str
    definition: str
    related: Sequence[str] = ()
    references: Sequence[str] = ()


class ExampleSnippet(BaseModel):
    video_id: str
    timestamp: float
    label: str
    outcome: str
    rationale: Optional[str] = None
    elements: Sequence[Dict[str, object]] = ()


class ValidationIssue(BaseModel):
    code: str
    message: str
    severity: str = "error"
    context: Dict[str, object] = Field(default_factory=dict)


class ValidationReport(BaseModel):
    is_valid: bool
    issues: List[ValidationIssue] = Field(default_factory=list)


@dataclass
class VectorisedChunk:
    doc_id: str
    chunk_id: str
    text: str
    metadata: Dict[str, str]
    vector: List[float]
