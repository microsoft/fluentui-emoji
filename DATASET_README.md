# FluentUI Emoji Dataset Toolkit

This repository contains utilities to build training datasets (JSONL + PNGs) from multiple emoji sets:
- Fluent UI (from `assets/` SVGs via 512x512 PNGs)
- Apple, Google, OpenMoji, and Twitter (pre-rendered 512x512 PNGs)

It can generate per-category JSONL files for a curated set of "manual" categories and copy the corresponding images into vendor-specific `manual*` folders for easy consumption.

## Prerequisites

- Node.js >= 12
- For SVG → PNG conversion (Fluent/Twitter SVGs), one of the following available on your PATH:
  - macOS `sips` (preferred on macOS)
  - `rsvg-convert` (librsvg)
  - ImageMagick `convert`
  - Inkscape `inkscape`

## Installation

```bash
npm install
```

## Workflows

### 1) Convert Fluent SVGs → 512x512 PNGs

Fluent UI assets are stored under `assets/`. Use the converter to render PNGs into `512x512-fluent/` mirroring the input folder structure.

```bash
# Convert all Color style SVGs to PNGs (default 512x512)
npm run png:svgs

# Test mode with first 5 emoji directories
npm run png:test
```

Options (for `scripts/convert_svgs_to_pngs.js`):
- `--size N`: output size (default 512)
- `--style S`: style folder to include (repeatable; default `Color`)
- `--styles A,B`: comma-separated list of styles
- `--out DIR`: output directory name (default `512x512-fluent`)
- `--test N`: process first N asset directories

The converter understands skintone subfolders `Default`, `Light`, `Medium-Light`, `Medium`, `Medium-Dark`, `Dark` and will mirror them in the output structure.

### 2) Convert Twitter SVGs → 512x512 PNGs (optional)

If you are using the raw Twitter SVGs in `svg-twitter/`:

```bash
npm run png:twitter

# Test mode
npm run png:twitter:test
```

Options (for `scripts/convert_twitter_svgs_to_pngs.js`):
- `--size N`: output size (default 512)
- `--test N`: process first N files

### 3) Generate Datasets (JSONL + copied PNGs)

There are vendor-specific generators that create per-category JSONL files in `manual*/jsonl/` and copy referenced images into `manual*/data/<Category>/`. Only emojis that belong to curated "manual" categories (from `ManualEmojisCategories.json`) are included.

Run one vendor:

```bash
npm run generate:fluent
npm run generate:apple
npm run generate:google
npm run generate:openmoji
npm run generate:twitter
```

Run all vendors:

```bash
npm run generate:all
```

You can also use the generic entry:

```bash
npm run generate
```

#### CLI flags (all generators)

- `--default-only` (alias: `--no-skin-tones`, `--no-skintones`):
  - Fluent: only includes images from `Default/Color` skin-tone variant folders (plus top-level `Color` if present), skipping `Light`/`Medium(-Light/-Dark)`/`Dark` variants.
  - Apple/Google/OpenMoji/Twitter: filters out any file names that include Unicode skin tone modifiers U+1F3FB..U+1F3FF (e.g., `1f3fb`..`1f3ff` in the filename).

Examples:

```bash
# Fluent only default (yellow) people variants
node generate_fluent_dataset.js --default-only

# All generators via npm with the same flag
npm run generate:fluent -- --default-only
npm run generate:apple -- --default-only
```

#### Outputs

Vendor-specific output locations:
- Fluent: `manualFluent/data/` and `manualFluent/jsonl/`
- Apple: `manualApple/data/` and `manualApple/jsonl/`
- Google: `manualGoogle/data/` and `manualGoogle/jsonl/`
- OpenMoji: `manualOpenmoji/data/` and `manualOpenmoji/jsonl/`
- Twitter: `manualTwitter/data/` and `manualTwitter/jsonl/`

Each category produces a JSONL file named as CamelCase of the category, e.g., `AnimalsAndNature.jsonl`.

JSONL schema:

```json
{"image":"data/<Category>/<file>.png","caption":"<CLDR name or derived caption>"}
```

Caption content varies slightly by generator but is based on CLDR names and, where applicable, selected keywords. Emoji glyphs are not inserted in captions.

### 4) Cleaning generated manual folders

Remove all top-level `manual*` folders:

```bash
npm run clean:manual
```

This executes `scripts/clean_manuals.js` and deletes any top-level directory with a name starting with `manual`.

## Files of Interest

- `scripts/convert_svgs_to_pngs.js`: SVG → PNG converter for Fluent assets (handles skin tone subfolders)
- `scripts/convert_twitter_svgs_to_pngs.js`: SVG → PNG converter for Twitter SVGs
- `generate_fluent_dataset.js`: Fluent dataset builder (reads `512x512-fluent/`)
- `generate_apple_dataset.js`: Apple dataset builder (reads `512x512-apple/`)
- `generate_google_dataset.js`: Google dataset builder (reads `512x512-google/`)
- `generate_openmoji_dataset.js`: OpenMoji dataset builder (reads `512x512-openmoji/`)
- `generate_twitter_dataset.js`: Twitter dataset builder (reads `512x512-twitter/`)
- `EmojisCategories.json`: emoji taxonomy data
- `ManualEmojisCategories.json`: curated category-to-emoji mapping used by generators

## Troubleshooting

- No output PNGs for Fluent: ensure you ran the converter to produce `512x512-fluent/` and that at least one of the expected converters (`sips`, `rsvg-convert`, `convert`, `inkscape`) is available.
- Missing JSONL entries for some emoji: only emojis listed under `ManualEmojisCategories.json` are included.
- Limiting variants: pass `--default-only` to exclude skin tone variants.
