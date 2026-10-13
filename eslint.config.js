const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const unusedImports = require('eslint-plugin-unused-imports');
module.exports = defineConfig([
 expoConfig,
 {ignores:['**/dist/**','design/**','tools/**','**/worker-configuration.d.ts']},
 {plugins:{'unused-imports':unusedImports},rules:{'unused-imports/no-unused-imports':'error'}},
]);
