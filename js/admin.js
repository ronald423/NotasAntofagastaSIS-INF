const API_URL = "https://script.google.com/macros/s/AKfycbzsNnAidvVDBunnxQemvTAsgNwfquniEh_9sX7vO2iYLIkay_9TdNWxCMuKLyOPqUtO/exec";
const API_TIMEOUT = 30000;
const DASHBOARD_TIMEOUT = 45000;
const DEFAULT_LOGO = "../assets/img/logo.png";
const DEFAULT_BOLIVIA_SEAL = "../assets/img/minedu.png";

const state = {
  user: null,
  config: {},
  students: [],
  subjects: [],
  courses: [],
  grades: [],
  attendanceRecords: [],
  noteRecords: [],
  history: [],
  backups: []
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const DIMENSION_WEIGHTS = { Ser: 10, Saber: 45, Hacer: 40, Decidir: 5 };
let visibleAttendanceRecords = [];
let visibleNoteRecords = [];
let academicRecordsLoaded = false;
let academicRecordsLoading = null;

document.addEventListener("DOMContentLoaded", boot);

async function boot() {
  setupLogoFallback();
  const token = sessionStorage.getItem("adminToken");
  if (!token) return location.replace("login.html");
  const userData = sessionStorage.getItem("adminUser");
  state.user = userData ? JSON.parse(userData) : null;
  bindEvents();
  applyConfig();
  try {
    await refreshAll();
  } catch (error) {
    if (/Sesion no valida|Sesion expirada/i.test(error.message)) {
      sessionStorage.clear();
      location.replace("login.html");
      return;
    }
    setMessage(error.message + " Puede intentar actualizar nuevamente sin iniciar sesion otra vez.", "error");
  }
}

async function api(action, payload = {}, timeout = API_TIMEOUT) {
  const token = sessionStorage.getItem("adminToken");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action, token, ...payload }),
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
    return "El registro es demasiado grande para una celda de Google Sheets. Ya se protegieron historial y resumenes; si vuelve a pasar, revise Detalle_Registro de esa nota o divida los registros por trimestre/materia.";
  }
  return text || "No se pudo completar la solicitud.";
}

function bindEvents() {
  $("#logoutBtn").addEventListener("click", logout);
  $("#menuToggle").addEventListener("click", toggleNavigation);
  $("#gradeFilterToggle").addEventListener("click", toggleGradeFilters);
  document.addEventListener("click", closeFloatingActionMenus);
  $$(".side-nav button").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
  $("#addStudentBtn").addEventListener("click", () => openStudentModal());
  $("#loadAttendanceBtn").addEventListener("click", renderAttendanceList);
  $("#saveAttendanceBtn").addEventListener("click", saveBulkAttendance);
  ["attendanceGroup", "attendanceDate"].forEach((id) => $(`#${id}`).addEventListener("change", renderAttendanceList));
  $("#addAttendanceRecordBtn").addEventListener("click", () => openAttendanceRecordModal());
  $("#selectAllAttendanceRecords").addEventListener("change", toggleAllAttendanceRecordSelection);
  $("#deleteSelectedAttendanceRecordsBtn").addEventListener("click", deleteSelectedAttendanceRecords);
  ["attendanceRecordSearch", "attendanceRecordGroupFilter", "attendanceRecordSubjectFilter", "attendanceRecordTrimesterFilter", "attendanceRecordDateFilter"].forEach((id) => $(`#${id}`).addEventListener("input", renderAttendanceRecords));
  $("#addSubjectBtn").addEventListener("click", () => openSubjectModal());
  $("#addCourseBtn").addEventListener("click", () => openCourseModal());
  $("#addGradeBtn").addEventListener("click", () => openGradeModal());
  $("#addNoteRecordBtn").addEventListener("click", () => openNoteRecordModal());
  $("#selectAllNoteRecords").addEventListener("change", toggleAllNoteRecordSelection);
  $("#deleteSelectedNoteRecordsBtn").addEventListener("click", deleteSelectedNoteRecords);
  $("#cancelModal").addEventListener("click", () => $("#modal").close());
  $("#closeModal").addEventListener("click", () => $("#modal").close());
  $("#saveSettingsBtn").addEventListener("click", saveSettings);
  $("#resetSettingsBtn").addEventListener("click", resetSettings);
  $("#printReportBtn").addEventListener("click", () => window.print());
  $("#pdfReportBtn").addEventListener("click", exportBulletinPdf);
  $("#csvReportBtn").addEventListener("click", exportReportCsv);
  $("#createBackupBtn").addEventListener("click", createBackup);
  $("#clearHistoryBtn").addEventListener("click", clearHistory);
  $("#reportType").addEventListener("change", renderReport);
  ["bulletinCourseFilter", "bulletinGroupFilter", "bulletinSubjectFilter"].forEach((id) => $(`#${id}`).addEventListener("change", renderBulletinReport));
  $$(".bulk-actions button").forEach((button) => button.addEventListener("click", () => bulkPublish(button.dataset.bulk)));

  ["studentSearch", "studentCourseFilter", "studentParallelFilter", "studentStatusFilter"].forEach((id) => $(`#${id}`).addEventListener("input", renderStudents));
  ["gradeSearch", "gradeGroupFilter", "gradeSubjectFilter", "gradeTrimesterFilter", "gradeStatusFilter", "gradePublishedFilter"].forEach((id) => $(`#${id}`).addEventListener("input", renderGrades));
  ["noteRecordSearch", "noteRecordGroupFilter", "noteRecordSubjectFilter", "noteRecordTrimesterFilter", "noteRecordDimensionFilter"].forEach((id) => $(`#${id}`).addEventListener("input", renderNoteRecords));
  $("#subjectSearch").addEventListener("input", renderSubjects);
  $("#courseSearch").addEventListener("input", renderCourses);
}

async function refreshAll() {
  setMessage("Cargando informacion academica...");
  const data = await api("dashboardData", {}, DASHBOARD_TIMEOUT);
  Object.assign(state, data);
  if (data.user) {
    state.user = data.user;
    sessionStorage.setItem("adminUser", JSON.stringify(data.user));
  }
  applyConfig();
  renderAll();
  setMessage("Sistema actualizado.", "success");
}

function applyConfig() {
  const root = document.documentElement;
  if (state.config.color_principal) root.style.setProperty("--primary", state.config.color_principal);
  if (state.config.color_secundario) root.style.setProperty("--secondary", state.config.color_secundario);
  $("#schoolName").textContent = state.config.nombre_colegio || "Unidad Educativa";
  $("#gestion").textContent = state.config.gestion || "Gestion";
  $("#adminName").textContent = state.user ? `${state.user.Usuario} (${state.user.Rol})` : "Administrador";
  if (isValidImageUrl(state.config.logo_url) && state.config.logo_url !== $("#logo").src) {
    $("#logo").src = state.config.logo_url;
  }
}

function renderAll() {
  fillFilters();
  renderSummary();
  renderCurrentView(getActiveView());
}

function showView(view) {
  const titles = {
    "registro-asistencias": "Registro asistencias",
    "registro-notas": "Registro notas"
  };
  $$(".view").forEach((element) => element.classList.toggle("active", element.id === view));
  $$(".side-nav button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $("#viewTitle").textContent = titles[view] || view.charAt(0).toUpperCase() + view.slice(1);
  $("#sidebar").classList.remove("open");
  renderCurrentView(view);
}

function getActiveView() {
  return document.querySelector(".view.active")?.id || "resumen";
}

function renderCurrentView(view) {
  if (view === "registro-asistencias" || view === "registro-notas") {
    ensureAcademicRecordsLoaded().then(() => {
      if (view === "registro-asistencias") renderAttendanceRecords();
      if (view === "registro-notas") renderNoteRecords();
    }).catch((error) => setMessage(error.message, "error"));
    return;
  }
  const renderers = {
    resumen: renderSummary,
    estudiantes: renderStudents,
    asistencias: renderAttendanceList,
    notas: renderGrades,
    materias: renderSubjects,
    cursos: renderCourses,
    reportes: renderReport,
    configuracion: renderSettings,
    historial: renderHistory,
    backups: renderBackups
  };
  if (renderers[view]) renderers[view]();
}

async function ensureAcademicRecordsLoaded(force = false) {
  if (academicRecordsLoaded && !force) return;
  if (academicRecordsLoading && !force) return academicRecordsLoading;
  setMessage("Cargando registros academicos...");
  academicRecordsLoading = api("academicRecords", {}, DASHBOARD_TIMEOUT).then((data) => {
    state.attendanceRecords = data.attendanceRecords || [];
    state.noteRecords = data.noteRecords || [];
    academicRecordsLoaded = true;
    setMessage("Registros academicos cargados.", "success");
  }).finally(() => {
    academicRecordsLoading = null;
  });
  return academicRecordsLoading;
}

function renderSummary() {
  const approved = state.grades.filter((grade) => grade.Estado_Academico === "Aprobado").length;
  const failed = state.grades.filter((grade) => grade.Estado_Academico === "Reprobado").length;
  const tracking = state.grades.filter((grade) => grade.Estado_Academico === "En seguimiento").length;
  const published = state.grades.filter((grade) => grade.Publicado === "Si").length;
  const avg = average(state.grades.map((grade) => Number(grade.Nota_Final)).filter((n) => !Number.isNaN(n)));
  const cards = [
    ["Total de estudiantes", state.students.length],
    ["Total de materias", state.subjects.length],
    ["Aprobados", approved],
    ["Reprobados", failed],
    ["En seguimiento", tracking],
    ["Promedio general", avg || "0"],
    ["Notas publicadas", published],
    ["Notas sin publicar", state.grades.length - published]
  ];
  $("#summaryCards").innerHTML = cards.map(([label, value]) => `<article class="summary-card"><span>${label}</span><strong>${value}</strong></article>`).join("");
}

function renderStudents() {
  const search = $("#studentSearch").value.toLowerCase();
  const course = $("#studentCourseFilter").value;
  const parallel = $("#studentParallelFilter").value;
  const status = $("#studentStatusFilter").value;
  const rows = state.students.filter((student) =>
    (!search || `${student.CI} ${student.Nombre}`.toLowerCase().includes(search)) &&
    (!course || student.Curso === course) &&
    (!parallel || student.Paralelo === parallel) &&
    (!status || student.Estado === status)
  ).sort(compareStudentsByName);
  updateListCount("#studentsCount", rows.length, state.students.length, "estudiantes");
  renderTable("#studentsTable", ["CI", "Nombre", "Curso", "Paralelo", "Estado", "Acciones"], rows.map((student) => [
    student.CI, student.Nombre, student.Curso, student.Paralelo, pill(student.Estado),
    actions([
      ["Ver", () => viewRecord("Estudiante", student)],
      ["Editar", () => openStudentModal(student)],
      ["Eliminar", () => deleteRecord("deleteStudent", "estudiante", student.ID_Estudiante)]
    ])
  ]));
}

function renderAttendanceList() {
  const group = $("#attendanceGroup")?.value || "";
  const date = $("#attendanceDate")?.value || "";
  const rows = state.students
    .filter((student) => !group || student.Paralelo === group)
    .sort(compareStudentsByName);
  if ($("#attendanceCount")) updateListCount("#attendanceCount", rows.length, state.students.length, "estudiantes para asistencia");
  if (!$("#attendanceTable")) return;
  renderTable("#attendanceTable", ["Apellidos y nombres", "Fecha", "Actividad"], rows.map((student) => [
    student.Nombre,
    date || "-",
    `<select data-att-student="${escapeHtml(student.ID_Estudiante)}">
      ${["A", "F", "R", "L"].map((value) => `<option value="${value}">${value} - ${attendanceStatusLabel(value)}</option>`).join("")}
    </select>`
  ]));
}

async function saveBulkAttendance() {
  const group = $("#attendanceGroup").value;
  const subject = $("#attendanceSubject").value;
  const trimester = $("#attendanceTrimester").value || "1";
  const published = $("#attendancePublished")?.value === "Si" ? "Si" : "No";
  const date = $("#attendanceDate").value;
  if (!group || !subject || !date) {
    setMessage("Seleccione grupo, materia y fecha para registrar asistencia.", "error");
    return;
  }
  const selects = $$("[data-att-student]");
  if (!selects.length) {
    setMessage("No hay estudiantes cargados para registrar asistencia.", "error");
    return;
  }
  setMessage(`Guardando asistencia del curso (${selects.length} estudiantes)...`);
  const grades = selects.map((selectEl) => {
    const studentId = selectEl.dataset.attStudent;
    const existing = state.grades.find((grade) =>
      grade.ID_Estudiante === studentId &&
      grade.ID_Materia === subject &&
      getGradeGroup(grade, getStudent(studentId)) === group &&
      String(grade.Trimestre || "1") === String(trimester)
    );
    const grade = existing ? { ...existing } : {
      Grupo: group,
      Trimestre: trimester,
      ID_Estudiante: studentId,
      ID_Materia: subject,
      Estado_Academico: "Sin completar",
      Publicado: published,
      Observacion: ""
    };
    grade.Publicado = published;
    const items = applyAttendanceDay(parseGradeItems(grade.Detalle_Registro), date, selectEl.value);
    const payload = { ...grade, Detalle_Registro: JSON.stringify(items), Tipo_Registro: "" };
    roundGradePayload(payload);
    return payload;
  });
  try {
    await api("saveGradesBatch", { grades });
    academicRecordsLoaded = false;
    await refreshAll();
    setMessage("Asistencia registrada correctamente.", "success");
  } catch (error) {
    if (!/Accion no reconocida/i.test(error.message)) {
      setMessage(error.message, "error");
      return;
    }
    setMessage("Guardando asistencia en modo compatible...");
    try {
      await runInBatches(grades, 6, (grade) => api(grade.ID_Nota ? "updateGrade" : "addGrade", { grade }));
      academicRecordsLoaded = false;
      await refreshAll();
      setMessage("Asistencia registrada correctamente.", "success");
    } catch (fallbackError) {
      setMessage(fallbackError.message, "error");
    }
  }
}

function applyAttendanceDay(items, date, status) {
  const base = items.filter((item) =>
    !(item.tipo === "asistencia_dia" && item.fecha === date) &&
    item.tipo !== "asistencia" &&
    item.tipo !== "asistencia_ser"
  );
  const daily = items
    .filter((item) => item.tipo === "asistencia_dia" && item.fecha !== date)
    .concat([{ tipo: "asistencia_dia", dimension: "", titulo: date, fecha: date, valor: normalizeAttendanceStatus(status), promedia: false }]);
  const totals = calculateAttendanceTotals(daily.map((item) => ({ estado: item.valor })));
  ["asistencia", "faltas", "retrasos", "licencias"].forEach((key) => {
    base.push({ tipo: "asistencia", dimension: "", titulo: attendanceLabel(key), valor: totals[key], promedia: false });
  });
  const score = calculateAttendanceScore(totals);
  if (score !== "") base.push({ tipo: "asistencia_ser", dimension: "Ser", titulo: "Nota asistencia", valor: score, promedia: true });
  return daily.concat(base);
}

function removeAttendanceDay(items, date, removeIndex = null) {
  const daily = items.filter((item, index) =>
    item.tipo === "asistencia_dia" &&
    !(removeIndex !== null ? index === removeIndex : item.fecha === date)
  );
  const base = items.filter((item) =>
    item.tipo !== "asistencia_dia" &&
    item.tipo !== "asistencia" &&
    item.tipo !== "asistencia_ser"
  );
  const totals = calculateAttendanceTotals(daily.map((item) => ({ estado: item.valor })));
  ["asistencia", "faltas", "retrasos", "licencias"].forEach((key) => {
    base.push({ tipo: "asistencia", dimension: "", titulo: attendanceLabel(key), valor: totals[key], promedia: false });
  });
  const score = calculateAttendanceScore(totals);
  if (score !== "") base.push({ tipo: "asistencia_ser", dimension: "Ser", titulo: "Nota asistencia", valor: score, promedia: true });
  return daily.concat(base);
}

function getAttendanceRecords() {
  if (state.attendanceRecords?.length) {
    return state.attendanceRecords.map((row) => {
      const grade = state.grades.find((item) => item.ID_Nota === row.ID_Nota) || row;
      return {
        row,
        grade,
        student: getStudent(row.ID_Estudiante),
        subject: getSubject(row.ID_Materia),
        item: { tipo: "asistencia_dia", fecha: row.Fecha, valor: row.Estado, titulo: row.Fecha },
        itemIndex: null,
        separated: true
      };
    });
  }
  return state.grades.flatMap((grade) => {
    const student = getStudent(grade.ID_Estudiante);
    const subject = getSubject(grade.ID_Materia);
    const daily = parseGradeItems(grade.Detalle_Registro)
      .map((item, itemIndex) => ({ grade, student, subject, item, itemIndex }))
      .filter((record) => record.item.tipo === "asistencia_dia" && record.item.fecha);
    if (daily.length) return daily;
    if (!grade.Asistencia) return [];
    return [{
      grade,
      student,
      subject,
      item: {
        tipo: "asistencia_resumen",
        fecha: dateFromTimestamp(grade.Ultima_Actualizacion || grade.Fecha_Registro) || "-",
        valor: grade.Asistencia,
        titulo: "Resumen de asistencia"
      },
      itemIndex: null,
      summaryOnly: true
    }];
  });
}

function renderAttendanceRecords() {
  const search = $("#attendanceRecordSearch")?.value.toLowerCase() || "";
  const group = $("#attendanceRecordGroupFilter")?.value || "";
  const subject = $("#attendanceRecordSubjectFilter")?.value || "";
  const trimester = $("#attendanceRecordTrimesterFilter")?.value || "";
  const date = $("#attendanceRecordDateFilter")?.value || "";
  const allRecords = getAttendanceRecords();
  const records = allRecords.filter(({ grade, student, subject: recordSubject, item }) =>
    (!search || `${student.CI} ${student.Nombre}`.toLowerCase().includes(search)) &&
    (!group || getGradeGroup(grade, student) === group) &&
    (!subject || grade.ID_Materia === subject) &&
    (!trimester || String(grade.Trimestre || "1") === trimester) &&
    (!date || item.fecha === date) &&
    recordSubject
  ).sort((a, b) => String(b.item.fecha).localeCompare(String(a.item.fecha)) || compareStudentsByName(a.student, b.student));
  visibleAttendanceRecords = records;
  if ($("#selectAllAttendanceRecords")) $("#selectAllAttendanceRecords").checked = false;
  updateListCount("#attendanceRecordsCount", records.length, allRecords.length, "asistencias");
  renderTable("#attendanceRecordsTable", ["Sel.", "Fecha", "CI", "Nombre", "Grupo", "Trim.", "Materia", "Estado", "Publicado", "Acciones"], records.map((record, index) => [
    record.summaryOnly ? "" : `<input class="row-check" type="checkbox" data-attendance-select="${index}" aria-label="Seleccionar asistencia">`,
    record.item.fecha,
    record.student.CI || "-",
    record.student.Nombre || "-",
    getGradeGroup(record.grade, record.student),
    trimesterLabel(record.grade.Trimestre),
    record.subject.Nombre_Materia || "-",
    record.summaryOnly ? escapeHtml(stripHtml(record.item.valor)) : pill(attendanceStatusLabel(record.item.valor)),
    pill(record.grade.Publicado || "No", "published"),
    attendanceRecordActions(record)
  ]));
}

function toggleAllAttendanceRecordSelection(event) {
  $$("[data-attendance-select]").forEach((input) => {
    input.checked = event.currentTarget.checked;
  });
}

function attendanceRecordActions(record) {
  if (record.summaryOnly) {
    return actions([
      ["Ver", () => viewAttendanceRecord(record)],
      ["Editar nota", () => openGradeModal(record.grade)]
    ]);
  }
  return actions([
    ["Ver", () => viewAttendanceRecord(record)],
    ["Editar", () => openAttendanceRecordModal(record)],
    ["Eliminar", () => deleteAttendanceRecord(record)]
  ]);
}

function viewAttendanceRecord(record) {
  viewRecord("Asistencia", {
    Fecha: record.item.fecha,
    Estado: record.summaryOnly ? stripHtml(record.item.valor) : attendanceStatusLabel(record.item.valor),
    Estudiante: record.student.Nombre,
    CI: record.student.CI,
    Grupo: getGradeGroup(record.grade, record.student),
    Trimestre: trimesterLabel(record.grade.Trimestre),
    Materia: record.subject.Nombre_Materia,
    Publicado: record.grade.Publicado
  });
}

function openAttendanceRecordModal(record = null) {
  const grade = record ? record.grade : {};
  const student = record ? record.student : getStudent(grade.ID_Estudiante);
  const selectedGroup = getGradeGroup(grade, student) || getGradeGroups()[0] || "";
  const selectedStudentId = grade.ID_Estudiante || firstStudentIdForGroup(selectedGroup);
  const selectedSubjectId = grade.ID_Materia || (state.subjects[0] && state.subjects[0].ID_Materia) || "";
  openModal(record ? "Editar asistencia" : "Agregar asistencia", [
    select("Grupo", "Grupo", getGradeGroups().length ? getGradeGroups() : ["G1", "G2"], selectedGroup, true),
    select("Trimestre", "Trimestre", [["1", "1er trimestre"], ["2", "2do trimestre"], ["3", "3er trimestre"]], grade.Trimestre || "1", true),
    select("ID_Estudiante", "Estudiante", getStudentsForGroupOptions(selectedGroup, selectedStudentId), selectedStudentId, true),
    select("ID_Materia", "Materia", state.subjects.map((s) => [s.ID_Materia, s.Nombre_Materia]), selectedSubjectId, true),
    field("fecha", "Fecha", record?.item.fecha || new Date().toISOString().slice(0, 10), true, "date"),
    select("estado", "Estado", [["A", "A - Asistencia"], ["F", "F - Falta"], ["R", "R - Retraso"], ["L", "L - Licencia"]], record?.item.valor || "A", true),
    select("Publicado", "Publicado", ["Si", "No"], grade.Publicado || "No")
  ], async (values) => saveAttendanceRecord(record, values), () => bindGradeGroupSelector());
}

async function saveAttendanceRecord(record, values) {
  const selection = {
    Grupo: values.Grupo,
    Trimestre: values.Trimestre,
    ID_Estudiante: values.ID_Estudiante,
    ID_Materia: values.ID_Materia
  };
  const grade = record ? { ...record.grade, ...selection } : resolveExistingGradeForSelection(selection);
  const baseGrade = {
    ...grade,
    Grupo: values.Grupo,
    Trimestre: values.Trimestre,
    ID_Estudiante: values.ID_Estudiante,
    ID_Materia: values.ID_Materia,
    Estado_Academico: grade.Estado_Academico || "Sin completar",
    Publicado: values.Publicado || grade.Publicado || "No",
    Observacion: grade.Observacion || ""
  };
  let items = parseGradeItems(baseGrade.Detalle_Registro);
  if (record && record.grade.ID_Nota === baseGrade.ID_Nota) {
    items = removeAttendanceDay(items, record.item.fecha, record.itemIndex);
  }
  items = applyAttendanceDay(items, values.fecha, values.estado);
  await saveGradeWithItems(baseGrade, items);
}

async function deleteAttendanceRecord(record) {
  if (!confirm(`¿Eliminar la asistencia de ${record.student.Nombre} del ${record.item.fecha}?`)) return;
  const items = removeAttendanceDay(parseGradeItems(record.grade.Detalle_Registro), record.item.fecha, record.itemIndex);
  await saveGradeWithItems(record.grade, items);
}

async function deleteSelectedAttendanceRecords() {
  const selected = $$("[data-attendance-select]:checked")
    .map((input) => visibleAttendanceRecords[Number(input.dataset.attendanceSelect)])
    .filter(Boolean);
  if (!selected.length) {
    setMessage("Seleccione al menos una asistencia para eliminar.", "error");
    return;
  }
  if (!confirm(`¿Eliminar ${selected.length} asistencia(s) seleccionada(s)?`)) return;
  const grouped = groupRecordsByGrade(selected);
  try {
    setMessage(`Eliminando ${selected.length} asistencia(s)...`);
    await saveGroupedGradeChanges(grouped, (grade, records) => {
      let items = parseGradeItems(grade.Detalle_Registro);
      records.forEach((record) => {
        items = removeAttendanceDay(items, record.item.fecha, record.itemIndex);
      });
      return items;
    });
    await refreshAll();
    setMessage("Asistencias eliminadas correctamente.", "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

function renderGrades() {
  const search = $("#gradeSearch").value.toLowerCase();
  const group = $("#gradeGroupFilter").value;
  const subject = $("#gradeSubjectFilter").value;
  const trimester = $("#gradeTrimesterFilter").value;
  const status = $("#gradeStatusFilter").value;
  const published = $("#gradePublishedFilter").value;
  const rows = state.grades.filter((grade) => {
    const student = getStudent(grade.ID_Estudiante);
    return (!search || `${student.CI} ${student.Nombre}`.toLowerCase().includes(search)) &&
      (!group || getGradeGroup(grade, student) === group) &&
      (!subject || grade.ID_Materia === subject) &&
      (!trimester || String(grade.Trimestre || "1") === trimester) &&
      (!status || grade.Estado_Academico === status) &&
      (!published || grade.Publicado === published);
  }).sort((a, b) => compareStudentsByName(getStudent(a.ID_Estudiante), getStudent(b.ID_Estudiante)));
  updateListCount("#gradesCount", rows.length, state.grades.length, "notas");
  renderTable("#gradesTable", ["CI", "Nombre", "Curso", "Grupo", "Trim.", "Materia", "Ser", "Saber", "Hacer", "Autoev.", "Final", "Estado", "Publicado", "Acciones"], rows.map((grade) => {
    const student = getStudent(grade.ID_Estudiante);
    return [
      student.CI, student.Nombre, student.Curso, getGradeGroup(grade, student), trimesterLabel(grade.Trimestre), getSubject(grade.ID_Materia).Nombre_Materia,
      grade.Ser_Aporte || "-", grade.Saber_Aporte || "-", grade.Hacer_Aporte || "-", grade.Decidir_Aporte || "-", grade.Nota_Final || "-", pill(grade.Estado_Academico), pill(grade.Publicado, "published"),
      actions([
        ["Ver", () => viewRecord("Nota", grade)],
        ["Editar", () => openGradeModal(grade)],
        ["Eliminar", () => deleteRecord("deleteGrade", "nota", grade.ID_Nota)],
        [grade.Publicado === "Si" ? "Despublicar" : "Publicar", () => updatePublish(grade)]
      ])
    ];
  }));
}

function getNoteRecords() {
  if (state.noteRecords?.length) {
    const detailRecords = state.noteRecords.map((row) => {
      const grade = state.grades.find((item) => item.ID_Nota === row.ID_Nota) || row;
      return {
        row,
        grade,
        student: getStudent(row.ID_Estudiante),
        subject: getSubject(row.ID_Materia),
        item: {
          tipo: row.Tipo,
          dimension: row.Dimension,
          titulo: row.Titulo,
          fecha: row.Fecha,
          valor: row.Valor,
          sobre: row.Sobre,
          promedia: row.Tipo !== "practica"
        },
        itemIndex: null,
        separated: true
      };
    });
    const summaries = state.grades.map((grade) => {
      const student = getStudent(grade.ID_Estudiante);
      const subject = getSubject(grade.ID_Materia);
      return {
        grade,
        student,
        subject,
        item: {
          tipo: "nota_final",
          dimension: "Final",
          titulo: "Nota final",
          fecha: dateFromTimestamp(grade.Ultima_Actualizacion || grade.Fecha_Registro),
          valor: grade.Nota_Final || "-",
          promedia: false
        },
        itemIndex: null,
        summaryOnly: true
      };
    });
    return summaries.concat(detailRecords);
  }
  return state.grades.flatMap((grade) => {
    const student = getStudent(grade.ID_Estudiante);
    const subject = getSubject(grade.ID_Materia);
    const summary = {
      grade,
      student,
      subject,
      item: {
        tipo: "nota_final",
        dimension: "Final",
        titulo: "Nota final",
        fecha: dateFromTimestamp(grade.Ultima_Actualizacion || grade.Fecha_Registro),
        valor: grade.Nota_Final || "-",
        promedia: false
      },
      itemIndex: null,
      summaryOnly: true
    };
    const details = parseGradeItems(grade.Detalle_Registro)
      .map((item, itemIndex) => ({ grade, student, subject, item, itemIndex }))
      .filter(({ item }) => isEditableNoteItem(item));
    return [summary].concat(details);
  });
}

function isEditableNoteItem(item = {}) {
  return item.tipo !== "asistencia_dia" &&
    item.tipo !== "asistencia" &&
    item.tipo !== "asistencia_ser" &&
    item.tipo !== "practicas_total";
}

function renderNoteRecords() {
  const search = $("#noteRecordSearch")?.value.toLowerCase() || "";
  const group = $("#noteRecordGroupFilter")?.value || "";
  const subject = $("#noteRecordSubjectFilter")?.value || "";
  const trimester = $("#noteRecordTrimesterFilter")?.value || "";
  const dimension = $("#noteRecordDimensionFilter")?.value || "";
  const allRecords = getNoteRecords();
  const records = allRecords.filter(({ grade, student, subject: recordSubject, item }) =>
    (!search || `${student.CI} ${student.Nombre} ${item.titulo} ${item.valor}`.toLowerCase().includes(search)) &&
    (!group || getGradeGroup(grade, student) === group) &&
    (!subject || grade.ID_Materia === subject) &&
    (!trimester || String(grade.Trimestre || "1") === trimester) &&
    (!dimension || noteItemDimension(item) === dimension) &&
    recordSubject
  ).sort((a, b) => compareStudentsByName(a.student, b.student) || String(a.item.titulo).localeCompare(String(b.item.titulo)));
  visibleNoteRecords = records;
  if ($("#selectAllNoteRecords")) $("#selectAllNoteRecords").checked = false;
  updateListCount("#noteRecordsCount", records.length, allRecords.length, "registros de notas");
  renderTable("#noteRecordsTable", ["Sel.", "CI", "Nombre", "Grupo", "Trim.", "Materia", "Dimension", "Detalle", "Fecha", "Valor", "Publicado", "Acciones"], records.map((record, index) => [
    `<input class="row-check" type="checkbox" data-note-select="${index}" aria-label="Seleccionar registro de nota">`,
    record.student.CI || "-",
    record.student.Nombre || "-",
    getGradeGroup(record.grade, record.student),
    trimesterLabel(record.grade.Trimestre),
    record.subject.Nombre_Materia || "-",
    noteItemDimension(record.item) || "-",
    record.item.titulo || "-",
    record.item.fecha || "-",
    formatPracticeDisplay(record.item),
    pill(record.grade.Publicado || "No", "published"),
    noteRecordActions(record)
  ]));
}

function toggleAllNoteRecordSelection(event) {
  $$("[data-note-select]").forEach((input) => {
    input.checked = event.currentTarget.checked;
  });
}

function noteRecordActions(record) {
  if (record.summaryOnly) {
    return actions([
      ["Ver", () => viewNoteRecord(record)],
      ["Editar nota", () => openGradeModal(record.grade)],
      ["Eliminar", () => deleteRecord("deleteGrade", "nota", record.grade.ID_Nota)]
    ]);
  }
  return actions([
    ["Ver", () => viewNoteRecord(record)],
    ["Editar", () => openNoteRecordModal(record)],
    ["Editar nota", () => openGradeModal(record.grade)],
    ["Eliminar", () => deleteNoteRecord(record)]
  ]);
}

function viewNoteRecord(record) {
  viewRecord("Registro de nota", {
    Estudiante: record.student.Nombre,
    CI: record.student.CI,
    Grupo: getGradeGroup(record.grade, record.student),
    Trimestre: trimesterLabel(record.grade.Trimestre),
    Materia: record.subject.Nombre_Materia,
    Dimension: noteItemDimension(record.item),
    Detalle: record.item.titulo,
    Fecha: record.item.fecha,
    Valor: formatPracticeDisplay(record.item),
    Publicado: record.grade.Publicado
  });
}

function openNoteRecordModal(record = null) {
  const grade = record ? record.grade : {};
  const student = record ? record.student : getStudent(grade.ID_Estudiante);
  const item = record?.item || {};
  const selectedGroup = getGradeGroup(grade, student) || getGradeGroups()[0] || "";
  const selectedStudentId = grade.ID_Estudiante || firstStudentIdForGroup(selectedGroup);
  const selectedSubjectId = grade.ID_Materia || (state.subjects[0] && state.subjects[0].ID_Materia) || "";
  openModal(record ? "Editar registro de nota" : "Agregar registro de nota", [
    select("Grupo", "Grupo", getGradeGroups().length ? getGradeGroups() : ["G1", "G2"], selectedGroup, true),
    select("Trimestre", "Trimestre", [["1", "1er trimestre"], ["2", "2do trimestre"], ["3", "3er trimestre"]], grade.Trimestre || "1", true),
    select("ID_Estudiante", "Estudiante", getStudentsForGroupOptions(selectedGroup, selectedStudentId), selectedStudentId, true),
    select("ID_Materia", "Materia", state.subjects.map((s) => [s.ID_Materia, s.Nombre_Materia]), selectedSubjectId, true),
    select("tipo", "Tipo de registro", [["practica", "Practica"], ["dimension_ser", "Ser"], ["dimension_saber", "Saber"], ["dimension_hacer", "Hacer"], ["dimension_autoevaluacion", "Autoevaluacion"]], noteItemType(item), true),
    field("titulo", "Detalle", item.titulo, true),
    field("fecha", "Fecha", item.fecha, false, "date"),
    field("valor", "Valor", splitPracticeValue(item).valor || item.valor, true, "number"),
    field("sobre", "Sobre", splitPracticeValue(item).sobre || item.sobre, false, "number"),
    select("Publicado", "Publicado", ["Si", "No"], grade.Publicado || "No")
  ], async (values) => saveNoteRecord(record, values), () => bindGradeGroupSelector());
}

async function saveNoteRecord(record, values) {
  const selection = {
    Grupo: values.Grupo,
    Trimestre: values.Trimestre,
    ID_Estudiante: values.ID_Estudiante,
    ID_Materia: values.ID_Materia
  };
  const grade = record ? { ...record.grade, ...selection } : resolveExistingGradeForSelection(selection);
  const baseGrade = {
    ...grade,
    Grupo: values.Grupo,
    Trimestre: values.Trimestre,
    ID_Estudiante: values.ID_Estudiante,
    ID_Materia: values.ID_Materia,
    Estado_Academico: grade.Estado_Academico || "Sin completar",
    Publicado: values.Publicado || grade.Publicado || "No",
    Observacion: grade.Observacion || ""
  };
  const newItem = buildNoteRecordItem(values);
  const items = parseGradeItems(baseGrade.Detalle_Registro);
  if (record && record.grade.ID_Nota === baseGrade.ID_Nota) {
    const index = record.itemIndex !== null && record.itemIndex !== undefined ? record.itemIndex : findNoteItemIndex(items, record.item);
    if (index >= 0) items[index] = newItem;
    else items.push(newItem);
  } else {
    items.push(newItem);
  }
  await saveGradeWithItems(baseGrade, items.filter(isEditableOrStoredItem));
}

async function deleteNoteRecord(record) {
  if (!confirm(`¿Eliminar el registro "${record.item.titulo || "nota"}" de ${record.student.Nombre}?`)) return;
  const parsed = parseGradeItems(record.grade.Detalle_Registro);
  const targetIndex = record.itemIndex !== null && record.itemIndex !== undefined ? record.itemIndex : findNoteItemIndex(parsed, record.item);
  const items = parsed.filter((_, index) => index !== targetIndex);
  await saveGradeWithItems(record.grade, items);
}

async function deleteSelectedNoteRecords() {
  const selected = $$("[data-note-select]:checked")
    .map((input) => visibleNoteRecords[Number(input.dataset.noteSelect)])
    .filter(Boolean);
  if (!selected.length) {
    setMessage("Seleccione al menos un registro de nota para eliminar.", "error");
    return;
  }
  const summaryCount = selected.filter((record) => record.summaryOnly).length;
  const message = summaryCount
    ? `Selecciono ${summaryCount} nota(s) principal(es). Eso eliminara la nota completa. ¿Continuar?`
    : `¿Eliminar ${selected.length} registro(s) de nota seleccionados?`;
  if (!confirm(message)) return;
  try {
    setMessage(`Eliminando ${selected.length} registro(s)...`);
    const summaryGrades = selected.filter((record) => record.summaryOnly).map((record) => record.grade);
    const detailRecords = selected.filter((record) => !record.summaryOnly);
    await runInBatches(uniqueGrades(summaryGrades), 4, (grade) => api("deleteGrade", { id: grade.ID_Nota }));
    if (summaryGrades.length) academicRecordsLoaded = false;
    const deletedGradeIds = new Set(summaryGrades.map((grade) => String(grade.ID_Nota)));
    const grouped = groupRecordsByGrade(detailRecords.filter((record) => !deletedGradeIds.has(String(record.grade.ID_Nota))));
    await saveGroupedGradeChanges(grouped, (grade, records) => {
      const removeKeys = new Set(records.map((record) => noteRecordKey(record.item)));
      return parseGradeItems(grade.Detalle_Registro).filter((item) => !removeKeys.has(noteRecordKey(item)));
    });
    await refreshAll();
    setMessage("Registros de notas eliminados correctamente.", "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

function findNoteItemIndex(items, target = {}) {
  return items.findIndex((item) =>
    isEditableNoteItem(item) &&
    noteRecordKey(item) === noteRecordKey(target)
  );
}

function noteRecordKey(item = {}) {
  return [
    item.tipo || "",
    item.dimension || "",
    item.titulo || "",
    item.fecha || "",
    item.valor === undefined || item.valor === null ? "" : item.valor,
    item.sobre || ""
  ].join("|");
}

function buildNoteRecordItem(values) {
  const dimension = noteTypeDimension(values.tipo);
  const item = {
    tipo: values.tipo,
    dimension,
    titulo: String(values.titulo || "").trim(),
    fecha: String(values.fecha || "").trim(),
    valor: String(values.valor || "").trim(),
    sobre: String(values.sobre || "").trim(),
    promedia: values.tipo !== "practica"
  };
  if (item.tipo === "practica" && item.sobre && item.valor) item.valor = `${item.valor}/${item.sobre}`;
  return item;
}

function isEditableOrStoredItem(item) {
  return item && item.tipo !== "asistencia" && item.tipo !== "asistencia_ser" && item.tipo !== "practicas_total";
}

function noteItemType(item = {}) {
  if (item.tipo) return item.tipo;
  const key = normalizeKey(item.dimension);
  if (key === "ser") return "dimension_ser";
  if (key === "saber") return "dimension_saber";
  if (key === "hacer") return "dimension_hacer";
  if (key === "decidir") return "dimension_autoevaluacion";
  return "practica";
}

function noteTypeDimension(type) {
  return {
    practica: "Hacer",
    dimension_ser: "Ser",
    dimension_saber: "Saber",
    dimension_hacer: "Hacer",
    dimension_autoevaluacion: "Decidir"
  }[type] || "";
}

function noteItemDimension(item = {}) {
  return item.dimension || noteTypeDimension(noteItemType(item));
}

function renderSubjects() {
  const search = $("#subjectSearch").value.toLowerCase();
  const rows = state.subjects.filter((subject) => `${subject.Nombre_Materia} ${subject.Docente}`.toLowerCase().includes(search));
  updateListCount("#subjectsCount", rows.length, state.subjects.length, "materias");
  renderTable("#subjectsTable", ["Materia", "Docente", "Estado", "Acciones"], rows.map((subject) => [
    subject.Nombre_Materia, subject.Docente, pill(subject.Estado),
    actions([
      ["Editar", () => openSubjectModal(subject)],
      ["Eliminar", () => deleteRecord("deleteSubject", "materia", subject.ID_Materia)]
    ])
  ]));
}

function renderCourses() {
  const search = $("#courseSearch").value.toLowerCase();
  const rows = state.courses.filter((course) => `${course.Curso} ${course.Paralelo} ${course.Gestion}`.toLowerCase().includes(search));
  updateListCount("#coursesCount", rows.length, state.courses.length, "cursos");
  renderTable("#coursesTable", ["Curso", "Paralelo", "Gestion", "Estado", "Acciones"], rows.map((course) => [
    course.Curso, course.Paralelo, course.Gestion, pill(course.Estado),
    actions([
      ["Editar", () => openCourseModal(course)],
      ["Eliminar", () => deleteRecord("deleteCourse", "curso", course.ID_Curso)]
    ])
  ]));
}

function renderSettings() {
  const keys = [
    ["nombre_colegio", "Nombre de la Unidad Educativa"],
    ["logo_url", "URL del logo institucional"],
    ["escudo_bolivia_url", "URL escudo de Bolivia para boletin"],
    ["docente", "Docente o encargado"],
    ["materia_principal", "Materia principal"],
    ["campo", "Campo"],
    ["director", "Directora/or"],
    ["gestion", "Gestion academica"],
    ["ciudad", "Ciudad o ubicacion"],
    ["footer_texto", "Texto del pie de pagina"],
    ["color_principal", "Color principal"],
    ["color_secundario", "Color secundario"],
    ["mensaje_bienvenida", "Mensaje de bienvenida"]
  ];
  $("#settingsForm").innerHTML = keys.map(([key, label]) => `
    <label>
      ${label}
      <input name="${key}" value="${escapeHtml(state.config[key] || "")}" ${key.includes("color") ? "type=\"color\"" : "type=\"text\""}>
    </label>
  `).join("");
}

function renderReport() {
  const type = $("#reportType").value;
  let grades = [...state.grades];
  if (type === "aprobados") grades = grades.filter((grade) => grade.Estado_Academico === "Aprobado");
  if (type === "reprobados") grades = grades.filter((grade) => grade.Estado_Academico === "Reprobado");
  if (type === "seguimiento") grades = grades.filter((grade) => grade.Estado_Academico === "En seguimiento");
  if (type === "publicadas") grades = grades.filter((grade) => grade.Publicado === "Si");
  if (type === "nopublicadas") grades = grades.filter((grade) => grade.Publicado === "No");

  $("#reportArea").innerHTML = `
    <h2>${state.config.nombre_colegio || "Unidad Educativa"}</h2>
    <p><strong>Gestion:</strong> ${state.config.gestion || ""} | <strong>Fecha:</strong> ${new Date().toLocaleString()} | <strong>Total:</strong> ${grades.length}</p>
    <table>
      <thead><tr><th>Nro.</th><th>CI</th><th>Nombre</th><th>Curso</th><th>Grupo</th><th>Trim.</th><th>Materia</th><th>Ser</th><th>Saber</th><th>Hacer</th><th>Autoev.</th><th>Final</th><th>Estado</th><th>Publicado</th></tr></thead>
      <tbody>${grades.map((grade, index) => {
        const student = getStudent(grade.ID_Estudiante);
        return `<tr><td class="row-number">${index + 1}</td><td>${student.CI}</td><td>${student.Nombre}</td><td>${student.Curso}</td><td>${getGradeGroup(grade, student)}</td><td>${trimesterLabel(grade.Trimestre)}</td><td>${getSubject(grade.ID_Materia).Nombre_Materia}</td><td>${grade.Ser_Aporte || "-"}</td><td>${grade.Saber_Aporte || "-"}</td><td>${grade.Hacer_Aporte || "-"}</td><td>${grade.Decidir_Aporte || "-"}</td><td>${grade.Nota_Final}</td><td>${grade.Estado_Academico}</td><td>${grade.Publicado}</td></tr>`;
      }).join("")}</tbody>
    </table>
  `;
}

function exportBulletinPdf() {
  renderBulletinReport();
  setTimeout(() => window.print(), 100);
}

function renderBulletinReport() {
  const courseFilter = $("#bulletinCourseFilter")?.value || "";
  const groupFilter = $("#bulletinGroupFilter")?.value || "";
  const subjectFilter = $("#bulletinSubjectFilter")?.value || "";
  const published = state.grades.filter((grade) => {
    const student = getStudent(grade.ID_Estudiante);
    return grade.Publicado === "Si" &&
      (!courseFilter || student.Curso === courseFilter) &&
      (!groupFilter || getGradeGroup(grade, student) === groupFilter) &&
      (!subjectFilter || grade.ID_Materia === subjectFilter);
  });
  const grouped = {};
  published.forEach((grade) => {
    const student = getStudent(grade.ID_Estudiante);
    const key = [grade.ID_Estudiante, grade.ID_Materia, getGradeGroup(grade, student)].join("|");
    if (!grouped[key]) grouped[key] = { student, grade, grades: {} };
    grouped[key].grades[String(grade.Trimestre || "1")] = grade;
  });
  const first = Object.keys(grouped).length ? grouped[Object.keys(grouped)[0]] : null;
  const headerStudent = first ? first.student : {};
  const headerGrade = first ? first.grade : {};
  const bulletinSubjectId = subjectFilter || headerGrade.ID_Materia || (state.subjects[0] && state.subjects[0].ID_Materia) || "";
  const headerSubject = bulletinSubjectId ? getSubject(bulletinSubjectId) : {};
  let reportStudents = state.students.filter((student) =>
    (!courseFilter || student.Curso === courseFilter) &&
    (!groupFilter || student.Paralelo === groupFilter)
  ).sort(compareStudentsByName);
  if (!reportStudents.length && published.length) {
    reportStudents = Object.keys(grouped).map((key) => grouped[key].student).sort(compareStudentsByName);
  }
  const metaStudent = headerStudent.ID_Estudiante ? headerStudent : (reportStudents[0] || {});
  const dataRows = reportStudents.map((student, index) => {
    const grades = {};
    published
      .filter((grade) =>
        grade.ID_Estudiante === student.ID_Estudiante &&
        (!bulletinSubjectId || grade.ID_Materia === bulletinSubjectId) &&
        (!groupFilter || getGradeGroup(grade, student) === groupFilter)
      )
      .forEach((grade) => {
        grades[String(grade.Trimestre || "1")] = grade;
      });
    const finals = ["1", "2", "3"].map((trimester) => Number(grades[trimester]?.Nota_Final)).filter((value) => !Number.isNaN(value));
    const annual = finals.length ? Math.round(finals.reduce((sum, value) => sum + value, 0) / finals.length) : "";
    const annualLevel = qualitativeAnnual(annual);
    return `<tr>
      <td class="row-number">${index + 1}</td>
      <td>${escapeHtml(student.Nombre || "")}</td>
      ${["1", "2", "3"].map((trimester) => bulletinTrimesterCells(grades[trimester], trimester)).join("")}
      <td class="bulletin-annual">${annual || "-"}</td>
      <td class="bulletin-annual">${annual || "-"}</td>
      <td class="bulletin-annual level-${annualLevel.toLowerCase()}">${annual === "" ? "-" : annualLevel}</td>
      <td class="bulletin-annual annual-literal">${annual === "" ? "-" : numberToSpanish(annual)}</td>
      <td class="bulletin-annual promotion-cell">${annual === "" ? "-" : (annual >= 51 ? "PROMOVIDO" : "RETENIDO")}</td>
    </tr>`;
  });
  const rows = dataRows.join("") || `<tr><td colspan="22">No hay estudiantes para exportar.</td></tr>`;
  const teacherName = headerSubject.Docente || state.config.docente || "";
  const directorName = state.config.director || "";
  const densityClass = reportStudents.length > 35 ? " density-ultra" : (reportStudents.length > 28 ? " density-compact" : "");
  const boliviaSeal = state.config.escudo_bolivia_url || DEFAULT_BOLIVIA_SEAL;
  const institutionalLogo = state.config.logo_url || DEFAULT_LOGO;

  $("#reportArea").innerHTML = `
    <section class="bulletin-report${densityClass}">
      <div class="bulletin-header">
        <div class="bulletin-header-logo">
          <img src="${escapeHtml(boliviaSeal)}" data-fallback="${escapeHtml(institutionalLogo)}" alt="Escudo de Bolivia" onerror="this.onerror=null;this.src=this.dataset.fallback;">
        </div>
        <div class="bulletin-heading">
          <span>DISTRITO EDUCATIVO DE SACABA DEL DEPARTAMENTO DE COCHABAMBA</span>
          <strong>BOLETIN CENTRALIZADOR DE CALIFICACIONES ${escapeHtml(state.config.gestion || "")}</strong>
          <span>${escapeHtml((state.config.nombre_colegio || "Unidad Educativa").toUpperCase())}</span>
          <div class="bulletin-meta">
            <span><strong>NIVEL:</strong> ${escapeHtml(metaStudent.Curso ? "SECUNDARIO COMUNITARIO PRODUCTIVO" : "")}</span>
            <span><strong>CAMPO:</strong> ${escapeHtml(state.config.campo || "CIENCIA, TECNOLOGIA Y PRODUCCION")}</span>
            <span><strong>MAESTRA/O:</strong> ${escapeHtml(headerSubject.Docente || state.config.docente || "")}</span>
            <span><strong>DIRECTORA/OR:</strong> ${escapeHtml(state.config.director || "")}</span>
          </div>
        </div>
        <div class="bulletin-header-side">
          <span><strong>AREA:</strong> ${escapeHtml(headerSubject.Nombre_Materia || state.config.materia_principal || "")}</span>
          <span><strong>AÑO DE ESCOLARIDAD:</strong> ${escapeHtml(courseGradeLabel(courseFilter || metaStudent.Curso || ""))}</span>
          <div class="parallel-box">
            <small>PARALELO:</small>
            <strong>${escapeHtml(groupFilter || getGradeGroup(headerGrade, metaStudent) || "")}</strong>
          </div>
        </div>
      </div>
      <div class="development-scale">
        <span><strong>ED</strong> EN DESARROLLO</span>
        <span><strong>DA</strong> DESARROLLO ACEPTABLE</span>
        <span><strong>DO</strong> DESARROLLO OPTIMO</span>
        <span><strong>DP</strong> DESARROLLO PLENO</span>
      </div>
      <table class="bulletin-table">
        <colgroup>
          <col class="col-nro">
          <col class="col-name">
          ${Array.from({ length: 15 }, () => `<col class="col-trimester">`).join("")}
          ${Array.from({ length: 5 }, () => `<col class="col-annual">`).join("")}
        </colgroup>
        <thead>
          <tr>
            <th rowspan="2">N°</th><th rowspan="2" class="student-head">
              <div class="ministry-banner">
                <img src="${escapeHtml(boliviaSeal)}" data-fallback="${escapeHtml(institutionalLogo)}" alt="" onerror="this.onerror=null;this.src=this.dataset.fallback;">
                <span>MINISTERIO DE<br>EDUCACION</span>
              </div>
              <strong>Apellidos y nombres</strong>
            </th>
            <th colspan="5" class="trimester-one block-end">1er trimestre</th><th colspan="5" class="trimester-two block-end">2do trimestre</th><th colspan="5" class="trimester-three block-end">3er trimestre</th>
            <th colspan="5" class="annual-head">Promedio anual</th>
          </tr>
          <tr>
            ${[1, 2, 3].map((index) => `${verticalHead("Evaluacion de|Maestro", `trimester-${index}`)}${verticalHead("Autoevaluacion", `trimester-${index}`)}${verticalHead("Valoracion|Cuantitativa", `trimester-${index}`)}${verticalHead("Cualitativa", `trimester-${index}`)}${verticalHead("Final", `trimester-${index} block-end`)}`).join("")}
            ${verticalHead("Anual", "annual-head")}${verticalHead("Cuantitativo", "annual-head")}${verticalHead("Cualitativa", "annual-head")}${stackedHead("Anual|Literal", "annual-head")}${horizontalHead("Promocion", "annual-head")}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="bulletin-signatures">
        <div>
          <span></span>
          <strong>${escapeHtml((teacherName || "MAESTRA/O").toUpperCase())}</strong>
          <small>MAESTRA/O DEL AREA DE ${escapeHtml((headerSubject.Nombre_Materia || state.config.materia_principal || "").toUpperCase())}</small>
        </div>
        <div>
          <span></span>
          <strong>${escapeHtml((directorName || "DIRECTORA/OR").toUpperCase())}</strong>
          <small>DIRECTOR DE LA U. E. ${escapeHtml((state.config.nombre_colegio || "").toUpperCase())}</small>
        </div>
      </div>
    </section>
  `;
}

function emptyBulletinRow(index) {
  return `<tr>
    <td class="row-number">${index}</td>
    <td></td>
    ${Array.from({ length: 3 }, (_, trimesterIndex) => {
      const cls = `trimester-${trimesterIndex + 1}`;
      return `<td class="${cls}"></td><td class="${cls}"></td><td class="${cls} bulletin-final"></td><td class="${cls}"></td><td class="${cls} block-end"></td>`;
    }).join("")}
    <td class="bulletin-annual"></td><td class="bulletin-annual"></td><td class="bulletin-annual"></td><td class="bulletin-annual"></td><td class="bulletin-annual"></td>
  </tr>`;
}

function verticalHead(label, classes = "") {
  const parts = String(label).split("|");
  const content = parts.length > 1
    ? `<span class="multi-line">${parts.map((part) => `<em>${escapeHtml(part)}</em>`).join("")}</span>`
    : `<span>${escapeHtml(label)}</span>`;
  return `<th class="vertical-head ${classes}">${content}</th>`;
}

function diagonalHead(label, classes = "") {
  return `<th class="diagonal-head ${classes}"><span>${escapeHtml(label)}</span></th>`;
}

function stackedHead(label, classes = "") {
  return `<th class="stacked-head ${classes}">${String(label).split("|").map((part) => `<span>${escapeHtml(part)}</span>`).join("")}</th>`;
}

function horizontalHead(label, classes = "") {
  return `<th class="horizontal-head ${classes}"><span>${escapeHtml(label)}</span></th>`;
}

function bulletinTrimesterCells(grade = {}, trimester = "1") {
  const evaluation = sumNumbers([grade.Ser_Aporte, grade.Saber_Aporte, grade.Hacer_Aporte]);
  const self = numberOrDash(grade.Decidir_Aporte);
  const final = numberOrDash(grade.Nota_Final);
  const cls = `trimester-${trimester}`;
  const level = qualitativeAnnual(final).toLowerCase();
  return `<td class="${cls}">${evaluation || "-"}</td><td class="${cls}">${self}</td><td class="${cls} bulletin-final">${final}</td><td class="${cls} level-${level}">${qualitativeAnnual(final)}</td><td class="${cls} block-end">${final}</td>`;
}

function sumNumbers(values) {
  const numbers = values.map((value) => Number(value)).filter((value) => !Number.isNaN(value));
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) : "";
}

function numberOrDash(value) {
  const number = Number(value);
  return Number.isNaN(number) ? "-" : String(Math.round(number));
}

function qualitativeAnnual(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return "-";
  if (number >= 86) return "DP";
  if (number >= 69) return "DO";
  if (number >= 51) return "DA";
  return "ED";
}

function courseGradeLabel(value) {
  const key = normalizeKey(value);
  const map = { "1ro": "PRIMERO", "1": "PRIMERO", "2do": "SEGUNDO", "2": "SEGUNDO", "3ro": "TERCERO", "3": "TERCERO", "4to": "CUARTO", "4": "CUARTO", "5to": "QUINTO", "5": "QUINTO", "6to": "SEXTO", "6": "SEXTO" };
  return map[key] || String(value || "").toUpperCase();
}

function numberToSpanish(value) {
  const number = Math.round(Number(value));
  if (Number.isNaN(number)) return "-";
  const units = ["CERO", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
  const tens = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  if (number < 20) return units[number] || String(number);
  if (number === 20) return "VEINTE";
  if (number < 30) return `VEINTI${units[number - 20]}`;
  if (number < 100) return number % 10 === 0 ? tens[Math.floor(number / 10)] : `${tens[Math.floor(number / 10)]} Y ${units[number % 10]}`;
  if (number === 100) return "CIEN";
  return String(number);
}

function renderHistory() {
  updateListCount("#historyCount", state.history.length, state.history.length, "ultimos registros de historial");
  renderTable("#historyTable", ["Fecha", "Hora", "Usuario", "Accion", "Detalle", "Anterior", "Nuevo"], state.history.map((row) => [
    row.Fecha, row.Hora, row.Usuario, row.Accion, row.Detalle, row.Dato_Anterior, row.Dato_Nuevo
  ]));
}

function renderBackups() {
  updateListCount("#backupsCount", state.backups.length, state.backups.length, "ultimos respaldos");
  renderTable("#backupsTable", ["Fecha", "Hora", "Usuario", "Nombre", "Detalle"], state.backups.map((row) => [
    row.Fecha, row.Hora, row.Usuario, row.Nombre_Backup, row.Detalle
  ]));
}

function fillFilters() {
  fillSelect("#studentCourseFilter", unique([...state.courses.map((c) => c.Curso), ...state.students.map((s) => s.Curso)]), "Todos los cursos");
  fillSelect("#studentParallelFilter", unique([...state.courses.map((c) => c.Paralelo), ...state.students.map((s) => s.Paralelo)]), "Todos los paralelos");
  fillSelect("#studentStatusFilter", unique(state.students.map((s) => s.Estado)), "Todos los estados");
  fillSelect("#gradeGroupFilter", getGradeGroups(), "Todos los grupos");
  fillSelect("#gradeSubjectFilter", state.subjects.map((s) => [s.ID_Materia, s.Nombre_Materia]), "Todas las materias");
  fillSelect("#gradeStatusFilter", ["Aprobado", "Reprobado", "En seguimiento", "Sin completar"], "Todos los estados");
  fillSelect("#noteRecordGroupFilter", getGradeGroups(), "Todos los grupos");
  fillSelect("#noteRecordSubjectFilter", state.subjects.map((s) => [s.ID_Materia, s.Nombre_Materia]), "Todas las materias");
  fillSelect("#noteRecordDimensionFilter", [["Ser", "Ser"], ["Saber", "Saber"], ["Hacer", "Hacer / Practicas"], ["Decidir", "Autoevaluacion"]], "Todas las dimensiones");
  fillSelect("#attendanceGroup", getGradeGroups(), "Seleccione grupo");
  fillSelect("#attendanceSubject", state.subjects.map((s) => [s.ID_Materia, s.Nombre_Materia]), "Seleccione materia");
  fillSelect("#attendanceRecordGroupFilter", getGradeGroups(), "Todos los grupos");
  fillSelect("#attendanceRecordSubjectFilter", state.subjects.map((s) => [s.ID_Materia, s.Nombre_Materia]), "Todas las materias");
  fillSelect("#bulletinCourseFilter", unique([...state.courses.map((c) => c.Curso), ...state.students.map((s) => s.Curso)]), "Curso para boletin");
  fillSelect("#bulletinGroupFilter", getGradeGroups(), "Paralelo para boletin");
  fillSelect("#bulletinSubjectFilter", state.subjects.map((s) => [s.ID_Materia, s.Nombre_Materia]), "Materia para boletin");
}

function openStudentModal(student = {}) {
  const courses = student.Curso ? includeOption(unique(state.courses.map((course) => course.Curso)), student.Curso) : unique(state.courses.map((course) => course.Curso));
  const parallels = student.Paralelo ? includeOption(getParallelsForCourse(student.Curso), student.Paralelo) : getParallelsForCourse(courses[0] || "");
  openModal("Estudiante", [
    field("CI", "CI", student.CI, true),
    field("Codigo_Acceso", "Codigo personal", student.Codigo_Acceso || generateAccessCode(), true),
    field("Nombre", "Nombre completo", student.Nombre, true),
    select("Curso", "Curso", courses.length ? courses : [["", "Registre cursos primero"]], student.Curso || courses[0] || "", true),
    select("Paralelo", "Paralelo", parallels.length ? parallels : [["", "Seleccione un curso"]], student.Paralelo || parallels[0] || "", true),
    select("Estado", "Estado", ["Activo", "Inactivo"], student.Estado || "Activo")
  ], async (values) => saveRecord(student.ID_Estudiante ? "updateStudent" : "addStudent", { student: { ...student, ...values } }), bindStudentCourseSelector);
}

function openSubjectModal(subject = {}) {
  openModal("Materia", [
    field("Nombre_Materia", "Nombre de materia", subject.Nombre_Materia, true),
    field("Docente", "Docente responsable", subject.Docente || state.config.docente, true),
    select("Estado", "Estado", ["Activo", "Inactivo"], subject.Estado || "Activo")
  ], async (values) => saveRecord(subject.ID_Materia ? "updateSubject" : "addSubject", { subject: { ...subject, ...values } }));
}

function openCourseModal(course = {}) {
  openModal("Curso y paralelo", [
    field("Curso", "Curso", course.Curso, true),
    field("Paralelo", "Paralelo", course.Paralelo, true),
    field("Gestion", "Gestion", course.Gestion || state.config.gestion, true),
    select("Estado", "Estado", ["Activo", "Inactivo"], course.Estado || "Activo")
  ], async (values) => saveRecord(course.ID_Curso ? "updateCourse" : "addCourse", { course: { ...course, ...values } }));
}

function openGradeModal(grade = {}) {
  const selectedStudent = getStudent(grade.ID_Estudiante);
  const selectedGroup = grade.Grupo || selectedStudent.Paralelo || getGradeGroups()[0] || "";
  let currentGrade = resolveExistingGradeForSelection({
    ...grade,
    Grupo: selectedGroup,
    Trimestre: grade.Trimestre || "1",
    ID_Estudiante: grade.ID_Estudiante || firstStudentIdForGroup(selectedGroup),
    ID_Materia: grade.ID_Materia || (state.subjects[0] && state.subjects[0].ID_Materia) || ""
  });
  openModal("Registro academico", gradeModalFields(currentGrade), async (values) => {
    const action = currentGrade.ID_Nota ? "updateGrade" : "addGrade";
    return saveRecord(action, { grade: buildGradePayload(currentGrade, values) });
  }, () => bindGradeModalControls((nextGrade) => {
    currentGrade = nextGrade;
  }));
}

function gradeModalFields(grade = {}) {
  const selectedStudent = getStudent(grade.ID_Estudiante);
  const selectedGroup = grade.Grupo || selectedStudent.Paralelo || getGradeGroups()[0] || "";
  const selectedStudentId = grade.ID_Estudiante || firstStudentIdForGroup(selectedGroup);
  const selectedSubjectId = grade.ID_Materia || (state.subjects[0] && state.subjects[0].ID_Materia) || "";
  return [
    select("Grupo", "Grupo", getGradeGroups().length ? getGradeGroups() : ["G1", "G2"], selectedGroup, true),
    select("Trimestre", "Trimestre", [["1", "1er trimestre"], ["2", "2do trimestre"], ["3", "3er trimestre"]], grade.Trimestre || "1", true),
    select("ID_Estudiante", "Estudiante", getStudentsForGroupOptions(selectedGroup, selectedStudentId), selectedStudentId, true),
    select("ID_Materia", "Materia", state.subjects.map((s) => [s.ID_Materia, s.Nombre_Materia]), selectedSubjectId, true),
    gradeItemsField({ ...grade, Grupo: selectedGroup, ID_Estudiante: selectedStudentId, ID_Materia: selectedSubjectId }),
    field("Nota_Final", "Nota final", grade.Nota_Final, false, "number"),
    select("Estado_Academico", "Estado academico", ["Aprobado", "Reprobado", "En seguimiento", "Sin completar"], grade.Estado_Academico || "Sin completar"),
    select("Publicado", "Publicado", ["Si", "No"], grade.Publicado || "No"),
    textarea("Observacion", "Observacion", grade.Observacion)
  ];
}

function bindGradeModalControls(setCurrentGrade) {
  const reloadFromSelection = () => {
    const selected = getSelectedGradeKeys();
    const nextGrade = resolveExistingGradeForSelection(selected);
    setCurrentGrade(nextGrade);
    $("#modalFields").innerHTML = gradeModalFields(nextGrade).join("");
    bindGradeModalControls(setCurrentGrade);
  };
  bindGradeGroupSelector(reloadFromSelection);
  ["Trimestre", "ID_Estudiante", "ID_Materia"].forEach((name) => {
    const input = document.querySelector(`[name="${name}"]`);
    if (input) input.addEventListener("change", reloadFromSelection);
  });
  bindGradeTabs();
  bindAttendanceRows();
  bindPracticeRows();
  bindGradeItemsCalculator();
}

function openModal(title, fields, onSubmit, afterOpen) {
  $("#modalTitle").textContent = title;
  $("#modalFields").innerHTML = fields.join("");
  $("#modalForm").onsubmit = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await onSubmit(values);
    $("#modal").close();
  };
  $("#modal").showModal();
  if (afterOpen) afterOpen();
}

async function saveRecord(action, payload) {
  try {
    await api(action, payload);
    academicRecordsLoaded = false;
    await refreshAll();
  } catch (error) {
    setMessage(error.message, "error");
  }
}

async function saveGradeWithItems(grade, items) {
  const payload = {
    ...grade,
    Detalle_Registro: JSON.stringify(items),
    Tipo_Registro: ""
  };
  roundGradePayload(payload);
  await saveRecord(payload.ID_Nota ? "updateGrade" : "addGrade", { grade: payload });
}

async function saveGradeWithItemsQuiet(grade, items) {
  const payload = {
    ...grade,
    Detalle_Registro: JSON.stringify(items),
    Tipo_Registro: ""
  };
  roundGradePayload(payload);
  await api(payload.ID_Nota ? "updateGrade" : "addGrade", { grade: payload });
  academicRecordsLoaded = false;
}

async function saveGroupedGradeChanges(grouped, buildItems) {
  const entries = Object.values(grouped);
  await runInBatches(entries, 4, ({ grade, records }) => saveGradeWithItemsQuiet(grade, buildItems(grade, records)));
}

function groupRecordsByGrade(records) {
  return records.reduce((acc, record) => {
    const id = record.grade.ID_Nota || `${record.grade.ID_Estudiante}|${record.grade.ID_Materia}|${record.grade.Grupo}|${record.grade.Trimestre}`;
    if (!acc[id]) acc[id] = { grade: record.grade, records: [] };
    acc[id].records.push(record);
    return acc;
  }, {});
}

function uniqueGrades(grades) {
  const seen = new Set();
  return grades.filter((grade) => {
    const id = String(grade.ID_Nota || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

async function deleteRecord(action, label, id) {
  if (!confirm(`¿Esta seguro de eliminar este ${label}? Esta accion no se puede deshacer.`)) return;
  await saveRecord(action, { id });
}

async function updatePublish(grade) {
  await saveRecord("updateGrade", { grade: { ...grade, Publicado: grade.Publicado === "Si" ? "No" : "Si" } });
}

async function bulkPublish(mode) {
  const published = mode === "publishAll" ? "Si" : "No";
  if (!confirm(`¿Desea ${published === "Si" ? "publicar" : "despublicar"} todas las notas?`)) return;
  await saveRecord("bulkPublish", { published });
}

async function saveSettings() {
  const config = Object.fromEntries(new FormData($("#settingsForm")).entries());
  await saveRecord("updateConfig", { config });
}

async function resetSettings() {
  if (!confirm("¿Restaurar configuracion institucional por defecto?")) return;
  await saveRecord("resetConfig", {});
}

async function createBackup() {
  await saveRecord("createBackup", {});
}

async function clearHistory() {
  if (!confirm("¿Desea borrar el historial? Se conservara solo el registro de esta limpieza.")) return;
  await saveRecord("clearHistory", {});
}

async function logout() {
  try { await api("logout"); } catch (error) { console.warn(error.message); }
  sessionStorage.clear();
  location.replace("login.html");
}

function exportReportCsv() {
  const rows = [["Nro.", "CI", "Nombre", "Curso", "Grupo", "Trimestre", "Materia", "Ser", "Saber", "Hacer", "Autoevaluacion", "Nota Final", "Asistencia", "Practicas", "Otros", "Estado", "Publicado"]];
  state.grades.forEach((grade, index) => {
    const student = getStudent(grade.ID_Estudiante);
    rows.push([index + 1, student.CI, student.Nombre, student.Curso, getGradeGroup(grade, student), trimesterLabel(grade.Trimestre), getSubject(grade.ID_Materia).Nombre_Materia, grade.Ser_Aporte, grade.Saber_Aporte, grade.Hacer_Aporte, grade.Decidir_Aporte, grade.Nota_Final, grade.Asistencia, grade.Practicas, grade.Otros_Registros, grade.Estado_Academico, grade.Publicado]);
  });
  const csv = rows.map((row) => row.map((cell) => `"${String(cell || "").replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `reporte_${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderTable(selector, headers, rows) {
  const numberedHeaders = ["Nro.", ...headers];
  const table = $(selector);
  table.innerHTML = `<thead><tr>${numberedHeaders.map((h, index) => `<th class="${tableCellClass(h, index)}">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row, index) => `<tr><td class="row-number" data-label="Nro.">${index + 1}</td>${row.map((cell, cellIndex) => {
    const header = headers[cellIndex];
    return `<td class="${tableCellClass(header, cellIndex + 1)}" data-label="${escapeHtml(header)}">${cell ?? ""}</td>`;
  }).join("")}</tr>`).join("")}</tbody>`;
}

function updateListCount(selector, visible, total, label) {
  const element = $(selector);
  if (!element) return;
  element.textContent = visible === total
    ? `Total: ${total} ${label}.`
    : `Mostrando ${visible} de ${total} ${label}.`;
}

function actions(items) {
  const id = `a${Math.random().toString(36).slice(2)}`;
  queueMicrotask(() => {
    items.forEach(([label, handler], index) => {
      const button = document.querySelector(`[data-action="${id}-${index}"]`);
      if (button) button.addEventListener("click", handler);
    });
    const toggle = document.querySelector(`[data-action-menu="${id}"]`);
    if (toggle) {
      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        closeFloatingActionMenus();
        toggle.closest(".action-menu").classList.toggle("open");
      });
    }
  });
  return `<span class="actions action-menu">
    <button class="action-menu-toggle" data-action-menu="${id}" type="button" aria-label="Abrir acciones">&#8942;</button>
    <span class="action-menu-list">${items.map(([label], index) => `<button class="${actionClass(label)}" data-action="${id}-${index}" type="button" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"><span class="action-icon" aria-hidden="true">${actionIcon(label)}</span><span class="action-label">${escapeHtml(label)}</span></button>`).join("")}</span>
  </span>`;
}

function toggleNavigation() {
  if (window.matchMedia("(max-width: 900px)").matches) {
    $("#sidebar").classList.toggle("open");
    return;
  }
  document.body.classList.toggle("sidebar-collapsed");
}

function toggleGradeFilters() {
  const panel = $("#gradeFilters");
  const expanded = panel.classList.toggle("open");
  $("#gradeFilterToggle").setAttribute("aria-expanded", String(expanded));
}

function closeFloatingActionMenus(event) {
  if (event && event.target.closest(".action-menu")) return;
  $$(".action-menu.open").forEach((menu) => menu.classList.remove("open"));
}

function tableCellClass(header, index) {
  const classes = [];
  if (index === 0) classes.push("row-number");
  if (header === "Nombre") classes.push("sticky-name");
  if (header === "Acciones") classes.push("actions-cell", "sticky-actions");
  return classes.join(" ");
}

function actionClass(label) {
  const key = normalizeKey(label);
  if (key.includes("eliminar")) return "icon-action danger-action";
  if (key.includes("publicar") || key.includes("despublicar")) return "icon-action publish-action";
  return "icon-action";
}

function actionIcon(label) {
  const key = normalizeKey(label);
  if (key.includes("ver")) return "&#128065;";
  if (key.includes("editar")) return "&#9998;";
  if (key.includes("eliminar")) return "&#128465;";
  if (key.includes("despublicar")) return "&#8635;";
  if (key.includes("publicar")) return "&#10003;";
  return "&#8226;";
}

async function runInBatches(items, size, task) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(task));
  }
}

function field(name, label, value = "", required = false, type = "text") {
  const step = type === "number" ? 'step="0.01"' : "";
  return `<label>${label}<input name="${name}" type="${type}" ${step} value="${escapeHtml(value || "")}" placeholder="${escapeHtml(label)}" ${required ? "required" : ""}></label>`;
}

function textarea(name, label, value = "") {
  return `<label class="full">${label}<textarea name="${name}">${escapeHtml(value || "")}</textarea></label>`;
}

function gradeItemsField(grade = {}) {
  const attendance = normalizeAttendance(grade);
  const practices = normalizePractices(grade);
  const dimensionTabs = [
    ["ser", "Ser", "Ser / 10"],
    ["saber", "Saber", "Saber / 45"],
    ["hacer", "Hacer", "Hacer / 40"],
    ["autoevaluacion", "Decidir", "Autoevaluacion / 5"]
  ];
  return `<fieldset class="full grade-items">
    <legend>Registro por dimensiones</legend>
    <div class="grade-tabs" role="tablist">
      <button class="grade-tab active" type="button" data-grade-tab="attendance">Asistencia</button>
      <button class="grade-tab" type="button" data-grade-tab="practices">Practicas</button>
      ${dimensionTabs.map(([key, , label]) => `<button class="grade-tab" type="button" data-grade-tab="${key}">${label}</button>`).join("")}
    </div>
    <section class="grade-tab-panel active" data-grade-panel="attendance">
      <div class="attendance-board">
        <div class="attendance-board-head">
          <span>Nro.</span>
          <span>Fecha</span>
          <span>Actividad</span>
          <span>Asistencia</span>
          <span>Faltas</span>
          <span>Retrasos</span>
          <span>Licencias</span>
          <span></span>
        </div>
        <div id="attendanceRows">
          ${attendance.entries.map((item, index) => attendanceRowTemplate(index, item)).join("")}
        </div>
        <div class="attendance-board-total">
          <span>Totales</span>
          <span></span>
          <span>Dias: <strong id="attendanceWorkedDays">-</strong></span>
          <span>A: <strong id="attendanceCountA">-</strong></span>
          <span>F: <strong id="attendanceCountF">-</strong></span>
          <span>R: <strong id="attendanceCountR">-</strong></span>
          <span>L: <strong id="attendanceCountL">-</strong></span>
          <span><strong id="attendanceScoreDisplay">-</strong></span>
        </div>
      </div>
      <input name="att_asistencia" type="hidden" value="${escapeHtml(attendance.asistencia)}">
      <input name="att_faltas" type="hidden" value="${escapeHtml(attendance.faltas)}">
      <input name="att_retrasos" type="hidden" value="${escapeHtml(attendance.retrasos)}">
      <input name="att_licencias" type="hidden" value="${escapeHtml(attendance.licencias)}">
      <button id="addAttendanceRow" class="inline-add-button" type="button">Agregar fecha</button>
      <p id="dimensionTotal_attendance" class="dimension-total">Total Ser / 10: -</p>
      <p class="dimension-note">Calificacion = redondear(((A + L) / (A + L + F + entero(R / 3))) * 10).</p>
    </section>
    <section class="grade-tab-panel" data-grade-panel="practices">
      <div class="grade-items-head grade-practice-head"><span>Practica</span><span>Fecha</span><span>Valor</span><span>Sobre</span><span>Dimension</span><span></span></div>
      <div id="practiceRows">
        ${practices.map((item, index) => practiceRowTemplate(index, item)).join("")}
      </div>
      <button id="addPracticeRow" class="inline-add-button" type="button">Agregar practica</button>
      <p id="practiceTotal" class="dimension-total">Total practicas: ${formatNumber(calculatePracticeTotalFromItems(practices))}</p>
      <p class="dimension-note">Las practicas se ponderan automaticamente dentro de Hacer / 40.</p>
    </section>
    ${dimensionTabs.map(([key, dimension, label]) => dimensionEntriesField(grade, key, dimension, label)).join("")}
  </fieldset>`;
}

function attendanceRowTemplate(index, item = {}) {
  const status = normalizeAttendanceStatus(item.valor || item.estado || "A");
  return `<div class="attendance-board-row">
    <span class="row-number">${index + 1}</span>
    <input name="att_fecha_${index}" type="date" value="${escapeHtml(item.fecha || "")}" title="Fecha de asistencia">
    <select name="att_estado_${index}" title="Actividad">
      ${["A", "F", "R", "L"].map((value) => `<option value="${value}" ${status === value ? "selected" : ""}>${value} - ${attendanceStatusLabel(value)}</option>`).join("")}
    </select>
    <span data-att-mark="A">${status === "A" ? "A" : ""}</span>
    <span data-att-mark="F">${status === "F" ? "F" : ""}</span>
    <span data-att-mark="R">${status === "R" ? "R" : ""}</span>
    <span data-att-mark="L">${status === "L" ? "L" : ""}</span>
    <button class="row-remove" type="button" data-remove-row aria-label="Quitar asistencia">×</button>
  </div>`;
}

function practiceRowTemplate(index, item = {}) {
  const practice = splitPracticeValue(item);
  return `<div class="grade-item-row grade-practice-row">
    <input name="practice_titulo_${index}" type="text" value="${escapeHtml(item.titulo || "")}" placeholder="Ej. Practica ${index + 1}">
    <input name="practice_fecha_${index}" type="date" value="${escapeHtml(item.fecha || "")}" title="Fecha de la practica">
    <input name="practice_valor_${index}" type="number" min="0" max="100" step="0.01" value="${escapeHtml(practice.valor)}" placeholder="Valor">
    <input name="practice_sobre_${index}" type="number" min="0" max="100" step="0.01" value="${escapeHtml(practice.sobre)}" placeholder="Sobre">
    <span class="dimension-pill">Hacer</span>
    <button class="row-remove" type="button" data-remove-row aria-label="Quitar practica">×</button>
  </div>`;
}

function dimensionEntriesField(grade, key, dimension, label) {
  const entries = normalizeDimensionEntries(grade, key, dimension);
  const fixedRows = key === "ser" ? dimensionAttendanceRowTemplate(label) : "";
  return `<section class="grade-tab-panel" data-grade-panel="${key}">
    <div class="grade-items-head"><span>Detalle</span><span>Valor</span><span>Dimension</span><span></span></div>
    ${fixedRows}
    ${entries.map((item, index) => dimensionEntryRowTemplate(item, index, key, label)).join("")}
    <p id="dimensionTotal_${key}" class="dimension-total">Total ${label}: -</p>
    <p class="dimension-note">Estos valores se suman dentro de ${label}.</p>
  </section>`;
}

function dimensionAttendanceRowTemplate(label) {
  return `<div class="grade-item-row">
    <input type="text" value="Nota asistencia" readonly>
    <input id="attendanceTotalSer" type="number" value="" readonly>
    <span class="dimension-pill">${label}</span>
  </div>`;
}

function dimensionEntryRowTemplate(item, index, key, label) {
  if (item.tipo === "practicas_total") {
    return `<div class="grade-item-row">
      <input type="text" value="${escapeHtml(item.titulo)}" readonly>
      <input id="practiceTotalHacer" type="number" value="${escapeHtml(item.valor)}" readonly>
      <span class="dimension-pill">${label}</span>
    </div>`;
  }
  return `<div class="grade-item-row">
    <input name="dim_${key}_titulo_${index}" type="text" value="${escapeHtml(item.titulo)}" placeholder="${escapeHtml(dimensionEntryPlaceholder(key, index, label))}">
    <input name="dim_${key}_valor_${index}" type="number" min="0" max="100" step="0.01" value="${escapeHtml(item.valor)}" placeholder="Valor">
    <span class="dimension-pill">${label}</span>
    <button class="row-remove" type="button" data-remove-row aria-label="Quitar registro">×</button>
  </div>`;
}

function dimensionEntryPlaceholder(key, index, label) {
  const suggestions = {
    ser: ["Ej. Responsabilidad", "Ej. Participacion", "Ej. Respeto"],
    saber: ["Ej. Examen", "Ej. Cuadernos", "Ej. Tripticos"],
    hacer: ["Ej. Cuestionarios", "Ej. Uso de herramientas", "Ej. Proyecto"],
    autoevaluacion: ["Ej. Autoevaluacion", "Ej. Reflexion", "Ej. Compromiso"]
  };
  const suggestionIndex = key === "hacer" ? index - 1 : index;
  return (suggestions[key] && suggestions[key][suggestionIndex]) || `Ej. ${label}`;
}

function select(name, label, options, value = "", required = false) {
  return `<label>${label}<select name="${name}" ${required ? "required" : ""}>${options.map((option) => {
    const val = Array.isArray(option) ? option[0] : option;
    const text = Array.isArray(option) ? option[1] : option;
    return `<option value="${escapeHtml(val)}" ${String(val) === String(value) ? "selected" : ""}>${escapeHtml(text)}</option>`;
  }).join("")}</select></label>`;
}

function bindStudentCourseSelector() {
  const courseSelect = document.querySelector('[name="Curso"]');
  const parallelSelect = document.querySelector('[name="Paralelo"]');
  if (!courseSelect || !parallelSelect) return;
  courseSelect.addEventListener("change", () => {
    const parallels = getParallelsForCourse(courseSelect.value);
    parallelSelect.innerHTML = (parallels.length ? parallels : [["", "Sin paralelos registrados"]]).map((option) => {
      const val = Array.isArray(option) ? option[0] : option;
      const text = Array.isArray(option) ? option[1] : option;
      return `<option value="${escapeHtml(val)}">${escapeHtml(text)}</option>`;
    }).join("");
  });
}

function bindGradeGroupSelector(afterChange) {
  const groupSelect = document.querySelector('[name="Grupo"]');
  const studentSelect = document.querySelector('[name="ID_Estudiante"]');
  if (!groupSelect || !studentSelect) return;
  groupSelect.addEventListener("change", () => {
    studentSelect.innerHTML = getStudentsForGroupOptions(groupSelect.value).map(([value, text]) =>
      `<option value="${escapeHtml(value)}">${escapeHtml(text)}</option>`
    ).join("");
    if (afterChange) afterChange();
  });
}

function bindGradeItemsCalculator() {
  const itemsContainer = document.querySelector(".grade-items");
  const finalInput = document.querySelector('[name="Nota_Final"]');
  const calculate = () => {
    if (!finalInput) return;
    const items = collectGradeItemsFromForm();
    updatePracticeTotalDisplays(calculatePracticeTotalFromItems(items));
    updateDimensionTotalDisplays(items);
    const finalValue = calculateDimensionFinal(items);
    if (finalValue !== "") finalInput.value = finalValue;
  };
  if (itemsContainer) {
    itemsContainer.addEventListener("input", calculate);
    itemsContainer.addEventListener("change", calculate);
    itemsContainer.addEventListener("click", (event) => {
      const remove = event.target.closest("[data-remove-row]");
      if (!remove) return;
      const row = remove.closest(".grade-item-row, .attendance-board-row");
      if (row) row.remove();
      calculate();
    });
  }
  if (finalInput) {
    finalInput.addEventListener("input", calculate);
    finalInput.addEventListener("change", calculate);
  }
  calculate();
}

function bindPracticeRows() {
  const rows = document.querySelector("#practiceRows");
  const addButton = document.querySelector("#addPracticeRow");
  if (!rows || !addButton) return;
  addButton.addEventListener("click", () => {
    const index = rows.querySelectorAll(".grade-item-row").length;
    rows.insertAdjacentHTML("beforeend", practiceRowTemplate(index));
    const newInput = rows.querySelector(`[name="practice_titulo_${index}"]`);
    if (newInput) newInput.focus();
  });
}

function bindAttendanceRows() {
  const rows = document.querySelector("#attendanceRows");
  const addButton = document.querySelector("#addAttendanceRow");
  if (!rows || !addButton) return;
  const refreshMarks = (row) => {
    const status = normalizeAttendanceStatus(row.querySelector("select")?.value || "A");
    row.querySelectorAll("[data-att-mark]").forEach((mark) => {
      mark.textContent = mark.dataset.attMark === status ? status : "";
    });
  };
  rows.querySelectorAll(".attendance-board-row").forEach(refreshMarks);
  rows.addEventListener("change", (event) => {
    const row = event.target.closest(".attendance-board-row");
    if (row) refreshMarks(row);
  });
  addButton.addEventListener("click", () => {
    const index = rows.querySelectorAll(".attendance-board-row").length;
    rows.insertAdjacentHTML("beforeend", attendanceRowTemplate(index, { valor: "A" }));
    const newInput = rows.querySelector(`[name="att_fecha_${index}"]`);
    if (newInput) newInput.focus();
  });
}

function normalizeAttendanceStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  return ["A", "F", "R", "L"].includes(status) ? status : "A";
}

function attendanceStatusLabel(value) {
  return {
    A: "Asistencia",
    F: "Falta",
    R: "Retraso",
    L: "Licencia"
  }[normalizeAttendanceStatus(value)] || "Asistencia";
}

function collectAttendanceEntries(values) {
  return Array.from(new Set(Object.keys(values).map((key) => {
    const match = /^att_(?:fecha|estado)_(\d+)$/.exec(key);
    return match ? Number(match[1]) : null;
  }).filter((index) => index !== null))).sort((a, b) => a - b).map((index) => ({
    fecha: String(values[`att_fecha_${index}`] || "").trim(),
    estado: normalizeAttendanceStatus(values[`att_estado_${index}`])
  })).filter((item) => item.fecha);
}

function calculateAttendanceTotals(entries) {
  const totals = { asistencia: 0, faltas: 0, retrasos: 0, licencias: 0 };
  entries.forEach((item) => {
    const status = normalizeAttendanceStatus(item.estado || item.valor);
    if (status === "A") totals.asistencia += 1;
    if (status === "F") totals.faltas += 1;
    if (status === "R") totals.retrasos += 1;
    if (status === "L") totals.licencias += 1;
  });
  return totals;
}

function bindGradeTabs() {
  $$(".grade-tab").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.gradeTab;
      $$(".grade-tab").forEach((item) => item.classList.toggle("active", item === button));
      $$(".grade-tab-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.gradePanel === tab));
    });
  });
}

function fillSelect(selector, values, placeholder) {
  const current = $(selector).value;
  $(selector).innerHTML = `<option value="">${placeholder}</option>${values.map((value) => {
    const val = Array.isArray(value) ? value[0] : value;
    const text = Array.isArray(value) ? value[1] : value;
    return `<option value="${escapeHtml(val)}">${escapeHtml(text)}</option>`;
  }).join("")}`;
  $(selector).value = current;
}

function getStudent(id) {
  return state.students.find((student) => student.ID_Estudiante === id) || {};
}

function getSubject(id) {
  return state.subjects.find((subject) => subject.ID_Materia === id) || {};
}

function buildGradePayload(grade, values) {
  const items = collectGradeItemsFromValues(values);
  const payload = { ...grade, ...values, Detalle_Registro: JSON.stringify(items), Tipo_Registro: "" };
  Object.keys(payload).forEach((key) => {
    if (/^(item_|att_|practice_|attendance_to_ser|dim_)/.test(key)) delete payload[key];
  });
  payload.Practica_1 = "";
  payload.Practica_2 = "";
  payload.Practica_3 = "";
  payload.Practica_4 = "";
  roundGradePayload(payload);
  return payload;
}

function roundGradePayload(payload) {
  ["Ser_Promedio", "Ser_Aporte", "Saber_Promedio", "Saber_Aporte", "Hacer_Promedio", "Hacer_Aporte", "Decidir_Promedio", "Decidir_Aporte", "Nota_Final"].forEach((key) => {
    if (payload[key] !== "" && payload[key] !== undefined && payload[key] !== null) {
      const value = Number(payload[key]);
      if (!Number.isNaN(value)) payload[key] = String(Math.round(value));
    }
  });
}

function trimesterLabel(value) {
  return { 1: "1er", 2: "2do", 3: "3er" }[String(value || "1")] || `${value}`;
}

function collectGradeItemsFromForm() {
  return collectGradeItemsFromValues(Object.fromEntries(new FormData($("#modalForm")).entries()));
}

function collectGradeItemsFromValues(values) {
  const items = [];
  const attendanceEntries = collectAttendanceEntries(values);
  const attendance = attendanceEntries.length
    ? calculateAttendanceTotals(attendanceEntries)
    : {
      asistencia: numberOrBlank(values.att_asistencia),
      faltas: numberOrBlank(values.att_faltas),
      retrasos: numberOrBlank(values.att_retrasos),
      licencias: numberOrBlank(values.att_licencias)
    };

  attendanceEntries.forEach((item, index) => {
    items.push({
      tipo: "asistencia_dia",
      dimension: "",
      titulo: item.fecha || `Fecha ${index + 1}`,
      fecha: item.fecha,
      valor: item.estado,
      promedia: false
    });
  });
  ["asistencia", "faltas", "retrasos", "licencias"].forEach((key) => {
    if (attendance[key] !== "") {
      items.push({ tipo: "asistencia", dimension: "", titulo: attendanceLabel(key), valor: attendance[key], promedia: false });
    }
  });

  const attendanceScore = calculateAttendanceScore(attendance);
  if (attendanceScore !== "") {
    items.push({ tipo: "asistencia_ser", dimension: "Ser", titulo: "Nota asistencia", valor: attendanceScore, promedia: true });
  }

  const practiceIndexes = Array.from(new Set(Object.keys(values).map((key) => {
    const match = /^practice_(?:titulo|fecha|valor|sobre)_(\d+)$/.exec(key);
    return match ? Number(match[1]) : null;
  }).filter((index) => index !== null))).sort((a, b) => a - b);

  practiceIndexes.forEach((index) => {
    const titulo = String(values[`practice_titulo_${index}`] || "").trim();
    const fecha = String(values[`practice_fecha_${index}`] || "").trim();
    const valor = String(values[`practice_valor_${index}`] || "").trim();
    const sobre = String(values[`practice_sobre_${index}`] || "").trim();
    if (titulo || fecha || valor || sobre) {
      const storedValue = sobre && valor ? `${valor}/${sobre}` : valor;
      items.push({ tipo: "practica", dimension: "", titulo: titulo || `Practica ${index + 1}`, fecha, valor: storedValue, sobre, promedia: false });
    }
  });
  const practiceTotal = calculatePracticeTotalFromItems(items);
  if (practiceTotal !== "") {
    items.push({ tipo: "practicas_total", dimension: "Hacer", titulo: "Total practicas", valor: formatNumber(practiceTotal), promedia: true });
  }

  [
    ["ser", "Ser"],
    ["saber", "Saber"],
    ["hacer", "Hacer"],
    ["autoevaluacion", "Decidir"]
  ].forEach(([key, dimension]) => {
    const dimensionIndexes = Array.from(new Set(Object.keys(values).map((fieldName) => {
      const match = new RegExp(`^dim_${key}_(?:titulo|valor)_(\\d+)$`).exec(fieldName);
      return match ? Number(match[1]) : null;
    }).filter((index) => index !== null))).sort((a, b) => a - b);
    dimensionIndexes.forEach((index) => {
      const titulo = String(values[`dim_${key}_titulo_${index}`] || "").trim();
      const valor = String(values[`dim_${key}_valor_${index}`] || "").trim();
      if (titulo || valor) {
        items.push({ tipo: `dimension_${key}`, dimension, titulo: titulo || dimensionLabel(dimension), valor, promedia: true });
      }
    });
  });

  return items;
}

function normalizeGradeItems(grade) {
  const parsed = parseGradeItems(grade.Detalle_Registro);
  const legacy = [
    ["Practica 1", grade.Practica_1],
    ["Practica 2", grade.Practica_2],
    ["Practica 3", grade.Practica_3],
    ["Practica 4", grade.Practica_4]
  ].filter(([, value]) => value !== "" && value !== undefined).map(([titulo, valor]) => ({ dimension: "Hacer", titulo, valor, promedia: true }));
  const base = parsed.length ? parsed : legacy;
  while (base.length < 6) base.push({ dimension: "", titulo: "", valor: "", promedia: false });
  return base.slice(0, 6);
}

function normalizeAttendance(grade) {
  const items = parseGradeItems(grade.Detalle_Registro);
  const entries = items
    .filter((item) => item.tipo === "asistencia_dia")
    .map((item) => ({ fecha: item.fecha || item.titulo || "", valor: normalizeAttendanceStatus(item.valor) }));
  const get = (title) => {
    const item = items.find((row) => normalizeKey(row.titulo) === normalizeKey(title) && row.tipo !== "asistencia_ser");
    return item ? item.valor : "";
  };
  const totals = entries.length ? calculateAttendanceTotals(entries.map((item) => ({ estado: item.valor }))) : {
    asistencia: get("Asistencia"),
    faltas: get("Faltas"),
    retrasos: get("Retrasos"),
    licencias: get("Licencias")
  };
  return {
    ...totals,
    entries: entries.length ? entries : [{ valor: "A" }, { valor: "A" }, { valor: "A" }, { valor: "A" }, { valor: "A" }]
  };
}

function normalizePractices(grade) {
  const items = parseGradeItems(grade.Detalle_Registro).filter((item) => item.tipo === "practica" || (!item.tipo && item.dimension === "Hacer"));
  const legacy = [
    ["Practica 1", grade.Practica_1],
    ["Practica 2", grade.Practica_2],
    ["Practica 3", grade.Practica_3],
    ["Practica 4", grade.Practica_4]
  ].filter(([, value]) => value !== "" && value !== undefined).map(([titulo, valor]) => ({ titulo, valor, sobre: "" }));
  const base = items.length ? items : legacy;
  while (base.length < 6) base.push({ titulo: "", valor: "" });
  return base;
}

function normalizeDimensionEntries(grade, key, dimension) {
  const items = parseGradeItems(grade.Detalle_Registro).filter((item) =>
    item.tipo === `dimension_${key}` ||
    (!item.tipo && item.dimension === dimension && !isLegacyPracticeTitle(item.titulo)) ||
    (key === "hacer" && item.tipo === "practicas_total")
  );
  if (key === "hacer" && !items.some((item) => item.tipo === "practicas_total")) {
    items.unshift({ tipo: "practicas_total", titulo: "Total practicas", valor: formatNumber(calculatePracticeTotalFromItems(normalizePractices(grade))) });
  }
  while (items.length < 4) items.push({ titulo: "", valor: "" });
  return key === "hacer" ? items.slice(0, 5) : items.slice(0, 4);
}

function parseGradeItems(raw) {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      tipo: item.tipo || "",
      dimension: item.dimension || "",
      titulo: item.titulo || "",
      fecha: item.fecha || "",
      valor: item.valor === undefined || item.valor === null ? "" : item.valor,
      sobre: item.sobre === undefined || item.sobre === null ? "" : item.sobre,
      promedia: Boolean(item.promedia || item.dimension)
    }));
  } catch (error) {
    return [];
  }
}

function summarizeGradeItems(grade) {
  const items = parseGradeItems(grade.Detalle_Registro);
  if (!items.length) return "-";
  return items.map((item) => {
    const value = formatPracticeDisplay(item);
    const date = item.fecha ? ` (${item.fecha})` : "";
    return `${escapeHtml(item.dimension || "Sin dimension")} - ${escapeHtml(item.titulo || "Registro")}${escapeHtml(date)}: ${escapeHtml(value)}`;
  }).join("<br>");
}

function calculateDimensionFinal(items) {
  const subtotal = Object.keys(DIMENSION_WEIGHTS).reduce((acc, dimension) => {
    const total = calculateDimensionTotal(items, dimension);
    return acc + (total === "" ? 0 : total);
  }, 0);
  return subtotal > 0 ? String(Math.round(subtotal)) : "";
}

function calculateDimensionTotal(items, dimension) {
  const values = items
    .filter((item) => item.dimension === dimension)
      .map((item) => Number(item.valor))
      .filter((value) => !Number.isNaN(value));
  if (!values.length) return "";
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.min(DIMENSION_WEIGHTS[dimension], Math.round(average));
}

function calculatePracticeTotalFromItems(items) {
  let scoreTotal = 0;
  let maxTotal = 0;
  let legacyTotal = 0;
  items
    .filter((item) => item.tipo === "practica" || (!item.tipo && isLegacyPracticeTitle(item.titulo)))
    .forEach((item) => {
      const score = practiceScoreValue(item.valor);
      if (Number.isNaN(score)) return;
      const max = practiceMaxValue(item);
      if (!Number.isNaN(max) && max > 0) {
        scoreTotal += Math.min(score, max);
        maxTotal += max;
      } else {
        legacyTotal += score;
      }
    });
  if (maxTotal > 0) return Math.min(40, (scoreTotal / maxTotal) * 40 + legacyTotal);
  const total = Math.min(40, legacyTotal);
  return total > 0 ? total : "";
}

function updatePracticeTotalDisplays(total) {
  const formatted = formatNumber(total);
  const practiceTotal = document.querySelector("#practiceTotal");
  const hacerTotal = document.querySelector("#practiceTotalHacer");
  if (practiceTotal) practiceTotal.textContent = `Total practicas: ${formatted}`;
  if (hacerTotal) hacerTotal.value = formatted === "-" ? "" : formatted;
}

function updateDimensionTotalDisplays(items) {
  const attendanceTotal = document.querySelector("#attendanceTotalSer");
  const attendanceItem = items.find((item) => item.tipo === "asistencia_ser");
  if (attendanceTotal) attendanceTotal.value = attendanceItem ? formatNumber(attendanceItem.valor) : "";
  const attendance = normalizeAttendanceFromItems(items);
  const workedDays = document.querySelector("#attendanceWorkedDays");
  const scoreDisplay = document.querySelector("#attendanceScoreDisplay");
  const countA = document.querySelector("#attendanceCountA");
  const countF = document.querySelector("#attendanceCountF");
  const countR = document.querySelector("#attendanceCountR");
  const countL = document.querySelector("#attendanceCountL");
  if (workedDays) workedDays.textContent = formatNumber(calculateAttendanceWorkedDays(attendance));
  if (scoreDisplay) scoreDisplay.textContent = attendanceItem ? formatNumber(attendanceItem.valor) : "-";
  if (countA) countA.textContent = formatNumber(attendance.asistencia);
  if (countF) countF.textContent = formatNumber(attendance.faltas);
  if (countR) countR.textContent = formatNumber(attendance.retrasos);
  if (countL) countL.textContent = formatNumber(attendance.licencias);
  [
    ["attendance", "Ser", "Ser / 10"],
    ["ser", "Ser", "Ser / 10"],
    ["saber", "Saber", "Saber / 45"],
    ["hacer", "Hacer", "Hacer / 40"],
    ["autoevaluacion", "Decidir", "Autoevaluacion / 5"]
  ].forEach(([key, dimension, label]) => {
    const target = document.querySelector(`#dimensionTotal_${key}`);
    if (target) target.textContent = `Total ${label}: ${formatNumber(calculateDimensionTotal(items, dimension))}`;
  });
}

function formatNumber(value) {
  if (value === "" || value === undefined || value === null) return "-";
  const number = Number(value);
  if (Number.isNaN(number)) return "-";
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

function splitPracticeValue(item = {}) {
  const rawValue = item.valor === undefined || item.valor === null ? "" : String(item.valor);
  const rawMax = item.sobre === undefined || item.sobre === null ? "" : String(item.sobre);
  if (!rawValue.includes("/")) return { valor: rawValue, sobre: rawMax };
  const [valor, sobre] = rawValue.split("/");
  return {
    valor: String(valor || "").trim(),
    sobre: String(rawMax || sobre || "").trim()
  };
}

function formatPracticeDisplay(item = {}) {
  const rawValue = item.valor === undefined || item.valor === null ? "" : String(item.valor);
  if (rawValue.includes("/")) return rawValue || "-";
  return item.sobre ? `${rawValue || "-"}/${item.sobre}` : (rawValue || "-");
}

function practiceScoreValue(value) {
  const raw = String(value === undefined || value === null ? "" : value).trim();
  const score = raw.includes("/") ? raw.split("/")[0] : raw;
  return Number(score);
}

function practiceMaxValue(item = {}) {
  const rawMax = item.sobre === undefined || item.sobre === null || item.sobre === "" ? "" : String(item.sobre);
  if (rawMax) return Number(rawMax);
  const rawValue = String(item.valor === undefined || item.valor === null ? "" : item.valor).trim();
  return rawValue.includes("/") ? Number(rawValue.split("/")[1]) : NaN;
}

function calculateAttendanceScore(attendance) {
  const asistencia = Number(attendance.asistencia) || 0;
  const faltas = Number(attendance.faltas) || 0;
  const retrasos = Number(attendance.retrasos) || 0;
  const licencias = Number(attendance.licencias) || 0;
  const total = calculateAttendanceWorkedDays({ asistencia, faltas, retrasos, licencias });
  if (!total) return "";
  return String(Math.round(((asistencia + licencias) / total) * 10));
}

function calculateAttendanceWorkedDays(attendance) {
  const asistencia = Number(attendance.asistencia) || 0;
  const faltas = Number(attendance.faltas) || 0;
  const retrasos = Number(attendance.retrasos) || 0;
  const licencias = Number(attendance.licencias) || 0;
  return asistencia + licencias + faltas + Math.floor(retrasos / 3);
}

function normalizeAttendanceFromItems(items) {
  const get = (title) => {
    const item = items.find((row) => row.tipo === "asistencia" && normalizeKey(row.titulo) === normalizeKey(title));
    return item ? item.valor : "";
  };
  return {
    asistencia: get("Asistencia"),
    faltas: get("Faltas"),
    retrasos: get("Retrasos"),
    licencias: get("Licencias")
  };
}

function attendanceLabel(key) {
  return { asistencia: "Asistencia", faltas: "Faltas", retrasos: "Retrasos", licencias: "Licencias" }[key] || key;
}

function dimensionLabel(dimension) {
  return { Ser: "Ser", Saber: "Saber", Hacer: "Hacer", Decidir: "Autoevaluacion" }[dimension] || dimension;
}

function isLegacyPracticeTitle(value) {
  return /^practica\s+\d+$/i.test(normalizeKey(value));
}

function numberOrBlank(value) {
  return value === undefined || value === null || String(value).trim() === "" ? "" : String(value).trim();
}

function dateFromTimestamp(value) {
  const text = String(value || "").trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text) || /^(\d{1,2}\/\d{1,2}\/\d{4})/.exec(text);
  return match ? match[1] : "";
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getGradeGroup(grade, student = {}) {
  return grade.Grupo || student.Paralelo || "";
}

function getSelectedGradeKeys() {
  return {
    Grupo: document.querySelector('[name="Grupo"]')?.value || "",
    Trimestre: document.querySelector('[name="Trimestre"]')?.value || "1",
    ID_Estudiante: document.querySelector('[name="ID_Estudiante"]')?.value || "",
    ID_Materia: document.querySelector('[name="ID_Materia"]')?.value || ""
  };
}

function resolveExistingGradeForSelection(selection = {}) {
  if (selection.ID_Nota) return selection;
  const group = selection.Grupo || getGradeGroup(selection, getStudent(selection.ID_Estudiante));
  const existing = state.grades.find((grade) =>
    grade.ID_Estudiante === selection.ID_Estudiante &&
    grade.ID_Materia === selection.ID_Materia &&
    getGradeGroup(grade, getStudent(grade.ID_Estudiante)) === group &&
    String(grade.Trimestre || "1") === String(selection.Trimestre || "1")
  );
  return existing ? { ...existing } : { ...selection, Grupo: group, Trimestre: selection.Trimestre || "1" };
}

function firstStudentIdForGroup(group) {
  const options = getStudentsForGroupOptions(group);
  return options.length ? options[0][0] : "";
}

function getGradeGroups() {
  return unique([...state.courses.map((course) => course.Paralelo), ...state.students.map((student) => student.Paralelo), "G1", "G2"]);
}

function getStudentsForGroupOptions(group, selectedId = "") {
  const students = state.students
    .filter((student) => !group || student.Paralelo === group || student.ID_Estudiante === selectedId)
    .sort(compareStudentsByName);
  return students.map((student) => [student.ID_Estudiante, `${student.Nombre} - ${student.CI}`]);
}

function compareStudentsByName(a = {}, b = {}) {
  return String(a.Nombre || "").localeCompare(String(b.Nombre || ""), "es", { sensitivity: "base" });
}

function average(numbers) {
  if (!numbers.length) return 0;
  return (numbers.reduce((sum, n) => sum + n, 0) / numbers.length).toFixed(2);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function includeOption(options, value) {
  return options.includes(value) ? options : [value, ...options].filter(Boolean);
}

function getParallelsForCourse(courseName) {
  return unique(state.courses
    .filter((course) => !courseName || course.Curso === courseName)
    .map((course) => course.Paralelo));
}

function pill(value, type = "") {
  const key = normalizeKey(value);
  const classes = ["pill"];
  if (key === "sin completar") classes.push("pending");
  if (type === "published" && key === "si") classes.push("published-yes");
  if (type === "published" && key === "no") classes.push("published-no");
  if (key === "aprobado" || key === "activo") classes.push("success");
  if (key === "reprobado" || key === "inactivo") classes.push("danger");
  if (key === "en seguimiento") classes.push("warning");
  return `<span class="${classes.join(" ")}">${escapeHtml(value || "-")}</span>`;
}

function stripHtml(value) {
  return String(value || "").replace(/<br\s*\/?>/gi, " | ").replace(/<[^>]*>/g, "");
}

function viewRecord(title, record) {
  openModal(title, [recordDetailView(record)], async () => {});
}

function recordDetailView(record = {}) {
  const entries = Object.entries(record)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([key, value]) => {
      const display = typeof value === "object" ? JSON.stringify(value) : String(value);
      return `<div class="detail-item">
        <span>${escapeHtml(humanizeKey(key))}</span>
        <strong>${escapeHtml(stripHtml(display))}</strong>
      </div>`;
    }).join("");
  return `<section class="full detail-card">${entries || "<p>Sin datos para mostrar.</p>"}</section>`;
}

function humanizeKey(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function generateAccessCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function setMessage(text, type = "") {
  $("#message").textContent = text;
  $("#message").className = `admin-message ${type}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
}

function setupLogoFallback() {
  $("#logo").addEventListener("error", () => {
    if (!$("#logo").src.endsWith(DEFAULT_LOGO)) $("#logo").src = DEFAULT_LOGO;
  });
}

function isValidImageUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}
