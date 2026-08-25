#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const copyFile = promisify(fs.copyFile);
const mkdir = promisify(fs.mkdir);

// Load emoji categories
let emojiCategories = null;
let manualCategories = null;

async function loadEmojiCategories() {
  if (emojiCategories) return emojiCategories;
  try {
    const categoriesPath = path.join(__dirname, 'EmojisCategories.json');
    const content = await readFile(categoriesPath, 'utf-8');
    const data = JSON.parse(content);
    emojiCategories = data.emojis;
    return emojiCategories;
  } catch (error) {
    console.warn('Failed to load emoji categories:', error.message);
    return {};
  }
}

async function loadManualCategories() {
  if (manualCategories) return manualCategories;
  try {
    const manualPath = path.join(__dirname, 'ManualEmojisCategories.json');
    const content = await readFile(manualPath, 'utf-8');
    const data = JSON.parse(content);
    manualCategories = data;
    return manualCategories;
  } catch (error) {
    console.warn('Failed to load manual emoji categories:', error.message);
    return {};
  }
}

// Detect if filename encodes a skin tone modifier (U+1F3FB..U+1F3FF)
function filenameHasSkinToneModifier(filename) {
  const name = filename.toLowerCase();
  return (
    name.includes('1f3fb') ||
    name.includes('1f3fc') ||
    name.includes('1f3fd') ||
    name.includes('1f3fe') ||
    name.includes('1f3ff')
  );
}

// Helper function to ensure directory exists
async function ensureDir(dirPath) {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

// Helper function to find emoji category (manual only)
function findEmojiCategory(emojiName, categories, manualCategories, emojiGlyph) {
  // Prefer glyph match in manual categories
  if (emojiGlyph && manualCategories) {
    for (const [categoryName, emojis] of Object.entries(manualCategories)) {
      if (Array.isArray(emojis) && emojis.includes(emojiGlyph)) {
        return categoryName;
      }
    }
  }

  // Fall back to name match in manual categories
  if (emojiName && manualCategories) {
    for (const [categoryName, emojis] of Object.entries(manualCategories)) {
      if (Array.isArray(emojis) && emojis.includes(emojiName)) {
        return categoryName;
      }
    }
  }

  return null; // not a manual category
}

function isManualCategory(category, manualCategories) {
  return manualCategories && Object.keys(manualCategories).includes(category);
}

// Build a lookup from normalized unicode (lowercase, no separators) to { cldr, glyph }
function buildUnicodeIndexFromCategories(categoriesEmojis) {
  const index = {};

  function normalizeCodeArray(codeArr) {
    return codeArr.join('').toLowerCase();
  }

  function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) {
        if (item && item.code && Array.isArray(item.code)) {
          const key = normalizeCodeArray(item.code);
          index[key] = {
            cldr: item.name,
            glyph: item.emoji
          };
        }
      }
      return;
    }
    if (typeof node === 'object') {
      for (const value of Object.values(node)) {
        walk(value);
      }
    }
  }

  walk(categoriesEmojis);
  return index;
}

// Generate captions for emoji (CLDR only)
function generateCaptions(metadata, filename, category = null) {
  const captions = [];

  if (!metadata) {
    const baseName = filename.replace('.png', '').replace(/_/g, ' ');
    const caption = category ? `${baseName}. Category of ${category}` : baseName;
    captions.push(caption);
    return captions;
  }

  const { cldr } = metadata;

  let baseCaption = '';
  if (cldr) {
    baseCaption = cldr;
  } else {
    const baseName = filename.replace('.png', '').replace(/_/g, ' ');
    baseCaption = baseName;
  }

  captions.push(baseCaption);
  return captions;
}

// Normalize Apple filename to unicode index key, handling multiple patterns
function filenameToUnicodeKey(filename) {
  // Remove common prefix and extension
  const core = filename
    .replace(/^emoji_u/i, '')
    .replace(/\.png$/i, '');

  // Strip any non-hex characters (handles both '_' and '-' separators)
  const hexOnly = core.replace(/[^0-9a-fA-F]/g, '');
  return hexOnly.toLowerCase();
}

// Main processing function
async function processAppleAssets(options = {}) {
  const apple512Path = path.join(__dirname, '512x512-apple');
  const appleDataDir = path.join(__dirname, 'manualApple', 'data');
  const appleJsonlDir = path.join(__dirname, 'manualApple', 'jsonl');

  console.log('Loading emoji categories...');
  const categories = await loadEmojiCategories();
  const manualCategories = await loadManualCategories();
  const unicodeIndex = buildUnicodeIndexFromCategories(categories);

  console.log('Creating manualApple directories...');
  await ensureDir(appleDataDir);
  await ensureDir(appleJsonlDir);

  // Read all PNG files from 512x512-apple directory
  let appleFiles = [];
  try {
    appleFiles = await readdir(apple512Path);
  } catch (error) {
    console.error('Failed to read 512x512-apple directory:', error.message);
    console.error('Ensure the directory exists and contains 512x512 PNG assets.');
    process.exitCode = 1;
    return;
  }

  let pngFiles = appleFiles.filter(file => file.toLowerCase().endsWith('.png'));
  if (options.defaultOnly) {
    pngFiles = pngFiles.filter((file) => !filenameHasSkinToneModifier(file));
  }
  console.log(`Found ${pngFiles.length} PNG files in 512x512-apple directory`);

  const appleCategoryEntries = {};
  const appleCategoryStats = {};
  let processedCount = 0;
  let skippedCount = 0;

  // Process each PNG file
  for (const filename of pngFiles) {
    try {
      // Normalize filename to unicode key for index lookup
      const metadataUnicode = filenameToUnicodeKey(filename);

      // Lookup in unicode index from EmojisCategories.json
      const metadata = unicodeIndex[metadataUnicode];

      if (!metadata) {
        console.log(`No metadata found for ${filename} (${metadataUnicode})`);
        skippedCount++;
        continue;
      }

      // Determine category for this emoji
      const emojiName = metadata?.cldr || filename.replace(/_/g, ' ');
      const emojiGlyph = metadata?.glyph;
      const category = findEmojiCategory(emojiName, categories, manualCategories, emojiGlyph);

      // Only include manual categories
      const isManual = isManualCategory(category, manualCategories);
      if (!isManual) {
        console.log(`Skipping ${filename} - not a manual category: ${category}`);
        skippedCount++;
        continue;
      }

      // Initialize category stats and entries
      if (!appleCategoryStats[category]) {
        appleCategoryStats[category] = 0;
        appleCategoryEntries[category] = [];
      }

      // Generate a safe filename based on CLDR name
      const safeFilename = metadata.cldr
        ? `${metadata.cldr
            .replace(/[^a-z0-9\s-]/gi, '_')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .toLowerCase()}.png`
        : filename;

      try {
        // Copy the file to apple category directory
        const appleCategoryDir = path.join(appleDataDir, category);
        await ensureDir(appleCategoryDir);
        const sourcePath = path.join(apple512Path, filename);
        const targetPath = path.join(appleCategoryDir, safeFilename);
        await copyFile(sourcePath, targetPath);

        // Generate captions
        const captions = generateCaptions(metadata, safeFilename, category);

        // Create JSONL entries for apple category
        for (const caption of captions) {
          const appleRelativePath = `data/${category}/${safeFilename}`;
          appleCategoryEntries[category].push({
            image: appleRelativePath,
            caption: caption
          });
        }

        appleCategoryStats[category]++;
        processedCount++;

        if (processedCount % 100 === 0) {
          console.log(`Processed ${processedCount} assets...`);
        }
      } catch (error) {
        console.error(`Error processing ${filename}:`, error.message);
        skippedCount++;
      }
    } catch (error) {
      console.error(`Error processing ${filename}:`, error.message);
      skippedCount++;
    }
  }

  console.log(`\nWriting JSONL files for each category...`);

  // Write separate JSONL files for each category
  let totalEntries = 0;
  for (const [category, entries] of Object.entries(appleCategoryEntries)) {
    if (entries.length > 0) {
      // Convert category name to CamelCase
      const camelCaseName = category
        .replace(/[^a-z0-9\s-]/gi, '')
        .split(/[\s-]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
      const outputFile = path.join(appleJsonlDir, `${camelCaseName}.jsonl`);
      const jsonlContent = entries.map(entry => JSON.stringify(entry)).join('\n');

      await writeFile(outputFile, jsonlContent, 'utf-8');
      totalEntries += entries.length;
      console.log(`  - ${category}: ${entries.length} entries -> ${camelCaseName}.jsonl`);
    }
  }

  console.log(`\nApple dataset generation complete!`);
  console.log(`- Processed: ${processedCount} assets`);
  console.log(`- Skipped: ${skippedCount} assets`);
  console.log(`- Total JSONL entries: ${totalEntries}`);
  console.log(`- Images copied to: ${appleDataDir}`);
  console.log(`- JSONL files written to: ${appleJsonlDir}`);
  console.log(`\nApple category breakdown:`);
  for (const [category, count] of Object.entries(appleCategoryStats)) {
    console.log(`  - ${category}: ${count} emojis`);
  }
}

// Run the script
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--default-only':
      case '--no-skin-tones':
      case '--no-skintones':
        options.defaultOnly = true;
        break;
      case '--help':
        console.log('Usage: node generate_apple_dataset.js [--default-only]');
        process.exit(0);
      default:
        break;
    }
  }
  processAppleAssets(options).catch(console.error);
}

module.exports = { processAppleAssets };


