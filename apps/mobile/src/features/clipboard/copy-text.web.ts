/** Use the browser clipboard directly; a denied write must remain a failure. */
export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
