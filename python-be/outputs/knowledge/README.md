# Knowledge Cache Artifacts

Generated files produced by `python data_processing/sync_knowledge_base.py`.

| File | Description |
| ---- | ----------- |
| `structured.json` | Serialised list of parsed Markdown and JSON documents (metadata, sections, headings). |
| `embeddings.json` | Embedding vectors for individual sections, used for retrieval-augmented generation and guideline lookup. |
| `schema_cache.json` | SHA-256 hashes of validated schema files to detect when they change. |
| `.gitkeep` | Placeholder to keep the directory under version control. |

> ⚠️ These files are regenerated; do not edit them manually. Delete the folder if you want a clean rebuild, then rerun the sync command.
