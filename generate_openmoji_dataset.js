#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const copyFile = promisify(fs.copyFile);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);

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

// Helper function to find emoji category
function findEmojiCategory(emojiName, categories, manualCategories, emojiGlyph) {
  // Only use manual categories
  if (emojiGlyph && manualCategories) {
    for (const [categoryName, emojis] of Object.entries(manualCategories)) {
      if (Array.isArray(emojis) && emojis.includes(emojiGlyph)) {
        return categoryName;
      }
    }
  }

  if (emojiName && manualCategories) {
    for (const [categoryName, emojis] of Object.entries(manualCategories)) {
      if (Array.isArray(emojis) && emojis.includes(emojiName)) {
        return categoryName;
      }
    }
  }

  return null; // not a manual category
}

// Helper function to check if category is manual
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

// Generate captions for emoji
function generateCaptions(metadata, filename, category = null) {
  const captions = [];
  
  if (!metadata) {
    // Fallback caption if no metadata
    const baseName = filename.replace('.png', '').replace(/_/g, ' ');
    const caption = category ? `${baseName}. Category of ${category}` : baseName;
    captions.push(caption);
    return captions;
  }
  
  const { cldr, keywords, glyph } = metadata;
  
  // Generate caption with CLDR name only (no emoji glyph, no keywords, no category)
  let baseCaption = '';
  if (cldr) {
    baseCaption = cldr;
  } else {
    // Fallback to filename if no CLDR name
    const baseName = filename.replace('.png', '').replace(/_/g, ' ');
    baseCaption = baseName;
  }
  
  captions.push(baseCaption);
  return captions;
}

// Convert unicode filename to unicode string
function unicodeFilenameToUnicode(filename) {
  // Handle emoji_u prefix format (e.g., emoji_u1f600.png)
  if (filename.startsWith('emoji_u')) {
    const unicodeStr = filename.replace('emoji_u', '').replace('.png', '');
    const codePoints = unicodeStr.split('_').map(cp => parseInt(cp, 16));
    return String.fromCodePoint(...codePoints);
  }
  // Handle regular format (e.g., 1f600.png)
  const unicodeStr = filename.replace('.png', '');
  const codePoints = unicodeStr.split('-').map(cp => parseInt(cp, 16));
  return String.fromCodePoint(...codePoints);
}

// Main processing function
async function processOpenmojiAssets(options = {}) {
  const assetsPath = path.join(__dirname, 'assets');
  const openmoji72Path = path.join(__dirname, '512x512-openmoji');
  const openmojiDataDir = path.join(__dirname, 'manualOpenmoji', 'data');
  const openmojiJsonlDir = path.join(__dirname, 'manualOpenmoji', 'jsonl');
  
  console.log('Loading emoji categories...');
  const categories = await loadEmojiCategories();
  const manualCategories = await loadManualCategories();
  const unicodeIndex = buildUnicodeIndexFromCategories(categories);
  
  console.log('Creating manualOpenmoji directories...');
  await ensureDir(openmojiDataDir);
  await ensureDir(openmojiJsonlDir);
  
  // Read all PNG files from 512x512-openmoji directory
  const openmojiFiles = await readdir(openmoji72Path);
  let pngFiles = openmojiFiles.filter(file => file.endsWith('.png'));
  if (options.defaultOnly) {
    pngFiles = pngFiles.filter((file) => !filenameHasSkinToneModifier(file));
  }
  console.log(`Found ${pngFiles.length} PNG files in 512x512-openmoji directory`);
  
  const openmojiCategoryEntries = {};
  const openmojiCategoryStats = {};
  let processedCount = 0;
  let skippedCount = 0;
  
  // Process each PNG file
  for (const filename of pngFiles) {
    try {
      // Convert OpenMoji filename to normalized unicode key for index
      // 1F60A.png or 1F344-200D-1F7EB.png -> 1f60a or 1f344200d1f7eb
      const metadataUnicode = filename
        .replace('.png', '')
        .split('-')
        .join('')
        .toLowerCase();

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
      
      // Check if this is a manual category
      const isManual = isManualCategory(category, manualCategories);
      if (!isManual) {
        console.log(`Skipping ${filename} - not a manual category: ${category}`);
        skippedCount++;
        continue;
      }
      
      // Initialize category stats and entries
      if (!openmojiCategoryStats[category]) {
        openmojiCategoryStats[category] = 0;
        openmojiCategoryEntries[category] = [];
      }
      
      // Generate a safe filename based on CLDR name (same as manual folder)
      const safeFilename = metadata.cldr 
        ? `${metadata.cldr.replace(/[^a-z0-9\s-]/gi, '_').replace(/\s+/g, '_').toLowerCase()}.png`
        : filename;
      
      try {
        // Copy the file to openmoji category directory
        const openmojiCategoryDir = path.join(openmojiDataDir, category);
        await ensureDir(openmojiCategoryDir);
        const sourcePath = path.join(openmoji72Path, filename);
        const targetPath = path.join(openmojiCategoryDir, safeFilename);
        await copyFile(sourcePath, targetPath);
        
        // Generate captions
        const captions = generateCaptions(metadata, safeFilename, category);
        
        // Create JSONL entries for openmoji category
        for (const caption of captions) {
          const openmojiRelativePath = `data/${category}/${safeFilename}`;
          openmojiCategoryEntries[category].push({
            image: openmojiRelativePath,
            caption: caption
          });
        }
        
        openmojiCategoryStats[category]++;
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
  for (const [category, entries] of Object.entries(openmojiCategoryEntries)) {
    if (entries.length > 0) {
      // Convert category name to CamelCase
      const camelCaseName = category
        .replace(/[^a-z0-9\s-]/gi, '') // Remove special characters except spaces and hyphens
        .split(/[\s-]+/) // Split on spaces and hyphens
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
      const outputFile = path.join(openmojiJsonlDir, `${camelCaseName}.jsonl`);
      const jsonlContent = entries
        .map(entry => JSON.stringify(entry))
        .join('\n');
      
      await writeFile(outputFile, jsonlContent, 'utf-8');
      totalEntries += entries.length;
      console.log(`  - ${category}: ${entries.length} entries -> ${camelCaseName}.jsonl`);
    }
  }
  
  console.log(`\nOpenMoji dataset generation complete!`);
  console.log(`- Processed: ${processedCount} assets`);
  console.log(`- Skipped: ${skippedCount} assets`);
  console.log(`- Total JSONL entries: ${totalEntries}`);
  console.log(`- Images copied to: ${openmojiDataDir}`);
  console.log(`- JSONL files written to: ${openmojiJsonlDir}`);
  console.log(`\nOpenMoji category breakdown:`);
  for (const [category, count] of Object.entries(openmojiCategoryStats)) {
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
        console.log('Usage: node generate_openmoji_dataset.js [--default-only]');
        process.exit(0);
      default:
        break;
    }
  }
  processOpenmojiAssets(options).catch(console.error);
}

module.exports = { processOpenmojiAssets };
