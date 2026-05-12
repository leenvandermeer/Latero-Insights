-- LADR-0xx: Optionele afreden bij contract-aanvraag afwijzing
ALTER TABLE meta.contract_requests
  ADD COLUMN IF NOT EXISTS reason TEXT;
