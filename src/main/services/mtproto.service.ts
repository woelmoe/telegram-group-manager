import { TelegramClient } from "@mtcute/core"
import type { ITelegramClient } from "@mtcute/core"
import type { TelegramUser, GroupInfo } from "../../shared/global"

// Простое in-memory хранилище для сессии
class MemoryStorage {
  private data: Record<string, any> = {}

  async get(key: string): Promise<any> {
    return this.data[key]
  }

  async set(key: string, value: any): Promise<void> {
    this.data[key] = value
  }

  async delete(key: string): Promise<void> {
    delete this.data[key]
  }

  async *iterate(prefix: string): AsyncIterableIterator<[string, any]> {
    for (const [key, value] of Object.entries(this.data)) {
      if (key.startsWith(prefix)) {
        yield [key, value]
      }
    }
  }
}

export class MtprotoService {
  private client: TelegramClient
  private initialized = false
  private phoneNumber: string

  constructor(apiId: number, apiHash: string, phoneNumber: string) {
    this.phoneNumber = phoneNumber

    // Используем in-memory storage вместо SQLite
    const storage = new MemoryStorage()

    this.client = new TelegramClient({
      apiId,
      apiHash,
      storage,
    })
  }

  async init(verificationCode?: string): Promise<boolean> {
    if (this.initialized) return true

    try {
      await this.client.connect()

      if (!this.client.authorized) {
        if (!verificationCode) {
          await this.client.sendCode({ phone: this.phoneNumber })
          return false
        }

        await this.client.signIn({
          code: verificationCode,
          phone: this.phoneNumber,
          phoneCodeHash: "",
        })
      }

      this.initialized = true
      return true
    } catch (error) {
      console.error("MTProto init error:", error)
      throw error
    }
  }

  async getGroupMembers(groupId: number): Promise<TelegramUser[]> {
    if (!this.initialized) {
      throw new Error("MTProto клиент не инициализирован")
    }

    try {
      const chat = await this.client.getChat(groupId)
      const participants = await this.client.getParticipants(chat.inputPeer)

      return participants.map((member) => ({
        id: Number(member.user.id),
        firstName: member.user.firstName || "",
        lastName: member.user.lastName || undefined,
        username: member.user.username || undefined,
        phone: member.user.phoneNumber || undefined,
      }))
    } catch (error) {
      console.error("Ошибка при получении участников:", error)
      throw error
    }
  }

  async getGroupInfo(groupId: number): Promise<GroupInfo> {
    const chat = await this.client.getChat(groupId)

    // Получаем количество участников
    let participantsCount = 0
    try {
      const participants = await this.client.getParticipants(chat.inputPeer, {
        limit: 1,
      })
      participantsCount = participants.total || 0
    } catch {
      participantsCount = 0
    }

    return {
      id: Number(chat.id),
      title: chat.title || "Без названия",
      username: chat.username,
      participantCount: participantsCount,
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.initialized = false
    }
  }
}
