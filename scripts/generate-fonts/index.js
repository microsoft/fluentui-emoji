import { resolve as path, basename } from 'node:path';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import SVGIcons2SVGFontStream from 'svgicons2svgfont';
import svg2ttf from 'svg2ttf';
import ttf2woff2 from 'ttf2woff2';

const assets_folder = path('..', '..', 'assets');
const output_folder = path('..', '..', 'dist', 'font');

const family_name = 'Fluent UI Emoji';

const variations = [
  // disbled: no .svg assets available
  // '3D',
  // disabled: Got an error parsing the glyph "alien": Unexpected character "N" at index 1. Command cannot follow comma.
  // 'Color',

  'Flat',
  'High Contrast',
];

const font_formats = {
  ttf: 'truetype',
  woff2: 'woff2',
};

const output_streams = {}

const overview = path(output_folder, 'index.html');

function red(x) { return `\x1b[38;2;255;127;127m${x}\x1b[0m`; }
function green(x) { return `\x1b[38;2;127;255;127m${x}\x1b[0m`; }
function gray(x) { return `\x1b[38;2;127;127;127m${x}\x1b[0m`; }


async function output_stream(family, variation) {
  if (! output_streams[variation]) {
    const fontName = `${family} ${variation}`;
    output_streams[variation] = new SVGIcons2SVGFontStream({ fontName });
    const fileName = fontName.replace(/\s/g, '-') + '.svg';
    await mkdir(path(output_folder, variation), { recursive: true });
    const out = path(output_folder, variation, fileName);
    output_streams[variation]
      .pipe(createWriteStream(out))
      .on('finish', async function () {
        console.info(`✅ ${green('svg')} Created ${out}`);
        const svgData = await readFile(out, 'utf8');
        const formats = [];
        const ttfData = await writeTtf(out.replace(/\.svg/, '.ttf'), svgData, formats);
        if (ttfData) {
          await writeWoff2(out.replace(/\.svg/, '.woff2'), ttfData, formats);
          await writeCss(path(output_folder, variation, 'webfont.css'),
              family, variation, formats);
        }
      })
      .on('error', function (e) {
        console.error(`❌ ${red('Error')} ${out}: ${e.message}`);
      });
  }
  return output_streams[variation];
}

async function write(file, data, fmt) {
  try {
    await writeFile(file, data);
    console.info(`✅ ${green(fmt)} Created ${file}`);
    return data;
  } catch(e) {
    console.error(`❌ ${red(fmt)} ${file}: ${e.message}`);
    return null;
  }
}

async function writeFont(file, data, fmt, formats) {
  const result = await write(file, data, fmt);
  if (result) {
    formats.push({ url: basename(file), format: font_formats[fmt] });
  }
  return result;
}

async function writeTtf(file, svgData, formats) {
  const ttfData = svg2ttf(svgData, {});
  return await writeFont(file, Buffer.from(ttfData.buffer), 'ttf', formats)
    ? ttfData
    : null;
}

async function writeWoff2(file, ttfData, formats) {
  const woff2Data = ttf2woff2(ttfData.buffer);
  return writeFont(file, woff2Data, 'woff2', formats);
}

async function writeCss(file, family, variation, formats) {
  const cssData = `@font-face {
  font-display: swap;
  font-family: '${family} ${variation}';
  font-style: normal;
  font-weight: normal;
  src: ${formats.map(({ url, format }) => `url('${url}') format('${format}')`).join(',\n    ')};
}
`
  return write(file, cssData, 'css');
}

async function writeHtml(glyphMeta) {
  const htmlData = `<html>
  <head>${variations.map(variation => `
    <link rel="stylesheet" href="${variation}/webfont.css" />`
  ).join('')}
    <style>
      table { width: 100%; }
      th { text-align: left; }${variations.map(variation => `
      #${variation.toLowerCase().replace(/\s/g, '-')}+table td:nth-child(3) {
        font-family: 'Fluent UI Emoji ${variation}';
      }`).join('')}
    </style>
  </head>
  <body>
    <h1>Fluent UI Emoji</h1>
    <ul>${variations.map(variation => `
      <li><a href="#${variation.toLowerCase().replace(/\s/g, '-')}">${variation}</a></li>`
    ).join('')}
    </ul>
    ${variations.map(variation => `
    <h2 id="${variation.toLowerCase().replace(/\s/g, '-')}">${variation}</h2>
    <table>
      <tr>
        <th>Emoji</th><th>Name</th><th>Glyph</th>
      </tr>
      ${Object.keys(glyphMeta).map(glyph => `
      <tr>
        <td>${glyph}</td><td>${glyphMeta[glyph]}</td><td>${glyph}</td>
      </tr>`
      ).join('')}
    </table>`
    ).join('')}
  </body>
</html>
`
  return write(path(output_folder, 'index.html'), htmlData, 'html');
}

async function readMeta(glyphFolder){
  const file = path(assets_folder, glyphFolder, 'metadata.json');
  let meta = null;
  try {
    const data = await readFile(file);
    meta = JSON.parse(data);
    console.info(gray(`${meta.glyph} - ${meta.tts}`));
    return meta;
  } catch(e) {
    console.error(`❌ ${red('ERROR')} ${file}: ${e.message}`);
    return null;
  }
}

async function writeGlyph(glyphFolder, variation, meta){
  let fileName = `${glyphFolder}_${variation}.svg`.toLowerCase().replace(/\s/g, '_');
  let glyphFile = path(assets_folder, glyphFolder, variation, fileName);
  try {
    await stat(glyphFile);
  } catch(e) {
    // glyph file not found... maybe skintone, try Default
    fileName = `${glyphFolder}_${variation}_default.svg`.toLowerCase().replace(/\s/g, '_');
    glyphFile = path(assets_folder, glyphFolder, 'Default', variation, fileName);
    try {
      await stat(glyphFile);
    } catch(e) {
      // not found, skip
      return null;
    }
  }

  const glyph = createReadStream(glyphFile);
  glyph.metadata = {
    unicode: [meta.glyph],
    name: meta.tts,
  };
  const stream = await output_stream(family_name, variation);
  stream.write(glyph);
  return glyph;
}

// MAIN

// add glyphs to fonts, create output streams on demand
const glyphFolders = await readdir(assets_folder);
const glyphMeta = {};
for (const glyphFolder of glyphFolders) {
  const meta = await readMeta(glyphFolder);
  if (! meta) continue;
  for (const variation of variations) {
    const glyph = await writeGlyph(glyphFolder, variation, meta);
    if (! glyph) continue;
    glyphMeta[meta.glyph] = meta.tts;
  }
}

// end all output streams
for (const name of Object.keys(output_streams)) {
  const stream = output_streams[name];
  stream.end();
}

await writeHtml(glyphMeta);