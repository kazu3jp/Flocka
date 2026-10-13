import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
async function createOnce(target, example, transform = (value) => value) {
  const template = await readFile(new URL(example, root), "utf8");
  try {
    await writeFile(new URL(target, root), transform(template), {
      flag: "wx",
      mode: 0o600,
    });
    console.log(`Created ${target}`);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    console.log(`Kept existing ${target}`);
  }
}
await createOnce("apps/api/.dev.vars", "apps/api/.dev.vars.example", (text) =>
  text.replace(
    'BETTER_AUTH_SECRET=""',
    `BETTER_AUTH_SECRET="${randomBytes(32).toString("hex")}"`,
  ),
);
await createOnce("apps/mobile/.env.local", "apps/mobile/.env.example");
console.log(
  "Set RESEND_API_KEY in apps/api/.dev.vars. Credentials are never printed or committed.",
);
