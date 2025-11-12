/**
 * Minimal DOMMatrix polyfill for Node.js environments.
 *
 * Some pdf.js based libraries expect `globalThis.DOMMatrix` to exist. When the
 * API routes run on the server this class is missing which causes a
 * `ReferenceError` during module evaluation and prevents the handlers from
 * loading. We only need a minimal stub so the constructors resolve without
 * throwing. Any functionality that depends on the full DOMMatrix math API is
 * unused in our document parsing pipeline because we rely on `pdf-parse`, which
 * only checks for the presence of the constructor.
 */

if (typeof globalThis.DOMMatrix === 'undefined') {
  class DOMMatrixPolyfill {
    constructor(init?: DOMMatrixInit | string) {
      // Store the input so debugging is easier if a library unexpectedly uses it
      // in the future. The values are otherwise unused by our server runtime.
      if (init) {
        (this as any)._init = init;
      }
    }
  }

  // @ts-ignore - Node's global scope does not declare DOMMatrix.
  globalThis.DOMMatrix = DOMMatrixPolyfill;
}

export {};
