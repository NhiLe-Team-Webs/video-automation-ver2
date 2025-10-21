"""Helpers for building a lightweight directed graph representing knowledge relationships."""

from __future__ import annotations

from typing import Iterable

import networkx as nx

from .models import KnowledgeDocument


def build_knowledge_graph(documents: Iterable[KnowledgeDocument]) -> nx.DiGraph:
    """
    Construct a lightweight directed graph linking document sections by heading.
    Nodes represent document identifiers and section headings.
    """
    graph = nx.DiGraph()
    for doc in documents:
        doc_node = doc.identifier
        graph.add_node(doc_node, type="document", title=doc.title, path=doc.path)
        for heading, level in doc.headings:
            section_node = f"{doc.identifier}::{heading}"
            graph.add_node(section_node, type="section", level=level)
            graph.add_edge(doc_node, section_node)
    return graph
