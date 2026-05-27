/**
 * Generates a multi-size .ico from PNG files in the icons/ folder.
 * ICO format with embedded PNG (supported by Windows Vista+).
 * Sizes included: 16, 32, 48, 64, 128, 256
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SIZES = [16, 32, 48, 64, 128, 256];
const OUT = path.join(ROOT, 'src', 'images', 'icon.ico');

const pngBuffers = SIZES.map(size => {
  const p = path.join(ROOT, 'icons', `icon-${size}.png`);
  if (!fs.existsSync(p)) {
    console.error(`Missing: icons/icon-${size}.png`);
    process.exit(1);
  }
  return fs.readFileSync(p);
});

// ICO header: reserved(2) + type=1(2) + count(2)
const count = SIZES.length;
const headerSize = 6;
const dirEntrySize = 16;
const dirSize = count * dirEntrySize;

let dataOffset = headerSize + dirSize;
const offsets = [];
for (const buf of pngBuffers) {
  offsets.push(dataOffset);
  dataOffset += buf.length;
}

const totalSize = dataOffset;
const ico = Buffer.alloc(totalSize);

// Write header
ico.writeUInt16LE(0, 0);       // reserved
ico.writeUInt16LE(1, 2);       // type: 1 = ICO
ico.writeUInt16LE(count, 4);   // image count

// Write directory entries
for (let i = 0; i < count; i++) {
  const base = headerSize + i * dirEntrySize;
  const size = SIZES[i];
  ico.writeUInt8(size >= 256 ? 0 : size, base);      // width (0 means 256)
  ico.writeUInt8(size >= 256 ? 0 : size, base + 1);  // height
  ico.writeUInt8(0, base + 2);    // color count
  ico.writeUInt8(0, base + 3);    // reserved
  ico.writeUInt16LE(1, base + 4); // planes
  ico.writeUInt16LE(32, base + 6); // bit count
  ico.writeUInt32LE(pngBuffers[i].length, base + 8);  // size of image data
  ico.writeUInt32LE(offsets[i], base + 12);            // offset to image data
}

// Write PNG data
let pos = headerSize + dirSize;
for (const buf of pngBuffers) {
  buf.copy(ico, pos);
  pos += buf.length;
}

fs.writeFileSync(OUT, ico);
console.log(`Written: ${OUT} (${(ico.length / 1024).toFixed(1)} KB, ${count} sizes)`);
