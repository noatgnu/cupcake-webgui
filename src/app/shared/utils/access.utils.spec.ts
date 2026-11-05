import type { User } from '@noatgnu/cupcake-core';
import { AccessUtils } from './access.utils';

describe('AccessUtils.canChange', () => {
  const resource = { owner: 1, editors: [2] };
  const user = (id: number, extra: Partial<User> = {}) => ({ id, isStaff: false, isSuperuser: false, ...extra }) as User;

  it('allows the owner and editors', () => {
    expect(AccessUtils.canChange(resource, user(1))).toBeTrue();
    expect(AccessUtils.canChange(resource, user(2))).toBeTrue();
  });

  it('refuses viewers and others', () => {
    expect(AccessUtils.canChange(resource, user(3))).toBeFalse();
    expect(AccessUtils.canChange({ owner: 1 }, user(3))).toBeFalse();
  });

  it('allows staff and superusers', () => {
    expect(AccessUtils.canChange(resource, user(4, { isStaff: true }))).toBeTrue();
    expect(AccessUtils.canChange(resource, user(5, { isSuperuser: true }))).toBeTrue();
  });

  it('refuses when the resource or user is missing', () => {
    expect(AccessUtils.canChange(null, user(1))).toBeFalse();
    expect(AccessUtils.canChange(resource, null)).toBeFalse();
  });
});
