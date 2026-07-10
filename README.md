# Sistema Web Academico de Notas

Sistema web para consulta segura de notas con **CI + codigo personal**, administracion privada con **login + token temporal**, Google Sheets como base de datos, Google Apps Script como API y publicacion en GitHub Pages.

## Archivos del proyecto

- `index.html`: consulta publica para estudiantes.
- `html/login.html`: acceso administrativo.
- `html/admin.html`: dashboard privado.
- `css/`: estilos responsivos.
- `js/`: logica frontend.
- `assets/img/logo.png`: logo optimizado usado por las paginas.
- `assets/img/LogoUE-original.png`: logo original de respaldo.
- `apps-script/Code.gs`: API para Google Apps Script.
- `README.md`: instalacion, seguridad y uso.

## 1. Crear Google Sheets

1. Cree una hoja de calculo en Google Drive.
2. Abra **Extensiones > Apps Script**.
3. Pegue todo el contenido de `apps-script/Code.gs`.
4. Guarde el proyecto.
5. Ejecute la funcion `setup`.
6. Autorice los permisos solicitados.

La funcion `setup` crea estas hojas:

- `Estudiantes`
- `Notas`
- `Materias`
- `Cursos`
- `Administradores`
- `Historial`
- `Configuracion`
- `Backups`

## 2. Crear administrador

En Apps Script, ejecute la funcion:

```js
createAdmin("admin", "Cambiar_Esta_Clave_123", "Administrador general")
```

Roles disponibles:

- `Administrador general`: administra todo, configuracion, backups y eliminaciones.
- `Docente`: administra estudiantes, materias, cursos y notas.
- `Solo lectura`: consulta reportes y datos.

La contraseña no se guarda en el frontend. Apps Script almacena un hash SHA-256 con salt en `PropertiesService`.

## 3. Publicar Google Apps Script como Web App

1. En Apps Script abra **Implementar > Nueva implementacion**.
2. Tipo: **Aplicacion web**.
3. Ejecutar como: **Yo**.
4. Quien tiene acceso: **Cualquier usuario**.
5. Publique y copie la URL de la aplicacion web.

## 4. Conectar el frontend con la API

En estos archivos reemplace:

```js
const API_URL = "PEGAR_AQUI_URL_WEB_APP_APPS_SCRIPT";
```

por la URL publicada de Apps Script:

- `js/script.js`
- `js/login.js`
- `js/admin.js`

Use `fetch` sin headers personalizados para evitar preflight CORS innecesario en Google Apps Script.

## 5. Publicar en GitHub Pages

1. Cree un repositorio en GitHub.
2. Suba todos los archivos del proyecto.
3. Abra **Settings > Pages**.
4. Seleccione la rama principal y la carpeta raiz.
5. Guarde y espere la URL publica.

## 6. Uso del sistema

### Consulta estudiante

1. Abra `index.html` o la URL de GitHub Pages.
2. Ingrese CI.
3. Ingrese codigo personal.
4. El sistema muestra solo los datos del estudiante autenticado.

Si la nota tiene `Publicado = No`, el estudiante vera:

> Sus notas aun no fueron publicadas. Consulte con el docente encargado.

### Administracion

1. Abra `html/login.html`.
2. Ingrese usuario y contraseña.
3. El sistema guarda el token temporal en `sessionStorage`.
4. Todas las acciones del dashboard validan el token en Apps Script.

### Estudiantes

Desde el modulo `Estudiantes` puede:

- Agregar estudiantes.
- Editar estudiantes.
- Eliminar estudiantes con confirmacion.
- Buscar por CI o nombre.
- Filtrar por curso, paralelo y estado.
- Generar o cambiar codigo personal.

### Materias

Desde `Materias` puede:

- Crear materias.
- Editar docente responsable.
- Activar o inactivar materias.
- Eliminar materias con confirmacion.

### Cursos y paralelos

Desde `Cursos` puede:

- Crear cursos.
- Definir paralelo.
- Definir gestion academica.
- Activar o inactivar cursos.
- Eliminar cursos con confirmacion.

### Notas y practicas

Desde `Notas` puede:

- Crear notas.
- Registrar Practica 1 a Practica 4.
- Ingresar nota final manual.
- Calcular nota final automaticamente si se deja vacia.
- Cambiar estado academico.
- Publicar o despublicar notas.
- Eliminar registros incorrectos con confirmacion.

Estados academicos:

- `Aprobado`
- `Reprobado`
- `En seguimiento`
- `Sin completar`

El rango de notas validado en servidor es de `0` a `100`.

### Configuracion institucional

Desde `Configuracion` puede cambiar:

- Nombre de la Unidad Educativa.
- URL del logo institucional.
- Docente o encargado.
- Materia principal.
- Gestion academica.
- Ciudad.
- Texto del pie de pagina.
- Color principal.
- Color secundario.
- Mensaje de bienvenida.

Estos datos se cargan desde la hoja `Configuracion`; no dependen de texto fijo en el HTML.

### Reportes

Desde `Reportes` puede:

- Ver reporte general.
- Filtrar aprobados.
- Filtrar reprobados.
- Filtrar estudiantes en seguimiento.
- Ver notas publicadas.
- Ver notas no publicadas.
- Exportar CSV.
- Imprimir o guardar como PDF con `window.print()`.

### Historial

El sistema registra:

- Login.
- Logout.
- Cambios de configuracion.
- CRUD de estudiantes, materias, cursos y notas.
- Publicacion y despublicacion de notas.
- Backups.

### Backups

Desde `Backups`, el Administrador general puede crear una copia completa del Google Sheets. El respaldo queda registrado con fecha, hora, usuario y enlace de la copia.

## Seguridad aplicada

- No hay contraseñas en archivos publicos.
- El login se valida en Google Apps Script.
- El token temporal se guarda en `sessionStorage`.
- Las acciones administrativas validan token en servidor.
- Los roles se validan en servidor.
- El estudiante consulta con CI + codigo personal.
- La consulta publica no lista estudiantes.
- Las notas no publicadas no se muestran.
- El enlace de Google Sheets no se expone en el frontend.
- El historial permite auditar cambios importantes.

## Datos iniciales recomendados

1. Cree al menos una materia.
2. Cree al menos un curso.
3. Cree un estudiante con CI y codigo personal.
4. Cree una nota asociada al estudiante y materia.
5. Cambie `Publicado` a `Si`.
6. Pruebe la consulta desde `index.html`.

## Nota sobre logo

La version incluida usa `assets/img/logo.png` como logo local para que cargue rapido. Si en Configuracion se pega una URL de logo, esa URL reemplaza el logo local en pantalla.
