import { TelegramClient } from '@mtcute/core/client.js';
import { NodeStorage } from '@mtcute/node';
import type { TelegramUser, GroupInfo } from './types';

export class MtprotoService {
  private client: TelegramClient;
  private initialized = false;
  private phoneNumber: string;

  constructor(apiId: number, apiHash: string, phoneNumber: string) {
    this.phoneNumber = phoneNumber;
    this.client = new TelegramClient({
      apiId,
      apiHash,
      storage: new NodeStorage('./session-data')
    });
  }

  async init(verificationCode?: string): Promise<boolean> {
    if (this.initialized) return true;

    await this.client.start();
    
    const authState = await this.client.getAuthorizationState();
    
    if (!authState.authorized) {
      if (!verificationCode) {
        // Отправляем код и ждем его ввода через UI
        await this.client.sendCode({ phone: this.phoneNumber });
        return false; // Требуется код подтверждения
      }
      
      // Вход с полученным кодом
      await this.client.signIn({ code: verificationCode });
    }
    
    this.initialized = true;
    return true;
  }

  async getGroupMembers(groupId: number): Promise<TelegramUser[]> {
    if (!this.initialized) {
      throw new Error('MTProto клиент не инициализирован');
    }

    try {
      const chat = await this.client.getChat(groupId);
      const participants = await this.client.getChatMembers(chat.inputPeer);
      
      return participants.map(member => ({
        id: Number(member.user.id),
        firstName: member.user.firstName,
        lastName: member.user.lastName,
        username: member.user.username,
        phone: member.user.phone
      }));
    } catch (error) {
      console.error('Ошибка при получении участников:', error);
      throw error;
    }
  }

  async getGroupInfo(groupId: number): Promise<GroupInfo> {
    const chat = await this.client.getChat(groupId);
    return {
      id: Number(chat.id),
      title: chat.title,
      username: chat.username,
      participantCount: chat.participantsCount
    };
  }
}