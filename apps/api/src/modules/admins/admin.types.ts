export interface AdminRecord {
  _id: string;
  id: string;
  email: string;
  username: string;
  password: string;
  avatarUrl?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
