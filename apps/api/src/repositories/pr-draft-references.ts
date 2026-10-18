/** Internal SQL expressions only. JSON and account values are bound parameters. */
export function invalidPRSource(
  snapshot: string,
  owner: string,
  excluded = "NULL",
) {
  return `EXISTS(SELECT 1 FROM json_each(${snapshot}, '$.prDraftSource.pieceIds') AS source WHERE NOT EXISTS(
    SELECT 1 FROM testimonies AS t WHERE t.id = source.value AND t.recipient_id = ${owner}
    AND t.card = json_extract(${snapshot}, '$.prDraftSource.card') AND t.removed_at IS NULL
    AND t.sender_id IS NOT ${excluded} AND t.recipient_id IS NOT ${excluded}))`;
}
