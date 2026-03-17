import { TelegramClient } from "teleproto"
import { StringSession } from "teleproto/sessions"
import Store from "electron-store"
import type { TelegramUser, GroupInfo } from "../../shared/global"

export class MtprotoService {
  private client: TelegramClient | null = null
  private initialized = false
  private phoneNumber: string
  private apiId: number
  private apiHash: string
  private sessionStore: Store
  private session: StringSession

  constructor(apiId: number, apiHash: string, phoneNumber: string) {
    this.apiId = apiId
    this.apiHash = apiHash
    this.phoneNumber = phoneNumber

    // Используем electron-store для сохранения сессии
    this.sessionStore = new Store({
      name: "telegram-session",
      encryptionKey: "telegram-group-manager-secret",
    })

    // Загружаем сохраненную сессию или создаем новую
    const savedSession = (this.sessionStore.get("session") as string) || ""
    this.session = new StringSession(savedSession)
  }

  async init(verificationCode?: string): Promise<boolean> {
    try {
      if (this.client && this.initialized) {
        return true
      }

      console.log("🔄 Создание Telegram клиента...")

      this.client = new TelegramClient(this.session, this.apiId, this.apiHash, {
        connectionRetries: 5,
        useWSS: true,
      })

      console.log("🔄 Подключение к Telegram...")
      await this.client.connect()

      // Проверяем авторизацию
      if (!(await this.client.isUserAuthorized())) {
        if (!verificationCode) {
          console.log("📱 Отправка кода на номер:", this.phoneNumber)

          // Отправляем запрос на код
          await this.client.sendCode(this.phoneNumber)

          return false
        } else {
          console.log("🔐 Вход с кодом подтверждения...")

          // Входим с кодом
          await this.client.invoke("auth.signIn", {
            phoneNumber: this.phoneNumber,
            phoneCode: verificationCode,
          })
        }
      }

      // Сохраняем сессию
      const sessionString = this.session.save()
      this.sessionStore.set("session", sessionString)

      this.initialized = true
      console.log("✅ MTProto клиент готов")
      return true
    } catch (error: any) {
      console.error("❌ Ошибка в init:", error)

      // Если требуется 2FA
      if (error.errorMessage === "SESSION_PASSWORD_NEEDED") {
        console.log("🔐 Требуется 2FA пароль")
        // Здесь можно добавить обработку 2FA
      }

      throw error
    }
  }

  async getGroupMembers(groupId: number): Promise<TelegramUser[]> {
    if (!this.client || !this.initialized) {
      throw new Error("MTProto клиент не инициализирован")
    }

    try {
      console.log(`📥 Получение участников группы ${groupId}...`)

      // Получаем информацию о чате
      const chat = await this.client.getEntity(groupId)

      // Получаем участников
      let participants: any[] = []

      if (chat.className === "Channel") {
        // Для супергрупп и каналов
        const result = await this.client.invoke("channels.getParticipants", {
          channel: chat,
          filter: { className: "ChannelParticipantsRecent" },
          limit: 1000,
        })
        participants = result.participants || []
      } else {
        // Для обычных групп
        const result = await this.client.invoke("messages.getFullChat", {
          chatId: chat.id,
        })
        participants = result.fullChat.participants?.participants || []
      }

      console.log(`📊 Найдено ${participants.length} участников`)

      return participants.map((member: any) => ({
        id: Number(member.userId || member.id),
        firstName: member.firstName || "",
        lastName: member.lastName || undefined,
        username: member.username || undefined,
        phone: member.phone || undefined,
      }))
    } catch (error) {
      console.error("❌ Ошибка при получении участников:", error)
      throw error
    }
  }

  async getGroupInfo(groupId: number): Promise<GroupInfo> {
    if (!this.client || !this.initialized) {
      throw new Error("MTProto клиент не инициализирован")
    }

    try {
      const chat = await this.client.getEntity(groupId)

      return {
        id: Number(chat.id),
        title: chat.title || chat.username || "Без названия",
        username: chat.username,
        participantCount: chat.participantsCount || 0,
      }
    } catch (error) {
      console.error("❌ Ошибка при получении информации о группе:", error)
      throw error
    }
  }

  async submitCode(code: string): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error("Клиент не инициализирован")
      }

      console.log("🔐 Отправка кода подтверждения...")

      await this.client.invoke("auth.signIn", {
        phoneNumber: this.phoneNumber,
        phoneCode: code,
      })

      // Сохраняем сессию
      const sessionString = this.session.save()
      this.sessionStore.set("session", sessionString)

      this.initialized = true
      console.log("✅ Авторизация успешна")
      return true
    } catch (error: any) {
      console.error("❌ Ошибка при вводе кода:", error)

      // Если требуется 2FA
      if (error.errorMessage === "SESSION_PASSWORD_NEEDED") {
        console.log("🔐 Требуется 2FA пароль")
        // Здесь можно добавить обработку 2FA
      }

      return false
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.disconnect()
        console.log("👋 Соединение закрыто")
      } catch (error) {
        console.error("Ошибка при закрытии соединения:", error)
      }
      this.client = null
      this.initialized = false
    }
  }
}
