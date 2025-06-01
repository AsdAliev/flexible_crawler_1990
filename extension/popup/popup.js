// popup.js
import { fillRequestList } from "./request-list.js";
import * as User from "./user.js"
import { initSettingsForm } from "./settings-page.js";
initPopup();

function initPopup() {
    setupNavbar();
    activateRequestPage();
    fillRequestList();
    startupAuth();
}

async function startupAuth() {
    const success = await User.checkAuth();
    if (success) {
        document.getElementById('profile-nav').textContent = `Профиль(${User.Name})`;
        document.getElementById('profile-log-nav').textContent = "Выйти";
        activateRequestPage();
    }
}

function setupNavbar() {
    document.getElementById('request-nav').addEventListener('click', activateRequestPage);
    document.getElementById('settings-nav').addEventListener('click', activateSettingsPage);
    document.getElementById('profile-registration-nav').addEventListener('click', activateProfileRegistrationPage);
    document.getElementById('profile-log-nav').addEventListener('click', activateProfileLoginPage);
    document.getElementById('profile-change-pswd-nav').addEventListener('click', activateProfileChangePasswordPage);

    document.getElementById("login-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("login-username").value;
        const password = document.getElementById("login-password").value;

        const success = await User.loginUser(username, password);
        const errorDiv = document.getElementById('login-error');
        if (success) {
            errorDiv.textContent = "Вход выполнен";
            errorDiv.classList.add("text-success");
            errorDiv.classList.remove("text-danger");
            setTimeout(() => {
                errorDiv.textContent = "";
            }, 3000);
            document.getElementById('profile-nav').textContent = `Профиль(${User.Name})`;
            document.getElementById('profile-log-nav').textContent = "Выйти";
            fillRequestList();
            activateRequestPage();
        } else {
            const errorDiv = document.getElementById("login-error");
            errorDiv.textContent = "Ошибка входа";
            errorDiv.classList.remove("text-success");
            errorDiv.classList.add("text-danger");
            setTimeout(() => {
                errorDiv.textContent = "";
            }, 3000);
        }
    });
    document.getElementById("register-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("register-username").value;
        const password = document.getElementById("register-password").value;

        const success = await User.registerUser(username, password);
        if (success) {

        } else {

        }
    });

    document.getElementById("change-password-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const oldPassword = document.getElementById("old-password").value;
        const newPassword = document.getElementById("new-password").value;
        const success = await User.changePassword(oldPassword, newPassword);
        if (success) {

        } else {

        }
    });
}

function activateRequestPage() {
    setActiveNavLink('request-nav');
    setActiveMainPage('requests-container');
}

function activateSettingsPage() {
    setActiveNavLink('settings-nav');
    setActiveMainPage('settings-container');
    initSettingsForm();
}

async function activateProfileLoginPage() {
    if (User.isAuthenticated) {
        await User.logoutUser();
        fillRequestList();
        document.getElementById('profile-log-nav').textContent = "Войти";
        document.getElementById('profile-nav').textContent = 'Профиль';
    }
    setActiveNavLink('profile-nav');
    setActiveMainPage('profile-log-container');
}

function activateProfileRegistrationPage() {
    setActiveNavLink('profile-nav');
    setActiveMainPage('profile-register-container');
}

function activateProfileChangePasswordPage() {
    setActiveNavLink('profile-nav');
    setActiveMainPage('profile-change-pswd-container');
}

function setActiveNavLink(id) {
    const elems = document.querySelectorAll('.nav-link');
    for (let i of elems) {
        i.classList.remove('active');
        i.ariaCurrent = null;
    }
    document.getElementById(id).classList.add('active');
    document.getElementById(id).ariaCurrent = 'page';
}

function setActiveMainPage(id) {
    const elems = document.querySelectorAll('.main-page-content');
    for (let i of elems) {
        i.classList.add('d-none');
        i.ariaCurrent = null;
    }
    document.getElementById(id).classList.remove('d-none');
    document.getElementById(id).ariaCurrent = 'page';
}
