const fs = require('node:fs');
const ts = require('typescript');

const compilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020,
  esModuleInterop: true,
  resolveJsonModule: true,
  jsx: ts.JsxEmit.ReactJSX,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
};

const Module = require('node:module');
const path = require('node:path');
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (typeof request === 'string' && request.startsWith('@/')) {
    const absolutePath = path.join(__dirname, '..', request.slice(2));
    return originalResolveFilename.call(this, absolutePath, parent, isMain, options);
  }
  if (request === 'pdfjs-dist/legacy/build/pdf.mjs') {
    const stubPath = path.join(__dirname, 'stubs', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs');
    return originalResolveFilename.call(this, stubPath, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions['.ts'] = function registerTsExtension(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const transformed = ts.transpileModule(source, {
    compilerOptions,
    fileName: filename,
    reportDiagnostics: false,
  });
  return module._compile(transformed.outputText, filename);
};
