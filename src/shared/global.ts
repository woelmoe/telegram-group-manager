// Типы для пользователей Telegram
export interface TelegramUser {
  id: number
  firstName: string
  lastName?: string
  username?: string
  phone?: string
}

// Типы для информации о группе
export interface GroupInfo {
  id: number
  title: string
  username?: string
  participantCount: number
}

// Типы для результата добавления участников
export interface AddMembersResult {
  success: number
  failed: number
  failedUsers: Array<{
    id: number
    reason: string
  }>
}

// Типы для API, которое будет доступно в renderer процессе через window.electronAPI
export interface ElectronAPI {
  // Управление окном
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void

  // MTProto методы
  initMTProto: (code?: string, password?: string) => Promise<boolean>
  getGroupMembers: (groupId: number) => Promise<TelegramUser[]>
  getGroupInfo: (groupId: number) => Promise<GroupInfo>

  // Bot методы
  addMembers: (
    targetId: number,
    users: TelegramUser[],
    excludedId?: number,
  ) => Promise<AddMembersResult>
  verifyBot: (groupId: number) => Promise<boolean>

  // Прогресс
  onProgress: (callback: (current: number, total: number) => void) => void
  removeListeners: () => void
}

// Расширяем глобальный интерфейс Window для доступа к electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

// Экспортируем пустой объект, чтобы файл считался модулем
export {}
