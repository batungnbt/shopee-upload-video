const fs = require('fs');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { targets, obfuscatorOptions } = require('./client-js-obfuscation.config');

function getExpectedCode(sourceCode) {
  return JavaScriptObfuscator.obfuscate(sourceCode, obfuscatorOptions).getObfuscatedCode();
}

function run() {
  let hasError = false;

  targets.forEach((target) => {
    if (!fs.existsSync(target.source)) {
      console.error(`[verify-obfuscation] Missing source file: ${target.source}`);
      hasError = true;
      return;
    }
    if (!fs.existsSync(target.output)) {
      console.error(`[verify-obfuscation] Missing output file: ${target.output}`);
      hasError = true;
      return;
    }

    const sourceCode = fs.readFileSync(target.source, 'utf8');
    const outputCode = fs.readFileSync(target.output, 'utf8');
    const expectedCode = getExpectedCode(sourceCode);

    if (outputCode !== expectedCode) {
      console.error(`[verify-obfuscation] ${target.label} is not obfuscated/latest. Run: npm run obfuscate:client-js`);
      hasError = true;
      return;
    }

    if (outputCode === sourceCode) {
      console.error(`[verify-obfuscation] ${target.label} appears to be plain source code.`);
      hasError = true;
      return;
    }

    console.log(`[verify-obfuscation] OK: ${target.label}`);
  });

  if (hasError) {
    process.exit(1);
  }
}

run();
