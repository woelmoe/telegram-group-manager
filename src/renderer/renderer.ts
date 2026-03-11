declare global {
  interface Window {
    electronAPI: {
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
      initMTProto: (code?: string) => Promise<boolean>;
      getGroupMembers: (groupId: number) => Promise<any[]>;
      getGroupInfo: (groupId: number) => Promise<any>;
      addMembers: (targetId: number, users: any[], excludedId?: number) => Promise<any>;
      verifyBot: (groupId: number) => Promise<boolean>;
      onProgress: (callback: (current: number, total: number) => void) => void;
      removeListeners: () => void;
    }
  }
}

// Управление окном
document.getElementById('minimize-btn')?.addEventListener('click', () => {
  window.electronAPI.minimizeWindow();
});

document.getElementById('maximize-btn')?.addEventListener('click', () => {
  window.electronAPI.maximizeWindow();
});

document.getElementById('close-btn')?.addEventListener('click', () => {
  window.electronAPI.closeWindow();
});

// Состояние приложения
let isMtProtoAuthorized = false;
let currentMembers: any[] = [];
let currentGroupInfo: any = null;

// DOM элементы
const statusPanel = document.getElementById('status') as HTMLDivElement;
const mtprotoStatus = document.getElementById('mtproto-status') as HTMLDivElement;
const codeInputArea = document.getElementById('code-input-area') as HTMLDivElement;
const initBtn = document.getElementById('init-mtproto') as HTMLButtonElement;
const submitCodeBtn = document.getElementById('submit-code') as HTMLButtonElement;
const loadMembersBtn = document.getElementById('load-members') as HTMLButtonElement;
const addMembersBtn = document.getElementById('add-members') as HTMLButtonElement;

// Функция для отображения статуса
function showStatus(message: string, isError: boolean = false) {
  statusPanel.style.display = 'block';
  statusPanel.textContent = message;
  statusPanel.style.backgroundColor = isError ? '#f8d7da' : '#fff3cd';
  statusPanel.style.color = isError ? '#721c24' : '#856404';
  
  setTimeout(() => {
    statusPanel.style.display = 'none';
  }, 5000);
}

// Инициализация MTProto
initBtn.addEventListener('click', async () => {
  try {
    initBtn.disabled = true;
    initBtn.textContent = 'Авторизация...';
    
    const result = await window.electronAPI.initMTProto();
    
    if (result) {
      isMtProtoAuthorized = true;
      mtprotoStatus.textContent = 'Авторизован';
      mtprotoStatus.className = 'status-badge authorized';
      loadMembersBtn.disabled = false;
      showStatus('✅ MTProto успешно авторизован');
      codeInputArea.style.display = 'none';
    } else {
      // Требуется код подтверждения
      codeInputArea.style.display = 'block';
      showStatus('📱 Введите код подтверждения из Telegram');
    }
  } catch (error: any) {
    showStatus(`❌ Ошибка авторизации: ${error.message}`, true);
  } finally {
    initBtn.disabled = false;
    initBtn.textContent = 'Авторизоваться';
  }
});

// Отправка кода подтверждения
submitCodeBtn.addEventListener('click', async () => {
  const code = (document.getElementById('code-input') as HTMLInputElement).value;
  if (!code) return;

  try {
    submitCodeBtn.disabled = true;
    submitCodeBtn.textContent = 'Проверка...';
    
    const result = await window.electronAPI.initMTProto(code);
    
    if (result) {
      isMtProtoAuthorized = true;
      mtprotoStatus.textContent = 'Авторизован';
      mtprotoStatus.className = 'status-badge authorized';
      loadMembersBtn.disabled = false;
      showStatus('✅ MTProto успешно авторизован');
      codeInputArea.style.display = 'none';
    }
  } catch (error: any) {
    showStatus(`❌ Ошибка: ${error.message}`, true);
  } finally {
    submitCodeBtn.disabled = false;
    submitCodeBtn.textContent = 'Подтвердить';
  }
});

// Загрузка участников
loadMembersBtn.addEventListener('click', async () => {
  const sourceGroup = (document.getElementById('source-group') as HTMLInputElement).value;
  if (!sourceGroup) {
    showStatus('❌ Введите ID исходной группы', true);
    return;
  }

  try {
    loadMembersBtn.disabled = true;
    loadMembersBtn.textContent = 'Загрузка...';
    
    // Получаем информацию о группе
    const groupInfo = await window.electronAPI.getGroupInfo(parseInt(sourceGroup));
    currentGroupInfo = groupInfo;
    
    // Получаем участников
    const members = await window.electronAPI.getGroupMembers(parseInt(sourceGroup));
    currentMembers = members;
    
    // Отображаем информацию
    const groupInfoDiv = document.getElementById('group-info') as HTMLDivElement;
    groupInfoDiv.innerHTML = `
      <div><strong>Группа:</strong> ${groupInfo.title || groupInfo.id}</div>
      <div><strong>Участников:</strong> ${members.length}</div>
    `;
    
    // Отображаем первых 20 участников
    const membersList = document.getElementById('members-list') as HTMLDivElement;
    membersList.innerHTML = '<strong>Первые 20 участников:</strong>' + 
      members.slice(0, 20).map(m => 
        `<div class="member-item">👤 ${m.firstName || ''} ${m.lastName || ''} (@${m.username || 'нет username'})</div>`
      ).join('');
    
    // Проверяем бота в целевой группе
    const targetGroup = (document.getElementById('target-group') as HTMLInputElement).value;
    if (targetGroup) {
      const isBotValid = await window.electronAPI.verifyBot(parseInt(targetGroup));
      addMembersBtn.disabled = !isBotValid;
      
      if (!isBotValid) {
        showStatus('⚠️ Бот не является администратором в целевой группе', true);
      }
    }
    
    showStatus(`✅ Загружено ${members.length} участников`);
  } catch (error: any) {
    showStatus(`❌ Ошибка загрузки: ${error.message}`, true);
  } finally {
    loadMembersBtn.disabled = false;
    loadMembersBtn.textContent = '📊 Загрузить участников';
  }
});

// Добавление участников
addMembersBtn.addEventListener('click', async () => {
  const targetGroup = (document.getElementById('target-group') as HTMLInputElement).value;
  const excludedUser = (document.getElementById('excluded-user') as HTMLInputElement).value;
  
  if (!targetGroup) {
    showStatus('❌ Введите ID целевой группы', true);
    return;
  }

  if (currentMembers.length === 0) {
    showStatus('❌ Сначала загрузите участников', true);
    return;
  }

  const progressArea = document.getElementById('progress-area') as HTMLDivElement;
  const progressBar = document.getElementById('progress-bar') as HTMLProgressElement;
  const progressText = document.getElementById('progress-text') as HTMLSpanElement;
  
  progressArea.style.display = 'block';
  addMembersBtn.disabled = true;

  // Подписываемся на прогресс
  window.electronAPI.onProgress((current, total) => {
    const percent = (current / total) * 100;
    progressBar.value = percent;
    progressText.textContent = `${current}/${total}`;
  });

  try {
    const excludedId = excludedUser ? parseInt(excludedUser) : undefined;
    const result = await window.electronAPI.addMembers(
      parseInt(targetGroup),
      currentMembers,
      excludedId
    );
    
    // Отображаем результаты
    const resultsDiv = document.getElementById('results') as HTMLPreElement;
    resultsDiv.textContent = JSON.stringify(result, null, 2);
    
    showStatus(`✅ Добавление завершено. Успешно: ${result.success}, Ошибок: ${result.failed}`);
  } catch (error: any) {
    showStatus(`❌ Ошибка добавления: ${error.message}`, true);
  } finally {
    progressArea.style.display = 'none';
    addMembersBtn.disabled = false;
    window.electronAPI.removeListeners();
  }
});