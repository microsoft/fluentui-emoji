#!/usr/bin/env node

/*
Converts Fluent UI Emoji SVG assets into PNGs at a target size.

Layout assumptions (observed in this repo):
- assets/<Emoji Name>/{Color,Flat,High Contrast}/*.svg
- Some assets may include skintone subfolders:
  assets/<Emoji Name>/{Default,Light,Medium-Light,Medium,Medium-Dark,Dark}/{Color,Flat,High Contrast}/*.svg

The script mirrors the input folder structure under an output directory
(`512x512-fluent` by default) and produces 512x512 PNGs by default.

Converters (tried in order):
1) macOS sips
2) rsvg-convert (librsvg)
3) ImageMagick convert
4) Inkscape
*/

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { execFile } = require('child_process');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);
const execFileAsync = promisify(execFile);

const ALL_STYLE_FOLDERS = ['Color', 'Flat', 'High Contrast'];
const SKINTONE_FOLDERS = new Set([
  'Default',
  'Light',
  'Medium-Light',
  'Medium',
  'Medium-Dark',
  'Dark'
]);

async function ensureDir(dirPath) {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

async function findAssetDirectories(assetsPath) {
  const directories = [];
  const items = await readdir(assetsPath);

  for (const item of items) {
    const itemPath = path.join(assetsPath, item);
    let itemStat;
    try {
      itemStat = await stat(itemPath);
    } catch {
      continue;
    }
    if (!itemStat.isDirectory()) continue;

    const metadataPath = path.join(itemPath, 'metadata.json');
    try {
      await stat(metadataPath);
      directories.push(itemPath);
    } catch {
      // skip non-emoji directories
    }
  }

  return directories;
}

async function listSvgFilesUnder(folderPath) {
  try {
    const items = await readdir(folderPath);
    return items
      .filter((f) => f.toLowerCase().endsWith('.svg'))
      .map((f) => path.join(folderPath, f));
  } catch {
    return [];
  }
}

async function findSvgFiles(assetDir, stylesFilter) {
  const results = [];

  // Case 1: direct style folders under asset dir
  for (const style of stylesFilter) {
    const styleDir = path.join(assetDir, style);
    const svgs = await listSvgFilesUnder(styleDir);
    for (const svgPath of svgs) {
      results.push({ svgPath, style, skintone: null, assetDir });
    }
  }

  // Case 2: skintone folders containing style subfolders
  const subdirs = await readdir(assetDir).catch(() => []);
  for (const sub of subdirs) {
    if (!SKINTONE_FOLDERS.has(sub)) continue;
    const toneDir = path.join(assetDir, sub);
    const toneStat = await stat(toneDir).catch(() => null);
    if (!toneStat || !toneStat.isDirectory()) continue;

    for (const style of stylesFilter) {
      const styleDir = path.join(toneDir, style);
      const svgs = await listSvgFilesUnder(styleDir);
      for (const svgPath of svgs) {
        results.push({ svgPath, style, skintone: sub, assetDir });
      }
    }
  }

  return results;
}

async function convertSvgToPng(svgPath, pngPath, size = 512) {
  // Try macOS sips
  try {
    await execFileAsync('sips', [
      '-s', 'format', 'png',
      '-Z', String(size),
      svgPath,
      '--out', pngPath
    ]);
    return true;
  } catch (error) {
    // continue
  }

  // Try rsvg-convert
  try {
    await execFileAsync('rsvg-convert', [
      '-w', String(size),
      '-h', String(size),
      '-o', pngPath,
      svgPath
    ]);
    return true;
  } catch (error) {
    // continue
  }

  // Try ImageMagick convert
  try {
    await execFileAsync('convert', [
      '-background', 'transparent',
      '-size', `${size}x${size}`,
      svgPath,
      pngPath
    ]);
    return true;
  } catch (error) {
    // continue
  }

  // Try Inkscape
  try {
    await execFileAsync('inkscape', [
      `--export-filename=${pngPath}`,
      `--export-width=${size}`,
      `--export-height=${size}`,
      svgPath
    ]);
    return true;
  } catch (error) {
    console.error(`Failed to convert SVG ${svgPath}: ${error.message}`);
    return false;
  }
}

function sanitizeName(name) {
  return name.replace(/[^a-z0-9._-]/gi, '_');
}

async function convertSingle(svgEntry, outputRoot, size) {
  const { svgPath, style, skintone, assetDir } = svgEntry;
  const assetName = path.basename(assetDir);
  const fileBase = path.basename(svgPath, '.svg');

  const relativeParts = [assetName];
  if (skintone) relativeParts.push(skintone);
  relativeParts.push(style);

  const outDir = path.join(outputRoot, ...relativeParts);
  await ensureDir(outDir);

  const pngFilename = sanitizeName(`${fileBase}.png`).toLowerCase();
  const outPath = path.join(outDir, pngFilename);

  const ok = await convertSvgToPng(svgPath, outPath, size);
  return { ok, outPath, pngFilename };
}

function toCanonicalStyles(inputStyles) {
  if (!inputStyles || inputStyles.length === 0) return ['Color'];
  const normalized = inputStyles.map((s) => String(s).toLowerCase());
  const canonical = [];
  for (const style of ALL_STYLE_FOLDERS) {
    const low = style.toLowerCase();
    if (normalized.includes(low)) canonical.push(style);
  }
  // fallback to Color if nothing matched
  return canonical.length ? canonical : ['Color'];
}

async function processAssets(options = {}) {
  const {
    outputSize = 512,
    testMode = false,
    testCount = 5,
    outputDirName = '512x512-fluent',
    styles = ['Color']
  } = options;

  const repoRoot = path.join(__dirname, '..');
  const assetsPath = path.join(repoRoot, 'assets');
  const outputRoot = path.join(repoRoot, outputDirName);
  const stylesToInclude = toCanonicalStyles(styles);

  console.log('Creating output directory...');
  await ensureDir(outputRoot);

  console.log('Scanning asset directories...');
  const assetDirectories = await findAssetDirectories(assetsPath);
  console.log(`Found ${assetDirectories.length} asset directories`);

  const directoriesToProcess = testMode
    ? assetDirectories.slice(0, Math.max(0, testCount))
    : assetDirectories;

  console.log(`Processing ${directoriesToProcess.length} directories${testMode ? ' (test mode)' : ''}...`);

  let processedCount = 0;
  let successCount = 0;
  let skippedCount = 0;

  for (const assetDir of directoriesToProcess) {
    const assetName = path.basename(assetDir);
    console.log(`Processing ${assetName}...`);

    const svgFiles = await findSvgFiles(assetDir, stylesToInclude);
    if (svgFiles.length === 0) {
      console.log(`  No SVG files found for ${assetName}`);
      skippedCount++;
      continue;
    }

    for (const entry of svgFiles) {
      const fileLabel = path.basename(entry.svgPath);
      console.log(`  Converting ${fileLabel}...`);
      try {
        const { ok, pngFilename } = await convertSingle(entry, outputRoot, outputSize);
        if (ok) {
          console.log(`    ✓ Created ${pngFilename}`);
          successCount++;
        } else {
          console.log(`    ✗ Failed to convert ${fileLabel}`);
        }
        processedCount++;
      } catch (err) {
        console.error(`    ✗ Error processing ${fileLabel}: ${err.message}`);
        processedCount++;
      }
    }
  }

  console.log('\nConversion complete!');
  console.log(`- Processed: ${processedCount} files`);
  console.log(`- Successful: ${successCount} files`);
  console.log(`- Skipped directories: ${skippedCount}`);
  console.log(`- Output directory: ${outputRoot}`);
  console.log(`- Source: SVG files`);
  console.log(`- Output size: ${outputSize}x${outputSize}px`);
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  const styles = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--size':
        options.outputSize = parseInt(args[++i], 10) || 512;
        break;
      case '--test':
        options.testMode = true;
        options.testCount = parseInt(args[++i], 10) || 5;
        break;
      case '--out':
        options.outputDirName = args[++i] || '512x512-fluent';
        break;
      case '--style': {
        const val = (args[++i] || '').trim();
        if (val) styles.push(val);
        break;
      }
      case '--styles': {
        const val = (args[++i] || '').trim();
        if (val) styles.push(...val.split(',').map((s) => s.trim()).filter(Boolean));
        break;
      }
      case '--help':
        console.log('Usage: node scripts/convert_svgs_to_pngs.js [options]');
        console.log('Options:');
        console.log('  --size N     Output size in pixels (default: 512)');
        console.log('  --test N     Test mode with N directories (default: 5)');
        console.log('  --out DIR    Output directory name (default: 512x512-fluent)');
        console.log('  --style S    Style to include (repeatable). Default: Color');
        console.log('  --styles L   Comma-separated styles to include');
        console.log('  --help       Show this help');
        process.exit(0);
      default:
        // ignore unknown
        break;
    }
  }

  if (styles.length) options.styles = styles;

  processAssets(options).catch((error) => {
    console.error('Error processing assets:', error);
    process.exit(1);
  });
}

module.exports = { processAssets };


