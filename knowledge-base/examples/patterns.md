# Editing Patterns & Examples

This catalogue complements the structured examples in `patterns.json`. Use it for qualitative insight before inspecting the machine-readable set.

## Video 1 - How I Would Learn Digital Marketing

- **Overlay + SFX Emphasis (positive)** - 0:43 (`highlighted_background` text paired with `ui_pop`) spotlights "Choose One Area" advice. 1:05 combines monetary figure `$2,000/month` with `money` SFX; 9:08 pairs typing checklist with `typing` SFX. Mirrors guidance in [planning_guidelines.md](../planning_guidelines.md#text--animated-overlays).
- **Zoom Transitions for Turning Points (positive)** - 0:03 introduces the career story; 1:28 and 1:31 highlight the pivot to SEO; 4:24 marks the shift into practice principles; 8:23 underscores networking advice. Aligns with motion cues in [planning_guidelines.md](../planning_guidelines.md#motion--transitions).
- **Metaphor B-Roll (positive)** - 0:22 "throwing trash" visualises past mistakes; 2:46-2:49 uses guitar, cooking, and homework shots to communicate learning analogies. Demonstrates contextual asset matching (see [asset_catalogs.md](../asset_catalogs.md)).
- **Progressive Checklists (positive)** - 4:39, 5:14, 5:53, 6:40, and 8:08 expand a practice list; each overlay adds to previous items rather than resetting.
- **Achievement Highlights (positive)** - 0:14 uses `achievement_highlight` to cement credibility ("Top 1%") with supporting overlay text and b-roll of accolades.
- **Stacking Conflict (negative)** - 5:27 draft plan attempted concurrent `highlighted_background` overlays on the `main` layer, obscuring the speaker. Fix by staggering overlays by at least 0.3 s (see [planning_guidelines.md](../planning_guidelines.md#layer--timing-hygiene)).

## Video 2 - Digital Marketing 101

- **Definition Callouts (positive)** - 0:50-1:05 overlays define "Digital Marketing" and "SEO" while `ui_pop` SFX punctuate each term.
- **Topic Transitions (positive)** - 0:39 introduces "Digital marketing vs Traditional marketing" with `whoosh_standard` while a `highlighted_background` overlay frames the comparison.
- **Framework Lists (positive)** - 3:18-3:30 (marketing funnel) and 10:12-10:35 (content pillars) build multi-point overlays with `fade_in_list` animation.
- **Product vs Service Contrast (positive)** - 15:15 overlay splits "FEATURE" vs "BENEFIT" and triggers `ui_pop`; 15:57 "SELL THE END" overlay plus `emphasis_ding` reinforces service marketing guidance.
- **B2B / B2C Distinction (positive)** - 16:30 overlay introduces the comparison, followed by 16:49 text listing both sides with supporting SFX.
- **Overuse of Zoom (negative)** - Early experiments layered `zoom_in` at 14:12, 14:32, and 14:52 with no narrative escalation, causing viewer fatigue. Apply minimum 0.5 s spacing and reserve for genuine emphasis.

## Edge Cases & Stress Tests

- **Rapid-fire Comparisons** - 8:31-9:20 (Video 2) alternates organic vs paid points every few seconds; keep overlays concise and pre-load the next item via `fade_in_list`.
- **Long Static Segments** - 11:51-12:53 (Video 1) features call-to-action without new visuals; maintain interest with subtle b-roll and a single sustaining overlay rather than stacking.
- **Emotion Swings** - 7:45-8:15 (Video 1) transitions from cautionary tale to motivational advice; pair darker-toned b-roll with caution SFX, then release into upbeat visuals.
- **Negative Example - Missing Context Tag** - Plans lacking `context` for b-roll (for example, "conference room") lead to mismatched assets; always populate `context` per [element_schema.json](../element_schema.json).
