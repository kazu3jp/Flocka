-- SQL guards close the race between an authentication hook and its actual write.
CREATE TRIGGER reject_deleting_account_session
BEFORE INSERT ON auth_sessions
WHEN EXISTS(SELECT 1 FROM account_deletions WHERE account_id = NEW.user_id)
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_DELETION_PENDING');
END;

CREATE TRIGGER reject_deleting_account_provider_insert
BEFORE INSERT ON auth_accounts
WHEN EXISTS(SELECT 1 FROM account_deletions WHERE account_id = NEW.user_id)
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_DELETION_PENDING');
END;

-- The erasure service may clear tokens, but callbacks may not replace them.
CREATE TRIGGER reject_deleting_account_provider_token_update
BEFORE UPDATE OF access_token, refresh_token ON auth_accounts
WHEN (NEW.access_token IS NOT NULL OR NEW.refresh_token IS NOT NULL)
  AND (NEW.access_token IS NOT OLD.access_token OR NEW.refresh_token IS NOT OLD.refresh_token)
  AND EXISTS(SELECT 1 FROM account_deletions WHERE account_id = NEW.user_id)
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_DELETION_PENDING');
END;
