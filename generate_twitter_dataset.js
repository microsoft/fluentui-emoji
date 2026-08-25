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

function stringHasSkinToneModifier(s) {
  const t = s.toLowerCase();
  return (
    t.includes('1f3fb') ||
    t.includes('1f3fc') ||
    t.includes('1f3fd') ||
    t.includes('1f3fe') ||
    t.includes('1f3ff')
  );
}

function findEmojiCategory(emojiName, categories, manualCategories, emojiGlyph) {
  // First check manual categories by glyph
  if (manualCategories && emojiGlyph) {
    for (const [categoryName, glyphs] of Object.entries(manualCategories)) {
      if (Array.isArray(glyphs) && glyphs.includes(emojiGlyph)) {
        return categoryName;
      }
    }
  }
  
  // Fall back to main categories if not found in manual categories
  if (!categories) return 'other';
  
  // Normalize the emoji name for matching
  const normalizedName = emojiName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  
  for (const [categoryName, subcategories] of Object.entries(categories)) {
    for (const [subcategoryName, emojis] of Object.entries(subcategories)) {
      if (Array.isArray(emojis)) {
        for (const emoji of emojis) {
          if (emoji.name && emoji.name.toLowerCase() === normalizedName) {
            return categoryName;
          }
          // Also try partial matching for cases where names might not match exactly
          if (emoji.name && emoji.name.toLowerCase().includes(normalizedName)) {
            return categoryName;
          }
        }
      }
    }
  }
  
  return 'other';
}

function isManualCategory(category, manualCategories) {
  if (!manualCategories) return false;
  return Object.keys(manualCategories).includes(category);
}

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
    const itemStat = await stat(itemPath);
    
    if (itemStat.isDirectory()) {
      // Check if this directory has a metadata.json file
      const metadataPath = path.join(itemPath, 'metadata.json');
      try {
        await stat(metadataPath);
        directories.push(itemPath);
      } catch (error) {
        // No metadata.json, skip this directory
      }
    }
  }
  
  return directories;
}

async function readMetadata(assetDir) {
  const metadataPath = path.join(assetDir, 'metadata.json');
  try {
    const content = await readFile(metadataPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Failed to read metadata for ${assetDir}:`, error.message);
    return null;
  }
}

function generateCaptions(metadata, filename, category = null) {
  const captions = [];
  
  if (!metadata) {
    // Fallback caption if no metadata
    const baseName = filename.replace('.png', '').replace(/_/g, ' ');
    captions.push(baseName);
    return captions;
  }
  
  const { cldr } = metadata;
  
  // Generate caption with just CLDR name
  let baseCaption = '';
  if (cldr) {
    baseCaption = cldr;
  } else {
    // Fallback to filename if no CLDR
    baseCaption = filename.replace('.png', '').replace(/_/g, ' ');
  }
  
  captions.push(baseCaption);
  return captions;
}

function unicodeToFilename(unicode) {
  // Convert unicode like "1f620" to filename like "1f620.png"
  return `${unicode.toLowerCase()}.png`;
}

async function processTwitterAssets(options = {}) {
  const assetsPath = path.join(__dirname, 'assets');
  const twitter512Path = path.join(__dirname, '512x512-twitter');
  const twitterDataDir = path.join(__dirname, 'manualTwitter', 'data');
  const twitterJsonlDir = path.join(__dirname, 'manualTwitter', 'jsonl');
  
  console.log('Loading emoji categories...');
  const categories = await loadEmojiCategories();
  const manualCategories = await loadManualCategories();
  
  console.log('Creating manualTwitter directories...');
  await ensureDir(twitterDataDir);
  await ensureDir(twitterJsonlDir);
  
  console.log('Scanning asset directories...');
  const assetDirectories = await findAssetDirectories(assetsPath);
  console.log(`Found ${assetDirectories.length} asset directories`);
  
  // Create a map of unicode to metadata for quick lookup
  const unicodeToMetadata = new Map();
  
  for (const assetDir of assetDirectories) {
    const metadata = await readMetadata(assetDir);
    if (metadata && metadata.unicode) {
      unicodeToMetadata.set(metadata.unicode.toLowerCase(), metadata);
    }
  }
  
  console.log(`Created unicode metadata map with ${unicodeToMetadata.size} entries`);
  
  // Get all 512x512 PNG files
  const twitterFiles = await readdir(twitter512Path);
  let pngFiles = twitterFiles.filter(file => file.endsWith('.png'));
  if (options.defaultOnly) {
    pngFiles = pngFiles.filter((file) => !stringHasSkinToneModifier(file));
  }
  console.log(`Found ${pngFiles.length} PNG files in 512x512-twitter directory`);
  
  const twitterCategoryEntries = {};
  const twitterCategoryStats = {};
  let processedCount = 0;
  let skippedCount = 0;
  
  for (const filename of pngFiles) {
    // Extract unicode from filename (remove .png extension)
    const unicode = filename.replace('.png', '').toLowerCase();
    if (options.defaultOnly && stringHasSkinToneModifier(unicode)) {
      skippedCount++;
      continue;
    }
    
    // Look up metadata by unicode
    const metadata = unicodeToMetadata.get(unicode);
    
    if (!metadata) {
      console.log(`  Skipping ${filename} - no metadata found for unicode ${unicode}`);
      skippedCount++;
      continue;
    }
    
    // Determine category for this emoji
    const emojiName = metadata.cldr || filename.replace('.png', '').replace(/_/g, ' ');
    const emojiGlyph = metadata.glyph;
    const category = findEmojiCategory(emojiName, categories, manualCategories, emojiGlyph);
    
    // Check if this is a manual category - only process manual categories
    const isManual = isManualCategory(category, manualCategories);
    if (!isManual) {
      console.log(`  Skipping ${filename} - not in manual categories (category: ${category})`);
      skippedCount++;
      continue;
    }
    
    // Initialize twitter category stats and entries
    if (!twitterCategoryStats[category]) {
      twitterCategoryStats[category] = 0;
      twitterCategoryEntries[category] = [];
    }
    
    try {
      // Generate a safe filename based on CLDR name (same as manual folder)
      const safeFilename = (metadata.cldr || filename.replace('.png', '').replace(/_/g, ' '))
        .replace(/[^a-z0-9\s-]/gi, '_') // Replace special characters with underscores
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/_+/g, '_') // Replace multiple underscores with single underscore
        .replace(/^_|_$/g, '') // Remove leading/trailing underscores
        .toLowerCase() + '.png';
      
      // Copy the file to twitter category directory
      const twitterCategoryDir = path.join(twitterDataDir, category);
      await ensureDir(twitterCategoryDir);
      const sourcePath = path.join(twitter512Path, filename);
      const targetPath = path.join(twitterCategoryDir, safeFilename);
      await copyFile(sourcePath, targetPath);
      
      // Generate captions
      const captions = generateCaptions(metadata, safeFilename, category);
      
      // Create JSONL entries for twitter category
      for (const caption of captions) {
        const twitterRelativePath = `data/${category}/${safeFilename}`;
        twitterCategoryEntries[category].push({
          image: twitterRelativePath,
          caption: caption
        });
      }
      
      twitterCategoryStats[category]++;
      processedCount++;
      
    } catch (error) {
      console.error(`Failed to process ${filename}:`, error.message);
      skippedCount++;
    }
  }
  
  // Write twitter category JSONL files
  console.log(`\nWriting manualTwitter category JSONL files...`);
  let twitterTotalEntries = 0;
  for (const [category, entries] of Object.entries(twitterCategoryEntries)) {
    if (entries.length > 0) {
      // Convert category name to CamelCase
      const camelCaseName = category
        .replace(/[^a-z0-9\s-]/gi, '') // Remove special characters except spaces and hyphens
        .split(/[\s-]+/) // Split on spaces and hyphens
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
      const outputFile = path.join(twitterJsonlDir, `${camelCaseName}.jsonl`);
      const jsonlContent = entries
        .map(entry => JSON.stringify(entry))
        .join('\n');
      
      await writeFile(outputFile, jsonlContent, 'utf-8');
      twitterTotalEntries += entries.length;
      console.log(`  - ${category}: ${entries.length} entries -> ${outputFile}`);
    }
  }
  
  console.log(`\nTwitter dataset generation complete!`);
  console.log(`- Processed: ${processedCount} assets`);
  console.log(`- Skipped: ${skippedCount} assets`);
  console.log(`- ManualTwitter JSONL entries: ${twitterTotalEntries}`);
  console.log(`- ManualTwitter images copied to: ${twitterDataDir}`);
  console.log(`- ManualTwitter JSONL files written to: ${twitterJsonlDir}`);
  console.log(`\nManualTwitter category breakdown:`);
  for (const [category, count] of Object.entries(twitterCategoryStats)) {
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
        console.log('Usage: node generate_twitter_dataset.js [--default-only]');
        process.exit(0);
      default:
        break;
    }
  }
  processTwitterAssets(options).catch(error => {
    console.error('Error processing twitter assets:', error);
    process.exit(1);
  });
}

module.exports = { processTwitterAssets };
