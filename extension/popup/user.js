export let isAuthenticated = false;
export let Name = null;

export async function checkAuth() {
    const token = localStorage.getItem("access_token");
    const refreshToken = localStorage.getItem("refresh_token");

    if (!token || !refreshToken) {
        isAuthenticated = false;
        Name = null;
        return false;
    }

    try {
        const res = await fetch("http://localhost:8000/me", {
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
        const res = await fetch("http://localhost:8000/login", {
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
        const res = await fetch("http://localhost:8000/register", {
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
        const res = await fetch("http://localhost:8000/change-password", {
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
        await fetch("http://localhost:8000/logout", {
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