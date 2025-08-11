/** biome-ignore-all lint/style/noNonNullAssertion: test code */

import path from "node:path";
import sharp from "sharp";
import { detectFaceFocalPoint, focalPointToBox } from "./src/index";

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: node test-focal-detection.js <image-path>");
  process.exit(1);
}

const inputPath = args[0];
const padding = parseFloat(args[1]) || 1.2; // Default padding multiplier

(async () => {
  try {
    console.log(`\nProcessing: ${inputPath}`);

    // Get image metadata
    const metadata = await sharp(inputPath).metadata();
    console.log(`Image size: ${metadata.width}x${metadata.height}`);

    // Detect focal point
    const focal = await detectFaceFocalPoint(inputPath);

    if (!focal) {
      console.log("❌ No face detected");
      process.exit(0);
    }

    console.log("\n✅ Face detected!");
    console.log(
      `Center: ${(focal.x * 100).toFixed(1)}%, ${(focal.y * 100).toFixed(1)}%`
    );
    console.log(
      `Size: ${(focal.width * 100).toFixed(1)}% x ${(focal.height * 100).toFixed(1)}%`
    );
    console.log(`Confidence: ${(focal.confidence * 100).toFixed(1)}%`);

    // Convert back to pixel coordinates for visualization
    const box = focalPointToBox(focal, metadata.width!, metadata.height!);
    console.log(`\nPixel coordinates:`);
    console.log(`Box: ${box.x}, ${box.y}, ${box.width}x${box.height}`);

    // Create visualization
    // Control crop tightness with padding multiplier
    // 1.0 = exact face box (very tight)
    // 1.2 = 20% padding (tight portrait crop)
    // 1.5 = 50% padding (comfortable portrait)
    // 2.0 = 100% padding (wide portrait showing shoulders)
    const cropPadding = padding;

    const size = Math.round(Math.max(box.width, box.height) * cropPadding);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const left = Math.max(0, Math.round(cx - size / 2));
    const top = Math.max(0, Math.round(cy - size / 2));

    // Ensure crop doesn't exceed image bounds
    const cropSize = Math.min(
      size,
      metadata.width! - left,
      metadata.height! - top
    );

    // Create side-by-side preview
    // Calculate scale for resizing
    const previewWidth = 400;
    const scale = previewWidth / metadata.width!;
    const previewHeight = Math.round(metadata.height! * scale);

    const origBuffer = await sharp(inputPath)
      .resize({ width: previewWidth, height: previewHeight })
      .toBuffer();

    const cropBuffer = await sharp(inputPath)
      .extract({
        left,
        top,
        width: cropSize,
        height: cropSize,
      })
      .resize({ width: 400, height: 400, fit: "cover" })
      .toBuffer();

    // Scale box coordinates for the resized preview
    const scaledBox = {
      x: Math.round(box.x * scale),
      y: Math.round(box.y * scale),
      width: Math.round(box.width * scale),
      height: Math.round(box.height * scale),
    };
    const scaledCx = Math.round(cx * scale);
    const scaledCy = Math.round(cy * scale);

    // Draw red box on original to show detection
    const origWithBox = await sharp(origBuffer)
      .composite([
        {
          input: Buffer.from(
            `<svg width="${previewWidth}" height="${previewHeight}">
            <rect x="${scaledBox.x}" y="${scaledBox.y}" width="${scaledBox.width}" height="${scaledBox.height}" 
                  fill="none" stroke="red" stroke-width="3"/>
            <circle cx="${scaledCx}" cy="${scaledCy}" r="5" fill="red"/>
          </svg>`
          ),
          top: 0,
          left: 0,
        },
      ])
      .toBuffer();

    const outName = path.join(
      path.dirname(inputPath),
      `${path.parse(inputPath).name}-focal-preview.png`
    );

    await sharp({
      create: {
        width: 820,
        height: Math.max(400, previewHeight),
        channels: 3,
        background: { r: 240, g: 240, b: 240 },
      },
    })
      .composite([
        { input: origWithBox, left: 10, top: 0 },
        { input: cropBuffer, left: 420, top: 0 },
      ])
      .png()
      .toFile(outName);

    console.log(`\n📸 Preview saved to: ${outName}`);

    // Show example database record
    console.log("\n📄 Example database record:");
    console.log(
      JSON.stringify(
        {
          focalPoint: {
            x: parseFloat(focal.x.toFixed(4)),
            y: parseFloat(focal.y.toFixed(4)),
            width: parseFloat(focal.width.toFixed(4)),
            height: parseFloat(focal.height.toFixed(4)),
            confidence: parseFloat(focal.confidence.toFixed(3)),
          },
        },
        null,
        2
      )
    );
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
})();
