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

require.extensions['.ts'] = function registerTsExtension(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const transformed = ts.transpileModule(source, {
    compilerOptions,
    fileName: filename,
    reportDiagnostics: false,
  });
  return module._compile(transformed.outputText, filename);
};
