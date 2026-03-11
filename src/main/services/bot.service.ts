import { Bot } from 'grammy';
import type { TelegramUser, AddMembersResult } from './types';

export class BotService {
  private bot: Bot;

  constructor(token: string) {
    this.bot = new Bot(token);
  }

  async addMembersToGroup(
    targetGroupId: number, 
    users: TelegramUser[],
    excludedUserId?: number,
    onProgress?: (current: number, total: number) => void
  ): Promise<AddMembersResult> {
    const result: AddMembersResult = {
      success: 0,
      failed: 0,
      failedUsers: []
    };

    // Фильтруем исключенного пользователя
    const usersToAdd = excludedUserId 
      ? users.filter(user => user.id !== excludedUserId)
      : users;
    
    if (usersToAdd.length === 0) {
      return result;
    }

    const batchSize = 20;
    for (let i = 0; i < usersToAdd.length; i += batchSize) {
      const batch = usersToAdd.slice(i, i + batchSize);
      
      onProgress?.(i + batch.length, usersToAdd.length);

      for (const user of batch) {
        try {
          await this.bot.api.addChatMember(targetGroupId, user.id);
          result.success++;
        } catch (error: any) {
          result.failed++;
          result.failedUsers.push({
            id: user.id,
            reason: error.description || error.message || 'Неизвестная ошибка'
          });
        }

        // Задержка между добавлениями
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Задержка между пачками
      if (i + batchSize < usersToAdd.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    return result;
  }

  async verifyBotInGroup(groupId: number): Promise<boolean> {
    try {
      const chat = await this.bot.api.getChat(groupId);
      return chat.type === 'supergroup' || chat.type === 'group';
    } catch {
      return false;
    }
  }
}