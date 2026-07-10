const CP_SHEETS = {
  students: "Estudiantes",
  practices: ["PRAC-1T", "PRAC-2T", "PRAC-3T"],
};

const CP_HEADERS = {
  Estudiantes: ["ID_Estudiante", "CI", "Codigo_Acceso", "Nombre", "Curso", "Paralelo", "Estado", "Fecha_Registro", "Ultima_Actualizacion"]
};

const CP_PRACTICE_HEADERS = ["CI", "Nombre", "Curso", "Paralelo"]
  .concat(Array.from({ length: 19 }, (_, index) => "Practica " + (index + 1)))
  .concat(["Nota"]);

const CP_STUDENT_DIRECTORY = [
  { CI: "17011164", Codigo_Acceso: "8P80MJ", Nombre: "ALMARAZ NOGALEZ LIZETH", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "15234955", Codigo_Acceso: "QKO4QC", Nombre: "AREVALO MAMANI EDWARD JOHAN", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "16938379", Codigo_Acceso: "P5TFWB", Nombre: "BARRIONUEVO JIMENEZ KAREN", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "14697643", Codigo_Acceso: "J1JS9N", Nombre: "CESPEDES GARCIA MASDYNE", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "16606694", Codigo_Acceso: "41ORQO", Nombre: "CHOQUE CORI DEYMAR", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "12748937", Codigo_Acceso: "P2VZRW", Nombre: "CLAROS VILLARROEL ROUSS VICTORIA", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "13483400", Codigo_Acceso: "JLPLOR", Nombre: "CLAURE ROSAS LESLIE", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "14648727", Codigo_Acceso: "8E4A89", Nombre: "COLQUE MAMANI JUAN PABLO", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "15685804", Codigo_Acceso: "8I4VFA", Nombre: "CONDORI ESCOBAR KARIOLY CELIN", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "15094017", Codigo_Acceso: "MXJW5J", Nombre: "CONDORI MAMANI ALISON ROCIO", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "16956814", Codigo_Acceso: "RVZO6N", Nombre: "CONDORI PEREDO KENIA ARACELI", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "1666666", Codigo_Acceso: "ZEFYO6", Nombre: "COÑACA PACOLI SERGIO", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "1666666", Codigo_Acceso: "5Z4OOO", Nombre: "CORDOBA MONTAÑO DAYNE", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "17777777", Codigo_Acceso: "ANLF2O", Nombre: "COSSIO ROJAS JESSICA DAYLEN", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "1444444", Codigo_Acceso: "83RVHD", Nombre: "ESPINOZA VARGAS ERICK", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "1333333333", Codigo_Acceso: "H6TELM", Nombre: "FERNANDEZ MIRANDA EVELYN", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "16023568", Codigo_Acceso: "Q8LIL1", Nombre: "FLORES MERINO YANINA PAOLA", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "14648595", Codigo_Acceso: "Q2WWS8", Nombre: "FLORES MUÑOZ MAYDALIZ", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "15832767", Codigo_Acceso: "RZVVLL", Nombre: "GARCIA HERBAS LIZ", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "13482814", Codigo_Acceso: "RJOVKM", Nombre: "GARCIA LEDEZMA MELAY ALEXIA", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "9503751", Codigo_Acceso: "SF8R2H", Nombre: "GUAMAN MALAGA AYME", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "15323774", Codigo_Acceso: "DEA32T", Nombre: "GUZMAN GARVIZU JHOJAN", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "15322759", Codigo_Acceso: "JIGT1J", Nombre: "INTURIAS VARGAS RYOSMER ABEL", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "11085430", Codigo_Acceso: "IRL93Y", Nombre: "JUCHAHUAÑO CORI ADELINA", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "99999999", Codigo_Acceso: "885QCC", Nombre: "LIMA QUIROZ NICOL", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "12432303", Codigo_Acceso: "RC5JBK", Nombre: "LINARES VALENCIA JHEREMY", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "16796424", Codigo_Acceso: "SP909L", Nombre: "LLANOS MEGIA MELAY", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "9482726", Codigo_Acceso: "8CGDLV", Nombre: "LOPEZ VERA JOSE MATHEW", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "12810945", Codigo_Acceso: "LXRVYN", Nombre: "LUPE TOLA JHO ALEX", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "13481521", Codigo_Acceso: "YUAZZ7", Nombre: "MAMANI POZO JOSE ARIEL", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "12937112", Codigo_Acceso: "CSLYG4", Nombre: "MENDOZA GONZALEZ ANDRES", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "15778734", Codigo_Acceso: "BFROET", Nombre: "MOSTACEDO COLQUE KAREN", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "188888", Codigo_Acceso: "R9ACMT", Nombre: "NOGALES CORDOBA ROBERTO", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "15906925", Codigo_Acceso: "WTXP21", Nombre: "NOGALES REVOLLO LITZY", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "12548370", Codigo_Acceso: "2N76SM", Nombre: "PEREZ SALAZAR MATIAS JESUS", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "15055032", Codigo_Acceso: "N6PM87", Nombre: "PRADO GARVIZU LUIS FERNANDO", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "199999", Codigo_Acceso: "XU5HKH", Nombre: "QUENTA MAMANI ANALIA", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "100100", Codigo_Acceso: "00WODT", Nombre: "QUENTA QUIROGA ANTONELLA LIBERTAD", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "9502213", Codigo_Acceso: "VCFOBR", Nombre: "QUINTEROS PINTO GROVER MIGUEL", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "1511750", Codigo_Acceso: "B98VIB", Nombre: "QUINTEROS SANDOBAL JOSE ENRRIQUE", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "62673927", Codigo_Acceso: "V20UA9", Nombre: "QUISPE CORRALES EDIT ESMERALDA", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "14070894", Codigo_Acceso: "VRRX2Z", Nombre: "REVOLLO MIRANDA DIEGO", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "15555555", Codigo_Acceso: "IGI1J2", Nombre: "RIVERA PEREZ MARCUS LOGAN", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "12969351", Codigo_Acceso: "7ZQ1Y7", Nombre: "RODRIGUEZ CAMACHO IRIS YARELIZ", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "14649007", Codigo_Acceso: "5S1NJ7", Nombre: "RODRIGUEZ LEON KEVIN", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "13036995", Codigo_Acceso: "HIOTAH", Nombre: "ROJAS CORRALES KEYLA AMELIA", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "11111111", Codigo_Acceso: "3BS2FY", Nombre: "ROJAS MENECES LIONEL", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "14332862", Codigo_Acceso: "CYWS7H", Nombre: "SANDOVAL ZANCHEZ LIZBETH", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "13384172", Codigo_Acceso: "F8PRO5", Nombre: "SIANCAS LEDEZMA YANINA KATHIA", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "16330955", Codigo_Acceso: "51Z7IJ", Nombre: "SOLIZ MAMANI MARELY", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "12909430", Codigo_Acceso: "0R63QV", Nombre: "TERCEROS IBAÑEZ JHESSICA SARAI", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "16636047", Codigo_Acceso: "YRS3SB", Nombre: "TORRICO CLAROS FRANCIS MAVRIC", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "13384961", Codigo_Acceso: "6SZHGW", Nombre: "URIBE RAYA CELINA NAIR", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "12112121", Codigo_Acceso: "F3BU8C", Nombre: "VIGABRIEL MENECES ADRIEL ANGEL", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "22222222", Codigo_Acceso: "2AXNRU", Nombre: "VILLAROEL TERCEROS MILEY", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "17033621", Codigo_Acceso: "S75ZRX", Nombre: "YAPURA RAMIREZ ISMAEL", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "1888888", Codigo_Acceso: "IU7IDG", Nombre: "YAVI CHOQUE JHOEL MARCOS", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "1111111", Codigo_Acceso: "B31AO5", Nombre: "ZAMBRANA CONDORI MELANI PAMELA", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "15027587", Codigo_Acceso: "ZM6PKM", Nombre: "ZAMBRANA OLIVERA ZURIÑE", Curso: "5to", Paralelo: "G2", Estado: "Activo" },
  { CI: "13228807", Codigo_Acceso: "FYS6C6", Nombre: "ZAPATA VERDUGUEZ YAIR", Curso: "5to", Paralelo: "G1", Estado: "Activo" },
  { CI: "16321265", Codigo_Acceso: "X8G5B3", Nombre: "ZELADA CASTELLON AYANA MARY", Curso: "5to", Paralelo: "G1", Estado: "Activo" }
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Cuaderno pedagogico")
    .addItem("Preparar practicas", "cpPrepararPublicacionWeb")
    .addItem("Generar codigos faltantes", "cpGenerarCodigosFaltantes")
    .addToUi();
}

function cpPrepararPublicacionWeb() {
  const ss = SpreadsheetApp.getActive();
  const students = cpReadObjects(ss, CP_SHEETS.students, CP_HEADERS.Estudiantes);
  if (!students.length) throw new Error("La hoja Estudiantes esta vacia. Complete o restaure la lista antes de preparar practicas.");
  cpPreparePracticesSheets(ss, students);
  SpreadsheetApp.getUi().alert("Hojas de practicas listas: PRAC-1T, PRAC-2T y PRAC-3T.");
}

function cpGenerarCodigosFaltantes() {
  const ss = SpreadsheetApp.getActive();
  cpEnsureSheet(ss, CP_SHEETS.students, CP_HEADERS.Estudiantes);
  const info = cpReadCourseInfo(ss);
  const students = cpBuildStudents(ss, info);
  if (!students.length) throw new Error("No se encontraron estudiantes para generar codigos.");
  cpWriteObjects(ss, CP_SHEETS.students, CP_HEADERS.Estudiantes, students);
  SpreadsheetApp.getUi().alert("Codigos generados o conservados en la hoja Estudiantes.");
}

function cpBuildStudents(ss, info) {
  if (CP_STUDENT_DIRECTORY.length) {
    const now = cpTimestamp();
    const parallel = cpResolveParallel(ss, info);
    return CP_STUDENT_DIRECTORY
      .slice()
      .filter((row) => !parallel || row.Paralelo === parallel)
      .sort(cpCompareByName)
      .map((row, index) => ({
        ID_Estudiante: "EST" + String(index + 1).padStart(3, "0"),
        CI: row.CI,
        Codigo_Acceso: row.Codigo_Acceso,
        Nombre: row.Nombre,
        Curso: row.Curso,
        Paralelo: row.Paralelo,
        Estado: row.Estado,
        Fecha_Registro: now,
        Ultima_Actualizacion: now
      }));
  }

  const filiacion = ss.getSheetByName("FILIACION");
  if (!filiacion) throw new Error("No existe la hoja FILIACION.");

  const existing = cpReadObjects(ss, CP_SHEETS.students, CP_HEADERS.Estudiantes);
  const byName = {};
  existing.forEach((row) => {
    if (row.Nombre) byName[cpNormalize(row.Nombre)] = row;
  });

  const now = cpTimestamp();
  const values = filiacion.getRange(9, 1, 40, 12).getDisplayValues();
  return values
    .filter((row) => row[1])
    .map((row, index) => {
      const name = String(row[1] || "").trim();
      const previous = byName[cpNormalize(name)] || {};
      const id = previous.ID_Estudiante || "EST_" + cpSlug(name).slice(0, 18) + "_" + String(index + 1).padStart(2, "0");
      const ci = String(row[3] || previous.CI || "").trim();
      return {
        ID_Estudiante: id,
        CI: ci,
        Codigo_Acceso: previous.Codigo_Acceso || cpAccessCode(name, ci),
        Nombre: name,
        Curso: info.course,
        Paralelo: info.parallel,
        Estado: "Activo",
        Fecha_Registro: previous.Fecha_Registro || now,
        Ultima_Actualizacion: now
      };
    })
    .sort(cpCompareByName);
}

function cpResolveParallel(ss, info) {
  const fromInfo = String(info && info.parallel || "").trim().toUpperCase();
  if (/^G[12]$/.test(fromInfo)) return fromInfo;
  const fromName = String(ss.getName() || "").toUpperCase().match(/\bG[12]\b/);
  return fromName ? fromName[0] : fromInfo;
}

function cpReadCourseInfo(ss) {
  const filiacion = ss.getSheetByName("FILIACION");
  if (!filiacion) throw new Error("No existe la hoja FILIACION.");
  const values = filiacion.getRange("A1:K6").getDisplayValues();
  return {
    school: values[2][0] || "Unidad Educativa",
    city: values[4][0] || "",
    level: values[0][4] || "",
    subject: values[2][4] || "Materia",
    teacher: values[4][4] || "",
    year: values[0][10] || "2026",
    course: values[2][10] || "",
    parallel: values[4][10] || ""
  };
}

function cpEnsureSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const current = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  const same = headers.every((header, index) => current[index] === header);
  if (!same) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}

function cpPreparePracticesSheets(ss, students) {
  CP_SHEETS.practices.forEach((sheetName) => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    sheet.getRange(2, 1, 1, CP_PRACTICE_HEADERS.length).setValues([CP_PRACTICE_HEADERS]);
    sheet.getRange(2, 1, 1, CP_PRACTICE_HEADERS.length).setFontWeight("bold").setBackground("#e7f0ff");
    sheet.setFrozenRows(2);
    sheet.setFrozenColumns(4);
    if (students && students.length) {
      const existingValues = sheet.getLastRow() > 2
        ? sheet.getRange(3, 1, sheet.getLastRow() - 2, CP_PRACTICE_HEADERS.length).getDisplayValues()
        : [];
      const existingByCi = {};
      existingValues.forEach((row) => {
        if (row[0]) existingByCi[String(row[0])] = row;
      });
      const values = students.map((student) => {
        const previous = existingByCi[String(student.CI)] || [];
        const base = [student.CI, student.Nombre, student.Curso, student.Paralelo];
        return base.concat(CP_PRACTICE_HEADERS.slice(4).map((_, index) => previous[index + 4] || ""));
      });
      const lastRow = Math.max(sheet.getLastRow(), 2);
      if (lastRow > 2) sheet.getRange(3, 1, lastRow - 2, CP_PRACTICE_HEADERS.length).clearContent();
      sheet.getRange(3, 1, values.length, CP_PRACTICE_HEADERS.length).setValues(values);
    }
    sheet.autoResizeColumns(1, CP_PRACTICE_HEADERS.length);
  });
}

function cpWriteObjects(ss, sheetName, headers, objects) {
  const sheet = cpEnsureSheet(ss, sheetName, headers);
  const lastRow = Math.max(sheet.getLastRow(), 1);
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  if (!objects.length) return;
  const values = objects.map((object) => headers.map((header) => object[header] == null ? "" : object[header]));
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
}

function cpReadObjects(ss, sheetName, headers) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getDisplayValues();
  return values.map((row) => {
    const object = {};
    headers.forEach((header, index) => object[header] = row[index]);
    return object;
  });
}

function cpAccessCode(name, ci) {
  const source = cpSlug((ci || name).slice(0, 20));
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = ((hash << 5) - hash) + source.charCodeAt(i);
    hash |= 0;
  }
  return ("CP" + Math.abs(hash).toString(36).toUpperCase()).slice(0, 8);
}

function cpNumber(value) {
  const text = String(value || "").replace(",", ".").trim();
  if (!text) return "";
  const number = Number(text);
  return Number.isFinite(number) ? number : "";
}

function cpCompareByName(a, b) {
  return cpNormalize(a.Nombre).localeCompare(cpNormalize(b.Nombre));
}

function cpNormalize(value) {
  return String(value || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function cpSlug(value) {
  return cpNormalize(value).replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "SIN_DATO";
}

function cpTimestamp() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
}
