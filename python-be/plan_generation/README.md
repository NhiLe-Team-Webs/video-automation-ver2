# Plan Generation Scripts

This directory contains scripts responsible for generating and enriching the video edit plan using LLMs and other data sources.

## Files:

- [`enrich_plan.py`](python-be/plan_generation/enrich_plan.py): This script post-processes an existing Gemini plan. It enriches each segment with B-roll assignments, motion cues, and CTA highlights based on scene map data, asset catalogs, and motion rules. It also appends a CTA highlight if needed and reports timing gaps.

- [`make_plan_gemini.py`](python-be/plan_generation/make_plan_gemini.py): This script generates an initial flexible edit plan using the Gemini LLM. It constructs a detailed prompt including transcript segments, schema hints, rules, and supplemental context from various catalogs (scene map, B-roll, SFX, motion rules). The LLM's response is then normalized and saved as a JSON plan.