let requires2FA = false
let tempCode = ""

// Проверяем, что electronAPI доступен
if (!window.electronAPI) {
  console.error("electronAPI не найден! Проверьте preload скрипт.")
}

// Управление окном
document.getElementById("minimize-btn")?.addEventListener("click", () => {
  window.electronAPI?.minimizeWindow()
})

document.getElementById("maximize-btn")?.addEventListener("click", () => {
  window.electronAPI?.maximizeWindow()
})

document.getElementById("close-btn")?.addEventListener("click", () => {
  window.electronAPI?.closeWindow()
})

// Состояние приложения
let isMtProtoAuthorized = false
let currentMembers: any[] = []
let currentGroupInfo: any = null

// DOM элементы с проверкой на null
const statusPanel = document.getElementById("status") as HTMLDivElement | null
const mtprotoStatus = document.getElementById(
  "mtproto-status",
) as HTMLDivElement | null
const codeInputArea = document.getElementById(
  "code-input-area",
) as HTMLDivElement | null
const initBtn = document.getElementById(
  "init-mtproto",
) as HTMLButtonElement | null
const submitCodeBtn = document.getElementById(
  "submit-code",
) as HTMLButtonElement | null
const loadMembersBtn = document.getElementById(
  "load-members",
) as HTMLButtonElement | null
const addMembersBtn = document.getElementById(
  "add-members",
) as HTMLButtonElement | null

// Функция для отображения статуса
function showStatus(message: string, isError: boolean = false): void {
  if (!statusPanel) return

  statusPanel.style.display = "block"
  statusPanel.textContent = message
  statusPanel.style.backgroundColor = isError ? "#f8d7da" : "#fff3cd"
  statusPanel.style.color = isError ? "#721c24" : "#856404"

  setTimeout(() => {
    statusPanel.style.display = "none"
  }, 5000)
}

// Инициализация MTProto
initBtn?.addEventListener("click", async () => {
  console.log("Кнопка авторизации нажата")

  if (!window.electronAPI) {
    console.error("electronAPI не найден!")
    showStatus("❌ electronAPI не доступен", true)
    return
  }

  try {
    initBtn.disabled = true
    initBtn.textContent = "Авторизация..."

    console.log("Вызов electronAPI.initMTProto()")
    const result = await window.electronAPI.initMTProto()
    console.log("Результат initMTProto:", result)

    if (result === true) {
      isMtProtoAuthorized = true
      if (mtprotoStatus) {
        mtprotoStatus.textContent = "Авторизован"
        mtprotoStatus.className = "status-badge authorized"
      }
      if (loadMembersBtn) loadMembersBtn.disabled = false
      showStatus("✅ MTProto успешно авторизован")
      if (codeInputArea) codeInputArea.style.display = "none"
    } else {
      if (codeInputArea) codeInputArea.style.display = "block"
      showStatus("📱 Введите код подтверждения из Telegram")
    }
  } catch (error: any) {
    console.error("Ошибка авторизации:", error)
    showStatus(`❌ Ошибка авторизации: ${error.message}`, true)
  } finally {
    if (initBtn) {
      initBtn.disabled = false
      initBtn.textContent = "Авторизоваться"
    }
  }
})

// Отправка кода подтверждения
// Замените весь обработчик submitCodeBtn на этот:

submitCodeBtn?.addEventListener("click", async () => {
  const codeInput = document.getElementById("code-input") as HTMLInputElement
  const code = codeInput?.value

  if (!code) {
    showStatus("❌ Введите код подтверждения", true)
    return
  }

  try {
    submitCodeBtn.disabled = true
    submitCodeBtn.textContent = "Проверка..."

    // Если ожидается 2FA пароль
    if (requires2FA) {
      const result = await window.electronAPI.initMTProto(tempCode, code)

      if (result === true) {
        isMtProtoAuthorized = true
        if (mtprotoStatus) {
          mtprotoStatus.textContent = "Авторизован"
          mtprotoStatus.className = "status-badge authorized"
        }
        if (loadMembersBtn) loadMembersBtn.disabled = false
        showStatus("✅ 2FA авторизация успешна")
        if (codeInputArea) codeInputArea.style.display = "none"
        requires2FA = false

        codeInput.placeholder = "Введите код из Telegram"
        submitCodeBtn.textContent = "Подтвердить"
      } else {
        showStatus("❌ Ошибка 2FA пароля", true)
      }
      return
    }

    // Обычный код подтверждения
    const result = await window.electronAPI.initMTProto(code)

    if (result === true) {
      isMtProtoAuthorized = true
      if (mtprotoStatus) {
        mtprotoStatus.textContent = "Авторизован"
        mtprotoStatus.className = "status-badge authorized"
      }
      if (loadMembersBtn) loadMembersBtn.disabled = false
      showStatus("✅ MTProto успешно авторизован")
      if (codeInputArea) codeInputArea.style.display = "none"

      // ИСПРАВЛЕНО: Проверяем тип результата
    } else if (
      result !== null &&
      typeof result === "object" &&
      result === "2FA_REQUIRED"
    ) {
      // Этот блок может не понадобиться, так как initMTProto теперь возвращает строку или boolean
      requires2FA = true
      tempCode = code
      showStatus("🔐 Требуется двухфакторный пароль", false)

      codeInput.placeholder = "Введите 2FA пароль"
      codeInput.value = ""
      submitCodeBtn.textContent = "Отправить пароль"

      // ИСПРАВЛЕНО: Добавляем проверку на строку '2FA_REQUIRED'
    } else if (typeof result === "string" && result === "2FA_REQUIRED") {
      requires2FA = true
      tempCode = code
      showStatus("🔐 Требуется двухфакторный пароль", false)

      codeInput.placeholder = "Введите 2FA пароль"
      codeInput.value = ""
      submitCodeBtn.textContent = "Отправить пароль"
    } else {
      showStatus("📱 Код отправлен, проверьте Telegram")
    }
  } catch (error: any) {
    showStatus(`❌ Ошибка: ${error.message}`, true)
  } finally {
    if (submitCodeBtn) {
      submitCodeBtn.disabled = false
    }
  }
})

// Загрузка участников
loadMembersBtn?.addEventListener("click", async () => {
  const sourceGroupInput = document.getElementById(
    "source-group",
  ) as HTMLInputElement
  const sourceGroup = sourceGroupInput?.value

  if (!sourceGroup) {
    showStatus("❌ Введите ID исходной группы", true)
    return
  }

  try {
    loadMembersBtn.disabled = true
    loadMembersBtn.textContent = "Загрузка..."

    const groupInfo = await window.electronAPI.getGroupInfo(
      parseInt(sourceGroup),
    )
    currentGroupInfo = groupInfo

    const members = await window.electronAPI.getGroupMembers(
      parseInt(sourceGroup),
    )
    currentMembers = members

    const groupInfoDiv = document.getElementById("group-info") as HTMLDivElement
    if (groupInfoDiv) {
      groupInfoDiv.innerHTML = `
                <div><strong>Группа:</strong> ${groupInfo.title || groupInfo.id}</div>
                <div><strong>Участников:</strong> ${members.length}</div>
            `
    }

    const membersList = document.getElementById(
      "members-list",
    ) as HTMLDivElement
    if (membersList) {
      membersList.innerHTML =
        "<strong>Первые 20 участников:</strong>" +
        members
          .slice(0, 20)
          .map(
            (m: any) =>
              `<div class="member-item">👤 ${m.firstName || ""} ${m.lastName || ""} (@${m.username || "нет username"})</div>`,
          )
          .join("")
    }

    const targetGroupInput = document.getElementById(
      "target-group",
    ) as HTMLInputElement
    const targetGroup = targetGroupInput?.value

    if (targetGroup) {
      const isBotValid = await window.electronAPI.verifyBot(
        parseInt(targetGroup),
      )
      if (addMembersBtn) {
        addMembersBtn.disabled = !isBotValid
      }

      if (!isBotValid) {
        showStatus("⚠️ Бот не является администратором в целевой группе", true)
      }
    }

    showStatus(`✅ Загружено ${members.length} участников`)
  } catch (error: any) {
    showStatus(`❌ Ошибка загрузки: ${error.message}`, true)
  } finally {
    if (loadMembersBtn) {
      loadMembersBtn.disabled = false
      loadMembersBtn.textContent = "📊 Загрузить участников"
    }
  }
})

// Добавление участников
addMembersBtn?.addEventListener("click", async () => {
  const targetGroupInput = document.getElementById(
    "target-group",
  ) as HTMLInputElement
  const excludedUserInput = document.getElementById(
    "excluded-user",
  ) as HTMLInputElement

  const targetGroup = targetGroupInput?.value
  const excludedUser = excludedUserInput?.value

  if (!targetGroup) {
    showStatus("❌ Введите ID целевой группы", true)
    return
  }

  if (currentMembers.length === 0) {
    showStatus("❌ Сначала загрузите участников", true)
    return
  }

  const progressArea = document.getElementById(
    "progress-area",
  ) as HTMLDivElement
  const progressBar = document.getElementById(
    "progress-bar",
  ) as HTMLProgressElement
  const progressText = document.getElementById(
    "progress-text",
  ) as HTMLSpanElement

  if (progressArea) progressArea.style.display = "block"
  if (addMembersBtn) addMembersBtn.disabled = true

  window.electronAPI.onProgress((current: number, total: number) => {
    if (progressBar && progressText) {
      const percent = (current / total) * 100
      progressBar.value = percent
      progressText.textContent = `${current}/${total}`
    }
  })

  try {
    const excludedId = excludedUser ? parseInt(excludedUser) : undefined
    const result = await window.electronAPI.addMembers(
      parseInt(targetGroup),
      currentMembers,
      excludedId,
    )

    const resultsDiv = document.getElementById("results") as HTMLPreElement
    if (resultsDiv) {
      resultsDiv.textContent = JSON.stringify(result, null, 2)
    }

    showStatus(
      `✅ Добавление завершено. Успешно: ${result.success}, Ошибок: ${result.failed}`,
    )
  } catch (error: any) {
    showStatus(`❌ Ошибка добавления: ${error.message}`, true)
  } finally {
    if (progressArea) progressArea.style.display = "none"
    if (addMembersBtn) addMembersBtn.disabled = false
    window.electronAPI.removeListeners()
  }
})

window.addEventListener("error", (event) => {
  console.error("Ошибка в renderer:", event.error)
  showStatus(`❌ Ошибка: ${event.error?.message || "Неизвестная ошибка"}`, true)
})

submitCodeBtn?.addEventListener("click", async () => {
  const codeInput = document.getElementById("code-input") as HTMLInputElement
  const code = codeInput?.value

  if (!code) {
    showStatus("❌ Введите код подтверждения", true)
    return
  }

  try {
    submitCodeBtn.disabled = true
    submitCodeBtn.textContent = "Проверка..."

    const result: any = await window.electronAPI.initMTProto(code)

    if (result === true) {
      // Успешная авторизация
      isMtProtoAuthorized = true
      if (mtprotoStatus) {
        mtprotoStatus.textContent = "Авторизован"
        mtprotoStatus.className = "status-badge authorized"
      }
      if (loadMembersBtn) loadMembersBtn.disabled = false
      showStatus("✅ MTProto успешно авторизован")
      if (codeInputArea) codeInputArea.style.display = "none"
    } else if (result === "2FA_REQUIRED") {
      // Требуется 2FA пароль
      requires2FA = true
      tempCode = code
      showStatus("🔐 Требуется двухфакторный пароль", false)

      // Меняем placeholder и кнопку для ввода пароля
      const codeInput = document.getElementById(
        "code-input",
      ) as HTMLInputElement
      codeInput.placeholder = "Введите 2FA пароль"
      submitCodeBtn.textContent = "Отправить пароль"
    } else {
      // Обычный код отправлен
      showStatus("📱 Код отправлен, проверьте Telegram")
    }
  } catch (error: any) {
    showStatus(`❌ Ошибка: ${error.message}`, true)
  } finally {
    if (submitCodeBtn) {
      submitCodeBtn.disabled = false
      if (!requires2FA) {
        submitCodeBtn.textContent = "Подтвердить"
      }
    }
  }
})

// Добавьте обработку 2FA пароля
async function handle2FAPassword(password: string) {
  try {
    const result = await window.electronAPI.initMTProto(tempCode, password)

    if (result === true) {
      isMtProtoAuthorized = true
      if (mtprotoStatus) {
        mtprotoStatus.textContent = "Авторизован"
        mtprotoStatus.className = "status-badge authorized"
      }
      if (loadMembersBtn) loadMembersBtn.disabled = false
      showStatus("✅ 2FA авторизация успешна")
      if (codeInputArea) codeInputArea.style.display = "none"
      requires2FA = false
    }
  } catch (error: any) {
    showStatus(`❌ Ошибка 2FA: ${error.message}`, true)
  }
}
