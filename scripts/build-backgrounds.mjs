// Builds the site background from the owner's two framed artworks (assets/source):
// a parchment + blush watercolour texture, and flower corners with feathered transparency.
// Usage: node scripts/build-backgrounds.mjs
import sharp from "sharp";

const P = "assets/source/floral-parchment.jpg";
const R = "assets/source/blush-roses-frame.jpg";
const OUT = "public/images/backgrounds";

// Texture: the parchment's damask centre, washed with the blush watercolour.
const parchment = await sharp(P).extract({ left: 140, top: 270, width: 460, height: 640 }).resize(1200, 1600, { fit: "cover" }).blur(0.6).toBuffer();
const blushBase = await sharp(R).extract({ left: 120, top: 200, width: 430, height: 560 }).resize(1200, 1600, { fit: "cover" }).blur(1.2).raw().toBuffer({ resolveWithObject: true });
// Watercolour at 55 % over the parchment, so both artworks read through.
const alpha = Buffer.alloc(1200 * 1600, Math.round(255 * 0.55));
const blush = await sharp(blushBase.data, { raw: blushBase.info }).joinChannel(alpha, { raw: { width: 1200, height: 1600, channels: 1 } }).png().toBuffer();
await sharp(parchment)
  .composite([{ input: blush, blend: "over" }])
  .modulate({ brightness: 1.05, saturation: 0.88 })
  .webp({ quality: 74 })
  .toFile(`${OUT}/site-texture.webp`);

/** Crops a corner and feathers it into transparency away from the given corner. */
async function corner(src, name, box, at, reach = 1) {
  const { width: w, height: h } = box;
  // Two linear fades (across and down), so every inner edge dissolves; the outer edges stay at the viewport edge.
  const fade = (x1, y1, x2, y2) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
        `<stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="${reach * 0.6}" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>` +
        `</linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`,
    );
  const right = at.includes("r");
  const bottom = at.includes("b");
  const across = await sharp(src).extract(box).ensureAlpha().composite([{ input: fade(right ? 1 : 0, 0, right ? 0 : 1, 0), blend: "dest-in" }]).png().toBuffer();
  await sharp(across)
    .composite([{ input: fade(0, bottom ? 1 : 0, 0, bottom ? 0 : 1), blend: "dest-in" }])
    .webp({ quality: 82, alphaQuality: 90 })
    .toFile(`${OUT}/${name}.webp`);
}

await corner(P, "corner-rose-tl", { left: 12, top: 0, width: 210, height: 220 }, "tl", 0.95);
await corner(P, "corner-peony-tr", { left: 450, top: 0, width: 286, height: 280 }, "tr", 0.9);
await corner(P, "corner-lilies-bl", { left: 0, top: 880, width: 340, height: 428 }, "bl", 0.95);
await corner(R, "corner-roses-br", { left: 340, top: 760, width: 335, height: 440 }, "br", 0.95);
console.log("backgrounds built");
