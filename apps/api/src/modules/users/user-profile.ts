import type { UserRow } from './rows/user.row.js';
/** Explicit learner-owned profile projection; credentials and moderation fields stay private. */
export function userProfile(user: UserRow) {
  return {
    _id: String(user._id),
    username: user.username,
    email: user.email,
    fullName: user.fullName ?? '',
    phone: user.phone ?? '',
    bio: user.bio ?? '',
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    role: 'USER' as const,
  };
}
