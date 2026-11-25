import { model, models, Schema, type Model } from 'mongoose';
import { createId } from '@orderflow/common';

export const USER_ROLES = ['USER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  _id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export const USER_MODEL = Symbol('USER_MODEL');
export type UserModel = Model<User>;

const UserSchema = new Schema<User>(
  {
    _id: { type: String, default: createId },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: USER_ROLES, default: 'USER' },
  },
  { timestamps: true, strict: true, collection: 'users' },
);

export function userModelFactory(): UserModel {
  return (models.User as UserModel | undefined) ?? model<User>('User', UserSchema);
}
