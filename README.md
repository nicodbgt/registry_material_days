# Caizén Mensual — App de producción de caños

App web móvil para registrar producción diaria de caños, calcular el peso
por tipo de material y generar el resumen mensual (caizén).

---

## Estructura del proyecto

```
caizen-app/
├── index.html   → UI principal (HTML + CSS)
├── app.js       → Lógica de la app (ES6 modules)
├── db.js        → Capa de datos Supabase (fetch API)
├── schema.sql   → Script SQL para crear las tablas
└── README.md    → Este archivo
```

---

## Setup paso a paso

### 1. Crear el proyecto en Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá una cuenta (gratis).
2. Creá un nuevo proyecto (nombre: `caizen`, región: South America).
3. Esperá que termine de provisionar (~2 min).

### 2. Crear las tablas

1. En el panel de Supabase, andá a **SQL Editor → New query**.
2. Pegá el contenido completo de `schema.sql`.
3. Hacé clic en **Run**.
4. Las tablas `modelos`, `dias_produccion` y `lineas_produccion` se crean
   junto con todos los modelos originales cargados.

### 3. Obtener las credenciales

1. Andá a **Project Settings → API**.
2. Copiá:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **anon / public key** (la clave larga que empieza con `eyJ...`)

### 4. Configurar db.js

Abrí `db.js` y reemplazá las dos líneas al principio:

```js
const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';  // ← tu URL
const SUPABASE_KEY = 'TU_ANON_KEY';                       // ← tu clave
```

### 5. Servir la app

La app usa ES6 modules (`type="module"`), así que **no se puede abrir
directamente como archivo** (`file://`). Necesitás un servidor HTTP simple.

#### Opción A — Python (más fácil, sin instalar nada)
```bash
cd caizen-app
python3 -m http.server 8080
```
Después abrís `http://localhost:8080` en el celular
(el celular y la PC deben estar en la misma red Wi-Fi).

#### Opción B — Node.js / npx
```bash
cd caizen-app
npx serve .
```

#### Opción C — VS Code
Instalá la extensión **Live Server** y hacé clic en "Go Live".

#### Opción D — GitHub Pages (acceso desde cualquier lugar)
1. Subí la carpeta a un repositorio GitHub.
2. Andá a **Settings → Pages → Branch: main → Save**.
3. La app queda accesible en `https://tu-usuario.github.io/caizen-app/`.

---

## Uso diario

### Carga diaria
1. Seleccioná el modelo del selector desplegable.
2. Ingresá la cantidad de caños fabricados.
3. Tocá **Agregar** (podés sumar varios modelos).
4. Al terminar el día, tocá **Guardar día** → queda registrado en Supabase.

### Historial
- Muestra todos los días cargados del mes actual.
- Podés borrar un día individual con el ícono de papelera.
- Al cierre de mes, "Limpiar mes" borra todos los registros del mes.

### Resumen (Caizén)
- Peso total del mes y cantidad de días cargados.
- Barras comparativas por material: **3052K**, **3053F**, **3053E**.
- Detalle de todos los modelos ordenados por peso.

### Modelos
- Listado de todos los modelos activos con material y peso unitario.
- Podés filtrar por material con los chips.
- **Nuevo**: agrega un modelo con código, peso y material.
- **Editar**: actualiza el peso o material de un modelo existente.
- **Eliminar**: desactiva el modelo (el historial histórico se conserva).

---

## Base de datos

### Tablas

| Tabla | Descripción |
|-------|-------------|
| `modelos` | Catálogo de modelos de caños con código, material y peso unitario |
| `dias_produccion` | Una fila por día de trabajo (fecha) |
| `lineas_produccion` | Detalle de cuántas unidades de cada modelo se produjeron ese día. Incluye `peso_total` como columna calculada. |

### Materiales soportados
- `3052K`
- `3053F`
- `3053E`

---

## Notas técnicas

- La app no usa ningún framework (Vanilla JS + ES6 modules).
- Sin dependencias npm, sin build step, sin bundler.
- Toda la comunicación con Supabase es vía REST API directa (fetch).
- Los datos del día en progreso se guardan en `sessionStorage` para no
  perderlos si se recarga la página accidentalmente.
- La columna `peso_total` en `lineas_produccion` es una **generated column**
  (calculada por la DB), nunca se escribe desde la app.

## Reporte mensual

La API `POST /api/reportes/mensual` recibe el JSON definido en
`KaizenMonthlyReporter.md`. Genera el CSV o el Excel en `reports/` y lo envía
como adjunto con el asunto `Reporte Kaizen Actualizado - [mes_reporte]`.

El Excel es un reporte nuevo con los materiales en `A17:A19` (`3053E`,
`3053F`, `3052K`) y los días 1 a 31 en `B:AF`; no copia la plantilla Kaizen.

Configurá estas variables en `.env` antes de usarla:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario
SMTP_PASS=contraseña
REPORT_FROM=reportes@example.com
```

La ruta devuelve `status: "error"` y no simula el envío si falta alguna
variable SMTP o falla la entrega.