# RLS Review — Bellure Booking

Generated: 2026-03-08 (UTC)

## Scope
- Supabase public schema RLS policies
- Goal: validate read/write access patterns and detect unintended public exposure

## Summary
- This report lists all active policies in `public` schema.
- Next step: walk each table and confirm policies align with product access rules (owners/staff/anon).

## Policy Inventory (from DB)

| Schema | Table | Policy | Roles | Command | Qual | With Check |
|---|---|---|---|---|---|---|
| public | audit_logs | owner_read_audit_logs | {authenticated} | SELECT | (salon_id IN ( SELECT salon_users.salon_id |  |
|    FROM salon_users |  |  |  |  |  |  |
|   WHERE ((salon_users.user_id = auth.uid()) AND (salon_users.role = 'owner'::text)))) |  |  |  |  |  |  |
| public | booking_services | auth_read_booking_services | {authenticated} | SELECT | (booking_id IN ( SELECT bookings.id |  |
|    FROM bookings |  |  |  |  |  |  |
|   WHERE (bookings.salon_id = get_user_salon_id()))) |  |  |  |  |  |  |
| public | bookings | auth_read_salon_bookings | {authenticated} | SELECT | (salon_id = get_user_salon_id()) |  |
| public | bookings | auth_update_salon_bookings | {authenticated} | UPDATE | (salon_id = get_user_salon_id()) |  |
| public | bookings | owner_delete_bookings | {authenticated} | DELETE | ((salon_id = get_user_salon_id()) AND is_salon_owner()) |  |
| public | bookings | owner_insert_bookings | {authenticated} | INSERT |  | (salon_id = get_user_salon_id()) |
| public | customer_users | auth_select_customer_users | {authenticated} | SELECT | (customer_id IN ( SELECT customers.id |  |
|    FROM customers |  |  |  |  |  |  |
|   WHERE (customers.salon_id = get_user_salon_id()))) |  |  |  |  |  |  |
| public | customers | auth_delete_customers | {authenticated} | DELETE | (salon_id = get_user_salon_id()) |  |
| public | customers | auth_insert_customers | {authenticated} | INSERT |  | (salon_id = get_user_salon_id()) |
| public | customers | auth_select_customers | {authenticated} | SELECT | (salon_id = get_user_salon_id()) |  |
| public | customers | auth_update_customers | {authenticated} | UPDATE | (salon_id = get_user_salon_id()) | (salon_id = get_user_salon_id()) |
| public | email_logs | auth_read_email_logs | {authenticated} | SELECT | (salon_id = get_user_salon_id()) |  |
| public | leads | leads_insert | {anon,authenticated} | INSERT |  | true |
| public | notifications | Service role can insert notifications | {public} | INSERT |  | true |
| public | notifications | Users can delete own salon notifications | {public} | DELETE | (salon_id IN ( SELECT salon_users.salon_id |  |
|    FROM salon_users |  |  |  |  |  |  |
|   WHERE (salon_users.user_id = auth.uid()))) |  |  |  |  |  |  |
| public | notifications | Users can read own salon notifications | {public} | SELECT | (salon_id IN ( SELECT salon_users.salon_id |  |
|    FROM salon_users |  |  |  |  |  |  |
|   WHERE (salon_users.user_id = auth.uid()))) |  |  |  |  |  |  |
| public | notifications | Users can update own salon notifications | {public} | UPDATE | (salon_id IN ( SELECT salon_users.salon_id |  |
|    FROM salon_users |  |  |  |  |  |  |
|   WHERE (salon_users.user_id = auth.uid()))) |  |  |  |  |  |  |
| public | payments | auth_read_salon_payments | {authenticated} | SELECT | (booking_id IN ( SELECT bookings.id |  |
|    FROM bookings |  |  |  |  |  |  |
|   WHERE (bookings.salon_id = get_user_salon_id()))) |  |  |  |  |  |  |
| public | public_bookings_cache | anon_read_public_bookings_cache | {anon} | SELECT | true |  |
| public | public_bookings_cache | auth_read_public_bookings_cache | {authenticated} | SELECT | true |  |
| public | public_salons_cache | anon_read_public_salons_cache | {anon} | SELECT | true |  |
| public | public_salons_cache | auth_read_public_salons_cache | {authenticated} | SELECT | true |  |
| public | refunds | auth_read_salon_refunds | {authenticated} | SELECT | (booking_id IN ( SELECT bookings.id |  |
|    FROM bookings |  |  |  |  |  |  |
|   WHERE (bookings.salon_id = get_user_salon_id()))) |  |  |  |  |  |  |
| public | salon_users | auth_read_own_salon_user | {authenticated} | SELECT | (user_id = auth.uid()) |  |
| public | salon_users | auth_read_salon_users | {authenticated} | SELECT | (salon_id = get_user_salon_id()) |  |
| public | salon_users | owner_manage_salon_users | {authenticated} | ALL | ((salon_id = get_user_salon_id()) AND is_salon_owner()) | ((salon_id = get_user_salon_id()) AND is_salon_owner()) |
| public | salons | auth_read_own_salon | {authenticated} | SELECT | (id = get_user_salon_id()) |  |
| public | salons | owner_update_salon | {authenticated} | UPDATE | ((id = get_user_salon_id()) AND is_salon_owner()) |  |
| public | service_categories | anon_read_categories | {anon} | SELECT | true |  |
| public | service_categories | auth_read_salon_categories | {authenticated} | SELECT | (salon_id = get_user_salon_id()) |  |
| public | service_categories | owner_manage_categories | {authenticated} | ALL | ((salon_id = get_user_salon_id()) AND is_salon_owner()) | ((salon_id = get_user_salon_id()) AND is_salon_owner()) |
| public | services | anon_read_active_services | {anon} | SELECT | (is_active = true) |  |
| public | services | auth_read_salon_services | {authenticated} | SELECT | (salon_id = get_user_salon_id()) |  |
| public | services | owner_manage_services | {authenticated} | ALL | ((salon_id = get_user_salon_id()) AND is_salon_owner()) | ((salon_id = get_user_salon_id()) AND is_salon_owner()) |
| public | staff | anon_read_active_staff | {anon} | SELECT | (is_active = true) |  |
| public | staff | auth_read_salon_staff | {authenticated} | SELECT | (salon_id = get_user_salon_id()) |  |
| public | staff | owner_manage_staff | {authenticated} | ALL | ((salon_id = get_user_salon_id()) AND is_salon_owner()) | ((salon_id = get_user_salon_id()) AND is_salon_owner()) |
| public | staff_blocks | anon_read_blocks | {anon} | SELECT | true |  |
| public | staff_blocks | auth_manage_salon_blocks | {authenticated} | ALL | (staff_id IN ( SELECT staff.id |  |
|    FROM staff |  |  |  |  |  |  |
|   WHERE (staff.salon_id = get_user_salon_id()))) | (staff_id IN ( SELECT staff.id |  |  |  |  |  |
|    FROM staff |  |  |  |  |  |  |
|   WHERE (staff.salon_id = get_user_salon_id()))) |  |  |  |  |  |  |
| public | staff_schedules | anon_read_schedules | {anon} | SELECT | true |  |
| public | staff_schedules | auth_manage_salon_schedules | {authenticated} | ALL | (staff_id IN ( SELECT staff.id |  |
|    FROM staff |  |  |  |  |  |  |
|   WHERE (staff.salon_id = get_user_salon_id()))) | (staff_id IN ( SELECT staff.id |  |  |  |  |  |
|    FROM staff |  |  |  |  |  |  |
|   WHERE (staff.salon_id = get_user_salon_id()))) |  |  |  |  |  |  |
| public | staff_services | anon_read_staff_services | {public} | SELECT | true |  |
| public | staff_services | owner_manage_staff_services | {authenticated} | ALL | ((staff_id IN ( SELECT staff.id |  |
|    FROM staff |  |  |  |  |  |  |
|   WHERE (staff.salon_id = get_user_salon_id()))) AND is_salon_owner()) | ((staff_id IN ( SELECT staff.id |  |  |  |  |  |
|    FROM staff |  |  |  |  |  |  |
|   WHERE (staff.salon_id = get_user_salon_id()))) AND is_salon_owner()) |  |  |  |  |  |  |
| public | subscription_payments | Salon owners can view their payments | {public} | SELECT | (salon_id IN ( SELECT salon_users.salon_id |  |
|    FROM salon_users |  |  |  |  |  |  |
|   WHERE ((salon_users.user_id = auth.uid()) AND (salon_users.role = 'owner'::text)))) |  |  |  |  |  |  |
| public | waitlist | Public can join waitlist | {anon} | INSERT |  | true |
| public | waitlist | Salon users can view waitlist | {public} | SELECT | (salon_id IN ( SELECT salon_users.salon_id |  |
|    FROM salon_users |  |  |  |  |  |  |
|   WHERE (salon_users.user_id = auth.uid()))) |  |  |  |  |  |  |

> Note: 'qual' and 'with_check' columns are truncated to 80 chars per row in this view.
