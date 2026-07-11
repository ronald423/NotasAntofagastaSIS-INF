const API_URL = "https://script.google.com/macros/s/AKfycbwg7EpKqyjRhIO2ixrG255JAaFN5P7U8la7Tovgb67cEFsZiYtK5XGIV3pAYwyjUBBq/exec";
const API_TIMEOUT = 20000;
const DEFAULT_LOGO = "assets/img/logo.png";
const DIMENSION_WEIGHTS = { Ser: 10, Saber: 45, Hacer: 40, Decidir: 5 };
const PUBLIC_CONFIG_CACHE_MS = 24 * 60 * 60 * 1000;

const $ = (selector) => document.querySelector(selector);

document.addEventListener("DOMContentLoaded", () => {
  setupLogoFallback();
  loadPublicSettings();
  $("#consultForm").addEventListener("submit", consultGrades);
  $("#toggleAccessCode").addEventListener("click", toggleAccessCodeVisibility);
  $("#newConsultBtn").addEventListener("click", resetConsult);
  bindResultTabs();
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
    throw new Error(formatApiError(error.message));
  } finally {
    clearTimeout(timeoutId);
  }
}

function formatApiError(message) {
  const text = String(message || "");
  if (/50000|maximum of 50000|n[uú]mero m[aá]ximo/i.test(text)) {
    return "El registro academico es demasiado grande para una celda de Google Sheets. Avise al administrador para limpiar o dividir los registros.";
  }
  return text || "No se pudo completar la solicitud.";
}

async function loadPublicSettings() {
  try {
    const cached = localStorage.getItem("publicConfig");
    if (cached) {
      const stored = JSON.parse(cached);
      if (stored && stored.config) applyConfig(stored.config);
      if (stored && stored.savedAt && Date.now() - stored.savedAt < PUBLIC_CONFIG_CACHE_MS) return;
    }
    const { config } = await api("getPublicConfig");
    localStorage.setItem("publicConfig", JSON.stringify({ config: config || {}, savedAt: Date.now() }));
    applyConfig(config || {});
  } catch (error) {
    console.warn(error.message);
  }
}

function applyConfig(config) {
  const root = document.documentElement;
  if (config.color_principal) root.style.setProperty("--primary", config.color_principal);
  if (config.color_secundario) root.style.setProperty("--secondary", config.color_secundario);
  const schoolLines = configLines(config.nombre_colegio, ["Unidad Educativa", "T.H. Antofagasta"]);
  const schoolPrefix = schoolLines.length > 1 ? schoolLines[0] : "Unidad Educativa";
  const schoolMain = schoolLines.length > 1 ? schoolLines[1] : schoolLines[0];
  $("#schoolName").innerHTML = `<span class="school-name-prefix">${escapeHtml(schoolPrefix)}</span><span class="school-name-main">${escapeHtml(schoolMain)}</span>`;
  $("#gestion").textContent = config.gestion || "Gestion academica";
  const welcomeLines = configLines(config.mensaje_bienvenida, ["Consulta de notas", "Sistemas Informáticos"]);
  $("#welcomeText .welcome-title").textContent = welcomeLines[0];
  $("#welcomeText .welcome-subtitle").textContent = welcomeLines[1] || "Sistemas Informáticos";
  const footerLines = configLines(config.footer_texto, ["Sistema académico institucional", "Developed by Ronald G."]);
  $("#footerText .footer-title").textContent = footerLines[0];
  const credit = footerLines[1] || "Developed by Ronald G.";
  $("#footerText .footer-credit").innerHTML = escapeHtml(credit).replace(/(Ronald G\.?)/i, "<strong>$1</strong>");
  if (isValidImageUrl(config.logo_url) && config.logo_url !== $("#logo").src) {
    $("#logo").src = config.logo_url;
  }
  document.title = `${schoolLines.join(" ")} | Consulta de notas`;
}

function configLines(value, fallback) {
  const lines = String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length ? lines : fallback;
}

async function consultGrades(event) {
  event.preventDefault();
  const ci = $("#ci").value.trim();
  const accessCode = $("#accessCode").value.trim();
  const group = $("#consultGroup").value;
  const trimester = $("#consultTrimester").value || "1";
  $("#result").hidden = true;

  if (!ci || !accessCode || !group) {
    setMessage("Ingrese CI, codigo personal y grupo.", "error");
    return;
  }

  try {
    event.submitter.disabled = true;
    setMessage("Consultando notas...", "");
    const { student, grades, message: responseMessage } = await api("consultStudent", { ci, accessCode, group, trimester });
    const trimesterGrades = (grades || []).filter((grade) => String(grade.Trimestre || "1") === String(trimester));
    if (trimesterGrades.length) renderResult(student, trimesterGrades);
    setMessage(trimesterGrades.length ? (responseMessage || "Consulta realizada correctamente.") : `No hay notas publicadas para ${trimesterLabel(trimester)}.`, trimesterGrades.length ? "success" : "error");
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    event.submitter.disabled = false;
  }
}

function renderResult(student, grades) {
  $("#studentName").textContent = student.Nombre;
  $("#studentCi").textContent = student.CI;
  $("#studentCourse").textContent = student.Curso;
  $("#studentParallel").textContent = student.Paralelo;
  const firstGrade = grades[0] || {};
  const subjects = [...new Set(grades.map((grade) => grade.Nombre_Materia).filter(Boolean))];
  const trimesters = [...new Set(grades.map((grade) => grade.Trimestre || "1").filter(Boolean))].sort();
  $("#studentSubject").textContent = `${subjects.join(", ") || "Sin materia"}${trimesters.length ? ` | ${trimesters.map(trimesterLabel).join(", ")}` : ""}`;
  $("#academicStatus").textContent = firstGrade.Estado_Academico || "Sin completar";
  $("#observation").textContent = firstGrade.Observacion || "Sin observaciones registradas.";
  $("#lastUpdate").textContent = `Ultima actualizacion: ${firstGrade.Ultima_Actualizacion || student.Ultima_Actualizacion || "Sin registro"}`;
  renderResultTabs(grades);
  $("#result").hidden = false;
}

function renderResultTabs(grades) {
  showResultTab("ser");
  const rawItems = collectGradeItems(grades);
  const items = rawItems;
  const breakdown = calculateDimensionBreakdown(items);
  const ser = items.filter((item) =>
    item.dimension === "Ser" &&
    !isAttendanceItem(item)
  );
  const saber = items.filter((item) => item.dimension === "Saber");
  const hacer = items.filter((item) => item.dimension === "Hacer" || item.tipo === "practica" || item.tipo === "practicas_total");
  const practices = hacer.filter((item) => item.tipo === "practica");
  const hacerSummary = hacer.filter((item) => item.tipo !== "practica");
  const decidir = items.filter((item) => item.dimension === "Decidir" || /auto/i.test(item.titulo || ""));
  const attendanceHtml = renderAttendanceColumns(rawItems);

  $("#serBody").innerHTML = renderItemsRows(ser, attendanceHtml ? "" : "Sin registros en Ser.") + attendanceHtml;
  $("#saberBody").innerHTML = renderItemsRows(saber, "Sin registros en Saber.");
  $("#hacerBody").innerHTML = renderPracticeColumns(practices) +
    renderItemsRows(hacerSummary, practices.length ? "" : "Sin registros en Hacer.");
  $("#decidirBody").innerHTML = renderItemsRows(decidir, "Sin registros de autoevaluacion.");
  updatePublicDimensionTotal("ser", "Ser / 10", breakdown.Ser);
  updatePublicDimensionTotal("saber", "Saber / 45", breakdown.Saber);
  updatePublicDimensionTotal("hacer", "Hacer / 40", breakdown.Hacer);
  updatePublicDimensionTotal("decidir", "Autoevaluacion / 5", breakdown.Decidir);
  $("#finalSummary").innerHTML = renderFinalSummary(items, grades);
}

function withAttendanceScore(items) {
  const grouped = {};
  items
    .filter((item) => item.tipo === "asistencia_dia" || item.tipo === "asistencia")
    .forEach((item) => {
      const key = item.materia || "Sin materia";
      const groupedKey = `${key}|${item.trimestre || "1"}`;
      if (!grouped[groupedKey]) grouped[groupedKey] = { materia: item.materia || "Sin materia", trimestre: item.trimestre || "1" };
      if (item.tipo === "asistencia_dia") {
        const status = normalizeAttendanceStatus(item.valor);
        if (!status) return;
        if (status === "A") grouped[groupedKey].asistencia = (Number(grouped[groupedKey].asistencia) || 0) + 1;
        if (status === "F") grouped[groupedKey].faltas = (Number(grouped[groupedKey].faltas) || 0) + 1;
        if (status === "R") grouped[groupedKey].retrasos = (Number(grouped[groupedKey].retrasos) || 0) + 1;
        if (status === "L") grouped[groupedKey].licencias = (Number(grouped[groupedKey].licencias) || 0) + 1;
      } else {
        grouped[groupedKey][normalizeKey(item.titulo)] = item.valor;
      }
    });
  const materias = Object.keys(grouped);
  const base = items.filter((item) => !(item.tipo === "asistencia_ser" && materias.includes(`${item.materia || "Sin materia"}|${item.trimestre || "1"}`)));
  const generated = materias.map((key) => {
      const score = calculateAttendanceScore(grouped[key]);
      return score === "" ? null : {
        tipo: "asistencia_ser",
        dimension: "Ser",
        titulo: "Nota asistencia",
        valor: score,
        materia: grouped[key].materia,
        trimestre: grouped[key].trimestre
      };
    })
    .filter(Boolean);
  return base.concat(generated);
}

function renderItemsRows(items, emptyText) {
  return items.map((item, index) => `
    <tr>
      <td class="row-number">${index + 1}</td>
      <td>${renderItemTitle(item)}</td>
      <td><strong>${escapeHtml(formatPracticeValue(item))}</strong></td>
    </tr>
  `).join("") || (emptyText ? `<tr><td colspan="3">${emptyText}</td></tr>` : "");
}

function renderPracticeColumns(items) {
  if (!items.length) return "";
  return `
    <tr>
      <td colspan="3">
        <div class="practice-summary">
          <strong>Practicas realizadas</strong>
          <div class="practice-columns-wrap">
            <table class="practice-columns">
              <thead>
                <tr>${items.map((item, index) => `<th>P${index + 1}${item.fecha ? `<small class="item-date">${escapeHtml(item.fecha)}</small>` : ""}</th>`).join("")}</tr>
              </thead>
              <tbody>
                <tr>${items.map((item) => `<td><strong>${escapeHtml(formatRoundedPracticeValue(item))}</strong></td>`).join("")}</tr>
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  `;
}

function renderAttendanceColumns(items) {
  const summaries = attendanceSummaries(items);
  if (!summaries.length) return "";
  return summaries.map((summary) => `
    <tr>
      <td colspan="3">
        <div class="attendance-summary">
          <strong>Asistencia</strong>
          <table class="attendance-columns">
            <thead>
              <tr><th>A</th><th>F</th><th>R</th><th>L</th><th>Nota</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>${summary.asistencia}</td>
                <td>${summary.faltas}</td>
                <td>${summary.retrasos}</td>
                <td>${summary.licencias}</td>
                <td>${summary.score || "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  `).join("");
}

function attendanceSummaries(items) {
  const grouped = {};
  items.filter(isAttendanceSummaryItem).forEach((item) => {
    const key = `${item.materia || "Sin materia"}|${item.trimestre || "1"}`;
    if (!grouped[key]) grouped[key] = { asistencia: 0, faltas: 0, retrasos: 0, licencias: 0 };
    if (item.tipo === "asistencia_nota") {
      grouped[key].score = item.valor;
      return;
    }
    grouped[key][normalizeKey(item.titulo)] = Number(item.valor) || 0;
  });
  return Object.keys(grouped).map((key) => Object.assign(grouped[key], {
    score: grouped[key].score || calculateAttendanceScore(grouped[key])
  })).filter((summary) =>
    summary.asistencia || summary.faltas || summary.retrasos || summary.licencias
  );
}

function isAttendanceItem(item = {}) {
  return item.tipo === "asistencia_dia" || item.tipo === "asistencia" || item.tipo === "asistencia_ser" || item.tipo === "asistencia_nota";
}

function isAttendanceSummaryItem(item = {}) {
  return item.tipo === "asistencia" || item.tipo === "asistencia_nota";
}

function renderPracticeRows(items, emptyText) {
  return items.map((item, index) => `
    <tr>
      <td class="row-number">${index + 1}</td>
      <td>${renderItemTitle(item)}</td>
      <td><strong>${escapeHtml(formatPracticeValue(item))}</strong></td>
    </tr>
  `).join("") || `<tr><td colspan="3">${emptyText}</td></tr>`;
}

function renderItemTitle(item = {}) {
  const title = escapeHtml(item.titulo || "Registro");
  const trimester = item.trimestre ? `<small class="item-date">${escapeHtml(trimesterLabel(item.trimestre))}</small>` : "";
  if (item.tipo === "asistencia_dia" && item.fecha) return `Fecha: ${escapeHtml(item.fecha)}<small class="item-date">${escapeHtml(attendanceStatusText(item.valor))}</small>${trimester}`;
  if (item.tipo === "practica" && item.fecha) return `${title}<small class="item-date">Fecha: ${escapeHtml(item.fecha)}</small>${trimester}`;
  return `${title}${trimester}`;
}

function updatePublicDimensionTotal(key, label, row) {
  const target = $(`#${key}Total`);
  if (!target) return;
  target.textContent = `Total ${label}: ${row ? Math.round(row.aporte) : "-"}`;
}

function renderFinalSummary(items, grades) {
  const breakdown = calculateDimensionBreakdown(items);
  const rows = [
    ["Ser", "Ser / 10", breakdown.Ser],
    ["Saber", "Saber / 45", breakdown.Saber],
    ["Hacer", "Hacer / 40", breakdown.Hacer],
    ["Decidir", "Autoevaluacion / 5", breakdown.Decidir]
  ];
  const total = rows.reduce((sum, [, , row]) => sum + (row ? row.aporte : 0), 0);
  const fallbackFinal = grades.map((grade) => Number(grade.Nota_Final)).filter((value) => !Number.isNaN(value));
  const finalValue = fallbackFinal.length ? String(Math.round(fallbackFinal.reduce((sum, value) => sum + value, 0) / fallbackFinal.length)) : (total > 0 ? String(Math.round(total)) : "-");

  return `
    <div class="dimension-grid">
      ${rows.map(([key, label, row]) => `
        <article class="dimension-card">
          <span>${label}</span>
          <strong>${row ? Math.round(row.aporte) : "-"}</strong>
          <small>Promedio: ${row ? Math.round(row.promedio) : "-"}</small>
        </article>
      `).join("")}
    </div>
    <div class="final-total">
      <span>Nota final trimestral</span>
      <strong>${finalValue}</strong>
    </div>
  `;
}

function renderGradeItems(grade) {
  const items = parseGradeItems(grade.Detalle_Registro);
  if (!items.length) return "-";
  return items.map((item) => `${escapeHtml(item.dimension || "Sin dimension")} - ${escapeHtml(item.titulo || "Registro")}: ${escapeHtml(formatPracticeValue(item))}`).join("<br>");
}

function collectGradeItems(grades) {
  return grades.flatMap((grade) => parseGradeItems(grade.Detalle_Registro).map((item) => ({
    tipo: item.tipo || "",
    dimension: item.dimension || "",
    titulo: item.titulo || "",
    fecha: item.fecha || "",
    valor: item.valor,
    sobre: item.sobre,
    trimestre: grade.Trimestre || "1",
    materia: grade.Nombre_Materia || "Sin materia"
  })));
}

function trimesterLabel(value) {
  return { 1: "1er trimestre", 2: "2do trimestre", 3: "3er trimestre" }[String(value || "1")] || `${value} trimestre`;
}

function calculateDimensionBreakdown(items) {
  return Object.keys(DIMENSION_WEIGHTS).reduce((acc, dimension) => {
    const totalItem = items.find((item) => item.dimension === dimension && item.tipo === "dimension_total");
    if (totalItem) {
      const aporte = Number(totalItem.valor);
      if (!Number.isNaN(aporte)) {
        acc[dimension] = {
          promedio: DIMENSION_WEIGHTS[dimension] ? (aporte / DIMENSION_WEIGHTS[dimension]) * 100 : aporte,
          aporte: Math.min(DIMENSION_WEIGHTS[dimension], aporte)
        };
      }
      return acc;
    }
    const values = items
      .filter((item) => item.dimension === dimension)
      .map((item) => Number(item.valor))
      .filter((value) => !Number.isNaN(value));
    if (values.length) {
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      const aporte = Math.min(DIMENSION_WEIGHTS[dimension], Math.round(average));
      acc[dimension] = {
        promedio: DIMENSION_WEIGHTS[dimension] ? (aporte / DIMENSION_WEIGHTS[dimension]) * 100 : aporte,
        aporte
      };
    }
    return acc;
  }, {});
}

function calculateAttendanceScore(attendance) {
  const asistencia = Number(attendance.asistencia) || 0;
  const faltas = Number(attendance.faltas) || 0;
  const retrasos = Number(attendance.retrasos) || 0;
  const licencias = Number(attendance.licencias) || 0;
  const total = asistencia + licencias + faltas + Math.floor(retrasos / 3);
  if (!total) return "";
  return String(Math.round(((asistencia + licencias) / total) * 10));
}

function normalizeAttendanceStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  return ["A", "F", "R", "L"].includes(status) ? status : "";
}

function attendanceStatusText(value) {
  return {
    A: "Asistencia",
    F: "Falta",
    R: "Retraso",
    L: "Licencia"
  }[normalizeAttendanceStatus(value)] || "Asistencia";
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function bindResultTabs() {
  document.querySelectorAll(".public-tab").forEach((button) => {
    button.addEventListener("click", () => {
      showResultTab(button.dataset.publicTab);
    });
  });
}

function showResultTab(tab) {
  document.querySelectorAll(".public-tab").forEach((button) => button.classList.toggle("active", button.dataset.publicTab === tab));
  document.querySelectorAll(".public-tab-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.publicPanel === tab));
}

function parseGradeItems(raw) {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
}

function formatValue(value) {
  return value === "" || value === undefined || value === null ? "-" : value;
}

function formatPracticeValue(item = {}) {
  const value = formatValue(item.valor);
  if (value === "-") return value;
  if (String(value).includes("/")) {
    return String(value).split("/").map(roundDisplayNumber).join("/");
  }
  const roundedValue = roundDisplayNumber(value);
  return item.sobre ? `${roundedValue}/${roundDisplayNumber(item.sobre)}` : roundedValue;
}

function roundDisplayNumber(value) {
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? Math.round(number) : value;
}

function formatRoundedPracticeValue(item = {}) {
  const rawValue = formatValue(item.valor);
  if (rawValue === "-") return rawValue;
  if (String(rawValue).includes("/")) {
    return String(rawValue).split("/").map(roundDisplayNumber).join("/");
  }
  const roundedValue = roundDisplayNumber(rawValue);
  return item.sobre ? `${roundedValue}/${roundDisplayNumber(item.sobre)}` : roundedValue;
}

function setMessage(text, type) {
  const message = $("#message");
  message.textContent = text;
  message.className = `message ${type || ""}`;
}

function resetConsult() {
  $("#consultForm").reset();
  $("#result").hidden = true;
  setMessage("", "");
  $("#accessCode").type = "password";
  $("#toggleAccessCode").setAttribute("aria-label", "Mostrar codigo");
  $("#toggleAccessCode").title = "Mostrar codigo";
  $("#ci").focus();
}

function toggleAccessCodeVisibility() {
  const input = $("#accessCode");
  const button = $("#toggleAccessCode");
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  button.setAttribute("aria-label", isPassword ? "Ocultar codigo" : "Mostrar codigo");
  button.title = isPassword ? "Ocultar codigo" : "Mostrar codigo";
  button.classList.toggle("is-visible", isPassword);
  button.classList.remove("is-blinking");
  void button.offsetWidth;
  if (isPassword) button.classList.add("is-blinking");
}

function setupLogoFallback() {
  $("#logo").addEventListener("error", () => {
    if (!$("#logo").src.endsWith(DEFAULT_LOGO)) $("#logo").src = DEFAULT_LOGO;
  });
}

function isValidImageUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
}
