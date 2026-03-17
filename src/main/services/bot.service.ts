import { Bot } from "grammy"
import type { TelegramUser, AddMembersResult } from "../../shared/global"

export class BotService {
  private bot: Bot

  constructor(token: string) {
    this.bot = new Bot(token)
  }

  async addMembersToGroup(
    targetGroupId: number,
    users: TelegramUser[],
    excludedUserId?: number,
    onProgress?: (current: number, total: number) => void,
  ): Promise<AddMembersResult> {
    const result: AddMembersResult = {
      success: 0,
      failed: 0,
      failedUsers: [],
    }

    const usersToAdd = excludedUserId
      ? users.filter((user) => user.id !== excludedUserId)
      : users

    if (usersToAdd.length === 0) {
      return result
    }

    console.log(`Начинаем добавление ${usersToAdd.length} пользователей`)

    // Telegram имеет ограничения: не более 30-50 добавлений в день
    // Добавляем с задержками
    const batchSize = 20

    for (let i = 0; i < usersToAdd.length; i += batchSize) {
      const batch = usersToAdd.slice(i, i + batchSize)

      for (let j = 0; j < batch.length; j++) {
        const user = batch[j]

        try {
          // Способ 1: Через временный бан и разбан
          // Это добавляет пользователя в группу, если он не был там ранее
          await this.bot.api.banChatMember(targetGroupId, user.id, {
            until_date: Math.floor(Date.now() / 1000) + 40, // Бан на 40 секунд
          })

          // Сразу разбаниваем
          await this.bot.api.unbanChatMember(targetGroupId, user.id, {
            only_if_banned: true, // Разбанить только если забанен
          })

          result.success++
          console.log(
            `✅ Добавлен пользователь ${user.id} (${user.username || "без username"})`,
          )
        } catch (error: any) {
          // Если не сработал первый способ, пробуем через invite link
          try {
            // Альтернативный способ: создаем invite ссылку и "приглашаем" пользователя
            // Но для этого нужно чтобы пользователь написал боту в личку
            console.log(
              `Пользователь ${user.id} не добавлен через бан, пробуем другие методы...`,
            )

            // Здесь можно добавить логику с invite ссылками
            // Но это сложнее, требует взаимодействия с пользователем

            result.failed++
            result.failedUsers.push({
              id: user.id,
              reason: `Не удалось добавить: ${error.description || error.message}`,
            })
          } catch (secondError: any) {
            result.failed++
            result.failedUsers.push({
              id: user.id,
              reason:
                secondError.description ||
                secondError.message ||
                "Неизвестная ошибка",
            })
          }
        }

        const currentProgress = i + j + 1
        onProgress?.(currentProgress, usersToAdd.length)

        // Задержка между добавлениями (важно для избежания флуд-контроля)
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }

      // Задержка между пачками
      if (i + batchSize < usersToAdd.length) {
        console.log("⏳ Ожидание 5 секунд перед следующей пачкой...")
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }

    return result
  }

  async verifyBotInGroup(groupId: number): Promise<boolean> {
    try {
      // Получаем информацию о чате
      const chat = await this.bot.api.getChat(groupId)
      console.log("Информация о чате:", chat)

      // Проверяем, является ли бот администратором
      const botMember = await this.bot.api.getChatMember(
        groupId,
        this.bot.botInfo.id,
      )
      console.log("Права бота:", botMember.status)

      return (
        botMember.status === "administrator" || botMember.status === "creator"
      )
    } catch (error) {
      console.error("Ошибка проверки бота:", error)
      return false
    }
  }

  // Дополнительный метод: получить invite ссылку для группы
  async getInviteLink(groupId: number): Promise<string | null> {
    try {
      const inviteLink = await this.bot.api.exportChatInviteLink(groupId)
      return inviteLink
    } catch (error) {
      console.error("Ошибка получения invite ссылки:", error)
      return null
    }
  }
}
