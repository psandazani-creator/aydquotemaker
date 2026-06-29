import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, '../dist');
const publicDir = path.join(__dirname, '../public');
const publicInDistDir = path.join(distDir, 'public');

// Copy static assets from public to dist (except HTML files)
const staticAssets = ['FullLogo.png', 'favicon.ico', 'logo192.png', 'logo512.png'];

staticAssets.forEach(asset => {
  const src = path.join(publicDir, asset);
  const dest = path.join(distDir, asset);
  
  if (fs.existsSync(src) && !fs.existsSync(dest)) {
    try {
      fs.copyFileSync(src, dest);
      console.log(`  ✓ Copied ${asset}`);
    } catch (err) {
      console.warn(`  ⚠ Failed to copy ${asset}: ${err.message}`);
    }
  }
});

// Check if dist/public exists and cleanup
if (fs.existsSync(publicInDistDir)) {
  try {
    // Move all files from dist/public to dist
    const files = fs.readdirSync(publicInDistDir);
    
    files.forEach(file => {
      const src = path.join(publicInDistDir, file);
      const dest = path.join(distDir, file);
      
      // Skip if destination already exists
      if (fs.existsSync(dest)) {
        return;
      }
      
      if (fs.statSync(src).isDirectory()) {
        copyDirRecursive(src, dest);
      } else {
        fs.copyFileSync(src, dest);
      }
    });
    
    // Remove the now-empty public directory
    fs.rmSync(publicInDistDir, { recursive: true, force: true });
    console.log('✓ Cleaned up dist/public directory');
  } catch (err) {
    console.warn(`⚠ Error cleaning dist/public: ${err.message}`);
  }
} else {
  console.log('✓ dist/public already cleaned');
}

console.log('✓ Successfully prepared dist/ for production');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const files = fs.readdirSync(src);
  files.forEach(file => {
    const srcFile = path.join(src, file);
    const destFile = path.join(dest, file);
    
    if (fs.statSync(srcFile).isDirectory()) {
      copyDirRecursive(srcFile, destFile);
    } else {
      fs.copyFileSync(srcFile, destFile);
    }
  });
}
