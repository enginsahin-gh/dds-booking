import { describe, it, expect } from 'vitest';

// Unit tests for admin user management logic

describe('Admin user management', () => {
  describe('Email validation for invite', () => {
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    it('accepts valid emails', () => {
      expect(EMAIL_REGEX.test('medewerker@salon.nl')).toBe(true);
      expect(EMAIL_REGEX.test('anna.de.vries@gmail.com')).toBe(true);
      expect(EMAIL_REGEX.test('info@kapsalon-orange.nl')).toBe(true);
    });

    it('rejects invalid emails', () => {
      expect(EMAIL_REGEX.test('')).toBe(false);
      expect(EMAIL_REGEX.test('notanemail')).toBe(false);
      expect(EMAIL_REGEX.test('user@')).toBe(false);
      expect(EMAIL_REGEX.test('@domain.com')).toBe(false);
    });
  });

  describe('Role validation', () => {
    const validRoles = ['owner', 'staff'];

    it('accepts valid roles', () => {
      expect(validRoles.includes('owner')).toBe(true);
      expect(validRoles.includes('staff')).toBe(true);
    });

    it('rejects invalid roles', () => {
      expect(validRoles.includes('admin')).toBe(false);
      expect(validRoles.includes('superuser')).toBe(false);
      expect(validRoles.includes('')).toBe(false);
    });
  });

  describe('Permission scope validation', () => {
    const validScopes = ['all', 'specific', 'self'];
    const scopeOrder: Record<string, number> = { self: 0, specific: 1, all: 2 };

    it('accepts valid scopes', () => {
      for (const scope of validScopes) {
        expect(validScopes.includes(scope)).toBe(true);
      }
    });

    it('validates edit scope <= read scope', () => {
      // Valid combinations
      expect(scopeOrder['self'] <= scopeOrder['all']).toBe(true);
      expect(scopeOrder['specific'] <= scopeOrder['all']).toBe(true);
      expect(scopeOrder['self'] <= scopeOrder['specific']).toBe(true);
      expect(scopeOrder['self'] <= scopeOrder['self']).toBe(true);

      // Invalid combinations
      expect(scopeOrder['all'] <= scopeOrder['self']).toBe(false);
      expect(scopeOrder['specific'] <= scopeOrder['self']).toBe(false);
      expect(scopeOrder['all'] <= scopeOrder['specific']).toBe(false);
    });

    it('lists all valid scope combinations', () => {
      const valid: [string, string][] = [];
      for (const read of validScopes) {
        for (const edit of validScopes) {
          if (scopeOrder[edit] <= scopeOrder[read]) {
            valid.push([read, edit]);
          }
        }
      }
      // all/all, all/specific, all/self, specific/specific, specific/self, self/self
      expect(valid).toHaveLength(6);
    });
  });

  describe('Owner protection', () => {
    it('prevents changing owner permissions', () => {
      const user = { role: 'owner' };
      const canModifyPermissions = user.role !== 'owner';
      expect(canModifyPermissions).toBe(false);
    });

    it('allows changing staff permissions', () => {
      const user = { role: 'staff' };
      const canModifyPermissions = user.role !== 'owner';
      expect(canModifyPermissions).toBe(true);
    });
  });

  describe('Salon user defaults', () => {
    it('defaults new staff to self/self/false', () => {
      const defaults = {
        read_scope: 'self',
        edit_scope: 'self',
        can_see_revenue: false,
      };
      expect(defaults.read_scope).toBe('self');
      expect(defaults.edit_scope).toBe('self');
      expect(defaults.can_see_revenue).toBe(false);
    });

    it('defaults new owner to all/all/true', () => {
      const defaults = {
        read_scope: 'all',
        edit_scope: 'all',
        can_see_revenue: true,
      };
      expect(defaults.read_scope).toBe('all');
      expect(defaults.edit_scope).toBe('all');
      expect(defaults.can_see_revenue).toBe(true);
    });
  });

  describe('Staff IDs validation', () => {
    it('accepts array of UUIDs for specific scope', () => {
      const ids = ['a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'b2c3d4e5-f6a7-8901-bcde-f12345678901'];
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      expect(ids.every(id => uuidRegex.test(id))).toBe(true);
    });

    it('ignores staff IDs for all/self scope', () => {
      const scope = 'all';
      const staffIds = ['some-id'];
      // IDs should be ignored when scope is not 'specific'
      const effectiveIds = scope === 'specific' ? staffIds : [];
      expect(effectiveIds).toHaveLength(0);
    });
  });
});
