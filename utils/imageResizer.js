const fs = require('fs');
const path = require('path');
let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  // sharp not available — we'll fallback to a safe copy operation so server won't crash.
  console.warn('Warning: `sharp` not installed. Image resizing will be skipped. Install `sharp` for full functionality.');
}

// Resize source image to width (preserving aspect ratio) and write to outPath.
// If `sharp` is available, performs real resize. Otherwise copies source to outPath.
async function resizeAndCache(srcPath, outPath, width, quality = 82) {
  if (!fs.existsSync(srcPath)) throw new Error('Source image not found: ' + srcPath);

  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });

  if (sharp) {
    // Use sharp to resize and write in same format (jpeg/webp/png handling)
    const ext = path.extname(outPath).toLowerCase();
    const pipeline = sharp(srcPath).rotate(); // auto-orient

    if (width && Number(width) > 0) pipeline.resize({ width: Number(width), withoutEnlargement: true });

    if (ext === '.webp') pipeline.webp({ quality });
    else if (ext === '.png') pipeline.png({ quality });
    else pipeline.jpeg({ quality });

    await pipeline.toFile(outPath);
    return outPath;
  }

  // Fallback: simply copy the source file to outPath (no resizing)
  await new Promise((resolve, reject) => {
    const rs = fs.createReadStream(srcPath);
    const ws = fs.createWriteStream(outPath);
    rs.on('error', reject);
    ws.on('error', reject);
    ws.on('finish', resolve);
    rs.pipe(ws);
  });

  return outPath;
}

module.exports = { resizeAndCache };
