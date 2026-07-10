const API_URL = "https://script.google.com/macros/s/AKfycbzsNnAidvVDBunnxQemvTAsgNwfquniEh_9sX7vO2iYLIkay_9TdNWxCMuKLyOPqUtO/exec";
const API_TIMEOUT = 9000;
const DEFAULT_LOGO = "../assets/img/logo.png";

const $ = (selector) => document.querySelector(selector);

document.addEventListener("DOMContentLoaded", () => {
  setupLogoFallback();
  loadLoginSettings();
  $("#loginForm").addEventListener("submit", login);
  $("#togglePassword").addEventListener("click", togglePasswordVisibility);
});

async function api(action, payload = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal
    });
    const text = await response.text();
    if (text.trim().startsWith("<")) {
      throw new Error("Apps Script esta pidiendo iniciar sesion con Google. Use Acceso = Cualquier persona, no 'con una cuenta de Google'.");
    }
    const data = JSON.parse(text);
    if (!data.ok) throw new Error(data.message || "No se pudo completar la solicitud.");
    return data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("La API no respondio con JSON valido. Revise la implementacion de Apps Script.");
    }
    if (error.message === "Failed to fetch") {
      throw new Error("No se pudo conectar con Apps Script. Use URL /exec, Ejecutar como = Yo y Acceso = Cualquier persona, no 'con una cuenta de Google'.");
    }
    if (error.name === "AbortError") {
      throw new Error("La conexion con Apps Script tardo demasiado. Intente nuevamente.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function loadLoginSettings() {
  try {
    const { config } = await api("getPublicConfig");
    if (config.color_principal) document.documentElement.style.setProperty("--primary", config.color_principal);
    if (config.color_secundario) document.documentElement.style.setProperty("--secondary", config.color_secundario);
    $("#schoolName").textContent = config.nombre_colegio || "Unidad Educativa";
    if (isValidImageUrl(config.logo_url) && config.logo_url !== $("#logo").src) {
      $("#logo").src = config.logo_url;
    }
  } catch (error) {
    console.warn(error.message);
  }
}

async function login(event) {
  event.preventDefault();
  const username = $("#username").value.trim();
  const password = $("#password").value;

  if (!username || !password) {
    setMessage("Ingrese usuario y contraseña.");
    return;
  }

  try {
    event.submitter.disabled = true;
    setMessage("Validando acceso...");
    const data = await api("login", { username, password });
    sessionStorage.setItem("adminToken", data.token);
    sessionStorage.setItem("adminUser", JSON.stringify(data.user));
    location.href = "admin.html";
  } catch (error) {
    setMessage(error.message);
  } finally {
    event.submitter.disabled = false;
  }
}

function setMessage(text) {
  $("#message").textContent = text;
}

function togglePasswordVisibility() {
  const input = $("#password");
  const button = $("#togglePassword");
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  button.setAttribute("aria-label", isPassword ? "Ocultar contraseña" : "Mostrar contraseña");
  button.title = isPassword ? "Ocultar contraseña" : "Mostrar contraseña";
}

function setupLogoFallback() {
  $("#logo").addEventListener("error", () => {
    if (!$("#logo").src.endsWith(DEFAULT_LOGO)) $("#logo").src = DEFAULT_LOGO;
  });
}

function isValidImageUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}
