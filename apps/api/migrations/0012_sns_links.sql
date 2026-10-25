-- Self-declared SNS handles for the profile card. Kept apart from profile_json so
-- the live profile that exchange partners receive can never carry them by accident;
-- the API adds them to a peer's profile only after an accepted exchange.
ALTER TABLE accounts ADD COLUMN sns_links_json TEXT NOT NULL DEFAULT '[]';
