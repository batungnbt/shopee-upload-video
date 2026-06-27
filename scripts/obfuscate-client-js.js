const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { targets, obfuscatorOptions } = require('./client-js-obfuscation.config');

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function obfuscateCode(sourceCode) {
  const result = JavaScriptObfuscator.obfuscate(sourceCode, obfuscatorOptions);
  return result.getObfuscatedCode();
}

function run() {
  targets.forEach((target) => {
    if (!fs.existsSync(target.source)) {
      throw new Error(`Missing source file: ${target.source}`);
    }
    const sourceCode = fs.readFileSync(target.source, 'utf8');
    const outputCode = obfuscateCode(sourceCode);
    ensureDir(target.output);
    fs.writeFileSync(target.output, outputCode, 'utf8');
    console.log(`[obfuscate] ${target.label} -> ${target.output}`);
  });
}

try {
  run();
} catch (error) {
  console.error('[obfuscate] failed:', error.message);
  process.exit(1);
}
