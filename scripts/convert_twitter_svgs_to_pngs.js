#!/usr/bin/env node

// Convert all SVGs in svg-twitter/ to PNGs in 512x512-twitter/ at a target size (default 512x512).

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { execFile } = require('child_process');

const readdir = promisify(fs.readdir);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);
const execFileAsync = promisify(execFile);

async function ensureDir(dirPath) {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

async function listSvgFiles(dirPath) {
  const items = await readdir(dirPath);
  const svgs = [];
  for (const item of items) {
    const p = path.join(dirPath, item);
    const st = await stat(p);
    if (st.isFile() && item.toLowerCase().endsWith('.svg')) {
      svgs.push(p);
    }
  }
  return svgs;
}

async function convertSvgToPng(svgPath, pngPath, size) {
  // macOS sips
  try {
    await execFileAsync('sips', ['-s', 'format', 'png', '-Z', String(size), svgPath, '--out', pngPath]);
    return true;
  } catch {}
  // librsvg
  try {
    await execFileAsync('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', pngPath, svgPath]);
    return true;
  } catch {}
  // ImageMagick
  try {
    await execFileAsync('convert', ['-background', 'transparent', '-size', `${size}x${size}`, svgPath, pngPath]);
    return true;
  } catch {}
  // Inkscape
  try {
    await execFileAsync('inkscape', [`--export-filename=${pngPath}`, `--export-width=${size}`, `--export-height=${size}`, svgPath]);
    return true;
  } catch (error) {
    console.error(`Failed to convert ${path.basename(svgPath)}: ${error.message}`);
    return false;
  }
}

function toPngName(svgFile) {
  return svgFile.replace(/\.svg$/i, '.png');
}

async function processTwitterSvgs(options = {}) {
  const { size = 512, test = false, testCount = 10 } = options;
  const root = path.join(__dirname, '..');
  const inputDir = path.join(root, 'svg-twitter');
  const outputDir = path.join(root, '512x512-twitter');

  console.log('Creating output directory...');
  await ensureDir(outputDir);

  console.log('Scanning svg-twitter...');
  const allSvgs = await listSvgFiles(inputDir);
  console.log(`Found ${allSvgs.length} SVG files`);

  const filesToProcess = test ? allSvgs.slice(0, Math.max(0, testCount)) : allSvgs;
  console.log(`Processing ${filesToProcess.length} files${test ? ' (test mode)' : ''}...`);

  let processed = 0;
  let succeeded = 0;

  for (const svgPath of filesToProcess) {
    const base = path.basename(svgPath);
    const outPath = path.join(outputDir, toPngName(base));
    console.log(`Converting ${base}...`);
    try {
      const ok = await convertSvgToPng(svgPath, outPath, size);
      if (ok) {
        console.log(`  ✓ ${path.basename(outPath)}`);
        succeeded++;
      } else {
        console.log('  ✗ failed');
      }
    } catch (e) {
      console.error(`  ✗ error: ${e.message}`);
    }
    processed++;
  }

  console.log('\nTwitter SVG conversion complete!');
  console.log(`- Processed: ${processed}`);
  console.log(`- Successful: ${succeeded}`);
  console.log(`- Output: ${outputDir}`);
  console.log(`- Size: ${size}x${size}`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    switch (a) {
      case '--size':
        options.size = parseInt(args[++i], 10) || 512;
        break;
      case '--test':
        options.test = true;
        options.testCount = parseInt(args[++i], 10) || 10;
        break;
      case '--help':
        console.log('Usage: node scripts/convert_twitter_svgs_to_pngs.js [--size N] [--test N]');
        process.exit(0);
      default:
        break;
    }
  }

  processTwitterSvgs(options).catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
}

module.exports = { processTwitterSvgs };


