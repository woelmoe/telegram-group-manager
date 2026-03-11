import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import dotenv from 'dotenv';
import { MtprotoService } from './services/mtproto.service';
import { BotService } from './services/bot.service';
import type { TelegramUser, AddMembersResult, GroupInfo } from './services/types';

dotenv.config();

let mainWindow: BrowserWindow | null = null;
let mtproto: MtprotoService;
let bot: BotService;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    frame: false, // Для кастомного заголовка
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Инициализация сервисов
  const apiId = parseInt(process.env.API_ID!);
  const apiHash = process.env.API_HASH!;
  const botToken = process.env.BOT_TOKEN!;
  const phoneNumber = process.env.PHONE_NUMBER!;

  mtproto = new MtprotoService(apiId, apiHash, phoneNumber);
  bot = new BotService(botToken);

  // DevTools в режиме разработки
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Обработчики IPC событий
ipcMain.handle('mtproto-init', async (_, code?: string) => {
  try {
    return await mtproto.init(code);
  } catch (error) {
    console.error('MTProto init error:', error);
    throw error;
  }
});

ipcMain.handle('get-group-members', async (_, groupId: number) => {
  try {
    return await mtproto.getGroupMembers(groupId);
  } catch (error: any) {
    dialog.showErrorBox('Ошибка', error.message);
    throw error;
  }
});

ipcMain.handle('get-group-info', async (_, groupId: number) => {
  return await mtproto.getGroupInfo(groupId);
});

ipcMain.handle('add-members', async (_, targetId: number, users: TelegramUser[], excludedId?: number) => {
  const sendProgress = (current: number, total: number) => {
    mainWindow?.webContents.send('progress-update', current, total);
  };

  return await bot.addMembersToGroup(targetId, users, excludedId, sendProgress);
});

ipcMain.handle('verify-bot', async (_, groupId: number) => {
  return await bot.verifyBotInGroup(groupId);
});

// Управление окном
ipcMain.on('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on('window-close', () => {
  mainWindow?.close();
});