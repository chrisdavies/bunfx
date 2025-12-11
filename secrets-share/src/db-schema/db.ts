// This file is auto-generated. Do not edit directly.

/** Table: login_codes */
export type LoginCodeRow = {
  user_id: string;
  code: string;
  created_at: string;
};

/** Insert type for: login_codes */
export type InsertLoginCodeRow = {
  user_id: string;
  code: string;
  created_at: string;
};

/** Table: secrets */
export type SecretRow = {
  id: string;
  code: string;
  encrypted_content: string;
  user_id: string;
  expires_at: string;
  max_downloads: number;
  download_count: number;
  created_at: string;
};

/** Insert type for: secrets */
export type InsertSecretRow = {
  id: string;
  code: string;
  encrypted_content: string;
  user_id: string;
  expires_at: string;
  max_downloads?: number;
  download_count?: number;
  created_at: string;
};

/** Table: users */
export type UserRow = {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
};

/** Insert type for: users */
export type InsertUserRow = {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
};
