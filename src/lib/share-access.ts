export const SHARE_PERMISSIONS = ["read", "comment", "edit", "delete"] as const;

export type SharePermission = (typeof SHARE_PERMISSIONS)[number];

export type ShortlistAccess = SharePermission | "owner";

const RANK: Record<ShortlistAccess, number> = {
  read: 1,
  comment: 2,
  edit: 3,
  delete: 4,
  owner: 5,
};

export function permissionAllows(
  actual: ShortlistAccess | null | undefined,
  required: SharePermission
): boolean {
  if (!actual) return false;
  return RANK[actual] >= RANK[required];
}

export function sharePermissionLabel(permission: SharePermission): string {
  switch (permission) {
    case "read":
      return "View only";
    case "comment":
      return "View and comment";
    case "edit":
      return "View, comment, and edit";
    case "delete":
      return "View, comment, edit, and delete";
  }
}
