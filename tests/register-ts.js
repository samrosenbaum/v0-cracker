const fs = require('node:fs');
const path = require('node:path');
const Module = require('module');
const ts = require('typescript');

const baseUrl = path.resolve(__dirname, '..');

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function patchedResolve(request, parent, isMain, options) {
  if (typeof request === 'string') {
    if (request.startsWith('@/')) {
      const resolved = path.join(baseUrl, request.slice(2));
      return originalResolveFilename.call(this, resolved, parent, isMain, options);
    }

    if (request.startsWith('pdfjs-dist/')) {
      try {
        return originalResolveFilename.call(this, request, parent, isMain, options);
      } catch (error) {
        const nestedRequest = path.join(
          baseUrl,
          'node_modules',
          'pdf-parse',
          'node_modules',
          request
        );
        return originalResolveFilename.call(this, nestedRequest, parent, isMain, options);
      }
    }
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const compilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020,
  esModuleInterop: true,
  resolveJsonModule: true,
  jsx: ts.JsxEmit.ReactJSX,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
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
