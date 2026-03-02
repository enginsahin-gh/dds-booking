-- 009: Flexible user permissions
-- Adds read/edit scopes and staff-specific access control

-- Add permission columns to salon_users
ALTER TABLE salon_users
  ADD COLUMN IF NOT EXISTS read_scope text NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS edit_scope text NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS readable_staff_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS editable_staff_ids uuid[] NOT NULL DEFAULT '{}';

-- Add check constraints for valid scope values
ALTER TABLE salon_users
  ADD CONSTRAINT chk_read_scope CHECK (read_scope IN ('all', 'specific', 'self')),
  ADD CONSTRAINT chk_edit_scope CHECK (edit_scope IN ('all', 'specific', 'self'));

-- Change default for can_see_revenue to false (new staff members shouldn't see revenue by default)
ALTER TABLE salon_users ALTER COLUMN can_see_revenue SET DEFAULT false;

-- Ensure existing owners have full permissions
UPDATE salon_users
SET read_scope = 'all',
    edit_scope = 'all',
    can_see_revenue = true
WHERE role = 'owner';

-- Comments
COMMENT ON COLUMN salon_users.read_scope IS 'What bookings/data the user can view: all, specific (staff IDs), or self (own linked staff only)';
COMMENT ON COLUMN salon_users.edit_scope IS 'What bookings/data the user can modify: all, specific (staff IDs), or self. Cannot exceed read_scope.';
COMMENT ON COLUMN salon_users.readable_staff_ids IS 'Staff IDs this user can view data for. Only used when read_scope = specific.';
COMMENT ON COLUMN salon_users.editable_staff_ids IS 'Staff IDs this user can edit data for. Only used when edit_scope = specific.';
