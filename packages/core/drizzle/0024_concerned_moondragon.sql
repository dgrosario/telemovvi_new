ALTER TABLE "conversations" ALTER COLUMN "status" DROP NOT NULL;

-- Data migration: Limpar campos de atendimento para grupos WhatsApp existentes
UPDATE conversations
SET
  status = NULL,
  attendant_id = NULL,
  sector_id = NULL,
  opened_at = NULL,
  closed_at = NULL,
  first_opened_at = NULL,
  active_flow_execution_id = NULL,
  flow_completed_at = NULL
WHERE conversation_type = 'whatsapp-group';