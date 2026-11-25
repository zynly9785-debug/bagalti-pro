-- Extend record-level synchronization for customer debt, payments, ledgers and collection plans.
alter table public.sync_records
  drop constraint if exists sync_records_entity_check;

alter table public.sync_records
  add constraint sync_records_entity_check
  check (entity in (
    'product','customer','sale','sale_item','return','expense','quick_product','store_preferences',
    'customer_payment','customer_ledger','customer_payment_plan','customer_communication','customer_merge','drawer_shift'
  ));
