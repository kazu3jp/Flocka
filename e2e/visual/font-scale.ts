import type { BrowserContext } from "@playwright/test";

/**
 * Browsers have no system font scale, so react-native-web always reports
 * `fontScale = 1`. Android and iOS multiply every Text size by that scale
 * after the app has computed its layout. This reproduces that on the web:
 * each element that declares its own font size (and line height) gets it
 * multiplied by `scale`; elements that inherit follow their parent. The app
 * itself still sees `fontScale = 1`, exactly as the sizes it computes before
 * the OS scales the text on a device.
 */
export async function emulateFontScale(context: BrowserContext, scale: number) {
  if (scale === 1) return;
  await context.addInitScript((requested) => {
    const done = new WeakSet<Element>();
    const px = (value: string) =>
      value.endsWith("px") ? Number.parseFloat(value) : Number.NaN;
    function scaleSubtree(root: Element) {
      const elements = [root, ...Array.from(root.querySelectorAll("*"))];
      const writes: (() => void)[] = [];
      for (const element of elements) {
        // Text caps the multiplier (maxFontSizeMultiplier); the display face
        // is capped at 1.2 (components/responsive-scale.ts).
        const factor = /DelaGothic/.test(getComputedStyle(element).fontFamily)
          ? Math.min(requested, 1.2)
          : requested;
        if (done.has(element) || !(element instanceof HTMLElement)) continue;
        const style = getComputedStyle(element);
        const parent = element.parentElement;
        const size = px(style.fontSize);
        if (Number.isNaN(size)) continue;
        const parentStyle = parent ? getComputedStyle(parent) : null;
        const inherits = !!parentStyle && px(parentStyle.fontSize) === size;
        const lineHeightValue = px(style.lineHeight);
        const lineHeightInherits =
          !!parentStyle && px(parentStyle.lineHeight) === lineHeightValue;
        const lineHeight = lineHeightInherits ? Number.NaN : lineHeightValue;
        done.add(element);
        if (inherits && Number.isNaN(lineHeight)) continue;
        writes.push(() => {
          if (!inherits)
            element.style.setProperty(
              "font-size",
              `${size * factor}px`,
              "important",
            );
          if (!Number.isNaN(lineHeight))
            element.style.setProperty(
              "line-height",
              `${lineHeight * factor}px`,
              "important",
            );
        });
      }
      for (const write of writes) write();
    }
    const start = () => {
      new MutationObserver((records) => {
        for (const record of records)
          for (const node of Array.from(record.addedNodes))
            if (node instanceof Element) scaleSubtree(node);
      }).observe(document.documentElement, { childList: true, subtree: true });
      scaleSubtree(document.documentElement);
    };
    if (document.documentElement) start();
    else document.addEventListener("DOMContentLoaded", start);
  }, scale);
}
