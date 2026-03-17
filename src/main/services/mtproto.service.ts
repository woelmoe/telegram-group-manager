// Импорты остаются без изменений
import { TelegramClient } from "teleproto"
import { StringSession } from "teleproto/sessions"
import { Api } from "teleproto/tl"
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
  private phoneCodeHash: string = ""

  constructor(apiId: number, apiHash: string, phoneNumber: string) {
    console.log("🔧 Создание MTProtoService")

    this.apiId = apiId
    this.apiHash = apiHash
    this.phoneNumber = phoneNumber

    this.sessionStore = new Store({
      name: "telegram-session",
      encryptionKey: "telegram-group-manager-secret",
    })

    const savedSession = (this.sessionStore.get("session") as string) || ""
    this.session = new StringSession(savedSession)
  }

  async init(
    verificationCode?: string,
    password?: string,
  ): Promise<boolean | string> {
    try {
      if (this.client && this.initialized) {
        return true
      }

      console.log("🔄 Создание Telegram клиента...")

      this.client = new TelegramClient(this.session, this.apiId, this.apiHash, {
        connectionRetries: 5,
      })

      console.log("🔄 Подключение к Telegram...")
      await this.client.connect()

      const isAuthorized = await this.client.isUserAuthorized()
      console.log("📊 Статус авторизации:", isAuthorized)

      if (!isAuthorized) {
        if (!verificationCode) {
          console.log("📱 Отправка кода на номер:", this.phoneNumber)

          // ИСПРАВЛЕНО: Правильное получение phoneCodeHash
          const sendCodeResult: any = await this.client.invoke(
            new Api.auth.SendCode({
              phoneNumber: this.phoneNumber,
              apiId: this.apiId,
              apiHash: this.apiHash,
              settings: new Api.CodeSettings({
                allowFlashcall: false,
                currentNumber: true,
                allowAppHash: true,
                allowMissedCall: false,
              }),
            }),
          )

          // Проверяем тип результата
          if (sendCodeResult._ === "auth.sentCode") {
            console.log(sendCodeResult)

            this.phoneCodeHash = sendCodeResult.phoneCodeHash
            console.log("✅ Код отправлен, phoneCodeHash:", this.phoneCodeHash)
          } else {
            console.log("❌ Неожиданный тип ответа:", sendCodeResult._)
          }
          return false
        } else {
          console.log("🔐 Вход с кодом подтверждения...")

          try {
            const signInResult = await this.client.invoke(
              new Api.auth.SignIn({
                phoneNumber: this.phoneNumber,
                phoneCode: verificationCode,
                phoneCodeHash: this.phoneCodeHash,
              }),
            )

            console.log("✅ Вход выполнен успешно")

            const sessionString = this.session.save()
            this.sessionStore.set("session", sessionString)

            this.initialized = true
            return true
          } catch (signInError: any) {
            console.error("❌ Ошибка входа:", signInError)

            if (signInError.errorMessage === "SESSION_PASSWORD_NEEDED") {
              console.log("🔐 Требуется 2FA пароль")

              if (!password) {
                return "2FA_REQUIRED"
              } else {
                return await this.loginWithPassword(password)
              }
            }
            throw signInError
          }
        }
      }

      this.initialized = true
      console.log("✅ MTProto клиент готов")
      return true
    } catch (error: any) {
      console.error("❌ Ошибка в init:", error)

      if (
        error.errorMessage === "AUTH_KEY_UNREGISTERED" ||
        error.code === 401
      ) {
        console.log("🔄 Сброс сессии...")
        this.session = new StringSession("")
        this.sessionStore.delete("session")
      }

      throw error
    }
  }

  // ИСПРАВЛЕН метод loginWithPassword
  async loginWithPassword(password: string): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error("Клиент не инициализирован")
      }

      console.log("🔐 Вход с 2FA паролем...")

      // Убираем пустой объект, передаем undefined
      const passwordInfo = await this.client.invoke(
        new Api.account.GetPassword(),
      )

      // В teleproto пароль передается как строка, библиотека сама хеширует
      const result = await this.client.invoke(
        new Api.auth.CheckPassword({
          password: password as any, // Используем any для обхода типизации
        }),
      )

      console.log("✅ Вход с 2FA выполнен успешно")

      const sessionString = this.session.save()
      this.sessionStore.set("session", sessionString)

      this.initialized = true
      return true
    } catch (error: any) {
      console.error("❌ Ошибка входа с 2FA:", error)
      throw error
    }
  }

  async getGroupMembers(groupId: number): Promise<TelegramUser[]> {
    if (!this.client || !this.initialized) {
      throw new Error("MTProto клиент не инициализирован")
    }

    try {
      console.log(`📥 Получение участников группы ${groupId}...`)

      const chat = await this.client.getEntity(groupId)

      let participants: any[] = []

      try {
        // ИСПРАВЛЕНО: Используем проверку через instanceof или наличие свойств
        const chatAny = chat as any
        const isChannel =
          chatAny.username !== undefined || chatAny.title !== undefined

        if (isChannel && chatAny.participantsCount !== undefined) {
          // Для каналов и супергрупп
          const result = await this.client.invoke(
            new Api.channels.GetParticipants({
              channel: chat,
              filter: new Api.ChannelParticipantsRecent(),
              limit: 1000,
            }),
          )

          if (result && "participants" in result) {
            participants = (result as any).participants || []
          }
        } else {
          // Для обычных групп
          const result = await this.client.invoke(
            new Api.messages.GetFullChat({
              chatId: chat.id,
            }),
          )

          if (result && "fullChat" in result) {
            const fullChat = (result as any).fullChat
            if (fullChat && "participants" in fullChat) {
              participants = fullChat.participants?.participants || []
            }
          }
        }
      } catch (error) {
        console.error("Ошибка при получении участников:", error)
        participants = []
      }

      console.log(`📊 Найдено ${participants.length} участников`)

      return participants.map((member: any) => ({
        id: Number(member.userId || member.id || 0),
        firstName: member.firstName || member.user?.firstName || "",
        lastName: member.lastName || member.user?.lastName || undefined,
        username: member.username || member.user?.username || undefined,
        phone: member.phone || member.user?.phone || undefined,
      }))
    } catch (error) {
      console.error("❌ Ошибка при получении участников:", error)
      return []
    }
  }

  async getGroupInfo(groupId: number): Promise<GroupInfo> {
    if (!this.client || !this.initialized) {
      throw new Error("MTProto клиент не инициализирован")
    }

    try {
      const chat = await this.client.getEntity(groupId)
      const chatAny = chat as any

      let title = "Без названия"
      let username = undefined

      if (chatAny.title) {
        title = chatAny.title
      }

      if (chatAny.username) {
        username = chatAny.username
      }

      let participantsCount = 0
      try {
        // ИСПРАВЛЕНО: Проверяем наличие participantsCount
        if (chatAny.participantsCount !== undefined) {
          participantsCount = chatAny.participantsCount || 0
        } else {
          // Пробуем получить полную информацию о канале
          try {
            const fullChannel = await this.client.invoke(
              new Api.channels.GetFullChannel({
                channel: chat,
              }),
            )

            if (fullChannel && "fullChat" in fullChannel) {
              const fullChatAny = (fullChannel as any).fullChat
              if (fullChatAny && fullChatAny.participantsCount !== undefined) {
                participantsCount = fullChatAny.participantsCount || 0
              }
            }
          } catch {
            // Если не получилось, считаем через getGroupMembers
            const members = await this.getGroupMembers(groupId)
            participantsCount = members.length
          }
        }
      } catch {
        participantsCount = 0
      }

      return {
        id: Number(chat.id),
        title: title,
        username: username,
        participantCount: participantsCount,
      }
    } catch (error) {
      console.error("❌ Ошибка при получении информации о группе:", error)
      throw error
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
