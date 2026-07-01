<div align="center">

# 🩻 XPectra — Clínica de Radiografías

**Sistema integral de gestión clínica para radiografías digitales**

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](#-inicio-rápido-con-docker)

[Español](#-descripción) · [English](#-description-english)

</div>

---

## 📋 Descripción

XPectra es una aplicación web full-stack diseñada para centralizar la operación de una clínica de radiografías. Permite gestionar pacientes, citas, imágenes diagnósticas e informes médicos desde una interfaz moderna y segura.

### ¿Qué problema resuelve?

Reemplaza procesos manuales o dispersos en clínicas de radiografías, ofreciendo:

- 📅 **Gestión de citas** — Crear, consultar, reagendar y cancelar con reglas de disponibilidad
- 🔐 **Autenticación segura** — JWT con bloqueo progresivo por intentos fallidos
- 🩻 **Radiografías digitales** — Carga, visualización y descarga de imágenes
- 📄 **Informes médicos** — Generación con predicción IA y exportación PDF
- 👥 **Control de roles** — Flujos separados para usuarios y administradores

---

## 📋 Description (English)

XPectra is a full-stack web application designed to centralize operations for a radiology clinic. It manages patients, appointments, diagnostic images, and medical reports through a modern, secure interface.

**Key features:** Appointment scheduling with availability rules · JWT authentication with progressive lockout · Digital X-ray management · AI-assisted medical reports with PDF export · Role-based access control (user/admin).

---

## 🛠️ Tecnologías / Tech Stack

| Capa | Tecnología |
|------|-----------|
| **Backend** | Node.js 18+, Express 4, MySQL 8 |
| **Autenticación** | JWT (`jsonwebtoken`), bcrypt (`bcryptjs`) |
| **Seguridad** | Helmet (CSP, HSTS), express-rate-limit, CORS |
| **Validación** | express-validator |
| **Archivos** | Multer (upload de imágenes) |
| **Frontend** | HTML5, CSS3, JavaScript vanilla |
| **UI** | Bootstrap 5, Bootstrap Icons |
| **IA** | TensorFlow.js + Teachable Machine |
| **Reportes** | jsPDF (exportación PDF) |

---

## 🚀 Inicio Rápido con Docker

La forma más rápida de levantar el proyecto:

```bash
# 1. Clonar el repositorio
git clone https://github.com/CR1309/Xpectra_CR.git
cd Xpectra_CR.git

# 2. Levantar MySQL + App con un solo comando
docker compose up -d

# 3. Abrir en el navegador
open http://localhost:3000
```

> La base de datos se inicializa automáticamente con el schema y datos de ejemplo.

---

## ⚙️ Instalación Manual

### Requisitos previos

- **Node.js** 18 o superior
- **MySQL** 8.0 o MariaDB 10.4+

### 1. Clonar el repositorio

```bash
git clone https://github.com/CR1309/Xpectra_CR.git
cd Xpectra_CR
```

### 2. Crear la base de datos

```bash
mysql -u root -p < server/schema.sql
```

### 3. Configurar variables de entorno

```bash
cd server
cp .env.example .env
# Edita .env con tus credenciales
```

Variables principales:

| Variable | Descripción | Ejemplo |
|----------|------------|---------|
| `DB_HOST` | Host de MySQL | `localhost` |
| `DB_USER` | Usuario de MySQL | `root` |
| `DB_PASSWORD` | Contraseña de MySQL | `tu_contraseña` |
| `DB_NAME` | Nombre de la base de datos | `clinicaradiografias` |
| `JWT_SECRET` | Secreto para tokens JWT | `mi_clave_secreta_32chars` |
| `PORT` | Puerto del servidor | `3000` |

> Consulta [`server/.env.example`](server/.env.example) para ver todas las opciones disponibles.

### 4. Instalar dependencias

```bash
cd server
npm install
```

### 5. Iniciar el servidor

```bash
# Desarrollo (con recarga automática)
npm run dev

# Producción
npm start
```

Abre http://localhost:3000 en tu navegador.

---

## 📁 Estructura del Proyecto

```
xpectra-clinic/
├── client/                     # Frontend (HTML, CSS, JS)
│   ├── index.html              # Panel principal de gestión
│   ├── landing.html            # Página de presentación
│   ├── admin_informes.html     # Vista de administración de informes
│   ├── app.js                  # Lógica principal del frontend
│   ├── landing.js              # Lógica de la landing page
│   ├── style.css               # Estilos del panel de gestión
│   ├── landing.css             # Estilos de la landing page
│   ├── admin_informes.css      # Estilos de admin informes
│   ├── theme-toggle.js         # Toggle de tema claro/oscuro
│   ├── scripts/                # Scripts auxiliares
│   │   ├── notifications.js    # Sistema de notificaciones
│   │   └── add-profile-button.js
│   ├── img/                    # Imágenes estáticas
│   ├── uploads/                # Radiografías subidas (gitignored)
│   └── vendor/                 # Librerías de terceros
│       ├── bootstrap/
│       ├── bootstrap-icons/
│       ├── tfjs/               # TensorFlow.js
│       ├── teachablemachine/   # Teachable Machine
│       └── jspdf/
│
├── server/                     # Backend (Node.js + Express)
│   ├── server.js               # Servidor Express y API REST
│   ├── schema.sql              # Schema de la base de datos
│   ├── migrations_ods.sql      # Migraciones incrementales
│   ├── .env.example            # Plantilla de variables de entorno
│   ├── package.json
│   └── uploads/                # Archivos del servidor (gitignored)
│
├── docker-compose.yml          # Setup con Docker
├── Dockerfile
├── .gitignore
├── .editorconfig
├── LICENSE                     # MIT
└── README.md
```

---

## 🔌 API Endpoints

### Autenticación

| Método | Ruta | Descripción | Auth |
|--------|------|------------|------|
| `POST` | `/api/register` | Registrar usuario | ❌ |
| `POST` | `/api/login` | Iniciar sesión | ❌ |
| `POST` | `/api/logout` | Cerrar sesión | ❌ |
| `GET` | `/api/login/status` | Estado de bloqueo | ❌ |

### Citas

| Método | Ruta | Descripción | Auth |
|--------|------|------------|------|
| `GET` | `/api/citas` | Listar citas (paginado) | ✅ |
| `POST` | `/api/citas` | Crear cita | ✅ |
| `PUT` | `/api/citas/:id` | Editar cita | ✅ |
| `DELETE` | `/api/citas/:id` | Eliminar cita | ✅ |
| `PUT` | `/api/citas/:id/estado` | Cambiar estado | 🔑 Admin |
| `PUT` | `/api/citas/:id/cancel` | Cancelar cita | ✅ |
| `GET` | `/api/disponibilidad` | Verificar disponibilidad | ✅ |

### Informes y Radiografías

| Método | Ruta | Descripción | Auth |
|--------|------|------------|------|
| `GET` | `/api/informes` | Listar todos los informes | 🔑 Admin |
| `GET` | `/api/informes/mios` | Mis informes | ✅ |
| `GET` | `/api/informes/:id` | Detalle de informe | ✅ |
| `POST` | `/api/informes` | Crear informe | 🔑 Admin |
| `PUT` | `/api/informes/:id` | Editar informe | 🔑 Admin |
| `GET` | `/api/radiografias/:idCita` | Radiografías de una cita | ✅ |
| `POST` | `/api/radiografias/:id/upload` | Subir imagen | 🔑 Admin |

### Otros

| Método | Ruta | Descripción | Auth |
|--------|------|------------|------|
| `GET` | `/api/categorias` | Categorías de estudio | ❌ |
| `GET` | `/api/usuarios` | Listar usuarios | 🔑 Admin |
| `GET` | `/api/usuarios/:id` | Perfil de usuario | ✅ |
| `PUT` | `/api/usuarios/:id` | Editar perfil | ✅ |
| `GET` | `/api/pagos/:id` | Pago de una cita | ✅ |
| `POST` | `/api/preguntas` | Enviar pregunta (landing) | ❌ |

> **Leyenda:** ❌ = Sin autenticación · ✅ = Requiere JWT · 🔑 = Solo administradores

---

## 🔒 Seguridad

El proyecto implementa múltiples capas de seguridad:

- **Autenticación JWT** — Tokens con expiración de 8 horas
- **Cifrado de contraseñas** — bcrypt con salt de 10 rondas
- **Bloqueo progresivo** — Después de 3 intentos fallidos: bloqueo de 1, 5 y 10 minutos (con cooldown)
- **Rate Limiting** — Límite de peticiones por IP (general + específico para login)
- **Helmet** — Cabeceras de seguridad (CSP, X-Frame-Options, HSTS en producción)
- **CORS** — Origen configurado por variable de entorno
- **Validación de entrada** — express-validator en todos los endpoints
- **Consultas parametrizadas** — Prevención de SQL injection con prepared statements
- **Transacciones SQL** — Operaciones atómicas para mantener integridad de datos

---

## 👥 Roles del Sistema

### 👤 Usuario
- Registro e inicio de sesión
- Crear y consultar sus citas
- Ver sus propios informes
- Exportar informes a PDF

### 🔑 Administrador
- Todo lo anterior, más:
- Ver todas las citas e informes
- Crear y editar informes médicos
- Subir imágenes de radiografías
- Cambiar estados de citas
- Gestionar usuarios

---

## 🧪 Tests

```bash
cd server
npm test
```

---

## 🐳 Docker

```bash
# Levantar servicios
docker compose up -d

# Ver logs
docker compose logs -f app

# Detener
docker compose down

# Detener y borrar datos
docker compose down -v
```

---

## 📝 Scripts Disponibles

| Script | Comando | Descripción |
|--------|---------|------------|
| Desarrollo | `npm run dev` | Servidor con recarga automática (nodemon) |
| Producción | `npm start` | Servidor con Node.js |
| Tests | `npm test` | Ejecutar suite de tests |

---

## 📄 Licencia

Este proyecto está bajo la licencia [MIT](LICENSE).

---

<div align="center">

Hecho con ❤️ para la gestión clínica moderna

</div>
