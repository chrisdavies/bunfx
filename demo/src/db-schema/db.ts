// This file is auto-generated. Do not edit directly.

/** Table: login_codes */
export type LoginCodeRow = {
  userId: string;
  code: string;
  createdAt: string;
};

/** Insert type for: login_codes */
export type InsertLoginCodeRow = {
  userId: string;
  code: string;
  createdAt: string;
};

/** Table: secrets */
export type SecretRow = {
  id: string;
  code: string;
  encryptedContent: string;
  userId: string;
  expiresAt: string;
  maxDownloads: number;
  downloadCount: number;
  createdAt: string;
};

/** Insert type for: secrets */
export type InsertSecretRow = {
  id: string;
  code: string;
  encryptedContent: string;
  userId: string;
  expiresAt: string;
  maxDownloads?: number;
  downloadCount?: number;
  createdAt: string;
};

/** Table: users */
export type UserRow = {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

/** Insert type for: users */
export type InsertUserRow = {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};
