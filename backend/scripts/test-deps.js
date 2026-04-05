// Minimal polyfill (same as rag.js)
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() { this.a=1;this.b=0;this.c=0;this.d=1;this.e=0;this.f=0 }
    static fromMatrix() { return new DOMMatrix() }
  }
}

require('pdf-parse')
console.log('pdf-parse: OK')

require('canvas')
console.log('canvas: OK')

require('tesseract.js')
console.log('tesseract.js: OK')

import('pdfjs-dist/legacy/build/pdf.mjs')
  .then(() => console.log('pdfjs-dist legacy ESM: OK\n\nAll deps loaded — OCR pipeline is ready.'))
  .catch(e => console.error('pdfjs-dist FAILED:', e.message))
