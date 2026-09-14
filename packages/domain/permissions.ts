import { UserRole, type AdminUser, type Permission } from "./index";

const adminPermissions: Permission[] = ["dashboard:view-global","student:view-any","student:update","student:block","teacher:view","teacher:create","teacher:update","course:view-any","course:create","course:update-any","course:archive","lesson:create","lesson:update","exercise:create","exercise:update","exercise:publish","attempt:view-any","report:view-global","media:manage-any","landing:update","site-settings:update","tts-settings:update","tts-job:retry"];
const teacherPermissions: Permission[] = ["dashboard:view-assigned","student:view-assigned","course:view-assigned","course:update-assigned","lesson:create","lesson:update","exercise:create","exercise:update","exercise:publish","attempt:view-assigned","report:view-assigned","media:manage-assigned"];

export type PermissionResource = { assignedTeacherIds?: string[]; enrolledCourseIds?: string[]; courseId?: string };
export function permissionsFor(user: AdminUser): Permission[] { return user.role === UserRole.ADMIN ? adminPermissions : user.role === UserRole.TEACHER ? teacherPermissions : []; }
export function can(user: AdminUser | null | undefined, permission: Permission, resource?: PermissionResource): boolean {
  if (!user || !permissionsFor(user).includes(permission)) return false;
  if (user.role === UserRole.ADMIN) return true;
  if (!resource) return true;
  if (resource.assignedTeacherIds) return resource.assignedTeacherIds.includes(user.id);
  if (resource.courseId) return user.assignedCourseIds.includes(resource.courseId);
  if (resource.enrolledCourseIds) return resource.enrolledCourseIds.some((id) => user.assignedCourseIds.includes(id));
  return false;
}
