import { app, BrowserWindow, ipcMain, dialog } from "electron"
import path from "path"
import dotenv from "dotenv"
import { MtprotoService } from "./services/mtproto.service"
import { BotService } from "./services/bot.service"
import type { TelegramUser } from "../shared/global"

dotenv.config()

let mainWindow: BrowserWindow | null = null
let mtproto: MtprotoService
let bot: BotService

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
    console.log("Пробуем альтернативный путь:", altPath)

    mainWindow?.loadFile(altPath).catch((altErr) => {
      console.error("Ошибка загрузки из альтернативного пути:", altErr)
      dialog.showErrorBox(
        "Ошибка",
        `Не удалось загрузить интерфейс: ${err.message}\nПуть: ${indexPath}`,
      )
    })
  })

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show()
  })

  // Инициализация сервисов
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
  bot = new BotService(botToken)

  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools()
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
  // Закрываем соединение с MTProto перед выходом
  if (mtproto) {
    await mtproto.disconnect()
  }
  if (process.platform !== "darwin") {
    app.quit()
  }
})

// Обработчики IPC событий
ipcMain.handle("mtproto-init", async (_, code?: string) => {
  try {
    return await mtproto.init(code)
  } catch (error) {
    console.error("MTProto init error:", error)
    throw error
  }
})

ipcMain.handle("get-group-members", async (_, groupId: number) => {
  try {
    return await mtproto.getGroupMembers(groupId)
  } catch (error: any) {
    dialog.showErrorBox("Ошибка", error.message)
    throw error
  }
})

ipcMain.handle("get-group-info", async (_, groupId: number) => {
  try {
    return await mtproto.getGroupInfo(groupId)
  } catch (error: any) {
    dialog.showErrorBox("Ошибка", error.message)
    throw error
  }
})

ipcMain.handle(
  "add-members",
  async (_, targetId: number, users: TelegramUser[], excludedId?: number) => {
    const sendProgress = (current: number, total: number) => {
      mainWindow?.webContents.send("progress-update", current, total)
    }

    try {
      return await bot.addMembersToGroup(
        targetId,
        users,
        excludedId,
        sendProgress,
      )
    } catch (error: any) {
      dialog.showErrorBox("Ошибка", error.message)
      throw error
    }
  },
)

ipcMain.handle("verify-bot", async (_, groupId: number) => {
  try {
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
