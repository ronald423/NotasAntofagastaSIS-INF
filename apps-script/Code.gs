const TOKEN_TTL_SECONDS = 60 * 60 * 2;
const DEFAULT_ROLE = "Administrador general";
const MAX_SHEET_CELL_CHARS = 49000;
const MAX_HISTORY_CELL_CHARS = 12000;
const MAX_SUMMARY_CELL_CHARS = 45000;
const DASHBOARD_HISTORY_LIMIT = 120;
const DASHBOARD_BACKUP_LIMIT = 30;
const ACADEMIC_RECORDS_MIGRATION_KEY = "ACADEMIC_RECORDS_MIGRATED_V1";
const PUBLIC_STUDENTS_CACHE_SECONDS = 1800;
const PUBLIC_RESULT_CACHE_SECONDS = 300;
const PUBLIC_CACHE_VERSION = "v2";
const SHEETS = {
  students: "Estudiantes",
  grades: "Notas",
  attendanceRecords: "Asistencias",
  noteRecords: "Registros_Notas",
  subjects: "Materias",
  courses: "Cursos",
  admins: "Administradores",
  history: "Historial",
  config: "Configuracion",
  backups: "Backups"
};

const PUBLIC_SPREADSHEETS = {
  G1: "1DBXhaOwAGn3r8L6BN4gTVqFUJesCIsCPkgtFrQLQT5w",
  G2: "1a--JRLubnrmXsNtp8kWbKEJL6XrtQg1bhke-KBhYZzU"
};

const HEADERS = {
  Estudiantes: ["ID_Estudiante", "CI", "Codigo_Acceso", "Nombre", "Curso", "Paralelo", "Estado", "Fecha_Registro", "Ultima_Actualizacion"],
  Notas: ["ID_Nota", "ID_Estudiante", "ID_Materia", "Grupo", "Trimestre", "Ser_Promedio", "Ser_Aporte", "Saber_Promedio", "Saber_Aporte", "Hacer_Promedio", "Hacer_Aporte", "Decidir_Promedio", "Decidir_Aporte", "Nota_Final", "Asistencia", "Practicas", "Otros_Registros", "Detalle_Registro", "Observacion", "Estado_Academico", "Publicado", "Fecha_Registro", "Ultima_Actualizacion"],
  Asistencias: ["ID_Asistencia", "ID_Nota", "ID_Estudiante", "ID_Materia", "Grupo", "Trimestre", "Fecha", "Estado", "Publicado", "Fecha_Registro", "Ultima_Actualizacion"],
  Registros_Notas: ["ID_Registro", "ID_Nota", "ID_Estudiante", "ID_Materia", "Grupo", "Trimestre", "Tipo", "Dimension", "Titulo", "Fecha", "Valor", "Sobre", "Publicado", "Fecha_Registro", "Ultima_Actualizacion"],
  Materias: ["ID_Materia", "Nombre_Materia", "Docente", "Estado"],
  Cursos: ["ID_Curso", "Curso", "Paralelo", "Gestion", "Estado"],
  Administradores: ["ID_Admin", "Usuario", "Password_Hash", "Rol", "Estado", "Fecha_Registro"],
  Historial: ["ID_Historial", "Fecha", "Hora", "Usuario", "Accion", "Detalle", "Dato_Anterior", "Dato_Nuevo"],
  Configuracion: ["Clave", "Valor", "Descripcion", "Ultima_Actualizacion"],
  Backups: ["ID_Backup", "Fecha", "Hora", "Usuario", "Nombre_Backup", "Detalle"]
};

const DEFAULT_CONFIG = {
  nombre_colegio: "Unidad Educativa",
  logo_url: "",
  escudo_bolivia_url: "",
  docente: "Docente encargado",
  materia_principal: "Materia principal",
  campo: "Ciencia, Tecnologia y Produccion",
  director: "",
  gestion: "Gestion 2026",
  ciudad: "Antofagasta",
  footer_texto: "Sistema academico institucional",
  color_principal: "#1d4ed8",
  color_secundario: "#0f766e",
  mensaje_bienvenida: "Consulta segura de notas y practicas."
};

const DIMENSION_WEIGHTS = {
  Ser: 10,
  Saber: 45,
  Hacer: 40,
  Decidir: 5
};

let REQUEST_USER = null;

function doGet() {
  return json({ ok: true, message: "API del sistema academico activa." });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = body.action;
    const publicActions = ["getPublicConfig", "consultStudent"];
    if (publicActions.indexOf(action) === -1) {
      throw new Error("La administracion web fue deshabilitada. Realice las modificaciones desde Google Sheets.");
    }
    REQUEST_USER = null;

    const routes = {
      getPublicConfig: () => ({ config: getConfig() }),
      consultStudent: () => consultStudent(body),
      login: () => login(body),
      validateSession: () => ({ user: validateSession(body.token) }),
      logout: () => logout(body.token),
      dashboardData: () => dashboardData(),
      academicRecords: () => academicRecords(),
      addStudent: () => saveRow(SHEETS.students, "ID_Estudiante", body.student, null, "Agregar estudiante"),
      updateStudent: () => saveRow(SHEETS.students, "ID_Estudiante", body.student, body.student.ID_Estudiante, "Editar estudiante"),
      deleteStudent: () => deleteRow(SHEETS.students, "ID_Estudiante", body.id, "Eliminar estudiante"),
      addSubject: () => saveRow(SHEETS.subjects, "ID_Materia", body.subject, null, "Agregar materia"),
      updateSubject: () => saveRow(SHEETS.subjects, "ID_Materia", body.subject, body.subject.ID_Materia, "Editar materia"),
      deleteSubject: () => deleteRow(SHEETS.subjects, "ID_Materia", body.id, "Eliminar materia"),
      addCourse: () => saveRow(SHEETS.courses, "ID_Curso", body.course, null, "Agregar curso"),
      updateCourse: () => saveRow(SHEETS.courses, "ID_Curso", body.course, body.course.ID_Curso, "Editar curso"),
      deleteCourse: () => deleteRow(SHEETS.courses, "ID_Curso", body.id, "Eliminar curso"),
      addGrade: () => saveGrade(body.grade, null),
      updateGrade: () => saveGrade(body.grade, body.grade.ID_Nota),
      saveGradesBatch: () => saveGradesBatch(body.grades),
      deleteGrade: () => deleteGrade(body.id),
      bulkPublish: () => bulkPublish(body),
      updateConfig: () => updateConfig(body.config),
      resetConfig: () => resetConfig(),
      createBackup: () => createBackup(),
      clearHistory: () => clearHistory()
    };
    if (!routes[action]) throw new Error("Accion no reconocida.");
    return json(Object.assign({ ok: true }, routes[action]()));
  } catch (error) {
    return json({ ok: false, message: error.message });
  }
}

function setup() {
  const ss = getSpreadsheet();
  Object.keys(HEADERS).forEach((name) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS[name]);
  });
  migrateNotasIfNeeded();
  migrateAcademicRecordsIfNeeded();
  migrateAdministradoresIfNeeded();
  ensureDefaultConfig();
}

function createAdmin(username, password, role) {
  setup();
  if (!username || !password) throw new Error("Usuario y contraseña son obligatorios.");
  const salt = getScriptProps().getProperty("PASSWORD_SALT") || Utilities.getUuid();
  getScriptProps().setProperty("PASSWORD_SALT", salt);
  const admin = {
    ID_Admin: makeId("ADM"),
    Usuario: username,
    Password_Hash: hashPassword(password),
    Rol: role || DEFAULT_ROLE,
    Estado: "Activo",
    Fecha_Registro: timestamp()
  };
  appendObject(SHEETS.admins, admin);
  return admin.ID_Admin;
}

function login(body) {
  migrateAdministradoresIfNeeded();
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const admin = readObjects(SHEETS.admins).find((row) => String(row.Usuario || "").trim() === username && normalize(row.Estado) === "activo");
  if (!admin || admin.Password_Hash !== hashPassword(password)) throw new Error("Usuario o contraseña incorrectos.");
  const token = Utilities.getUuid() + Utilities.getUuid();
  const user = { Usuario: admin.Usuario, Rol: admin.Rol, ID_Admin: admin.ID_Admin };
  CacheService.getScriptCache().put("session_" + token, JSON.stringify(user), TOKEN_TTL_SECONDS);
  addHistory(admin.Usuario, "Inicio de sesion", "Acceso administrativo correcto", "", "");
  return { token, user, expiresIn: TOKEN_TTL_SECONDS };
}

function validateSession(token) {
  if (!token) throw new Error("Sesion no valida. Inicie sesion nuevamente.");
  const raw = CacheService.getScriptCache().get("session_" + token);
  if (!raw) throw new Error("Sesion expirada. Inicie sesion nuevamente.");
  return JSON.parse(raw);
}

function logout(token) {
  const user = validateSession(token);
  CacheService.getScriptCache().remove("session_" + token);
  addHistory(user.Usuario, "Cierre de sesion", "Sesion finalizada", "", "");
  return { message: "Sesion cerrada." };
}

function dashboardData() {
  migrateNotasIfNeeded();
  migrateAcademicRecordsIfNeeded();
  return {
    config: getConfig(),
    students: readObjects(SHEETS.students),
    subjects: readObjects(SHEETS.subjects),
    courses: readObjects(SHEETS.courses),
    grades: enrichGrades(readObjects(SHEETS.grades)),
    history: readRecentObjects(SHEETS.history, DASHBOARD_HISTORY_LIMIT).reverse(),
    backups: readRecentObjects(SHEETS.backups, DASHBOARD_BACKUP_LIMIT).reverse()
  };
}

function academicRecords() {
  migrateAcademicRecordsIfNeeded();
  return {
    attendanceRecords: readObjects(SHEETS.attendanceRecords),
    noteRecords: readObjects(SHEETS.noteRecords)
  };
}

function consultStudent(body) {
  const ci = String(body.ci || "").trim();
  const accessCode = String(body.accessCode || "").trim();
  const group = String(body.group || body.paralelo || "").trim().toUpperCase();
  if (!ci || !accessCode || !group) throw new Error("Ingrese CI, codigo personal y grupo.");
  const ss = getPublicSpreadsheet(group);
  const student = readCachedPublicStudents(ss, group).find((row) =>
    sameCi(row.CI, ci) &&
    sameAccessCode(row.Codigo_Acceso, accessCode) &&
    normalize(row.Paralelo) === normalize(group) &&
    normalize(row.Estado) !== "inactivo"
  );
  if (!student) throw new Error("CI, codigo personal o grupo incorrecto.");
  const trimester = String(body.trimester || "1").trim();
  const cache = CacheService.getScriptCache();
  const resultCacheKey = ["public_result", PUBLIC_CACHE_VERSION, group, student.ID_Estudiante || ci, trimester].join("_");
  const cachedResult = cache.get(resultCacheKey);
  if (cachedResult) {
    try {
      return JSON.parse(cachedResult);
    } catch (error) {
      cache.remove(resultCacheKey);
    }
  }
  const grades = buildWorkbookGrades(ss, student, trimester || "1");
  if (!grades.length) {
    return cachePublicConsultResult(cache, resultCacheKey, { student, grades: [], message: "Estudiante encontrado. Todavia no tiene notas registradas en el cuaderno pedagogico." });
  }
  const published = grades.filter((row) => row.Publicado === "Si");
  if (!published.length) {
    return cachePublicConsultResult(cache, resultCacheKey, { student, grades: [], message: "Estudiante encontrado. Sus notas aun no fueron publicadas." });
  }
  return cachePublicConsultResult(cache, resultCacheKey, { student, grades: published, message: "Consulta realizada correctamente." });
}

function readCachedPublicStudents(ss, group) {
  const cache = CacheService.getScriptCache();
  const key = ["public_students", PUBLIC_CACHE_VERSION, group].join("_");
  const cached = cache.get(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      cache.remove(key);
    }
  }
  const students = readPublicObjects(ss, SHEETS.students);
  cache.put(key, JSON.stringify(students), PUBLIC_STUDENTS_CACHE_SECONDS);
  return students;
}

function cachePublicConsultResult(cache, key, result) {
  const serialized = JSON.stringify(result);
  if (serialized.length < 95000) cache.put(key, serialized, PUBLIC_RESULT_CACHE_SECONDS);
  return result;
}

function diagnosticarConsultaEstudiante() {
  const ci = "9503751";
  const accessCode = "SF8R2H";
  const ss = getSpreadsheet();
  const students = readObjects(SHEETS.students);
  const matchesByCi = students.filter((row) => sameCi(row.CI, ci));
  const exactMatch = students.find((row) => sameCi(row.CI, ci) && sameAccessCode(row.Codigo_Acceso, accessCode));
  Logger.log("Spreadsheet: " + ss.getName() + " | " + ss.getUrl());
  Logger.log("Total estudiantes: " + students.length);
  Logger.log("Coincidencias por CI " + ci + ": " + matchesByCi.length);
  Logger.log(JSON.stringify(matchesByCi));
  Logger.log("Coincidencia CI + codigo: " + JSON.stringify(exactMatch || null));
}

function saveRow(sheetName, idField, object, id, action) {
  const user = currentUser();
  assertCanEdit(user, action);
  const sheet = getSheet(sheetName);
  const headers = getHeaders(sheet);
  const now = timestamp();
  const data = Object.assign({}, object);
  if (!id) {
    data[idField] = makeId(idField.split("_")[1] || "ID");
    if (headers.indexOf("Fecha_Registro") !== -1) data.Fecha_Registro = now;
  }
  if (headers.indexOf("Ultima_Actualizacion") !== -1) data.Ultima_Actualizacion = now;
  const result = upsertObject(sheetName, idField, data);
  addHistory(user.Usuario, action, id || data[idField], JSON.stringify(result.old || ""), JSON.stringify(data));
  return { record: data };
}

function saveGrade(grade, id) {
  const user = currentUser();
  assertCanEdit(user, id ? "Editar nota" : "Crear nota");
  migrateNotasIfNeeded();
  validateGrade(grade);
  const sheet = getSheet(SHEETS.grades);
  const headers = getHeaders(sheet);
  const now = timestamp();
  const rows = readObjects(SHEETS.grades);
  const existing = id
    ? rows.find((row) => String(row.ID_Nota) === String(id))
    : rows.find((row) =>
      String(row.ID_Estudiante) === String(grade.ID_Estudiante) &&
      String(row.ID_Materia) === String(grade.ID_Materia) &&
      String(row.Grupo || "") === String(grade.Grupo || "") &&
      String(row.Trimestre || "1") === String(grade.Trimestre || "1")
    );
  const merged = existing ? Object.assign({}, existing, grade) : Object.assign({}, grade);
  merged.ID_Nota = existing ? existing.ID_Nota : (grade.ID_Nota || makeId("Nota"));
  merged.Fecha_Registro = existing ? existing.Fecha_Registro : now;
  merged.Ultima_Actualizacion = now;
  merged.Detalle_Registro = JSON.stringify(id ? parseGradeItems(grade.Detalle_Registro) : mergeGradeItems(parseGradeItems(existing && existing.Detalle_Registro), parseGradeItems(grade.Detalle_Registro)));
  applyGradeSummary(merged);

  let old = null;
  let wrote = false;
  const idIndex = headers.indexOf("ID_Nota");
  for (let i = 1; i <= sheet.getLastRow() - 1; i++) {
    const row = sheet.getRange(i + 1, 1, 1, headers.length).getValues()[0];
    if (String(row[idIndex]) === String(merged.ID_Nota)) {
      old = rowToObject(headers, row);
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([headers.map((header) => valueOrBlank(merged[header], header))]);
      wrote = true;
      break;
    }
  }
  if (!wrote) sheet.appendRow(headers.map((header) => valueOrBlank(merged[header], header)));
  syncAcademicRecordSheets(merged);
  addHistory(user.Usuario, id ? "Editar nota" : "Crear nota", merged.ID_Nota, JSON.stringify(old || ""), JSON.stringify(merged));
  return { record: merged };
}

function saveGradesBatch(grades) {
  const user = currentUser();
  assertCanEdit(user, "Registrar asistencia");
  migrateNotasIfNeeded();
  if (!Array.isArray(grades) || !grades.length) throw new Error("No hay notas para guardar.");

  const now = timestamp();
  const rows = readObjects(SHEETS.grades);
  const oldById = {};
  const indexById = {};
  rows.forEach((row, index) => {
    indexById[String(row.ID_Nota)] = index;
  });

  grades.forEach((grade) => {
    validateGrade(grade);
    const existing = grade.ID_Nota
      ? rows[indexById[String(grade.ID_Nota)]]
      : rows.find((row) =>
        String(row.ID_Estudiante) === String(grade.ID_Estudiante) &&
        String(row.ID_Materia) === String(grade.ID_Materia) &&
        String(row.Grupo || "") === String(grade.Grupo || "") &&
        String(row.Trimestre || "1") === String(grade.Trimestre || "1")
      );
    const merged = existing ? Object.assign({}, existing, grade) : Object.assign({}, grade);
    merged.ID_Nota = existing ? existing.ID_Nota : (grade.ID_Nota || makeId("Nota"));
    merged.Fecha_Registro = existing ? existing.Fecha_Registro : now;
    merged.Ultima_Actualizacion = now;
    merged.Detalle_Registro = JSON.stringify(grade.ID_Nota ? parseGradeItems(grade.Detalle_Registro) : mergeGradeItems(parseGradeItems(existing && existing.Detalle_Registro), parseGradeItems(grade.Detalle_Registro)));
    applyGradeSummary(merged);

    if (existing) {
      oldById[merged.ID_Nota] = Object.assign({}, existing);
      rows[indexById[String(existing.ID_Nota)]] = merged;
    } else {
      rows.push(merged);
      indexById[String(merged.ID_Nota)] = rows.length - 1;
    }
  });

  rewriteObjects(SHEETS.grades, rows);
  syncAllAcademicRecordSheets(rows);
  addHistory(user.Usuario, "Registrar asistencia masiva", grades.length + " registros", JSON.stringify(oldById), JSON.stringify({ total: grades.length }));
  return { updated: grades.length };
}

function deleteRow(sheetName, idField, id, action) {
  const user = currentUser();
  assertCanDelete(user, action);
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf(idField);
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idIndex]) === String(id)) {
      const old = rowToObject(headers, values[i]);
      sheet.deleteRow(i + 1);
      addHistory(user.Usuario, action, id, JSON.stringify(old), "");
      return { deleted: id };
    }
  }
  throw new Error("Registro no encontrado.");
}

function deleteGrade(id) {
  const result = deleteRow(SHEETS.grades, "ID_Nota", id, "Eliminar nota");
  replaceObjectsWhere(SHEETS.attendanceRecords, (row) => String(row.ID_Nota) !== String(id), []);
  replaceObjectsWhere(SHEETS.noteRecords, (row) => String(row.ID_Nota) !== String(id), []);
  return result;
}

function bulkPublish(body) {
  const user = currentUser();
  assertCanEdit(user, "Publicar notas");
  const published = body.published === "Si" ? "Si" : "No";
  const rows = readObjects(SHEETS.grades).map((grade) => Object.assign(grade, { Publicado: published, Ultima_Actualizacion: timestamp() }));
  rewriteObjects(SHEETS.grades, rows);
  syncAllAcademicRecordSheets(rows);
  addHistory(user.Usuario, published === "Si" ? "Publicar notas" : "Despublicar notas", "Cambio masivo", "", published);
  return { updated: rows.length };
}

function updateConfig(config) {
  const user = currentUser();
  assertAdmin(user, "Cambiar configuracion institucional");
  const merged = Object.assign(getConfig(), config || {});
  writeConfig(merged);
  addHistory(user.Usuario, "Cambio de configuracion institucional", "Configuracion actualizada", "", JSON.stringify(merged));
  return { config: merged };
}

function resetConfig() {
  const user = currentUser();
  assertAdmin(user, "Restaurar configuracion");
  writeConfig(DEFAULT_CONFIG);
  addHistory(user.Usuario, "Cambio de configuracion institucional", "Restaurar valores por defecto", "", JSON.stringify(DEFAULT_CONFIG));
  return { config: DEFAULT_CONFIG };
}

function createBackup() {
  const user = currentUser();
  assertAdmin(user, "Crear respaldo");
  const name = "Backup_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy_MM_dd_HHmm");
  const ss = getSpreadsheet();
  const copy = ss.copy(name);
  const row = {
    ID_Backup: makeId("BCK"),
    Fecha: dateOnly(),
    Hora: timeOnly(),
    Usuario: user.Usuario,
    Nombre_Backup: name,
    Detalle: "Copia creada: " + copy.getUrl()
  };
  appendObject(SHEETS.backups, row);
  addHistory(user.Usuario, "Crear respaldo", name, "", row.Detalle);
  return { backup: row };
}

function clearHistory() {
  const user = currentUser();
  assertCanDelete(user, "Borrar historial");
  const sheet = getSheet(SHEETS.history);
  sheet.clearContents();
  sheet.appendRow(HEADERS[SHEETS.history]);
  addHistory(user.Usuario, "Borrar historial", "Historial limpiado manualmente", "", "");
  return { message: "Historial borrado correctamente." };
}

function getConfig() {
  ensureDefaultConfig();
  const rows = readObjects(SHEETS.config);
  const config = {};
  rows.forEach((row) => config[row.Clave] = row.Valor);
  return Object.assign({}, DEFAULT_CONFIG, config);
}

function migrateAdministradoresIfNeeded() {
  const sheet = getSheet(SHEETS.admins);
  const values = sheet.getDataRange().getValues();
  if (!values.length) return;
  const headers = values[0].map((header) => normalize(header));
  const alreadyStructured = headers.indexOf("id_admin") !== -1 && headers.indexOf("password_hash") !== -1;

  const rows = values.slice(1).filter((row) => row.join("") !== "").map((row) => {
    const get = (names) => {
      for (let i = 0; i < names.length; i++) {
        const index = headers.indexOf(normalize(names[i]));
        if (index !== -1) return row[index];
      }
      return "";
    };
    const username = String(get(["Usuario", "USUARIO"])).trim();
    const passwordValue = String(get(["Password_Hash", "Contrasena", "Contraseña", "CONTRASEÑA", "Password"]));
    if (!username || !passwordValue) return null;
    const passwordHash = isSha256Hash(passwordValue) ? passwordValue : hashPassword(passwordValue);
    return {
      ID_Admin: String(get(["ID_Admin", "ID"])) || makeId("ADM"),
      Usuario: username,
      Password_Hash: passwordHash,
      Rol: String(get(["Rol", "ROL"])) || DEFAULT_ROLE,
      Estado: normalize(get(["Estado", "ESTADO"])) === "activo" ? "Activo" : "Inactivo",
      Fecha_Registro: String(get(["Fecha_Registro", "Fecha"])) || timestamp()
    };
  }).filter(Boolean);

  const needsHashRepair = alreadyStructured && rows.some((row, index) => String(values[index + 1][headers.indexOf("password_hash")]) !== row.Password_Hash);
  if (alreadyStructured && !needsHashRepair) return;

  sheet.clearContents();
  sheet.appendRow(HEADERS[SHEETS.admins]);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, HEADERS[SHEETS.admins].length).setValues(rows.map((row) => HEADERS[SHEETS.admins].map((header) => row[header] || "")));
  }
}

function migrateNotasIfNeeded() {
  const sheet = getSheet(SHEETS.grades);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    if (getHeaders(sheet).join("|") !== HEADERS[SHEETS.grades].join("|")) rewriteObjects(SHEETS.grades, []);
    return;
  }
  const headers = values[0];
  const rows = values.slice(1)
    .filter((row) => row.join("") !== "")
    .map((row) => rowToObject(headers, row));
  const currentKeys = rows.map((row) => gradeCompositeKey(row));
  const hasDuplicates = currentKeys.some((key, index) => currentKeys.indexOf(key) !== index);
  const hasOldStructure = headers.join("|") !== HEADERS[SHEETS.grades].join("|");
  if (!hasDuplicates && !hasOldStructure) return;

  const grouped = {};
  rows.forEach((row) => {
    const key = gradeCompositeKey(row);
    if (!grouped[key]) {
      grouped[key] = {
        ID_Nota: row.ID_Nota || makeId("Nota"),
        ID_Estudiante: row.ID_Estudiante,
        ID_Materia: row.ID_Materia,
        Grupo: row.Grupo || "",
        Trimestre: row.Trimestre || "1",
        Observacion: row.Observacion || "",
        Estado_Academico: row.Estado_Academico || "Sin completar",
        Publicado: row.Publicado || "No",
        Fecha_Registro: row.Fecha_Registro || timestamp(),
        Ultima_Actualizacion: row.Ultima_Actualizacion || timestamp(),
        Detalle_Registro: "[]"
      };
    }
    const current = grouped[key];
    current.Publicado = current.Publicado === "Si" || row.Publicado === "Si" ? "Si" : "No";
    current.Observacion = current.Observacion || row.Observacion || "";
    current.Estado_Academico = row.Estado_Academico || current.Estado_Academico;
    current.Ultima_Actualizacion = row.Ultima_Actualizacion || current.Ultima_Actualizacion;
    current.Detalle_Registro = JSON.stringify(mergeGradeItems(
      parseGradeItems(current.Detalle_Registro),
      parseGradeItems(row.Detalle_Registro).concat(legacyGradeItems(row))
    ));
  });

  const migrated = Object.keys(grouped).map((key) => {
    const row = grouped[key];
    applyGradeSummary(row);
    return row;
  });
  rewriteObjects(SHEETS.grades, migrated);
}

function migrateAcademicRecordsIfNeeded() {
  getSheet(SHEETS.attendanceRecords);
  getSheet(SHEETS.noteRecords);
  const props = getScriptProps();
  if (props.getProperty(ACADEMIC_RECORDS_MIGRATION_KEY) === "1") return;
  const hasAttendance = readObjects(SHEETS.attendanceRecords).length > 0;
  const hasNoteRecords = readObjects(SHEETS.noteRecords).length > 0;
  if (hasAttendance && hasNoteRecords) {
    props.setProperty(ACADEMIC_RECORDS_MIGRATION_KEY, "1");
    return;
  }
  const attendanceRows = [];
  const noteRows = [];
  readObjects(SHEETS.grades).forEach((grade) => {
    const built = buildAcademicRecordRows(grade);
    if (!hasAttendance) attendanceRows.push.apply(attendanceRows, built.attendance);
    if (!hasNoteRecords) noteRows.push.apply(noteRows, built.notes);
  });
  if (!hasAttendance) rewriteObjects(SHEETS.attendanceRecords, attendanceRows);
  if (!hasNoteRecords) rewriteObjects(SHEETS.noteRecords, noteRows);
  props.setProperty(ACADEMIC_RECORDS_MIGRATION_KEY, "1");
}

function syncAcademicRecordSheets(grade) {
  const built = buildAcademicRecordRows(grade);
  replaceObjectsWhere(SHEETS.attendanceRecords, (row) => String(row.ID_Nota) !== String(grade.ID_Nota), built.attendance);
  replaceObjectsWhere(SHEETS.noteRecords, (row) => String(row.ID_Nota) !== String(grade.ID_Nota), built.notes);
}

function syncAllAcademicRecordSheets(grades) {
  const attendanceRows = [];
  const noteRows = [];
  (grades || readObjects(SHEETS.grades)).forEach((grade) => {
    const built = buildAcademicRecordRows(grade);
    attendanceRows.push.apply(attendanceRows, built.attendance);
    noteRows.push.apply(noteRows, built.notes);
  });
  rewriteObjects(SHEETS.attendanceRecords, attendanceRows);
  rewriteObjects(SHEETS.noteRecords, noteRows);
}

function buildAcademicRecordRows(grade) {
  const now = grade.Ultima_Actualizacion || timestamp();
  const base = {
    ID_Nota: grade.ID_Nota,
    ID_Estudiante: grade.ID_Estudiante,
    ID_Materia: grade.ID_Materia,
    Grupo: grade.Grupo || "",
    Trimestre: grade.Trimestre || "1",
    Publicado: grade.Publicado || "No",
    Fecha_Registro: grade.Fecha_Registro || now,
    Ultima_Actualizacion: now
  };
  const attendance = [];
  const notes = [];
  parseGradeItems(grade.Detalle_Registro).forEach((item) => {
    if (item.tipo === "asistencia_dia" && item.fecha) {
      attendance.push(Object.assign({}, base, {
        ID_Asistencia: makeStableRecordId("AST", grade.ID_Nota, item.fecha, item.valor),
        Fecha: item.fecha,
        Estado: item.valor
      }));
      return;
    }
    if (!isSeparatedNoteItem(item)) return;
    notes.push(Object.assign({}, base, {
      ID_Registro: makeStableRecordId("RNT", grade.ID_Nota, item.tipo, item.dimension, item.titulo, item.fecha, item.valor),
      Tipo: item.tipo || "",
      Dimension: item.dimension || "",
      Titulo: item.titulo || "",
      Fecha: item.fecha || "",
      Valor: item.valor === undefined || item.valor === null ? "" : item.valor,
      Sobre: item.sobre || ""
    }));
  });
  return { attendance, notes };
}

function isSeparatedNoteItem(item) {
  return item &&
    item.tipo !== "asistencia_dia" &&
    item.tipo !== "asistencia" &&
    item.tipo !== "asistencia_ser" &&
    item.tipo !== "practicas_total";
}

function makeStableRecordId(prefix) {
  const raw = Array.prototype.slice.call(arguments, 1).join("|");
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw);
  const hash = digest.map((byte) => ("0" + (byte & 0xff).toString(16)).slice(-2)).join("").slice(0, 18);
  return prefix + "_" + hash;
}

function gradeCompositeKey(row) {
  return [row.ID_Estudiante || "", row.ID_Materia || "", row.Grupo || "", row.Trimestre || "1"].join("|");
}

function legacyGradeItems(row) {
  return ["Practica_1", "Practica_2", "Practica_3", "Practica_4"]
    .filter((key) => row[key] !== "" && row[key] !== undefined)
    .map((key, index) => ({
      tipo: "practica",
      dimension: "Hacer",
      titulo: "Practica " + (index + 1),
      valor: row[key],
      promedia: true
    }));
}

function writeConfig(config) {
  const rows = Object.keys(config).map((key) => ({
    Clave: key,
    Valor: config[key],
    Descripcion: key,
    Ultima_Actualizacion: timestamp()
  }));
  rewriteObjects(SHEETS.config, rows);
}

function ensureDefaultConfig() {
  const sheet = getSheet(SHEETS.config);
  if (sheet.getLastRow() <= 1) writeConfig(DEFAULT_CONFIG);
}

function validateGrade(grade) {
  const items = parseGradeItems(grade.Detalle_Registro);
  items.forEach((item) => {
    if (!item.dimension) return;
    if (item.valor === "" || item.valor === undefined) return;
    const value = Number(item.valor);
    if (Number.isNaN(value) || value < 0 || value > 100) throw new Error("Las notas deben estar entre 0 y 100.");
  });
  if (grade.Nota_Final !== "" && grade.Nota_Final !== undefined) {
    const finalValue = Number(grade.Nota_Final);
    if (Number.isNaN(finalValue) || finalValue < 0 || finalValue > 100) throw new Error("La nota final debe estar entre 0 y 100.");
  }
}

function calculateFinal(grade) {
  const summary = gradeSummary(parseGradeItems(grade.Detalle_Registro));
  if (!summary.hasValues) {
    const legacyValues = ["Practica_1", "Practica_2", "Practica_3", "Practica_4"].map((key) => Number(grade[key])).filter((n) => !Number.isNaN(n));
    if (legacyValues.length) return (legacyValues.reduce((sum, n) => sum + n, 0) / legacyValues.length).toFixed(2);
  }
  return summary.hasValues ? String(Math.round(summary.final)) : "";
}

function applyGradeSummary(grade) {
  const items = withAttendanceScore(parseGradeItems(grade.Detalle_Registro));
  grade.Detalle_Registro = JSON.stringify(items);
  const summary = gradeSummary(items);
  grade.Ser_Promedio = formatSummaryValue(summary.Ser.promedio);
  grade.Ser_Aporte = formatSummaryValue(summary.Ser.aporte);
  grade.Saber_Promedio = formatSummaryValue(summary.Saber.promedio);
  grade.Saber_Aporte = formatSummaryValue(summary.Saber.aporte);
  grade.Hacer_Promedio = formatSummaryValue(summary.Hacer.promedio);
  grade.Hacer_Aporte = formatSummaryValue(summary.Hacer.aporte);
  grade.Decidir_Promedio = formatSummaryValue(summary.Decidir.promedio);
  grade.Decidir_Aporte = formatSummaryValue(summary.Decidir.aporte);
  grade.Nota_Final = summary.hasValues ? String(Math.round(summary.final)) : (grade.Nota_Final === "" || grade.Nota_Final === undefined ? "" : String(Math.round(Number(grade.Nota_Final))));
  grade.Asistencia = summarizeItems(items.filter((item) => item.tipo === "asistencia" || item.tipo === "asistencia_ser" || item.dimension === "Ser"));
  grade.Practicas = summarizeItems(items.filter((item) => item.tipo === "practica"));
  grade.Asistencia = limitSummaryCell(grade.Asistencia);
  grade.Practicas = limitSummaryCell(grade.Practicas);
  grade.Otros_Registros = limitSummaryCell(summarizeItems(items.filter((item) =>
    item.tipo !== "asistencia" &&
    item.tipo !== "asistencia_dia" &&
    item.tipo !== "asistencia_ser" &&
    item.tipo !== "practica" &&
    item.tipo !== "practicas_total"
  )));
}

function withAttendanceScore(items) {
  const attendance = {};
  items
    .filter((item) => item.tipo === "asistencia_dia" || item.tipo === "asistencia")
    .forEach((item) => {
      if (item.tipo === "asistencia_dia") {
        const status = normalizeAttendanceStatus(item.valor);
        if (!status) return;
        if (status === "A") attendance.asistencia = (Number(attendance.asistencia) || 0) + 1;
        if (status === "F") attendance.faltas = (Number(attendance.faltas) || 0) + 1;
        if (status === "R") attendance.retrasos = (Number(attendance.retrasos) || 0) + 1;
        if (status === "L") attendance.licencias = (Number(attendance.licencias) || 0) + 1;
      } else {
        attendance[normalize(item.titulo)] = item.valor;
      }
    });
  const score = calculateAttendanceScore(attendance);
  if (score === "") return items;
  return items
    .filter((item) => item.tipo !== "asistencia_ser")
    .concat([{ tipo: "asistencia_ser", dimension: "Ser", titulo: "Nota asistencia", valor: score, promedia: true }]);
}

function normalizeAttendanceStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  return ["A", "F", "R", "L"].indexOf(status) !== -1 ? status : "";
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

function gradeSummary(items) {
  const summary = {};
  let final = 0;
  let hasValues = false;
  Object.keys(DIMENSION_WEIGHTS).forEach((dimension) => {
    const values = items
      .filter((item) => item.dimension === dimension)
      .map((item) => Number(item.valor))
      .filter((n) => !Number.isNaN(n));
    if (values.length) {
      const average = values.reduce((sum, n) => sum + n, 0) / values.length;
      const aporte = Math.min(DIMENSION_WEIGHTS[dimension], Math.round(average));
      const promedio = DIMENSION_WEIGHTS[dimension] ? (aporte / DIMENSION_WEIGHTS[dimension]) * 100 : aporte;
      summary[dimension] = { promedio, aporte };
      final += aporte;
      hasValues = true;
    } else {
      summary[dimension] = { promedio: "", aporte: "" };
    }
  });
  summary.final = final;
  summary.hasValues = hasValues;
  return summary;
}

function mergeGradeItems(existingItems, incomingItems) {
  const map = {};
  existingItems.concat(incomingItems).forEach((item) => {
    const key = [item.tipo || "registro", item.dimension || "", normalize(item.titulo || "")].join("|");
    map[key] = item;
  });
  return Object.keys(map).map((key) => map[key]);
}

function summarizeItems(items) {
  const practiceTotal = calculatePracticeTotalFromItems(items);
  const detail = items.map((item) => {
    const value = formatPracticeDisplay(item);
    const date = item.fecha ? " (" + item.fecha + ")" : "";
    return (item.dimension ? item.dimension + " - " : "") + (item.titulo || "Registro") + date + ": " + value;
  }).join(" | ");
  if (practiceTotal === "") return detail;
  return detail + " | Total practicas: " + formatSummaryValue(practiceTotal);
}

function formatSummaryValue(value) {
  return value === "" || value === undefined ? "" : String(Math.round(Number(value)));
}

function formatPracticeDisplay(item) {
  const value = item.valor === undefined || item.valor === null || item.valor === "" ? "-" : String(item.valor);
  if (value.indexOf("/") !== -1) return value;
  return item.sobre ? value + "/" + item.sobre : value;
}

function practiceScoreValue(value) {
  const raw = String(value === undefined || value === null ? "" : value).trim();
  return Number(raw.indexOf("/") !== -1 ? raw.split("/")[0] : raw);
}

function practiceMaxValue(item) {
  const max = item.sobre === undefined || item.sobre === null || item.sobre === "" ? "" : String(item.sobre);
  if (max) return Number(max);
  const raw = String(item.valor === undefined || item.valor === null ? "" : item.valor).trim();
  return raw.indexOf("/") !== -1 ? Number(raw.split("/")[1]) : NaN;
}

function calculatePracticeTotalFromItems(items) {
  let scoreTotal = 0;
  let maxTotal = 0;
  let legacyTotal = 0;
  items
    .filter((item) => item.tipo === "practica")
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

function parseGradeItems(raw) {
  if (!raw) return [];
  try {
    const data = JSON.parse(String(raw));
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => ({
        tipo: String(item.tipo || "").trim(),
        titulo: String(item.titulo || "").trim(),
        dimension: String(item.dimension || "").trim(),
        fecha: String(item.fecha || "").trim(),
        valor: item.valor === undefined ? "" : item.valor,
        sobre: item.sobre === undefined && String(item.valor || "").indexOf("/") !== -1 ? String(item.valor).split("/")[1] : (item.sobre === undefined ? "" : item.sobre),
        promedia: item.promedia === true || item.promedia === "true" || item.promedia === "Si"
      }))
      .filter((item) => item.titulo || item.fecha || item.valor !== "" || item.sobre !== "");
  } catch (error) {
    return [];
  }
}

function enrichGrades(grades) {
  const subjects = readObjects(SHEETS.subjects);
  return grades.map((grade) => {
    const subject = subjects.find((row) => row.ID_Materia === grade.ID_Materia) || {};
    return Object.assign({}, grade, { Nombre_Materia: subject.Nombre_Materia || "" });
  });
}

function enrichGradesFrom(ss, grades) {
  const subjects = readPublicObjects(ss, SHEETS.subjects);
  return grades.map((grade) => {
    const subject = subjects.find((row) => row.ID_Materia === grade.ID_Materia) || {};
    return Object.assign({}, grade, { Nombre_Materia: subject.Nombre_Materia || "" });
  });
}

function buildWorkbookGrades(ss, student, trimester) {
  const trimesterSheet = ss.getSheetByName(String(trimester || "1") + "TRIM");
  if (!trimesterSheet) return [];
  const rows = trimesterSheet.getRange(15, 1, 40, 46).getDisplayValues();
  const row = rows.find((values) => normalize(values[1]) === normalize(student.Nombre));
  if (!row) return [];
  const finalGrade = publicNumber(row[44]);
  const ser = publicNumber(row[15]);
  const saber = publicNumber(row[27]);
  const evaluatedItems = buildWorkbookDimensionItems(trimesterSheet, row);
  const practiceItems = buildWorkbookPracticeItems(ss, student, trimester);
  // El promedio oficial de Hacer es el registrado por el maestro en la hoja
  // trimestral. Las practicas se publican como detalle y no deben reemplazarlo.
  const hacer = publicNumber(row[38]);
  const decidir = publicNumber(row[40]);
  const attendanceItems = buildWorkbookAttendanceItems(ss, student, trimester);
  const hasPublishedValues = [ser, saber, hacer, decidir, finalGrade].some((value) => value !== "") ||
    evaluatedItems.length > 0 || practiceItems.length > 0 || attendanceItems.length > 0;
  if (!hasPublishedValues) return [];
  const detail = evaluatedItems.concat([
    { tipo: "dimension_total", dimension: "Ser", titulo: "Evaluacion del Ser", valor: ser, sobre: 10 },
    { tipo: "dimension_total", dimension: "Saber", titulo: "Evaluacion del Saber", valor: saber, sobre: 45 },
  ]).concat(practiceItems).concat([
    { tipo: "dimension_total", dimension: "Hacer", titulo: "Practicas y cuadernos (Hacer)", valor: hacer, sobre: 40 },
    { tipo: "dimension_total", dimension: "Decidir", titulo: "Autoevaluacion", valor: decidir, sobre: 5 }
  ]).concat(attendanceItems).filter((item) => item.valor !== "");
  return [{
    ID_Nota: ["NOT", student.ID_Estudiante, "MAT_CUADERNO", trimester].join("_"),
    ID_Estudiante: student.ID_Estudiante,
    ID_Materia: "MAT_CUADERNO",
    Grupo: student.Paralelo,
    Trimestre: String(trimester || "1"),
    Ser_Promedio: ser,
    Ser_Aporte: ser,
    Saber_Promedio: saber,
    Saber_Aporte: saber,
    Hacer_Promedio: hacer,
    Hacer_Aporte: hacer,
    Decidir_Promedio: decidir,
    Decidir_Aporte: decidir,
    Nota_Final: finalGrade,
    Detalle_Registro: JSON.stringify(detail),
    Observacion: "",
    Estado_Academico: row[45] || (finalGrade === "" ? "Sin completar" : (Number(finalGrade) >= 51 ? "APROBADO" : "REPROBADO")),
    Publicado: "Si",
    Ultima_Actualizacion: timestamp(),
    Nombre_Materia: getWorkbookSubject(ss)
  }];
}

function buildWorkbookDimensionItems(sheet, studentRow) {
  // Columnas (base cero) de cada dimension en *TRIM. Solo se publican las
  // casillas que tienen encabezado (que se evalua) y nota para el estudiante.
  const blocks = [
    { dimension: "Ser", first: 13, last: 16, total: 15 },
    { dimension: "Saber", first: 17, last: 27, total: 27 },
    { dimension: "Hacer", first: 28, last: 38, total: 38 }
  ];
  const headers = sheet.getRange(9, 1, 6, 46).getDisplayValues();

  return blocks.reduce((items, block) => {
    for (let column = block.first; column <= block.last; column += 1) {
      if (column === block.total) continue;
      const value = publicNumber(studentRow[column]);
      if (value === "") continue;
      const candidates = headers
        .map((headerRow) => String(headerRow[column] || "").trim())
        .filter((header) => header && !/promedio/i.test(normalize(header)));
      if (!candidates.length) continue;
      items.push({
        tipo: "evaluacion_casilla",
        dimension: block.dimension,
        titulo: candidates[0],
        valor: value
      });
    }
    return items;
  }, []);
}

function buildWorkbookPracticeItems(ss, student, trimester) {
  const sheet = ss.getSheetByName(practiceSheetName(trimester));
  if (!sheet || sheet.getLastRow() < 3) return [];
  const lastColumn = Math.max(sheet.getLastColumn(), 24);
  const values = sheet.getRange(1, 1, sheet.getLastRow(), lastColumn).getDisplayValues();
  const headers = values[1].map((header, index) =>
    String(header || values[0][index] || "").trim()
  );
  const ciIndex = headers.findIndex((header) => normalize(header) === "ci");
  const nameIndex = headers.findIndex((header) => normalize(header) === "nombre");
  const parallelIndex = headers.findIndex((header) => /^paral/i.test(normalize(header)));
  const noteIndex = headers.findIndex((header) => normalize(header) === "nota");
  const row = values.slice(2).find((valuesRow) =>
    (ciIndex !== -1 && sameCi(valuesRow[ciIndex], student.CI)) ||
    (nameIndex !== -1 && normalize(valuesRow[nameIndex]) === normalize(student.Nombre))
  );
  if (!row) return [];

  const firstPracticeIndex = parallelIndex !== -1 ? parallelIndex + 1 : 5;
  const lastPracticeIndex = noteIndex !== -1 ? noteIndex : headers.length;
  const items = headers.slice(firstPracticeIndex, lastPracticeIndex)
    .map((header, offset) => ({ header, index: firstPracticeIndex + offset }))
    .filter((column) => column.header && String(row[column.index] || "").trim())
    .map((column, practiceIndex) => {
      const parsed = parsePracticeNote(row[column.index]);
      const namedPractice = /^practica\s*\d+$/i.test(normalizePracticeHeader(column.header));
      return {
        tipo: "practica",
        dimension: "Hacer",
        titulo: namedPractice ? column.header : "Practica " + (practiceIndex + 1),
        fecha: namedPractice ? "" : column.header,
        valor: parsed.valor,
        sobre: parsed.sobre,
        promedia: true
      };
    })
    .filter((item) => item.valor !== "" && item.sobre !== "");

  if (items.length) return items;
  if (noteIndex === -1) return [];
  const parsedNote = parsePracticeTotalNote(row[noteIndex]);
  if (parsedNote.valor === "") return [];
  return [{
    tipo: "practica",
    dimension: "Hacer",
    titulo: "Total practicas",
    valor: Math.min(40, parsedNote.valor),
    sobre: 40,
    promedia: true
  }];
}

function parsePracticeTotalNote(value) {
  const parsed = parsePracticeNote(value);
  if (parsed.valor === "") return parsed;
  if (String(value || "").indexOf("/") !== -1) return parsed;
  return { valor: Math.min(40, parsed.valor), sobre: 40 };
}

function practiceSheetName(trimester) {
  return "PRAC-" + String(trimester || "1").trim() + "T";
}

function normalizePracticeHeader(value) {
  return normalize(value).replace(/\s+/g, " ");
}

function parsePracticeNote(value) {
  const raw = String(value === undefined || value === null ? "" : value).replace(",", ".").trim();
  if (!raw) return { valor: "", sobre: "" };
  if (raw.indexOf("/") !== -1) {
    const parts = raw.split("/");
    const score = publicNumber(parts[0]);
    const max = publicNumber(parts[1]);
    if (score === "" || max === "" || max <= 0) return { valor: "", sobre: "" };
    return { valor: Math.min(score, max), sobre: max };
  }
  const score = publicNumber(raw);
  return score === "" ? { valor: "", sobre: "" } : { valor: score, sobre: 10 };
}

function buildWorkbookAttendanceItems(ss, student, trimester) {
  const listSheet = ss.getSheetByName("LIST " + String(trimester || "1") + "TRIM");
  if (!listSheet) return [];
  const lastColumn = Math.min(Math.max(listSheet.getLastColumn(), 57), listSheet.getMaxColumns());
  const rows = listSheet.getRange(12, 1, 43, lastColumn).getDisplayValues();
  const row = rows.find((values) => normalize(values[1]) === normalize(student.Nombre));
  if (!row) return [];
  const summary = {
    asistencia: publicNumber(row[50]),
    faltas: publicNumber(row[51]),
    retrasos: publicNumber(row[52]),
    licencias: publicNumber(row[53]),
    nota: publicNumber(row[56]) !== "" ? publicNumber(row[56]) : publicNumber(row[55])
  };
  if (!summary.asistencia && !summary.faltas && !summary.retrasos && !summary.licencias) return [];
  return [
    { tipo: "asistencia", titulo: "asistencia", valor: summary.asistencia },
    { tipo: "asistencia", titulo: "faltas", valor: summary.faltas },
    { tipo: "asistencia", titulo: "retrasos", valor: summary.retrasos },
    { tipo: "asistencia", titulo: "licencias", valor: summary.licencias },
    { tipo: "asistencia_nota", titulo: "calificacion asistencia", valor: summary.nota }
  ];
}

function getWorkbookSubject(ss) {
  const filiacion = ss.getSheetByName("FILIACION");
  if (!filiacion) return "Materia";
  return filiacion.getRange("E3").getDisplayValue() || "Materia";
}

function publicNumber(value) {
  const text = String(value || "").replace(",", ".").trim();
  if (!text) return "";
  const number = Number(text);
  return Number.isFinite(number) ? number : "";
}

function currentUser() {
  return REQUEST_USER || { Usuario: "Sistema", Rol: DEFAULT_ROLE };
}

function getSpreadsheet() {
  const id = getScriptProps().getProperty("SPREADSHEET_ID");
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function getPublicSpreadsheet(group) {
  const id = PUBLIC_SPREADSHEETS[String(group || "").trim().toUpperCase()];
  if (!id) throw new Error("Seleccione un grupo valido: G1 o G2.");
  if (/^AKfy/i.test(String(id))) {
    throw new Error("PUBLIC_SPREADSHEETS debe tener el ID del Google Sheets del cuaderno, no la URL ni el ID de Apps Script.");
  }
  return SpreadsheetApp.openById(id);
}

function readPublicObjects(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const lastColumn = Math.max(sheet.getLastColumn(), (HEADERS[sheetName] || []).length || 1);
  const values = sheet.getRange(1, 1, sheet.getLastRow(), lastColumn).getValues();
  const headers = values[0];
  return values.slice(1).filter((row) => row.join("") !== "").map((row) => rowToObject(headers, row));
}

function getSheet(name) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(HEADERS[name]);
  }
  if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() === "") {
    sheet.clearContents();
    sheet.appendRow(HEADERS[name]);
  }
  ensureHeaders(sheet, name);
  return sheet;
}

function ensureHeaders(sheet, name) {
  const expected = HEADERS[name];
  if (!expected) return;
  const current = getHeaders(sheet);
  const missing = expected.filter((header) => current.indexOf(header) === -1);
  if (missing.length) {
    sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }
}

function readObjects(sheetName) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter((row) => row.join("") !== "").map((row) => rowToObject(headers, row));
}

function readRecentObjects(sheetName, limit) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const headers = getHeaders(sheet);
  const count = Math.min(Number(limit) || 100, lastRow - 1);
  const start = Math.max(2, lastRow - count + 1);
  return sheet.getRange(start, 1, count, headers.length)
    .getValues()
    .filter((row) => row.join("") !== "")
    .map((row) => rowToObject(headers, row));
}

function appendObject(sheetName, object) {
  const sheet = getSheet(sheetName);
  const headers = getHeaders(sheet);
  sheet.appendRow(headers.map((header) => valueOrBlank(object[header], header)));
}

function upsertObject(sheetName, idField, object) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf(idField);
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idIndex]) === String(object[idField])) {
      const old = rowToObject(headers, values[i]);
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([headers.map((header) => valueOrBlank(object[header], header))]);
      return { old };
    }
  }
  appendObject(sheetName, object);
  return { old: null };
}

function rewriteObjects(sheetName, objects) {
  const sheet = getSheet(sheetName);
  const headers = HEADERS[sheetName];
  sheet.clearContents();
  sheet.appendRow(headers);
  if (objects.length) sheet.getRange(2, 1, objects.length, headers.length).setValues(objects.map((obj) => headers.map((header) => valueOrBlank(obj[header], header))));
}

function replaceObjectsWhere(sheetName, keepPredicate, newObjects) {
  const current = readObjects(sheetName).filter(keepPredicate);
  rewriteObjects(sheetName, current.concat(newObjects || []));
}

function valueOrBlank(value, header) {
  if (value === undefined || value === null) return "";
  const text = typeof value === "string" ? value : String(value);
  if (text.length > MAX_SHEET_CELL_CHARS) {
    throw new Error("El campo " + (header || "registro") + " tiene demasiada informacion para una celda de Google Sheets. Se supero el limite de 50000 caracteres. Revise registros antiguos o divida la informacion.");
  }
  return value;
}

function limitHistoryCell(value) {
  return limitTextCell(value, MAX_HISTORY_CELL_CHARS, " ... [historial recortado]");
}

function limitSummaryCell(value) {
  return limitTextCell(value, MAX_SUMMARY_CELL_CHARS, " ... [resumen recortado]");
}

function limitTextCell(value, maxLength, suffix) {
  if (value === undefined || value === null) return "";
  const text = typeof value === "string" ? value : String(value);
  if (text.length <= maxLength) return value;
  const ending = suffix || " ... [recortado]";
  return text.slice(0, Math.max(0, maxLength - ending.length)) + ending;
}

function getHeaders(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((header, index) => obj[header] = row[index]);
  return obj;
}

function addHistory(user, action, detail, oldData, newData) {
  appendObject(SHEETS.history, {
    ID_Historial: makeId("HIS"),
    Fecha: dateOnly(),
    Hora: timeOnly(),
    Usuario: user || "Sistema",
    Accion: action,
    Detalle: limitHistoryCell(detail),
    Dato_Anterior: limitHistoryCell(oldData),
    Dato_Nuevo: limitHistoryCell(newData)
  });
}

function hashPassword(password) {
  const salt = getScriptProps().getProperty("PASSWORD_SALT") || "";
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + password);
  return raw.map((byte) => ("0" + (byte & 0xff).toString(16)).slice(-2)).join("");
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isSha256Hash(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || "").trim());
}

function sameCi(left, right) {
  return onlyDigits(left) === onlyDigits(right);
}

function sameAccessCode(left, right) {
  return cleanCode(left) === cleanCode(right);
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function cleanCode(value) {
  return String(value || "").trim().replace(/\s+/g, "").toUpperCase();
}

function assertCanEdit(user, action) {
  if (user.Rol === "Solo lectura") throw new Error("Su rol no permite modificar registros.");
}

function assertCanDelete(user, action) {
  if (user.Rol !== DEFAULT_ROLE) throw new Error("Solo el Administrador general puede eliminar registros importantes.");
}

function assertAdmin(user, action) {
  if (user.Rol !== DEFAULT_ROLE) throw new Error("Solo el Administrador general puede realizar esta accion.");
}

function makeId(prefix) {
  return prefix + "_" + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function timestamp() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
}

function dateOnly() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function timeOnly() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "HH:mm:ss");
}

function getScriptProps() {
  return PropertiesService.getScriptProperties();
}

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
