# Diagnóstico SaaS Multiempresa (Fase 1)

## Tabelas já multiempresa (workspace_id direto)
- sectors, channels, memberships, partners, labels, conversations, flows, quick_messages, system_variables, roles, notifications, campaigns, calculator_settings, payment_plans, calculator_messages.

## Tabelas críticas auditadas que ainda exigem hardening
- users (estratégia global + memberships), messages, templates, flow_executions, flow_execution_logs, processed_messages, meta_app_settings, partner_contacts, partners_metadata, partners_labels, users_in_sectors, channels_in_sectors, flows_in_channels, flows_in_sectors, campaign_messages, campaign_recipients, sector_permissions, payment_plan_installments, inbound_message_logs, starred_messages, internal_conversation_participants.

## Riscos de vazamento identificados
- Tabelas sem workspace_id direto dependem de join indireto e podem vazar em queries sem join completo.
- Webhooks/consumers com resolução por instance_name/message_id precisam registrar workspace_id persistido para auditoria.
- Sem camada central obrigatória, server actions podem esquecer validação de acesso por workspace.

## Plano de migração em fases
1. **Fase 1**: camada central de autorização (`getCurrentUser`, `getCurrentWorkspace`, `assertWorkspaceAccess`, `assertPermission`) e inventário de tabelas.
2. **Fase 2**: migrations aditivas com backfill para workspace padrão e índices por workspace.
3. **Fase 3**: revisar actions/services/consumers/webhooks para filtro obrigatório no backend.
4. **Fase 4**: módulo billing Asaas (planos, assinaturas, faturas, pagamentos, webhooks, uso, limites).
5. **Fase 5**: área administrativa SaaS (tenants, planos, cobrança, status).
6. **Fase 6**: bloqueio automático por inadimplência + reativação por webhook de pagamento.
7. **Fase 7**: revisão CRM omnichannel por workspace + auditoria operacional.
