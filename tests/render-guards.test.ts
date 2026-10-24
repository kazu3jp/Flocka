import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

/**
 * React Native throws "Text strings must be rendered within a <Text> component"
 * when `{value && <View/>}` renders "" or 0 straight into a View. React on the
 * web accepts it, so the web tests never catch it. A string or number on the
 * left of `&&` in JSX children must be turned into a boolean first, for example
 * `{value ? <View/> : null}`.
 */
const mobileRoot = path.resolve(__dirname, "../apps/mobile");

function canBeEmptyStringOrZero(type: ts.Type) {
  return (type.isUnion() ? type.types : [type]).some(
    (part) =>
      Boolean(part.flags & (ts.TypeFlags.String | ts.TypeFlags.Number)) ||
      (part.isStringLiteral() && part.value === "") ||
      (part.isNumberLiteral() && part.value === 0),
  );
}

test("no JSX guard can render an empty string or zero into a native view", () => {
  const configPath = ts.findConfigFile(
    mobileRoot,
    ts.sys.fileExists,
    "tsconfig.json",
  );
  assert.ok(configPath, "apps/mobile/tsconfig.json");
  const config = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        );
      },
    },
  );
  assert.ok(config);
  const program = ts.createProgram(config.fileNames, config.options);
  const checker = program.getTypeChecker();
  const offenders: string[] = [];
  const sourceRoot = path.join(mobileRoot, "src") + path.sep;
  for (const file of program.getSourceFiles()) {
    if (
      !path.normalize(file.fileName).startsWith(sourceRoot) ||
      file.isDeclarationFile
    )
      continue;
    const visit = (node: ts.Node) => {
      if (
        ts.isJsxExpression(node) &&
        node.expression &&
        ts.isBinaryExpression(node.expression) &&
        node.expression.operatorToken.kind ===
          ts.SyntaxKind.AmpersandAmpersandToken &&
        (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
        canBeEmptyStringOrZero(checker.getTypeAtLocation(node.expression.left))
      ) {
        const { line } = file.getLineAndCharacterOfPosition(node.getStart());
        offenders.push(
          `${path.relative(sourceRoot, file.fileName)}:${line + 1} ${node.expression.left.getText()}`,
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  assert.deepEqual(
    offenders,
    [],
    `use \`cond ? <X/> : null\` here:\n${offenders.join("\n")}`,
  );
});
