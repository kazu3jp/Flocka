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
  path.join(root, "design/flocka-v2-blue-prototype.html"),
  "utf8",
);
const css = fs.readFileSync(
  path.join(root, "design/flocka-v2-game.css"),
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
    "\nresult = {CARDS,SELF_OPTIONS,STRENGTH_GROUPS,VIBES,VIBE_CARD,INTERESTS,DECO,DECO_COLORS,AV_COLORS,AV_COLOR_NAMES,AV_MOTIFS,PEER_PROFILE,IC,Sticker,Illust,Motif};",
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
      path.join(root, "design/flocka-app-icon-fsticker-1024.svg"),
      "utf8",
    ),
  ),
  // Brand marks for SNS links: one 24x24 path each, filled by the app.
  sns: {},
};
for (const file of fs.readdirSync(path.join(root, "design/sns-icons")).sort())
  if (file.endsWith(".svg"))
    vectors.sns[file.slice(0, -4)] = fs
      .readFileSync(path.join(root, "design/sns-icons", file), "utf8")
      .match(/<path d="([^"]+)"/)[1];
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
colors["confirmed-paper"] = rgb(0.96, 0.07, 98);
colors.stage = rgb(0.25, 0.06, 264);
colors["tab-inactive"] = rgb(0.75, 0.03, 265);
colors["stamp-ink"] = rgb(0.5, 0.2, 20);
colors["stamp-border"] = rgb(0.55, 0.2, 20);
colors["locked-stripe"] = rgb(0.4, 0.17, 264);
colors["locked-center"] = rgb(0.3, 0.13, 264);
catalog.COLORS = colors;
fs.writeFileSync(
  path.join(root, "packages/domain/src/catalog.json"),
  normalize(JSON.stringify(catalog, null, 2)) + "\n",
);
fs.writeFileSync(
  path.join(root, "apps/mobile/src/vectors.json"),
  JSON.stringify(vectors, null, 2) + "\n",
);
console.log(
  "Imported 21 card illustrations, 12 stickers, 6 avatars, brand icon, SNS marks, and exact sRGB tokens.",
);

for (const [name, width] of [
  ["icon.png", 1024],
  ["favicon.png", 64],
])
  fs.writeFileSync(
    path.join(root, "apps/mobile/assets", name),
    new Resvg(vectors.icon, { fitTo: { mode: "width", value: width } })
      .render()
      .asPng(),
  );
