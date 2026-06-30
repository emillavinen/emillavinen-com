#!/usr/bin/env tsx
/**
 * Generates all favicon and app icon files as SVG.
 * Run with: npx tsx scripts/generate-icons.ts
 *
 * To replace icons: update the SVG source below or
 * place a new source at /scripts/icon-source.svg and re-run.
 */
import fs from "fs";
import path from "path";

const ICONS_DIR = path.join(process.cwd(), "public/icons");

function elSVG(size: number): string {
  const fontSize = Math.round(size * 0.45);
  const x = Math.round(size * 0.5);
  const y = Math.round(size * 0.62);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0A0A0A"/>
  <text
    x="${x}" y="${y}"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="${fontSize}"
    font-weight="400"
    fill="#FFFFFF"
    text-anchor="middle"
    dominant-baseline="auto"
    letter-spacing="1"
  >EL</text>
</svg>`;
}

function safariPinnedSVG(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#000000"/>
  <text x="50" y="62" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="400" fill="#FFFFFF" text-anchor="middle">EL</text>
</svg>`;
}

function ogDefaultSVG(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0A0A0A"/>
  <text x="80" y="260" font-family="system-ui, -apple-system, sans-serif" font-size="96" font-weight="400" fill="#FFFFFF" letter-spacing="-2">Emil Lavinen</text>
  <text x="80" y="340" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="400" fill="#888888" letter-spacing="4">CREATIVE DIRECTOR &amp; BRAND STRATEGIST</text>
  <text x="80" y="560" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="400" fill="#555555" letter-spacing="2">emillavinen.com</text>
</svg>`;
}

const ICON_SIZES: Array<{ name: string; size: number }> = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "favicon-48x48.png", size: 48 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "android-chrome-192x192.png", size: 192 },
  { name: "android-chrome-512x512.png", size: 512 },
  { name: "mstile-150x150.png", size: 150 },
];

function main() {
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  // Write SVG versions (PNG names but SVG content — browsers handle SVGs fine for icons)
  // For production PNG conversion, pipe through sharp or imagemagick
  for (const { name, size } of ICON_SIZES) {
    const svgName = name.replace(".png", ".svg");
    fs.writeFileSync(path.join(ICONS_DIR, svgName), elSVG(size), "utf8");
    // Write an SVG as .png placeholder (rename to .svg in prod if using SVG-only icons)
    fs.writeFileSync(path.join(ICONS_DIR, name), elSVG(size), "utf8");
    console.log(`✓ ${name} (${size}×${size})`);
  }

  // favicon.ico — write as SVG (modern browsers accept SVG favicon.ico)
  fs.writeFileSync(path.join(ICONS_DIR, "favicon.ico"), elSVG(32), "utf8");
  console.log("✓ favicon.ico");

  // safari-pinned-tab.svg
  fs.writeFileSync(path.join(ICONS_DIR, "safari-pinned-tab.svg"), safariPinnedSVG(), "utf8");
  console.log("✓ safari-pinned-tab.svg");

  // og-default (SVG)
  fs.writeFileSync(path.join(ICONS_DIR, "og-default.svg"), ogDefaultSVG(), "utf8");
  fs.writeFileSync(path.join(ICONS_DIR, "og-default.png"), ogDefaultSVG(), "utf8");
  console.log("✓ og-default.png (SVG source)");

  console.log("\nDone. All icons written to /public/icons/");
  console.log("Note: For production PNG icons, run through sharp or imagemagick:");
  console.log("  npx sharp-cli -i public/icons/android-chrome-192x192.svg -o public/icons/android-chrome-192x192.png");
}

main();
