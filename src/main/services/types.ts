export interface TelegramUser {
  id: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  phone?: string;
}

export interface AddMembersResult {
  success: number;
  failed: number;
  failedUsers: Array<{ id: number; reason: string }>;
}

export interface GroupInfo {
  id: number;
  title?: string;
  username?: string;
  participantCount?: number;
}

export interface AppConfig {
  botToken: string;
  apiId: number;
  apiHash: string;
  phoneNumber: string;
}