-- Increase message_id length in processed_messages table to support Instagram message IDs
-- Instagram message IDs can be up to 152 characters long

ALTER TABLE processed_messages 
ALTER COLUMN message_id TYPE varchar(256);
