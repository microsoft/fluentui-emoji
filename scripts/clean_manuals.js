#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function removeDirectoryRecursive(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) return;

  for (const entry of fs.readdirSync(targetPath)) {
    const entryPath = path.join(targetPath, entry);
    const entryStat = fs.lstatSync(entryPath);
    if (entryStat.isDirectory()) {
      removeDirectoryRecursive(entryPath);
    } else {
      try {
        fs.unlinkSync(entryPath);
      } catch {}
    }
  }
  try {
    fs.rmdirSync(targetPath);
  } catch {}
}

function removeDir(targetPath) {
  try {
    // Prefer modern API if available (Node >=14.14)
    if (typeof fs.rmSync === 'function') {
      fs.rmSync(targetPath, { recursive: true, force: true });
      return;
    }
  } catch {}
  // Fallback to manual recursive removal
  removeDirectoryRecursive(targetPath);
}

function main() {
  const repoRoot = path.join(__dirname, '..');
  const entries = fs.readdirSync(repoRoot, { withFileTypes: true });
  const manualDirs = entries
    .filter((d) => d.isDirectory() && d.name.toLowerCase().startsWith('manual'))
    .map((d) => d.name)
    .sort();

  if (manualDirs.length === 0) {
    console.log('No manual* directories found.');
    return;
  }

  console.log('Removing directories:');
  for (const dirName of manualDirs) {
    const targetPath = path.join(repoRoot, dirName);
    console.log(`- ${dirName}`);
    removeDir(targetPath);
  }
  console.log('Done.');
}

if (require.main === module) {
  try {
    main();
    process.exit(0);
  } catch (err) {
    console.error('Error cleaning manual* directories:', err.message);
    process.exit(1);
  }
}

module.exports = { main };


