import { appSettings } from '../app-settings.js';

export let isAuthenticated = false;
export let Name = null;

// ───────────────────────────────────────────────────────────────
// Вернуть access-token (или null).  Использует те же localStorage
// ключи, что уже применяет checkAuth().
//
//   Если нужно проверять срок действия, сохраните время истечения
//   (unix-секунды) под ключом "access_token_exp" и раскомментируйте
//   проверку exp.
//   Возвращаем Promise, чтобы вызов  `await getToken()`  выглядел
//   единообразно с Async-API chrome.storage, если когда-нибудь
//   решите перейти на него.
// ───────────────────────────────────────────────────────────────
export async function getToken() {
    return new Promise(async resolve => {
        const token = localStorage.getItem('access_token');

    const exp = Number(localStorage.getItem('access_token_exp') || 0);
    const now = Date.now() / 1000;
    if (!token || (exp && now >= exp)) {
        // пробуем «тихо» обновить
        const ok = await tryRefresh();
        if (!ok) return resolve(null);           // refresh не сработал
        return resolve(localStorage.getItem('access_token'));
    }

        resolve(token || null);
    });
}


export async function checkAuth() {
    const token = localStorage.getItem("access_token");
    const refreshToken = localStorage.getItem("refresh_token");

    if (!token || !refreshToken) {
        isAuthenticated = false;
        Name = null;
        return false;
    }

    try {
        const res = await fetch(appSettings.serverDomain + "me", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!res.ok) throw new Error("Не авторизован");

        const data = await res.json();
        isAuthenticated = true;
        Name = data.username;
        return true;

    } catch (e) {
        console.warn("Не авторизован");
        logoutUser();
        return false;
    }
}


export async function loginUser(username, password) {
    const errorDiv = document.getElementById("login-error");
    try {
        const res = await fetch(appSettings.serverDomain + "login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            return false;
        }

        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        localStorage.setItem("access_token_exp", data.access_expires);
        if (await checkAuth()) {
            return true;
        } else {
            return false;
        }
    } catch (err) {
        setTimeout(() => {
            errorDiv.textContent = "";
        }, 3000);
        console.error("Login error:", err);
        errorDiv.textContent = "Сервер недоступен";
        errorDiv.classList.remove("text-success");
        errorDiv.classList.add("text-danger");
        return false;
    }
}

export async function registerUser(username, password) {
    const errorDiv = document.getElementById("register-error");

    try {
        const res = await fetch(appSettings.serverDomain + "register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            errorDiv.textContent = data.detail || "Ошибка регистрации";
            errorDiv.classList.remove("text-success");
            errorDiv.classList.add("text-danger");
            setTimeout(() => {
                errorDiv.textContent = "";
            }, 3000);
            return false;
        }

        errorDiv.textContent = "Регистрация успешна. Теперь войдите.";
        errorDiv.classList.add("text-success");
        errorDiv.classList.remove("text-danger");
        setTimeout(() => {
            errorDiv.textContent = "";
        }, 3000);
        return true;

    } catch (err) {
        console.error("Register error:", err);
        errorDiv.textContent = "Сервер недоступен";
        return false;
    }
}

export async function changePassword(oldPassword, newPassword) {
    const msgBox = document.getElementById("change-password-msg");
    const token = localStorage.getItem("access_token");

    try {
        const res = await fetch(appSettings.serverDomain + "change-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                old_password: oldPassword,
                new_password: newPassword
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            msgBox.textContent = data.detail || "Ошибка при смене пароля";
            msgBox.className = "text-danger mt-2";
            setTimeout(() => {
                msgBox.textContent = "";
            }, 3000);
            return false;
        }

        msgBox.textContent = "Пароль успешно изменён!";
        msgBox.className = "text-success mt-2";
        setTimeout(() => {
            msgBox.textContent = "";
        }, 3000);
        return true;

    } catch (err) {
        console.error("Change password error:", err);
        msgBox.textContent = "Сервер недоступен";
        msgBox.className = "text-danger mt-2";
        setTimeout(() => {
            msgBox.textContent = "";
        }, 3000);
        return false;
    }
}

export async function logoutUser() {
    const token = localStorage.getItem("access_token");

    // Отзываем токен на сервере
    try {
        await fetch(appSettings.serverDomain + "logout", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
    } catch (err) {
        console.warn("Logout failed (не критично)");
    }

    // Очищаем локальные токены СРАЗУ
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    isAuthenticated = false;
    Name = null;
}

export async function tryRefresh () {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return false;                // нечем обновлять

  const res = await fetch('http://localhost:8000/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {                                  // refresh недействителен
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('access_token_exp');
    return false;
  }

  const data = await res.json();                  // {access_token, refresh_token, access_expires}
  localStorage.setItem('access_token',      data.access_token);
  localStorage.setItem('refresh_token',     data.refresh_token);
  localStorage.setItem('access_token_exp',  data.access_expires);
  return true;
}
