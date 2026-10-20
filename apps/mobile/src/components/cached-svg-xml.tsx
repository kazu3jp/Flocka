import React, { memo } from "react";
import { parse, SvgAst, type JsxAST, type SvgProps } from "react-native-svg";

const PARSED_SVG_LIMIT = 400;
const parsedSvgs = new Map<string, JsxAST | null>();

/** Parse each source SVG once; SvgXml would parse it again on every mount. */
function parseSvg(xml: string) {
  let ast = parsedSvgs.get(xml);
  if (ast === undefined) {
    ast = parse(xml);
    parsedSvgs.set(xml, ast);
    if (parsedSvgs.size > PARSED_SVG_LIMIT)
      parsedSvgs.delete(parsedSvgs.keys().next().value!);
  }
  return ast;
}

export const CachedSvgXml = memo(function CachedSvgXml({
  xml,
  ...props
}: SvgProps & { xml: string }) {
  return <SvgAst ast={parseSvg(xml)} override={props} />;
});
