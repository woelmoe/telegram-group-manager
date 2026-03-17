import { app, BrowserWindow, ipcMain, dialog } from "electron"
import path from "path"
import dotenv from "dotenv"
import { MtprotoService } from "./services/mtproto.service"
import { BotService } from "./services/bot.service"
import type { TelegramUser } from "../shared/global"

dotenv.config()

let mainWindow: BrowserWindow | null = null
let mtproto: MtprotoService | null = null
let bot: BotService | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    frame: false,
    show: false,
    backgroundColor: "#f5f5f5",
  })

  const indexPath = path.join(__dirname, "../renderer/index.html")
  console.log("Загрузка HTML из:", indexPath)

  mainWindow.loadFile(indexPath).catch((err) => {
    console.error("Ошибка загрузки HTML:", err)
    const altPath = path.join(__dirname, "..", "renderer", "index.html")

    mainWindow?.loadFile(altPath).catch((altErr) => {
      console.error("Ошибка загрузки из альтернативного пути:", altErr)
      dialog.showErrorBox(
        "Ошибка",
        `Не удалось загрузить интерфейс: ${err.message}`,
      )
    })
  })

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show()
  })

  // Инициализация сервисов ПОСЛЕ создания окна
  initServices()

  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools()
  }
}

function initServices() {
  try {
    const apiId = parseInt(process.env.API_ID || "0")
    const apiHash = process.env.API_HASH || ""
    const botToken = process.env.BOT_TOKEN || ""
    const phoneNumber = process.env.PHONE_NUMBER || ""

    if (!apiId || !apiHash || !botToken || !phoneNumber) {
      dialog.showErrorBox(
        "Ошибка конфигурации",
        "Проверьте файл .env, все поля должны быть заполнены",
      )
      return
    }

    mtproto = new MtprotoService(apiId, apiHash, phoneNumber)

    console.log("mtproto", mtproto)

    bot = new BotService(botToken)

    console.log("✅ Сервисы инициализированы")
  } catch (error) {
    console.error("❌ Ошибка инициализации сервисов:", error)
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on("window-all-closed", async () => {
  if (mtproto) {
    await mtproto.disconnect()
  }
  if (process.platform !== "darwin") {
    app.quit()
  }
})

// Обработчики IPC событий
ipcMain.handle("mtproto-init", async (_, code?: string, password?: string) => {
  try {
    if (!mtproto) {
      throw new Error("MTProto сервис не инициализирован")
    }
    console.log(
      "Вызов mtproto.init с кодом:",
      code ? "***" : "без кода",
      "password:",
      password ? "***" : "без пароля",
    )

    const result = await mtproto.init(code, password)
    console.log("Результат mtproto.init:", result)
    return result
  } catch (error: any) {
    console.error("MTProto init error:", error)
    throw error
  }
})

ipcMain.handle("get-group-members", async (_, groupId: number) => {
  try {
    if (!mtproto) {
      throw new Error("MTProto сервис не инициализирован")
    }
    return await mtproto.getGroupMembers(groupId)
  } catch (error: any) {
    console.error("Ошибка получения участников:", error)
    dialog.showErrorBox("Ошибка", error.message)
    throw error
  }
})

ipcMain.handle("get-group-info", async (_, groupId: number) => {
  try {
    if (!mtproto) {
      throw new Error("MTProto сервис не инициализирован")
    }
    return await mtproto.getGroupInfo(groupId)
  } catch (error: any) {
    console.error("Ошибка получения информации о группе:", error)
    dialog.showErrorBox("Ошибка", error.message)
    throw error
  }
})

ipcMain.handle(
  "add-members",
  async (_, targetId: number, users: TelegramUser[], excludedId?: number) => {
    try {
      if (!bot) {
        throw new Error("Bot сервис не инициализирован")
      }

      const sendProgress = (current: number, total: number) => {
        mainWindow?.webContents.send("progress-update", current, total)
      }

      return await bot.addMembersToGroup(
        targetId,
        users,
        excludedId,
        sendProgress,
      )
    } catch (error: any) {
      console.error("Ошибка добавления участников:", error)
      dialog.showErrorBox("Ошибка", error.message)
      throw error
    }
  },
)

ipcMain.handle("verify-bot", async (_, groupId: number) => {
  try {
    if (!bot) {
      throw new Error("Bot сервис не инициализирован")
    }
    return await bot.verifyBotInGroup(groupId)
  } catch (error: any) {
    console.error("Ошибка проверки бота:", error)
    return false
  }
})

// Управление окном
ipcMain.on("window-minimize", () => {
  mainWindow?.minimize()
})

ipcMain.on("window-maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.on("window-close", () => {
  mainWindow?.close()
})
