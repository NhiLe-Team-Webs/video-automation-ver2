# Element Definitions & Layering Rules

Compiled from `video1.json`, `video2.json`, and production metadata. See [element_schema.json](element_schema.json) for machine-readable constraints.

## Element Families

### `broll`
- **Purpose** - supplemental footage reinforcing the spoken idea.
- **Layer** - `video` (replaces or overlays the main speaker feed).
- **Key fields** - `description`, `context`, optional `tags`.
- **Defaults** - plays until another `video` layer element appears or the timeline returns to `main`.

### `text_overlay`
- **Purpose** - on-screen text with branded styling.
- **Layer** - `overlay`.
- **Key fields** - `content`, `style`, `animation`.
- **Common styles** - `highlighted_background`, `clean_minimal`, `bold_emphasis`, `split_column`, `callout_box`.
- **Defaults** - stays visible until the next overlay or contextual change.

### `text_animation`
- **Purpose** - animated typography for counts, progressions, or emphasis.
- **Layer** - `overlay`.
- **Key fields** - `content`, `animation`, `emphasis`.
- **Common animations** - `count_up`, `typing_effect`, `flow_chart`, `progression_arrow`, `expansion_flow`, `fade_in_list`, `pulse`.

### `sound_effect`
- **Purpose** - accentuate moments with short audio cues.
- **Layer** - `audio`.
- **Key field** - `sound` (see `sfx_catalog.json`).
- **Common sounds** - `transition_rewind`, `whoosh_standard`, `ui_pop`, `money`, `success`, `fire`, `achievement`, `crash`, `money_loss`, `typing`, `confusion`, `expansion`, `emphasis_ding`, `heartbeat_soft`.
- **Defaults** - one-shot playback with duration driven by source asset.

### `effect`
- **Purpose** - visual motion or transitions.
- **Layer** - `transition`.
- **Key fields** - `action`, `duration`.
- **Common actions** - `zoom_in`, `zoom_out`, `fade`, `slide_left`, `slide_right`, `push_in`, `camera_shake`.
- **Defaults** - duration 0.5-2.0 seconds unless overridden by `duration`.

### `icon`
- **Purpose** - static or minimal-motion graphics.
- **Layer** - `overlay`.
- **Key fields** - `content`, `context`.

### `speaker_intro`, `achievement_highlight`, `section_header`, `emphasis`
- Specialised high-level cues that appear on the `main` or `overlay` layers to introduce the speaker, emphasise milestones, mark sections, or spotlight keywords. Use sparingly and tie to beats in `videos/*.md`.

## Layer Stack

1. `main` - primary camera feed (baseline footage).
2. `video` - b-roll replacing or augmenting the main layer.
3. `overlay` - text, icons, and animated graphics.
4. `audio` - sound effects mixed with narration.
5. `transition` - temporary visual effects used between clips.

Respect layer priority to avoid stacking conflicts; only one dominant element per layer at a time.

## Synchronisation Notes

- Multiple elements can share the same timestamp; treat them as simultaneous but respect layer ordering.
- Transitions (`effect`) should begin before or exactly with the visual/text they introduce.
- Use `style` values to keep branding consistent (default: `highlighted_background` for critical callouts).
- Populate `context` to support catalog lookups (see [asset_catalogs.md](asset_catalogs.md)).
- Record `confidence` when available to support downstream thresholding (optional field in `element_schema.json`).
