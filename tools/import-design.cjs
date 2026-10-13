// Extract the original drawings and catalog without fetching or substituting assets.
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const React = require("react");
const { Resvg } = require("@resvg/resvg-js");
const { renderToStaticMarkup } = require("react-dom/server");
const { transformSync } = require("@babel/core");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "assets/source/flocka-v2-blue-prototype.html"),
  "utf8",
);
const css = fs.readFileSync(
  path.join(root, "assets/source/flocka-v2-game.css"),
  "utf8",
);
function rgb(l, c, h) {
  const a = c * Math.cos((h * Math.PI) / 180),
    b = c * Math.sin((h * Math.PI) / 180);
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const encode = (v) =>
    Math.round(
      255 *
        Math.max(
          0,
          Math.min(
            1,
            v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055,
          ),
        ),
    )
      .toString(16)
      .padStart(2, "0");
  return (
    "#" +
    [
      4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
      -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
      -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
    ]
      .map(encode)
      .join("")
  );
}
const convert = (str) =>
  str.replace(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/g, (_, l, c, h) =>
    rgb(+l, +c, +h),
  );
const colors = {};
for (const m of css.matchAll(/--([\w-]+): (oklch\([^)]+\));/g))
  colors[m[1]] = convert(m[2]);
const normalize = (str) =>
  convert(str).replace(/var\(--([\w-]+)\)/g, (_, k) => colors[k]);
function between(start, end) {
  return source.slice(
    source.indexOf(start),
    source.indexOf(end, source.indexOf(start)),
  );
}
const code =
  between("const CARDS =", "// Local keyword") +
  between("const SELF_OPTIONS =", "const RESP =") +
  between("const DECO =", "const STICKER_POS") +
  between("const AV_COLORS =", "// Resize an uploaded") +
  between("const PEER_PROFILE =", "const peerCard") +
  between("function Sticker(", "const AV_COLORS") +
  between("function Illust(", "function Header(") +
  between("const IC =", "const Icon =");
const js = transformSync(
  code +
    "\nresult = {CARDS,SELF_OPTIONS,STRENGTH_GROUPS,PEOPLE,VIBES,VIBE_CARD,INTERESTS,DECO,DECO_COLORS,AV_COLORS,AV_COLOR_NAMES,AV_MOTIFS,PEER_PROFILE,PEER_REPLY,IC,Sticker,Illust,Motif};",
  {
    plugins: ["@babel/plugin-transform-react-jsx"],
    configFile: false,
    babelrc: false,
  },
).code;
const context = { React, result: null };
vm.runInNewContext(js, context);
const { Sticker, Illust, Motif, ...catalog } = context.result;
const vectors = {
  cards: {},
  stickers: {},
  motifs: {},
  icon: normalize(
    fs.readFileSync(
      path.join(root, "assets/source/flocka-app-icon-fsticker-1024.svg"),
      "utf8",
    ),
  ),
};
for (const [k, c] of Object.entries(catalog.CARDS))
  vectors.cards[k] = normalize(
    renderToStaticMarkup(React.createElement(Illust, { k, h: c.h })),
  );
for (const [k] of catalog.DECO.stickers)
  vectors.stickers[k] = normalize(
    renderToStaticMarkup(React.createElement(Sticker, { k })),
  );
for (const [k] of catalog.AV_MOTIFS)
  vectors.motifs[k] = normalize(
    renderToStaticMarkup(React.createElement(Motif, { k })),
  );
catalog.ART_COLORS = Object.fromEntries(
  Object.entries(catalog.CARDS).map(([k, c]) => [
    k,
    {
      base: rgb(0.86, 0.11, c.h),
      shade: rgb(0.79, 0.13, c.h),
      shade2: rgb(0.76, 0.13, c.h),
      light: rgb(0.95, 0.06, c.h),
    },
  ]),
);
for (const [key, , h] of catalog.DECO_COLORS)
  if (h !== null)
    catalog.ART_COLORS["deco-" + key] = {
      base: rgb(0.86, 0.11, h),
      shade: rgb(0.79, 0.13, h),
      shade2: rgb(0.76, 0.13, h),
      light: rgb(0.95, 0.06, h),
    };
catalog.COLORS = colors;
fs.writeFileSync(
  path.join(root, "src/catalog.json"),
  normalize(JSON.stringify(catalog, null, 2)) + "\n",
);
fs.writeFileSync(
  path.join(root, "src/vectors.json"),
  JSON.stringify(vectors, null, 2) + "\n",
);
console.log(
  "Imported 21 card illustrations, 12 stickers, 6 avatars, brand icon, and exact sRGB tokens.",
);

for (const [name, width] of [
  ["icon.png", 1024],
  ["favicon.png", 64],
])
  fs.writeFileSync(
    path.join(root, "assets", name),
    new Resvg(vectors.icon, { fitTo: { mode: "width", value: width } })
      .render()
      .asPng(),
  );
