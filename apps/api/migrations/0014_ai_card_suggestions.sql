-- Card suggestions for testimonies share the day's Neuron budget with
-- self-PR drafts but have their own per-account count, so suggesting cards
-- never uses up the few self-PR drafts an account gets each day.
ALTER TABLE ai_usage_accounts
  ADD COLUMN card_calls INTEGER NOT NULL DEFAULT 0 CHECK (card_calls >= 0);
