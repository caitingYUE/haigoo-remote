-- WeChat Mini Program virtual-payment order state.
--
-- Monetary values from WeChat are stored in integer cents. Membership is only
-- granted after a signed xpay_goods_deliver_notify event is validated by the
-- public callback handler; the Mini Program success callback never grants it.

ALTER TABLE payment_records
    ADD COLUMN IF NOT EXISTS provider VARCHAR(64),
    ADD COLUMN IF NOT EXISTS provider_transaction_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS provider_status VARCHAR(64),
    ADD COLUMN IF NOT EXISTS app_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS openid VARCHAR(128),
    ADD COLUMN IF NOT EXISTS product_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS expected_amount_cents INTEGER,
    ADD COLUMN IF NOT EXISTS paid_amount_cents INTEGER,
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS callback_received_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_records_provider_transaction
    ON payment_records (provider, provider_transaction_id)
    WHERE provider_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_records_wechat_user
    ON payment_records (app_id, openid, created_at DESC)
    WHERE provider = 'wechat_virtual';

CREATE INDEX IF NOT EXISTS idx_payment_records_pending_virtual
    ON payment_records (status, created_at)
    WHERE provider = 'wechat_virtual' AND status = 'pending';

ALTER TABLE payment_records
    DROP CONSTRAINT IF EXISTS chk_payment_records_virtual_amounts;

ALTER TABLE payment_records
    ADD CONSTRAINT chk_payment_records_virtual_amounts
    CHECK (
      provider <> 'wechat_virtual'
      OR (
        expected_amount_cents IS NOT NULL
        AND expected_amount_cents > 0
        AND currency = 'CNY'
      )
    );

-- Rollback (only after reverting all virtual-payment callers):
-- DROP INDEX IF EXISTS idx_payment_records_pending_virtual;
-- DROP INDEX IF EXISTS idx_payment_records_wechat_user;
-- DROP INDEX IF EXISTS idx_payment_records_provider_transaction;
-- ALTER TABLE payment_records DROP CONSTRAINT IF EXISTS chk_payment_records_virtual_amounts;
-- ALTER TABLE payment_records
--   DROP COLUMN IF EXISTS callback_received_at,
--   DROP COLUMN IF EXISTS paid_at,
--   DROP COLUMN IF EXISTS paid_amount_cents,
--   DROP COLUMN IF EXISTS expected_amount_cents,
--   DROP COLUMN IF EXISTS product_id,
--   DROP COLUMN IF EXISTS openid,
--   DROP COLUMN IF EXISTS app_id,
--   DROP COLUMN IF EXISTS provider_status,
--   DROP COLUMN IF EXISTS provider_transaction_id,
--   DROP COLUMN IF EXISTS provider;
