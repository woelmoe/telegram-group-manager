import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Управление окнами
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),

  // Telegram операции
  initMTProto: (code?: string) => ipcRenderer.invoke('mtproto-init', code),
  getGroupMembers: (groupId: number) => ipcRenderer.invoke('get-group-members', groupId),
  getGroupInfo: (groupId: number) => ipcRenderer.invoke('get-group-info', groupId),
  addMembers: (targetId: number, users: any[], excludedId?: number) => 
    ipcRenderer.invoke('add-members', targetId, users, excludedId),
  verifyBot: (groupId: number) => ipcRenderer.invoke('verify-bot', groupId),

  // События прогресса
  onProgress: (callback: (current: number, total: number) => void) => {
    ipcRenderer.on('progress-update', (_, current, total) => callback(current, total));
  },
  
  // Удаление слушателей
  removeListeners: () => {
    ipcRenderer.removeAllListeners('progress-update');
  }
});