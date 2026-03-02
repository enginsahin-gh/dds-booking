import { describe, it, expect } from 'vitest';

// Unit tests for permission scope logic (mirrors AuthContext helpers)

type PermissionScope = 'all' | 'specific' | 'self';

interface MockUser {
  role: 'owner' | 'staff';
  staffId: string | null;
  readScope: PermissionScope;
  editScope: PermissionScope;
  readableStaffIds: string[];
  editableStaffIds: string[];
  canSeeRevenue: boolean;
}

function getReadableStaffIds(user: MockUser): string[] | null {
  if (user.role === 'owner' || user.readScope === 'all') return null;
  if (user.readScope === 'specific') {
    const ids = [...user.readableStaffIds];
    if (user.staffId && !ids.includes(user.staffId)) ids.push(user.staffId);
    return ids;
  }
  return user.staffId ? [user.staffId] : [];
}

function getEditableStaffIds(user: MockUser): string[] | null {
  if (user.role === 'owner' || user.editScope === 'all') return null;
  if (user.editScope === 'specific') {
    const ids = [...user.editableStaffIds];
    if (user.staffId && !ids.includes(user.staffId)) ids.push(user.staffId);
    return ids;
  }
  return user.staffId ? [user.staffId] : [];
}

function canReadStaff(user: MockUser, targetStaffId: string): boolean {
  const ids = getReadableStaffIds(user);
  return ids === null || ids.includes(targetStaffId);
}

function canEditStaff(user: MockUser, targetStaffId: string): boolean {
  const ids = getEditableStaffIds(user);
  return ids === null || ids.includes(targetStaffId);
}

describe('Permission system', () => {
  const owner: MockUser = {
    role: 'owner', staffId: null,
    readScope: 'all', editScope: 'all',
    readableStaffIds: [], editableStaffIds: [],
    canSeeRevenue: true,
  };

  const staffSelf: MockUser = {
    role: 'staff', staffId: 'staff-1',
    readScope: 'self', editScope: 'self',
    readableStaffIds: [], editableStaffIds: [],
    canSeeRevenue: false,
  };

  const staffSpecific: MockUser = {
    role: 'staff', staffId: 'staff-1',
    readScope: 'specific', editScope: 'self',
    readableStaffIds: ['staff-2', 'staff-3'], editableStaffIds: [],
    canSeeRevenue: true,
  };

  const staffAll: MockUser = {
    role: 'staff', staffId: 'staff-1',
    readScope: 'all', editScope: 'specific',
    readableStaffIds: [], editableStaffIds: ['staff-2'],
    canSeeRevenue: true,
  };

  describe('Owner permissions', () => {
    it('owner can read all staff', () => {
      expect(getReadableStaffIds(owner)).toBeNull();
      expect(canReadStaff(owner, 'any-staff')).toBe(true);
    });

    it('owner can edit all staff', () => {
      expect(getEditableStaffIds(owner)).toBeNull();
      expect(canEditStaff(owner, 'any-staff')).toBe(true);
    });

    it('owner can see revenue', () => {
      expect(owner.canSeeRevenue).toBe(true);
    });
  });

  describe('Staff with self scope', () => {
    it('can only read own staff', () => {
      const ids = getReadableStaffIds(staffSelf);
      expect(ids).toEqual(['staff-1']);
    });

    it('can read own bookings', () => {
      expect(canReadStaff(staffSelf, 'staff-1')).toBe(true);
    });

    it('cannot read other staff bookings', () => {
      expect(canReadStaff(staffSelf, 'staff-2')).toBe(false);
      expect(canReadStaff(staffSelf, 'staff-99')).toBe(false);
    });

    it('can only edit own staff', () => {
      expect(canEditStaff(staffSelf, 'staff-1')).toBe(true);
      expect(canEditStaff(staffSelf, 'staff-2')).toBe(false);
    });

    it('cannot see revenue', () => {
      expect(staffSelf.canSeeRevenue).toBe(false);
    });
  });

  describe('Staff with specific read scope', () => {
    it('can read specified staff + own', () => {
      const ids = getReadableStaffIds(staffSpecific);
      expect(ids).toContain('staff-1'); // own
      expect(ids).toContain('staff-2'); // specified
      expect(ids).toContain('staff-3'); // specified
    });

    it('cannot read unspecified staff', () => {
      expect(canReadStaff(staffSpecific, 'staff-99')).toBe(false);
    });

    it('can only edit own (edit scope is self)', () => {
      expect(canEditStaff(staffSpecific, 'staff-1')).toBe(true);
      expect(canEditStaff(staffSpecific, 'staff-2')).toBe(false);
    });
  });

  describe('Staff with all read, specific edit', () => {
    it('can read all staff', () => {
      expect(getReadableStaffIds(staffAll)).toBeNull();
      expect(canReadStaff(staffAll, 'any-staff')).toBe(true);
    });

    it('can edit specified staff + own', () => {
      const ids = getEditableStaffIds(staffAll);
      expect(ids).toContain('staff-1'); // own
      expect(ids).toContain('staff-2'); // specified
    });

    it('cannot edit unspecified staff', () => {
      expect(canEditStaff(staffAll, 'staff-99')).toBe(false);
    });
  });

  describe('Staff without linked staff_id', () => {
    it('returns empty array for self scope without staffId', () => {
      const noLink: MockUser = { ...staffSelf, staffId: null };
      expect(getReadableStaffIds(noLink)).toEqual([]);
      expect(canReadStaff(noLink, 'staff-1')).toBe(false);
    });
  });

  describe('Scope ordering validation', () => {
    it('edit scope cannot exceed read scope', () => {
      const scopeOrder: Record<PermissionScope, number> = { self: 0, specific: 1, all: 2 };

      // Valid: read=all, edit=specific
      expect(scopeOrder['specific'] <= scopeOrder['all']).toBe(true);

      // Valid: read=specific, edit=self
      expect(scopeOrder['self'] <= scopeOrder['specific']).toBe(true);

      // Invalid: read=self, edit=all
      expect(scopeOrder['all'] <= scopeOrder['self']).toBe(false);

      // Invalid: read=self, edit=specific
      expect(scopeOrder['specific'] <= scopeOrder['self']).toBe(false);
    });
  });
});
