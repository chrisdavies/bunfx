// This file is auto-generated. Do not edit directly.

/** Table: login_codes */
export type LoginCodeRow = {
  userId: string;
  code: string;
  createdAt: Date;
};

/** Insert type for: login_codes */
export type InsertLoginCodeRow = {
  userId: string;
  code: string;
  createdAt?: Date;
};

/** Table: users */
export type UserRow = {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Insert type for: users */
export type InsertUserRow = {
  id?: string;
  email: string;
  createdAt?: Date;
  updatedAt?: Date;
};
