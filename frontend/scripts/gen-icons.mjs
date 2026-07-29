/**
 * Rasterise app/icon.svg into the icons Next.js and the app stores can't serve as SVG.
 *
 *   npm run icons
 *
 * Produces:
 *   app/favicon.ico        16/32/48 — old browsers and Windows shortcuts
 *   app/apple-icon.png     180 — iOS home screen (Next.js file convention)
 *   public/logo.svg        copy of the mark, for READMEs and OG images
 *   public/logo-512.png    submission / store listing size
 *
 * app/icon.svg is the source of truth and is what modern browsers actually use.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = await readFile(path.join(root, "app", "icon.svg"));

const png = (size) =>
  sharp(src, { density: 384 }).resize(size, size, { fit: "contain" }).png({ compressionLevel: 9 }).toBuffer();

/** ICO container holding PNG frames (supported by every browser we target). */
function ico(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(frames.length, 4);

  let offset = 6 + frames.length * 16;
  const dir = frames.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });

  return Buffer.concat([header, ...dir, ...frames.map((f) => f.data)]);
}

const icoSizes = [16, 32, 48];
const frames = await Promise.all(icoSizes.map(async (size) => ({ size, data: await png(size) })));
await writeFile(path.join(root, "app", "favicon.ico"), ico(frames));
await writeFile(path.join(root, "app", "apple-icon.png"), await png(180));

await mkdir(path.join(root, "public"), { recursive: true });
await writeFile(path.join(root, "public", "logo.svg"), src);
await writeFile(path.join(root, "public", "logo-512.png"), await png(512));

console.log("icons: app/favicon.ico, app/apple-icon.png, public/logo.svg, public/logo-512.png");
