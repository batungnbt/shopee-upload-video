const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const targets = [
  {
    source: path.join(rootDir, 'src', 'client-js', 'campaign_jobs.js'),
    output: path.join(rootDir, 'public', 'js', 'campaign_jobs.js'),
    label: 'campaign_jobs.js'
  },
  {
    source: path.join(rootDir, 'src', 'client-js', 'video_upload_manager.js'),
    output: path.join(rootDir, 'public', 'js', 'video_upload_manager.js'),
    label: 'video_upload_manager.js'
  }
];

const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.85,
  deadCodeInjection: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  rotateStringArray: true,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  stringArray: true,
  stringArrayThreshold: 0.8,
  stringArrayEncoding: ['base64'],
  unicodeEscapeSequence: false,
  sourceMap: false,
  seed: 20260505
};

module.exports = {
  rootDir,
  targets,
  obfuscatorOptions
};
