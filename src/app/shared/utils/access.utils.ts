import type { User } from '@noatgnu/cupcake-core';

export interface OwnerEditorResource {
  owner?: number;
  editors?: number[];
}

export class AccessUtils {
  static readonly OWNER_OR_EDITOR_ONLY = 'Only the owner or an editor can do this';

  /**
   * Whether the user can change a protocol or session: staff, superusers, its owner or one of its editors.
   */
  static canChange(resource: OwnerEditorResource | null | undefined, user: User | null | undefined): boolean {
    if (!resource || !user) {
      return false;
    }
    if (user.isStaff || user.isSuperuser) {
      return true;
    }
    return resource.owner === user.id || (resource.editors ?? []).includes(user.id);
  }
}
