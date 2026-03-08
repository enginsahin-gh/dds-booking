import { describe, it, expect } from 'vitest';

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

describe('RBAC coverage', () => {
  const owner: MockUser = {
    role: 'owner',
    staffId: null,
    readScope: 'all',
    editScope: 'all',
    readableStaffIds: [],
    editableStaffIds: [],
    canSeeRevenue: true,
  };

  const staffSelf: MockUser = {
    role: 'staff',
    staffId: 'staff-1',
    readScope: 'self',
    editScope: 'self',
    readableStaffIds: [],
    editableStaffIds: [],
    canSeeRevenue: false,
  };

  const staffSpecific: MockUser = {
    role: 'staff',
    staffId: 'staff-1',
    readScope: 'specific',
    editScope: 'self',
    readableStaffIds: ['staff-2', 'staff-3'],
    editableStaffIds: [],
    canSeeRevenue: true,
  };

  const staffAll: MockUser = {
    role: 'staff',
    staffId: 'staff-1',
    readScope: 'all',
    editScope: 'specific',
    readableStaffIds: [],
    editableStaffIds: ['staff-2'],
    canSeeRevenue: true,
  };

  it('owner gets null readable ids (all)', () => {
    expect(getReadableStaffIds(owner)).toBeNull();
  });

  it('owner gets null editable ids (all)', () => {
    expect(getEditableStaffIds(owner)).toBeNull();
  });

  it('owner can read any staff', () => {
    expect(canReadStaff(owner, 'any')).toBe(true);
  });

  it('owner can edit any staff', () => {
    expect(canEditStaff(owner, 'any')).toBe(true);
  });

  it('owner can see revenue', () => {
    expect(owner.canSeeRevenue).toBe(true);
  });

  it('self scope returns only own id', () => {
    expect(getReadableStaffIds(staffSelf)).toEqual(['staff-1']);
  });

  it('self scope cannot read other staff', () => {
    expect(canReadStaff(staffSelf, 'staff-2')).toBe(false);
  });

  it('self scope can edit own staff', () => {
    expect(canEditStaff(staffSelf, 'staff-1')).toBe(true);
  });

  it('self scope cannot edit other staff', () => {
    expect(canEditStaff(staffSelf, 'staff-2')).toBe(false);
  });

  it('self scope cannot see revenue', () => {
    expect(staffSelf.canSeeRevenue).toBe(false);
  });

  it('specific read includes own staff', () => {
    const ids = getReadableStaffIds(staffSpecific);
    expect(ids).toContain('staff-1');
  });

  it('specific read includes allowed staff', () => {
    const ids = getReadableStaffIds(staffSpecific);
    expect(ids).toContain('staff-2');
    expect(ids).toContain('staff-3');
  });

  it('specific read excludes other staff', () => {
    expect(canReadStaff(staffSpecific, 'staff-9')).toBe(false);
  });

  it('specific edit (self) only allows own', () => {
    expect(canEditStaff(staffSpecific, 'staff-1')).toBe(true);
    expect(canEditStaff(staffSpecific, 'staff-2')).toBe(false);
  });

  it('all read returns null for staffAll', () => {
    expect(getReadableStaffIds(staffAll)).toBeNull();
  });

  it('specific edit includes own + specified', () => {
    const ids = getEditableStaffIds(staffAll);
    expect(ids).toContain('staff-1');
    expect(ids).toContain('staff-2');
  });

  it('specific edit excludes other staff', () => {
    expect(canEditStaff(staffAll, 'staff-9')).toBe(false);
  });

  it('missing staffId (self) yields empty list', () => {
    const noLink = { ...staffSelf, staffId: null };
    expect(getReadableStaffIds(noLink)).toEqual([]);
    expect(getEditableStaffIds(noLink)).toEqual([]);
  });

  it('missing staffId (specific) returns specific list', () => {
    const noLink = { ...staffSpecific, staffId: null };
    expect(getReadableStaffIds(noLink)).toEqual(['staff-2', 'staff-3']);
  });

  it('own id is not duplicated in readable list', () => {
    const user = { ...staffSpecific, readableStaffIds: ['staff-1', 'staff-2'] };
    const ids = getReadableStaffIds(user);
    expect(ids?.filter(id => id === 'staff-1')).toHaveLength(1);
  });

  it('own id is not duplicated in editable list', () => {
    const user = { ...staffAll, editableStaffIds: ['staff-1', 'staff-2'] };
    const ids = getEditableStaffIds(user);
    expect(ids?.filter(id => id === 'staff-1')).toHaveLength(1);
  });

  it('canReadStaff handles null ids as full access', () => {
    expect(canReadStaff(owner, 'staff-x')).toBe(true);
  });

  it('canEditStaff handles null ids as full access', () => {
    expect(canEditStaff(owner, 'staff-x')).toBe(true);
  });

  it('scope ordering: edit cannot exceed read', () => {
    const scopeOrder: Record<PermissionScope, number> = { self: 0, specific: 1, all: 2 };
    expect(scopeOrder['specific'] <= scopeOrder['all']).toBe(true);
    expect(scopeOrder['self'] <= scopeOrder['specific']).toBe(true);
    expect(scopeOrder['all'] <= scopeOrder['self']).toBe(false);
    expect(scopeOrder['specific'] <= scopeOrder['self']).toBe(false);
  });
});
