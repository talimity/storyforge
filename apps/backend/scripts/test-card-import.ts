#!/usr/bin/env node
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function uploadCard() {
  const dataDir = join(__dirname, "../data");
  const pngFiles = readdirSync(dataDir).filter((file) => file.endsWith(".png"));

  if (pngFiles.length === 0) {
    console.error("❌ No PNG files found in data directory");
    process.exit(1);
  }

  const randomFile = pngFiles[Math.floor(Math.random() * pngFiles.length)];
  const cardPath = join(dataDir, randomFile!);

  try {
    console.log("📁 Reading card file:", cardPath);
    const cardData = readFileSync(cardPath);

    console.log("📤 Uploading to import endpoint...");
    const formData = new FormData();
    const blob = new Blob([cardData], { type: "image/png" });
    formData.append("file", blob, randomFile);

    const response = await fetch(
      "http://localhost:3001/api/characters/import",
      { method: "POST", body: formData }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log("✅ Import successful!");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ Import failed:", error);
    process.exit(1);
  }
}

uploadCard();
