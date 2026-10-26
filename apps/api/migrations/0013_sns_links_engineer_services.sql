-- The profile now offers services for engineers (X, GitHub, Zenn, Qiita, note,
-- Bluesky) and a website. Instagram, TikTok, YouTube and LINE are no longer
-- offered, so their stored links are removed and every list stays valid.
UPDATE accounts
SET sns_links_json = (
  SELECT json_group_array(json(value))
  FROM json_each(accounts.sns_links_json)
  WHERE json_extract(value, '$.platform') IN ('x', 'github')
)
WHERE EXISTS (
  SELECT 1
  FROM json_each(accounts.sns_links_json)
  WHERE json_extract(value, '$.platform') NOT IN ('x', 'github')
);
