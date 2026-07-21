const fs = require('fs')
const path = require('path')

const out = path.join(__dirname, '..', 'public')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#3b5bdb"/><stop offset="50%" stop-color="#995af2"/><stop offset="100%" stop-color="#14b8a6"/>
  </linearGradient></defs>
  <circle cx="32" cy="32" r="30" fill="url(#g)"/>
  <text x="32" y="42" text-anchor="middle" fill="#fff" font-size="28" font-weight="800" font-family="Arial,sans-serif">S</text>
</svg>`

async function main() {
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, 'icon.svg'), svg)
  fs.copyFileSync(path.join(out, 'icon.svg'), path.join(out, 'apple-touch-icon.svg'))
  try {
    const sharp = require('sharp')
    const buf = Buffer.from(svg)
    await sharp(buf).resize(192, 192).png().toFile(path.join(out, 'icon-192.png'))
    await sharp(buf).resize(512, 512).png().toFile(path.join(out, 'icon-512.png'))
    await sharp(buf).resize(32, 32).png().toFile(path.join(out, 'favicon.png'))
    console.log('PNG icons written to', out)
  } catch (e) {
    console.log('sharp unavailable, SVG only:', e.message)
  }
}
main()
