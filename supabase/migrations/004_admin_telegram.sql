-- Admin Telegram chat ID para reportes por bot
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS admin_telegram_chat_id TEXT;
