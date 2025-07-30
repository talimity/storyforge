#!/usr/bin/env node
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function uploadCard() {
  const cardPath = join(__dirname, '../data/main_kyria-guardswoman-e1ea5be7_spec_v2.png');
  
  try {
    console.log('📁 Reading card file:', cardPath);
    const cardData = readFileSync(cardPath);
    
    console.log('📤 Uploading to import endpoint...');
    const formData = new FormData();
    const blob = new Blob([cardData], { type: 'image/png' });
    formData.append('file', blob, 'test-card.png');
    
    const response = await fetch('http://localhost:3001/api/characters/import', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ Import successful!');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

uploadCard();