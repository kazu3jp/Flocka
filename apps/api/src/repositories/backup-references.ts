/**
 * SQLite expression evaluated in the same statement as the backup write.
 * A stale device must not restore copies of a deleted player's server data.
 * Arguments are internal SQL expressions, never interpolated request values.
 */
export function backupWithLiveReferences(
  snapshot: string,
  owner: string,
  excluded = "NULL",
): string {
  const array = (path: string, predicate: string) =>
    `COALESCE((SELECT json_group_array(json(item.value)) FROM json_each(${snapshot}, '$.${path}') AS item WHERE ${predicate}), json('[]'))`;
  const piece = (sent: boolean) => `EXISTS(SELECT 1 FROM testimonies AS t
    WHERE t.id = json_extract(item.value, '$.id')
    AND t.${sent ? "sender_id" : "recipient_id"} = ${owner}
    AND t.${sent ? "recipient_id" : "sender_id"} = json_extract(item.value, '$.${sent ? "toId" : "fromId"}')
    AND t.sender_id IS NOT ${excluded} AND t.recipient_id IS NOT ${excluded})`;
  const paths = [
    [
      "connections",
      array(
        "connections",
        `EXISTS(SELECT 1 FROM exchanges AS e WHERE e.id = json_extract(item.value, '$.id')
      AND ((e.player_a = ${owner} AND e.player_b = json_extract(item.value, '$.peerId')) OR (e.player_b = ${owner} AND e.player_a = json_extract(item.value, '$.peerId')))
      AND e.player_a IS NOT ${excluded} AND e.player_b IS NOT ${excluded})`,
      ),
    ],
    ["vibes", array("vibes", piece(false))],
    ["proofs", array("proofs", piece(false))],
    ["sentVibes", array("sentVibes", piece(true))],
    ["sentProofs", array("sentProofs", piece(true))],
    [
      "blocked",
      `COALESCE((SELECT json_group_array(item.value) FROM json_each(${snapshot}, '$.blocked') AS item WHERE EXISTS(SELECT 1 FROM accounts WHERE id = item.value AND id IS NOT ${excluded})), json('[]'))`,
    ],
    ...["reports", "deletions"].map((path) => [
      path,
      array(
        path,
        `EXISTS(SELECT 1 FROM testimonies AS t WHERE t.id = json_extract(item.value, '$.pieceId') AND t.sender_id IS NOT ${excluded} AND t.recipient_id IS NOT ${excluded})`,
      ),
    ]),
  ];
  const removed = paths
    .map(
      ([path, value]) =>
        `json_array_length(${snapshot}, '$.${path}') != json_array_length(${value})`,
    )
    .join(" OR ");
  return `json_set(${snapshot}, ${paths.map(([path, value]) => `'$.${path}', json(${value})`).join(", ")}, '$.prDraft', CASE WHEN ${removed} THEN NULL ELSE json_extract(${snapshot}, '$.prDraft') END)`;
}
