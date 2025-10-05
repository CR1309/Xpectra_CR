require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult, param, query } = require('express-validator');
const multer = require('multer');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'supersecreto';
// Zona horaria por defecto: El Salvador (UTC-06, sin DST)
const TIMEZONE_OFFSET_MINUTES = parseInt(process.env.TZ_OFFSET_MINUTES || '-360', 10); // -6h
// Políticas (horas mínimas)
const POLICY_RESCHEDULE_MIN_HOURS = parseInt(process.env.POLICY_RESCHEDULE_MIN_HOURS || '4', 10);
const POLICY_CANCEL_MIN_HOURS = parseInt(process.env.POLICY_CANCEL_MIN_HOURS || '6', 10);
// Login cooldown: minutos sin actividad (fallos) para reiniciar la etapa (0)
const LOGIN_STAGE_COOLDOWN_MINUTES = parseInt(process.env.LOGIN_STAGE_COOLDOWN_MINUTES || '120', 10);

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
// Confía en el proxy si existe (necesario para rate limiting y cabeceras X-Forwarded-*)
app.set('trust proxy', 1);

// Seguridad de cabeceras con Helmet (sin CSP aquí para no duplicar con la meta del HTML)
// Helmet con CSP centralizada (equivalente a la meta que había en el HTML)
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            defaultSrc: ["'self'"],
            // Nota: tfjs/teachablemachine usan eval() internamente (seedrandom, kernels). Permitimos 'unsafe-eval'.
            // Si en el futuro migras a builds sin eval, quita esta directiva.
            scriptSrc: ["'self'", "'unsafe-eval'", "'wasm-unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
            fontSrc: ["'self'", 'data:'],
            connectSrc: [
                "'self'",
                'https://teachablemachine.withgoogle.com',
                'https://storage.googleapis.com'
            ],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'self'"],
        },
    },
}));

if (process.env.NODE_ENV === 'production') {
    app.use(helmet.hsts({ maxAge: 15552000 })); // ~180 días, solo con HTTPS
}

// Rate limiting: general y específico para login
const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_GENERAL_MAX || '100', 10),
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(generalLimiter);
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../client')));

// Configuración MySQL
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'p1',
    password: process.env.DB_PASSWORD || '123',
    database: process.env.DB_NAME || 'clinicaradiografias',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    maxAllowedPacket: 50 * 1024 * 1024 //
});

// Inicializar tabla de intentos de login (si no existe)
(async function ensureLoginAttemptsTable(){
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS login_attempts (
                ID INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                failed_count INT NOT NULL DEFAULT 0,
                stage TINYINT NOT NULL DEFAULT 0,
                lock_until DATETIME NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
    } catch (e) {
        console.error('No se pudo asegurar la tabla login_attempts:', e);
    }
})();

// Middleware para verificar JWT
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No autenticado' });
    const token = authHeader.split(' ')[1];
    try {
        req.user = jwt.verify(token, SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Token inválido' });
    }
}

// Manejo centralizado de errores
function errorHandler(err, req, res, next) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
}

// Utilidades de fecha/hora
function toUtcMsFromLocal(fechaISO, horaHHmm) {
    const [y,m,d] = fechaISO.split('-').map(Number);
    const [hh,mm] = horaHHmm.split(':').map(Number);
    const naiveUtc = Date.UTC(y, (m-1), d, hh, mm, 0, 0); // interpreta como UTC
    // Convertir hora local (América/El_Salvador) a UTC: utc = local - offset
    return naiveUtc - (TIMEZONE_OFFSET_MINUTES * 60 * 1000);
}
function hoursUntil(fechaISO, horaHHmm) {
    try {
        const targetUtcMs = toUtcMsFromLocal(fechaISO, horaHHmm);
        const nowUtcMs = Date.now();
        return (targetUtcMs - nowUtcMs) / (1000*60*60);
    } catch { return Infinity; }
}
function todayLocalISO() {
    const nowUtc = Date.now();
    const nowLocal = new Date(nowUtc + TIMEZONE_OFFSET_MINUTES * 60 * 1000);
    const y = nowLocal.getUTCFullYear(); // usamos UTC getters porque ya desplazamos
    const m = String(nowLocal.getUTCMonth() + 1).padStart(2,'0');
    const d = String(nowLocal.getUTCDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
}

// Precios por categoría (Fuera de uso)
const PRECIOS_CATEGORIA = {
    'General': 500,
    'Dental': 300,
    'Torax': 700,
    'Otro': 400
};

// Helper para obtener precio por categoría
async function obtenerPrecioPorCategoria(idCita) {
    // Busca la categoría de la radiografía asociada a la cita
    const [[rad]] = await pool.query(`
        SELECT ce.Nombre_Categoria
        FROM radiografia r
        JOIN categoria_estudio ce ON r.ID_Categoria = ce.ID_Categoria
        WHERE r.ID_Cita = ?
    `, [idCita]);
    if (rad && rad.Nombre_Categoria && PRECIOS_CATEGORIA[rad.Nombre_Categoria]) {
        return PRECIOS_CATEGORIA[rad.Nombre_Categoria];
    }
    // Si no hay categoría, retorna precio base
    return PRECIOS_CATEGORIA['Otro'];
}

// Antes de configurar multer, asegúrate de que la carpeta de uploads existe
const uploadsDir = path.join(__dirname, '../client/uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuración de almacenamiento para imágenes de radiografías
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'rad-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Endpoint: Registro de usuario
app.post('/api/register',
    body('Nombre_Usuario').trim().isLength({ min: 3 }).withMessage('El nombre de usuario debe tener al menos 3 caracteres.'),
    body('Correo').isEmail().withMessage('Correo inválido.').normalizeEmail(),
    body('Contrasena').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres.'),
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
        }
        const { Nombre_Usuario, Correo, Contrasena } = req.body;
        try {
            // Verifica si el correo ya existe
            const [users] = await pool.query(
                'SELECT * FROM usuario WHERE Correo = ?',
                [Correo]
            );
            if (users.length > 0) {
                return res.status(400).json({ error: 'El correo ya está registrado.' });
            }
            const hash = await bcrypt.hash(Contrasena, 10);
            // Por defecto, rol "usuario"
            await pool.query(
                'INSERT INTO usuario (Nombre_Usuario, Rol, Correo, Contrasena_Hash) VALUES (?, ?, ?, ?)',
                [Nombre_Usuario, 'usuario', Correo, hash]
            );
            res.status(201).json({ success: true });
        } catch (error) {
            next(error);
        }
    }
);

// Endpoint: Login
// Límite de intentos de login: 5 por minuto por IP
const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '5', 10),
    message: { error: 'Demasiados intentos de login. Intenta de nuevo en un minuto.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.post('/api/login', loginLimiter,
    body('Correo').isEmail(),
    body('Contrasena').isLength({ min: 1 }),
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
        }
        
        const { Correo, Contrasena } = req.body;
        console.log('Intento de login para:', Correo); // Log para depuración
        
        if (!Correo || !Contrasena) {
            return res.status(400).json({ error: 'Correo y contraseña requeridos' });
        }
        
        try {
            const [users] = await pool.query(
                'SELECT * FROM usuario WHERE Correo = ?',
                [Correo]
            );
            
            if (users.length === 0) {
                console.log('Usuario no encontrado:', Correo);
                return res.status(401).json({ error: 'Usuario no encontrado' });
            }
            
            const user = users[0];
            const hash = user.Contrasena_Hash;
            console.log('Usuario encontrado:', user.Correo, 'Hash:', hash ? 'Presente' : 'Ausente');

            // Verificación de bloqueo progresivo por intentos fallidos
            async function getAttempts(uId){
                const [rows] = await pool.query('SELECT failed_count, stage, lock_until, updated_at FROM login_attempts WHERE user_id=?', [uId]);
                if (rows.length === 0) {
                    await pool.query('INSERT INTO login_attempts (user_id, failed_count, stage, lock_until) VALUES (?,?,?,?)', [uId, 0, 0, null]);
                    return { failed_count: 0, stage: 0, lock_until: null, updated_at: new Date() };
                }
                return rows[0];
            }
            async function applyStageCooldown(uId, attempts){
                try {
                    const last = attempts.updated_at ? new Date(attempts.updated_at) : null;
                    if (!last) return attempts;
                    const msInactive = Date.now() - last.getTime();
                    if ((attempts.stage || 0) > 0 && (!attempts.lock_until) && msInactive >= LOGIN_STAGE_COOLDOWN_MINUTES*60*1000) {
                        await pool.query('UPDATE login_attempts SET stage=?, failed_count=?, lock_until=NULL WHERE user_id=?', [0, 0, uId]);
                        return { ...attempts, stage: 0, failed_count: 0, lock_until: null, updated_at: new Date() };
                    }
                } catch(_e) {}
                return attempts;
            }
            function toMySqlDatetime(d){ return new Date(d).toISOString().slice(0,19).replace('T',' '); }
            async function setLock(uId, minutes, nextStage){
                // Fijar lock_until en la BD usando NOW() del servidor para evitar desfases de zona horaria
                const [r] = await pool.query('UPDATE login_attempts SET failed_count=?, stage=?, lock_until=DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE user_id=?', [0, nextStage, minutes, uId]);
                // Calcular "until" localmente para respuesta consistente
                const until = new Date(Date.now() + minutes*60*1000);
                return until;
            }
            async function incFail(uId, cur){
                const next = (cur.failed_count||0) + 1;
                await pool.query('UPDATE login_attempts SET failed_count=? WHERE user_id=?', [next, uId]);
                return next;
            }
            async function resetAttempts(uId){
                await pool.query('UPDATE login_attempts SET failed_count=?, stage=?, lock_until=? WHERE user_id=?', [0, 0, null, uId]);
            }

            let attempts = await getAttempts(user.ID_Usuario);
            attempts = await applyStageCooldown(user.ID_Usuario, attempts);
            if (attempts.lock_until) {
                const now = new Date();
                const lockDate = new Date(attempts.lock_until);
                if (lockDate > now) {
                    const secs = Math.max(0, Math.ceil((lockDate - now)/1000));
                    return res.status(429).json({ error: `Cuenta bloqueada temporalmente. Intenta nuevamente en ${secs} segundos.`, secondsLeft: secs, stage: attempts.stage });
                } else {
                    // Limpiar lock expirado (mantiene la etapa alcanzada)
                    try { await pool.query('UPDATE login_attempts SET lock_until=NULL WHERE user_id=?', [user.ID_Usuario]); } catch(_e) {}
                }
            }
            
            // Verificar que el hash de contraseña existe
            if (!hash) {
                console.error('Hash de contraseña faltante para usuario:', user.Correo);
                return res.status(500).json({ error: 'Error en configuración de usuario' });
            }
            
            // Comparar contraseña
            const valid = await bcrypt.compare(Contrasena, hash);
            console.log('Validación de contraseña:', valid);
            
            if (!valid) {
                // Incrementar contador y bloquear si corresponde (cada 3 fallos)
                const current = await getAttempts(user.ID_Usuario);
                const fails = await incFail(user.ID_Usuario, current);
                if (fails >= 3) {
                    // Determinar duración según etapa
                    const stage = Math.max(0, Math.min(2, current.stage || 0));
                    const minutes = stage === 0 ? 1 : (stage === 1 ? 5 : 10);
                    const nextStage = Math.min(2, stage + 1);
                    const until = await setLock(user.ID_Usuario, minutes, nextStage);
                    const secs = Math.ceil((until - new Date())/1000);
                    return res.status(429).json({ error: `Demasiados intentos fallidos. Bloqueado por ${minutes} minuto(s). Intenta en ${secs} segundos.`, secondsLeft: secs, lockedMinutes: minutes, stage: nextStage });
                }
                const remaining = Math.max(0, 3 - fails);
                const stage = Math.max(0, Math.min(2, current.stage || 0));
                const nextLockMinutes = stage === 0 ? 1 : (stage === 1 ? 5 : 10);
                return res.status(401).json({ error: 'Contraseña incorrecta', remainingAttempts: remaining, nextLockMinutes });
            }
            
            const token = jwt.sign({
                ID_Usuario: user.ID_Usuario,
                Rol: user.Rol,
                Correo: user.Correo
            }, SECRET, { expiresIn: '8h' });
            
            console.log('Login exitoso para:', user.Correo);
            // Resetear intentos en éxito
            try { await resetAttempts(user.ID_Usuario); } catch(_e) {}
            
            // Devuelve más datos del usuario para el frontend
            res.json({ 
                token, 
                user: { 
                    ID_Usuario: user.ID_Usuario, 
                    Rol: user.Rol, 
                    Correo: user.Correo,
                    Nombre_Usuario: user.Nombre_Usuario
                } 
            });
        } catch (error) {
            console.error('Error en login:', error);
            // Devuelve el mensaje de error real solo en desarrollo
            res.status(500).json({ error: 'Error interno del servidor (login).' });
        }
    }
);

// Endpoint: Estado de bloqueo por correo (para mostrar contador en UI)
const loginStatusLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120, // permite hasta 2 req/seg por IP
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        // Indica al cliente cuándo retry (en segundos)
        const retryAfter = Math.ceil((options.windowMs || 60000) / 1000);
        res.set('Retry-After', String(retryAfter));
        return res.status(options.statusCode || 429).json({ error: 'Too many requests', locked: false });
    }
});

app.get('/api/login/status', loginStatusLimiter, [
    query('correo').isEmail()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ locked: false });
    }
    const correo = String(req.query.correo || '').trim();
    try {
        const [users] = await pool.query('SELECT ID_Usuario FROM usuario WHERE Correo=?', [correo]);
        if (users.length === 0) {
            // No revelar existencia: responder genérico
            return res.json({ locked: false });
        }
        const userId = users[0].ID_Usuario;
        const [rows] = await pool.query('SELECT failed_count, stage, lock_until, updated_at FROM login_attempts WHERE user_id=?', [userId]);
        if (rows.length === 0) return res.json({ locked: false });
        let { failed_count, stage, lock_until, updated_at } = rows[0];
        // Cooldown de etapa por inactividad
        try {
            const last = updated_at ? new Date(updated_at) : null;
            if (last) {
                const msInactive = Date.now() - last.getTime();
                if ((stage || 0) > 0 && !lock_until && msInactive >= LOGIN_STAGE_COOLDOWN_MINUTES*60*1000) {
                    await pool.query('UPDATE login_attempts SET stage=?, failed_count=? WHERE user_id=?', [0, 0, userId]);
                    stage = 0; failed_count = 0;
                }
            }
        } catch(_e) {}
        const now = new Date();
        if (lock_until) {
            const lockDate = new Date(lock_until);
            if (lockDate > now) {
                const secs = Math.max(0, Math.ceil((lockDate - now)/1000));
                return res.json({ locked: true, secondsLeft: secs, stage });
            } else {
                // Limpiar lock expirado
                try { await pool.query('UPDATE login_attempts SET lock_until=NULL WHERE user_id=?', [userId]); } catch(_e) {}
            }
        }
    // Si no está bloqueado, informar intentos restantes (failed_count se resetea tras bloqueo)
    const fails = Number(failed_count || 0);
    const remainingAttempts = Math.max(0, 3 - fails);
        const s = Math.max(0, Math.min(2, Number(stage || 0)));
        const nextLockMinutes = s === 0 ? 1 : (s === 1 ? 5 : 10);
        return res.json({ locked: false, remainingAttempts, nextLockMinutes });
    } catch (e) {
        return res.json({ locked: false });
    }
});

// Endpoint: Logout (opcional, solo frontend borra el token)
app.post('/api/logout', (req, res) => {
    res.json({ success: true });
});

// Endpoint: Disponibilidad de correo (registro)
app.get('/api/usuarios/disponible', [
    query('correo').isEmail()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(200).json({ available: false, reason: 'Formato de correo inválido' });
    }
    const correo = String(req.query.correo || '').trim();
    try {
        const [users] = await pool.query('SELECT 1 FROM usuario WHERE Correo = ? LIMIT 1', [correo]);
        return res.json({ available: users.length === 0 });
    } catch(_e){
        return res.json({ available: false });
    }
});

// Endpoint: Obtener todas las citas (con paginación)
app.get('/api/citas', authMiddleware, [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res, next) => {
    try {
        let rows;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        if (req.user.Rol === 'admin') {
            [rows] = await pool.query(`
                SELECT 
                    c.*, 
                    p.Nombre, p.Apellido, p.Fecha_Nacimiento, p.Sexo, p.Direccion, p.Telefono, p.Correo_Electronico,
                    u.Correo as UsuarioCorreo,  -- Asegura el alias correcto
                    c.ID_Usuario
                FROM cita c
                JOIN paciente p ON c.ID_Paciente = p.ID_Paciente
                JOIN usuario u ON c.ID_Usuario = u.ID_Usuario
                LIMIT ? OFFSET ?
            `, [limit, offset]);
        } else {
            [rows] = await pool.query(`
                SELECT 
                    c.*, 
                    p.Nombre, p.Apellido, p.Fecha_Nacimiento, p.Sexo, p.Direccion, p.Telefono, p.Correo_Electronico,
                    c.ID_Usuario
                FROM cita c
                JOIN paciente p ON c.ID_Paciente = p.ID_Paciente
                WHERE c.ID_Usuario = ?
                LIMIT ? OFFSET ?
            `, [req.user.ID_Usuario, limit, offset]);
        }
        res.json(rows);
    } catch (error) {
        next(error);
    }
});

// Modifica el endpoint de crear cita para aceptar método y fecha de pago si aplica
app.post('/api/citas', authMiddleware, [
    body('Nombre').notEmpty(),
    body('Apellido').notEmpty(),
    body('Fecha_Nacimiento').isDate(),
    body('Sexo').notEmpty(),
    body('Direccion').notEmpty(),
    body('Telefono').notEmpty(),
    body('Correo_Electronico').isEmail(),
    body('Fecha_Cita').isDate(),
    body('Hora_Cita').notEmpty(),
    body('ID_Categoria').isInt(),
    body('Fecha_Cita').custom(value => {
        // Comparación según zona horaria configurada
        const hoyISO = todayLocalISO();
        const msFecha = toUtcMsFromLocal(value, '00:00');
        const msHoy = toUtcMsFromLocal(hoyISO, '00:00');
        if (msFecha < msHoy) {
            throw new Error('La fecha de la cita no puede ser anterior a hoy');
        }
        return true;
    }),
], async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    }
    const {
        Nombre,
        Apellido,
        Fecha_Nacimiento,
        Sexo,
        Direccion,
        Telefono,
        Correo_Electronico,
        Fecha_Cita,
        Hora_Cita,
        Motivo,
        Metodo_Pago,
        Fecha_Pago,
        Tipo_Pago,
        ID_Categoria
    } = req.body;

    // Log para depuración de campos recibidos
    console.log('POST /api/citas', {
        Nombre, Apellido, Fecha_Nacimiento, Sexo, Direccion, Telefono, Correo_Electronico,
        Fecha_Cita, Hora_Cita, Motivo, Metodo_Pago, Fecha_Pago, ID_Categoria
    });

    if (
        !Nombre || !Apellido || !Fecha_Nacimiento || !Sexo ||
        !Direccion || !Telefono || !Correo_Electronico ||
        !Fecha_Cita || !Hora_Cita
    ) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }

    if (!ID_Categoria) {
        return res.status(400).json({ error: 'La categoría de estudio es obligatoria.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Buscar si el paciente ya existe (por nombre, apellido y fecha de nacimiento)
        const [pacienteExistente] = await connection.query(
            `SELECT ID_Paciente FROM paciente WHERE Nombre = ? AND Apellido = ? AND Fecha_Nacimiento = ?`,
            [Nombre, Apellido, Fecha_Nacimiento]
        );

        let idPaciente;
        if (pacienteExistente.length > 0) {
            idPaciente = pacienteExistente[0].ID_Paciente;
        } else {
            const [paciente] = await connection.query(
                `INSERT INTO paciente 
                (Nombre, Apellido, Fecha_Nacimiento, Sexo, Direccion, Telefono, Correo_Electronico) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [Nombre, Apellido, Fecha_Nacimiento, Sexo, Direccion, Telefono, Correo_Electronico]
            );
            idPaciente = paciente.insertId;
        }

        // Verifica si el slot (fecha/hora) está ocupado en la clínica
        const [[ocup]] = await connection.query(
            `SELECT COUNT(1) AS cnt FROM cita WHERE Fecha_Cita = ? AND Hora_Cita = ?`,
            [Fecha_Cita, Hora_Cita]
        );
        if (ocup.cnt > 0) {
            // Construye sugerencias de horarios libres
            const sugerencias = await sugerirHorarios(connection, Fecha_Cita, Hora_Cita, 5);
            await connection.rollback();
            return res.status(409).json({ 
                error: 'La fecha y hora seleccionadas ya están ocupadas.',
                suggestions: sugerencias
            });
        }

        // Verifica si ya existe una cita para este paciente en la misma fecha y hora (duplicado por paciente)
        const [citaExistente] = await connection.query(
            `SELECT ID_Cita FROM cita WHERE ID_Paciente = ? AND Fecha_Cita = ? AND Hora_Cita = ?`,
            [idPaciente, Fecha_Cita, Hora_Cita]
        );
        if (citaExistente.length > 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'La cita ya existe para este paciente en esa fecha y hora.' });
        }

        // Usar el usuario autenticado como clave foránea
        const idUsuario = req.user.ID_Usuario;

        // Insertar cita vinculada a usuario y paciente
        const [result] = await connection.query(
            'INSERT INTO cita (Fecha_Cita, Hora_Cita, Motivo, ID_Paciente, ID_Usuario) VALUES (?, ?, ?, ?, ?)',
            [Fecha_Cita, Hora_Cita, Motivo || null, idPaciente, idUsuario]
        );

        if (result.affectedRows === 1) {
            // Crea radiografía vacía asociada a la cita y categoría (el admin podrá subir la imagen después)
            await connection.query(
                'INSERT INTO radiografia (Fecha_Realizacion, Imagen_URL, ID_Cita, ID_Categoria) VALUES (?, ?, ?, ?)', 
                [Fecha_Cita, '', result.insertId, ID_Categoria]
            );

            // Si se envió método y fecha de pago, crea el pago
            if (Metodo_Pago && Fecha_Pago) {
                await connection.query(
                    'INSERT INTO pago (Fecha_Pago, Monto, Metodo_Pago, Estado, ID_Paciente, ID_Cita, Tipo_Pago) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [Fecha_Pago, 0, Metodo_Pago, 'Pendiente', idPaciente, result.insertId, Tipo_Pago || 'Completo']
                );
            }
            await connection.commit();
            res.status(201).json({ success: true, ID_Paciente: idPaciente });
        } else {
            res.status(500).json({ error: 'No se pudo guardar la cita.' });
        }
    } catch (error) {
        await connection.rollback();
        console.error('Error al insertar cita:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'La cita ya existe para este paciente en esa fecha y hora.' });
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            res.status(400).json({ error: 'El usuario o paciente no existe.' });
        } else {
            res.status(400).json({ error: error.message });
        }
    } finally {
        connection.release();
    }
});

// Helper: generar intervalos de 30 minutos en el horario de la clínica y sugerir huecos libres
async function sugerirHorarios(conn, fechaISO, horaISO, maxSugerencias = 5, excluirIdCita = null) {
    const pasoMin = 30;
    const horaInicio = 8;  // 08:00
    const horaFin = 18;    // 18:00
    // Obtiene horas ocupadas de ese día
    const [ocupadasRows] = await conn.query(
        `SELECT Hora_Cita FROM cita WHERE Fecha_Cita = ? ${excluirIdCita ? 'AND ID_Cita <> ?' : ''}`,
        excluirIdCita ? [fechaISO, excluirIdCita] : [fechaISO]
    );
    const ocupadas = new Set(
        ocupadasRows.map(r => (r.Hora_Cita || '').toString().slice(0,5))
    );
    // Genera slots del día
    const slots = [];
    for (let h = horaInicio; h <= horaFin; h++) {
        for (let m = 0; m < 60; m += pasoMin) {
            const hh = String(h).padStart(2, '0');
            const mm = String(m).padStart(2, '0');
            slots.push(`${hh}:${mm}`);
        }
    }
    const solicitada = (horaISO || '').slice(0,5);
    // Filtra libres
    const libres = slots.filter(t => !ocupadas.has(t));
    // Ordena por cercanía a la solicitada
    function minutos(t) { const [H,M]=t.split(':').map(Number); return H*60+M; }
    const target = minutos(solicitada);
    libres.sort((a,b)=>Math.abs(minutos(a)-target)-Math.abs(minutos(b)-target));
    const sugerencias = libres.slice(0, Math.min(maxSugerencias, libres.length)).map(h => ({ fecha: fechaISO, hora: h }));
    // Si no hay suficientes, mira días siguientes (hasta 7 días)
    let dia = new Date(fechaISO);
    for (let d = 1; sugerencias.length < maxSugerencias && d <= 7; d++) {
        const d2 = new Date(dia);
        d2.setDate(d2.getDate()+d);
        const y = d2.getFullYear(); const m = String(d2.getMonth()+1).padStart(2,'0'); const day = String(d2.getDate()).padStart(2,'0');
        const fecha2 = `${y}-${m}-${day}`;
        const [oc2] = await conn.query(
            `SELECT Hora_Cita FROM cita WHERE Fecha_Cita = ? ${excluirIdCita ? 'AND ID_Cita <> ?' : ''}`,
            excluirIdCita ? [fecha2, excluirIdCita] : [fecha2]
        );
        const set2 = new Set(oc2.map(r => (r.Hora_Cita || '').toString().slice(0,5)));
        const libres2 = slots.filter(t => !set2.has(t));
        libres2.sort((a,b)=>Math.abs(minutos(a)-target)-Math.abs(minutos(b)-target));
        libres2.slice(0, Math.min(maxSugerencias - sugerencias.length, libres2.length))
            .forEach(h => sugerencias.push({ fecha: fecha2, hora: h }));
    }
    return sugerencias;
}

// Endpoint: comprobar disponibilidad y dar sugerencias
app.get('/api/disponibilidad', authMiddleware, [
    query('fecha').isISO8601().withMessage('fecha inválida'),
    query('hora').matches(/^\d{2}:\d{2}$/).withMessage('hora inválida'),
    query('excluirIdCita').optional().isInt()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Parámetros inválidos', details: errors.array() });
    const { fecha, hora } = req.query;
    const excluirIdCita = req.query.excluirIdCita ? parseInt(req.query.excluirIdCita) : null;
    const conn = await pool.getConnection();
    try {
        const [[ocup]] = await conn.query(
            `SELECT COUNT(1) AS cnt FROM cita WHERE Fecha_Cita = ? AND Hora_Cita = ? ${excluirIdCita ? 'AND ID_Cita <> ?' : ''}`,
            excluirIdCita ? [fecha, hora, excluirIdCita] : [fecha, hora]
        );
        const available = ocup.cnt === 0;
        let suggestions = [];
        if (!available) suggestions = await sugerirHorarios(conn, fecha, hora, 5, excluirIdCita);
        res.json({ available, suggestions });
    } catch (e) {
        res.status(500).json({ error: 'Error al comprobar disponibilidad' });
    } finally {
        conn.release();
    }
});

// Endpoint: Editar cita (solo dueño o admin)
app.put('/api/citas/:id', authMiddleware, async (req, res) => {
    const idCita = req.params.id;
    const { Fecha_Cita, Hora_Cita, Motivo } = req.body;
    // Log de entrada para depuración
    console.log('PUT /api/citas/:id', { idCita, Fecha_Cita, Hora_Cita, Motivo, user: req.user });

    if (!Fecha_Cita || !Hora_Cita) {
        return res.status(400).json({ error: 'Fecha y hora obligatorias.' });
    }
    try {
        // Verificar permisos
        let citaArr;
        if (req.user.Rol === 'admin') {
            [citaArr] = await pool.query('SELECT * FROM cita WHERE ID_Cita = ?', [idCita]);
        } else {
            [citaArr] = await pool.query('SELECT * FROM cita WHERE ID_Cita = ? AND ID_Usuario = ?', [idCita, req.user.ID_Usuario]);
        }
        const cita = citaArr[0];
        if (!cita) {
            return res.status(403).json({ error: 'No tienes permiso para editar esta cita.' });
        }
        // Política de reagendado para usuarios (no admin)
        if (req.user.Rol !== 'admin') {
            const hrs = hoursUntil(cita.Fecha_Cita, cita.Hora_Cita);
            if (hrs < POLICY_RESCHEDULE_MIN_HOURS) {
                return res.status(400).json({ error: `No puedes reagendar con menos de ${POLICY_RESCHEDULE_MIN_HOURS} horas de anticipación.` });
            }
        }
        // Validación: nueva fecha/hora no puede ser en el pasado
        const hrsNew = hoursUntil(Fecha_Cita, Hora_Cita);
        if (hrsNew <= 0) {
            return res.status(400).json({ error: 'La nueva fecha/hora debe ser en el futuro.' });
        }
        // Conflicto de disponibilidad (excluyendo la propia cita)
        const [[ocup]] = await pool.query(
            `SELECT COUNT(1) AS cnt FROM cita WHERE Fecha_Cita = ? AND Hora_Cita = ? AND ID_Cita <> ?`,
            [Fecha_Cita, Hora_Cita, idCita]
        );
        if (ocup.cnt > 0) {
            // Sugerencias cercanas
            const conn = await pool.getConnection();
            try {
                const sugerencias = await sugerirHorarios(conn, Fecha_Cita, Hora_Cita, 5, Number(idCita));
                return res.status(409).json({ error: 'Horario ocupado.', suggestions: sugerencias });
            } finally { conn.release(); }
        }
        // Actualizar cita
        const [result] = await pool.query(
            'UPDATE cita SET Fecha_Cita = ?, Hora_Cita = ?, Motivo = ? WHERE ID_Cita = ?',
            [Fecha_Cita, Hora_Cita, Motivo || null, idCita]
        );
        if (result.affectedRows === 1) {
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'No se pudo actualizar la cita.' });
        }
    } catch (error) {
        console.error('Error en PUT /api/citas/:id:', error); // Log detallado
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Cambiar estado de cita (solo admin)
app.put('/api/citas/:id/estado', authMiddleware, async (req, res) => {
    if (req.user.Rol !== 'admin') {
        return res.status(403).json({ error: 'Solo los administradores pueden cambiar el estado.' });
    }
    const idCita = req.params.id;
    const { Estado } = req.body;
    if (!Estado) {
        return res.status(400).json({ error: 'El estado es obligatorio.' });
    }
    try {
        const [result] = await pool.query(
            'UPDATE cita SET Estado = ? WHERE ID_Cita = ?',
            [Estado, idCita]
        );
        if (result.affectedRows === 1) {
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'No se pudo actualizar el estado.' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Eliminar cita (solo dueño o admin)
app.delete('/api/citas/:id', authMiddleware, async (req, res) => {
    const idCita = req.params.id;
    const connection = await pool.getConnection();
    try {
        // Verificar permisos
        let citaArr;
        if (req.user.Rol === 'admin') {
            [citaArr] = await connection.query('SELECT * FROM cita WHERE ID_Cita = ?', [idCita]);
        } else {
            [citaArr] = await connection.query('SELECT * FROM cita WHERE ID_Cita = ? AND ID_Usuario = ?', [idCita, req.user.ID_Usuario]);
        }
        const cita = citaArr[0];
        if (!cita) {
            connection.release();
            return res.status(403).json({ error: 'No tienes permiso para eliminar esta cita.' });
        }

        await connection.beginTransaction();

        // Eliminar informes relacionados a radiografías de la cita
        const [rads] = await connection.query('SELECT ID_Radiografia FROM radiografia WHERE ID_Cita = ?', [idCita]);
        if (rads.length > 0) {
            const radIds = rads.map(r => r.ID_Radiografia);
            if (radIds.length > 0) {
                await connection.query('DELETE FROM informe WHERE ID_Radiografia IN (?)', [radIds]);
            }
        }
        // Eliminar radiografías de la cita
        await connection.query('DELETE FROM radiografia WHERE ID_Cita = ?', [idCita]);
        // Eliminar pagos de la cita
        await connection.query('DELETE FROM pago WHERE ID_Cita = ?', [idCita]);
        // Eliminar la cita
        const [result] = await connection.query('DELETE FROM cita WHERE ID_Cita = ?', [idCita]);

        await connection.commit();
        connection.release();

        if (result.affectedRows === 1) {
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'No se pudo eliminar la cita.' });
        }
    } catch (error) {
        await connection.rollback();
        connection.release();
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Listar todos los usuarios (solo admin)
app.get('/api/usuarios', authMiddleware, async (req, res) => {
    if (!req.user || req.user.Rol !== 'admin') {
        return res.status(403).json({ error: 'Solo los administradores pueden ver todos los usuarios.' });
    }
    try {
        // Solo selecciona columnas que existen en la tabla usuario
        const [usuarios] = await pool.query(
            'SELECT ID_Usuario, Nombre_Usuario, Correo, Rol FROM usuario'
        );
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Obtener perfil de usuario (propio o admin)
app.get('/api/usuarios/:id', authMiddleware, async (req, res) => {
    const id = parseInt(req.params.id);
    // Permitir que el usuario vea su propio perfil o que el admin vea cualquier perfil
    if (!req.user || (req.user.Rol !== 'admin' && req.user.ID_Usuario !== id)) {
        return res.status(403).json({ error: 'No autorizado.' });
    }
    try {
        // Solo selecciona columnas que existen en la tabla usuario
        const [[usuario]] = await pool.query(`
            SELECT 
                ID_Usuario, Nombre_Usuario, Correo, Rol
            FROM usuario 
            WHERE ID_Usuario = ?
        `, [id]);

        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json(usuario);
    } catch (error) {
        console.error('Error en /api/usuarios/:id:', error); // Log detallado
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Endpoint: Editar perfil de usuario (propio o admin)
app.put('/api/usuarios/:id', authMiddleware, async (req, res) => {
    const id = parseInt(req.params.id);
    if (req.user.Rol !== 'admin' && req.user.ID_Usuario !== id) {
        return res.status(403).json({ error: 'No autorizado.' });
    }
    // Robustez: si no hay body, responde error
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Datos inválidos.' });
    }
    // Solo actualiza campos que existen en la tabla usuario
    const { Nombre_Usuario, Foto_Perfil } = req.body;
    try {
        // Verifica si la columna Foto_Perfil existe en la tabla usuario
        const [cols] = await pool.query(`SHOW COLUMNS FROM usuario LIKE 'Foto_Perfil'`);
        let query = `
            UPDATE usuario SET 
                Nombre_Usuario = COALESCE(?, Nombre_Usuario)
        `;
        const params = [Nombre_Usuario];
        if (Foto_Perfil && cols.length > 0) {
            query += `, Foto_Perfil = ? `;
            params.push(Foto_Perfil);
        }
        query += ` WHERE ID_Usuario = ?`;
        params.push(id);

        const [result] = await pool.query(query, params);
        if (result.affectedRows === 1) {
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'No se pudo actualizar el perfil.' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Borrar usuario (propio o admin)
app.delete('/api/usuarios/:id', authMiddleware, async (req, res) => {
    const id = parseInt(req.params.id);
    if (req.user.Rol !== 'admin' && req.user.ID_Usuario !== id) {
        return res.status(403).json({ error: 'No autorizado.' });
    }
    try {
        const [result] = await pool.query('DELETE FROM usuario WHERE ID_Usuario = ?', [id]);
        if (result.affectedRows === 1) {
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'No se pudo eliminar el usuario.' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Agregar información personal (propio o admin)
app.post('/api/usuarios/:id/info', authMiddleware, async (req, res) => {
    const id = parseInt(req.params.id);
    if (req.user.Rol !== 'admin' && req.user.ID_Usuario !== id) {
        return res.status(403).json({ error: 'No autorizado.' });
    }
    const { Nombre_Completo, Telefono, Direccion, Fecha_Nacimiento, Sexo } = req.body;
    try {
        const [result] = await pool.query(
            `UPDATE usuario SET 
                Nombre_Completo = ?,
                Telefono = ?,
                Direccion = ?,
                Fecha_Nacimiento = ?,
                Sexo = ?
            WHERE ID_Usuario = ?`,
            [Nombre_Completo, Telefono, Direccion, Fecha_Nacimiento, Sexo, id]
        );
        if (result.affectedRows === 1) {
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'No se pudo agregar la información.' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Obtener pago de una cita por ID de cita (Fuera de uso)
app.get('/api/pagos/:id', authMiddleware, async (req, res) => {
    const idCita = req.params.id;
    try {
        const [[pago]] = await pool.query(
            'SELECT * FROM pago WHERE ID_Cita = ?',
            [idCita]
        );
        if (!pago) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }
        res.json(pago);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Editar o crear pago (usuarios pueden editar método y tipo, admin todo)
app.put('/api/pagos/:id', authMiddleware, async (req, res) => {
    const idCita = req.params.id;
    const { Metodo_Pago, Fecha_Pago, Monto, Estado, Tipo_Pago } = req.body;
    try {
        // Verifica si ya existe un pago para la cita
        const [[pago]] = await pool.query('SELECT * FROM pago WHERE ID_Cita = ?', [idCita]);
        // Si no existe, solo admin puede crear
        if (!pago && req.user.Rol !== 'admin') {
            return res.status(403).json({ error: 'Solo los administradores pueden crear pagos.' });
        }
        // Si existe, permisos según rol
        if (pago) {
            if (req.user.Rol === 'admin') {
                // Admin puede editar todo
                await pool.query(
                    'UPDATE pago SET Metodo_Pago = ?, Fecha_Pago = ?, Monto = ?, Estado = ?, Tipo_Pago = ? WHERE ID_Cita = ?',
                    [Metodo_Pago, Fecha_Pago, Monto, Estado, Tipo_Pago, idCita]
                );
            } else {
                // Usuario solo puede editar método y tipo de pago
                await pool.query(
                    'UPDATE pago SET Metodo_Pago = ?, Tipo_Pago = ? WHERE ID_Cita = ?',
                    [Metodo_Pago, Tipo_Pago, idCita]
                );
            }
        } else {
            // Crear pago (solo admin)
            // Busca el paciente y precio por categoría
            const [[cita]] = await pool.query('SELECT ID_Paciente FROM cita WHERE ID_Cita = ?', [idCita]);
            if (!cita) return res.status(400).json({ error: 'Cita no encontrada' });
            const precio = await obtenerPrecioPorCategoria(idCita);
            await pool.query(
                'INSERT INTO pago (Fecha_Pago, Monto, Metodo_Pago, Estado, ID_Paciente, ID_Cita, Tipo_Pago) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [Fecha_Pago, precio, Metodo_Pago, Estado || 'Pendiente', cita.ID_Paciente, idCita, Tipo_Pago || 'Completo']
            );
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Obtener informe por ID (solo acepta IDs numéricos para no colisionar con /api/informes/mios)
app.get('/api/informes/:id(\\d+)', authMiddleware, async (req, res) => {
    const idInforme = req.params.id;
    try {
        // Busca el informe y la cita asociada
        const [[informe]] = await pool.query(
            `SELECT i.*, r.ID_Cita, c.ID_Usuario
             FROM informe i
             JOIN radiografia r ON i.ID_Radiografia = r.ID_Radiografia
             JOIN cita c ON r.ID_Cita = c.ID_Cita
             WHERE i.ID_Informe = ?`,
            [idInforme]
        );
        if (!informe) {
            return res.status(404).json({ error: 'Informe no encontrado' });
        }
        // Permitir que el usuario autenticado vea su propio informe o el admin cualquiera
        if (req.user.Rol !== 'admin' && req.user.ID_Usuario !== informe.ID_Usuario) {
            return res.status(403).json({ error: 'No autorizado para ver este informe.' });
        }
        res.json(informe);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Editar informe (solo admin)
app.put('/api/informes/:id(\\d+)', authMiddleware, async (req, res) => {
    if (req.user.Rol !== 'admin') {
        return res.status(403).json({ error: 'Solo los administradores pueden editar informes.' });
    }
    const idInforme = req.params.id;
    // Obtener el informe actual
    let informeActual;
    try {
        const [[inf]] = await pool.query('SELECT * FROM informe WHERE ID_Informe = ?', [idInforme]);
        if (!inf) return res.status(404).json({ error: 'Informe no encontrado.' });
        informeActual = inf;
    } catch (error) {
        return res.status(500).json({ error: 'Error al obtener el informe.' });
    }
    // Usar valores actuales si no se envían en el body
    const {
        Diagnostico = informeActual.Diagnostico,
        Recomendaciones = informeActual.Recomendaciones,
        Fecha_Informe = informeActual.Fecha_Informe,
        IA_Prediccion = informeActual.IA_Prediccion,
        Validado_Por = informeActual.Validado_Por
    } = req.body;
    try {
        const [result] = await pool.query(
            `UPDATE informe SET Diagnostico = ?, Recomendaciones = ?, Fecha_Informe = ?, IA_Prediccion = ?, Validado_Por = ? WHERE ID_Informe = ?`,
            [Diagnostico, Recomendaciones, Fecha_Informe, IA_Prediccion, Validado_Por, idInforme]
        );
        if (result.affectedRows === 1) {
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'No se pudo actualizar el informe.' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Listar categorías de estudio
app.get('/api/categorias', async (req, res) => {
    try {
        const [categorias] = await pool.query('SELECT ID_Categoria, Nombre_Categoria, Descripcion FROM categoria_estudio');
        res.json(categorias);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Obtener radiografías de una cita
app.get('/api/radiografias/:idCita', authMiddleware, async (req, res) => {
    const idCita = req.params.idCita;
    try {
        const [rads] = await pool.query(`
            SELECT r.*, ce.Nombre_Categoria
            FROM radiografia r
            LEFT JOIN categoria_estudio ce ON r.ID_Categoria = ce.ID_Categoria
            WHERE r.ID_Cita = ?
        `, [idCita]);
        // Siempre devuelve array (vacío si no hay)
        res.json(Array.isArray(rads) ? rads : []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Recibir preguntas de la landing
app.post('/api/preguntas', async (req, res) => {
    // Permite apellido pero lo ignora si no existe en la tabla
    const { nombre, apellido, correo, mensaje } = req.body;
    if (!nombre || !correo || !mensaje) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }
    try {
        // Si la tabla pregunta no tiene columna apellido, ignora ese campo
        await pool.query(
            'INSERT INTO pregunta (nombre, correo, mensaje, fecha) VALUES (?, ?, ?, NOW())',
            [nombre, correo, mensaje]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Listar citas sin informe (solo admin)
app.get('/api/citas-sin-informe', authMiddleware, async (req, res) => {
    if (req.user.Rol !== 'admin') {
        return res.status(403).json({ error: 'Solo administradores.' });
    }
    try {
        const [rows] = await pool.query(`
            SELECT c.ID_Cita, c.Fecha_Cita, c.Hora_Cita, p.Nombre, p.Apellido, r.ID_Radiografia
            FROM cita c
            JOIN paciente p ON c.ID_Paciente = p.ID_Paciente
            JOIN radiografia r ON r.ID_Cita = c.ID_Cita
            WHERE c.Estado = 'Pendiente'
              AND NOT EXISTS (
                SELECT 1 FROM informe i WHERE i.ID_Radiografia = r.ID_Radiografia
              )
            ORDER BY c.Fecha_Cita DESC
        `);
        console.log('CITAS SIN INFORME:', rows.length, rows);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Listar informes del usuario autenticado (solo sus propios informes)
app.get('/api/informes/mios', authMiddleware, async (req, res) => {
    const userId = req.user.ID_Usuario;
    try {
     // Devuelve los informes asociados a las citas del usuario autenticado
        const [informes] = await pool.query(`
            SELECT 
                i.ID_Informe, i.Diagnostico, i.Recomendaciones, i.Fecha_Informe, i.IA_Prediccion,
                r.Imagen_URL, c.Fecha_Cita, c.Hora_Cita, ce.Nombre_Categoria,
                p.Nombre AS Paciente_Nombre, p.Apellido AS Paciente_Apellido
            FROM informe i
            JOIN radiografia r ON i.ID_Radiografia = r.ID_Radiografia
            JOIN cita c ON r.ID_Cita = c.ID_Cita
            JOIN paciente p ON c.ID_Paciente = p.ID_Paciente
            LEFT JOIN categoria_estudio ce ON r.ID_Categoria = ce.ID_Categoria
            WHERE c.ID_Usuario = ?
            ORDER BY i.Fecha_Informe DESC
        `, [userId]);
        res.json(Array.isArray(informes) ? informes : []);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Redirige la raíz "/" a la landing
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/landing.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.get(/^\/(?!api)(?!.*\.[a-zA-Z0-9]+$).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../client/landing.html'));
});

app.use(errorHandler);

// Endpoint: Subir imagen de radiografía (solo admin)
app.post('/api/radiografias/:id/upload', authMiddleware, upload.single('imagen'), async (req, res) => {
    if (req.user.Rol !== 'admin') {
        return res.status(403).json({ error: 'Solo administradores.' });
    }
    const idRadiografia = req.params.id;
    if (!req.file) {
        return res.status(400).json({ error: 'No se subió ninguna imagen.' });
    }
    const url = '/uploads/' + req.file.filename;
    try {
        // Verifica que la radiografía exista antes de actualizar
        const [[rad]] = await pool.query('SELECT ID_Radiografia FROM radiografia WHERE ID_Radiografia = ?', [idRadiografia]);
        if (!rad) {
            // Borra el archivo subido si la radiografía no existe
            fs.unlinkSync(path.join(uploadsDir, req.file.filename));
            return res.status(400).json({ error: 'Radiografía no encontrada.' });
        }
        await pool.query(
            'UPDATE radiografia SET Imagen_URL = ? WHERE ID_Radiografia = ?',
            [url, idRadiografia]
        );
        res.json({ success: true, url });
    } catch (error) {
        // Borra el archivo subido si ocurre un error
        if (req.file && fs.existsSync(path.join(uploadsDir, req.file.filename))) {
            fs.unlinkSync(path.join(uploadsDir, req.file.filename));
        }
        console.error('Error al subir imagen:', error); // Log detallado
        res.status(500).json({ error: 'Error interno al guardar la imagen.' });
    }
});

// Endpoint: Crear informe (solo admin)
app.post('/api/informes', authMiddleware, async (req, res) => {
    if (req.user.Rol !== 'admin') {
        return res.status(403).json({ error: 'Solo administradores.' });
    }
    const { Diagnostico, Recomendaciones, Fecha_Informe, IA_Prediccion, ID_Radiografia } = req.body;
    if (!Diagnostico || !Fecha_Informe || !ID_Radiografia) {
        return res.status(400).json({ error: 'Faltan campos obligatorios.' });
    }
    try {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            // Verificar que la radiografía exista y obtener la cita
            const [[rad]] = await conn.query('SELECT ID_Cita FROM radiografia WHERE ID_Radiografia = ?', [ID_Radiografia]);
            if (!rad) {
                await conn.rollback();
                conn.release();
                return res.status(400).json({ error: 'Radiografía no encontrada.' });
            }
            // Insertar informe
            await conn.query(
                `INSERT INTO informe (Diagnostico, Recomendaciones, Fecha_Informe, IA_Prediccion, Validado_Por, ID_Radiografia)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [Diagnostico, Recomendaciones || null, Fecha_Informe, IA_Prediccion || null, req.user.ID_Usuario, ID_Radiografia]
            );
            // Marcar cita como Completada
            await conn.query('UPDATE cita SET Estado = ? WHERE ID_Cita = ?', ['Completada', rad.ID_Cita]);
            await conn.commit();
            conn.release();
            res.json({ success: true });
        } catch (txErr) {
            try { await conn.rollback(); } catch(_) {}
            try { conn.release(); } catch(_) {}
            throw txErr;
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Listar todos los informes (solo admin)
app.get('/api/informes', authMiddleware, async (req, res) => {
    if (req.user.Rol !== 'admin') {
        return res.status(403).json({ error: 'Solo administradores.' });
    }
    try {
        const [rows] = await pool.query(`
            SELECT 
                i.ID_Informe, i.Diagnostico, i.Recomendaciones, i.Fecha_Informe, i.IA_Prediccion, i.Validado_Por,
                r.ID_Radiografia, r.Imagen_URL, ce.Nombre_Categoria,
                c.ID_Cita, c.Fecha_Cita, c.Hora_Cita,
                p.Nombre AS Paciente_Nombre, p.Apellido AS Paciente_Apellido
            FROM informe i
            JOIN radiografia r ON i.ID_Radiografia = r.ID_Radiografia
            JOIN categoria_estudio ce ON r.ID_Categoria = ce.ID_Categoria
            JOIN cita c ON r.ID_Cita = c.ID_Cita
            JOIN paciente p ON c.ID_Paciente = p.ID_Paciente
            ORDER BY i.Fecha_Informe DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Descargar imagen de informe (solo dueño o admin)
app.get('/api/informes/:id(\\d+)/descargar', authMiddleware, async (req, res) => {
    const idInforme = req.params.id;
    try {
        // Busca el informe y la imagen asociada
        const [[inf]] = await pool.query(`
            SELECT r.Imagen_URL, c.ID_Usuario
            FROM informe i
            JOIN radiografia r ON i.ID_Radiografia = r.ID_Radiografia
            JOIN cita c ON r.ID_Cita = c.ID_Cita
            WHERE i.ID_Informe = ?
        `, [idInforme]);
        if (!inf) return res.status(404).json({ error: 'Informe no encontrado' });
        // Solo el dueño o admin puede descargar
        if (req.user.Rol !== 'admin' && req.user.ID_Usuario !== inf.ID_Usuario) {
            return res.status(403).json({ error: 'No autorizado para descargar este informe.' });
        }
        if (!inf.Imagen_URL) return res.status(404).json({ error: 'No hay imagen asociada.' });
        const filePath = path.join(__dirname, '../client', inf.Imagen_URL);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado.' });
        res.download(filePath, path.basename(filePath));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Servir archivos subidos
app.use('/uploads', express.static(path.join(__dirname, '../client/uploads')));

// Iniciar servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});

// Endpoint: Cancelar cita (cambia estado a Cancelada según política)
app.put('/api/citas/:id/cancel', authMiddleware, async (req, res) => {
    const idCita = req.params.id;
    try {
        // Cargar cita y verificar permisos
        let rows;
        if (req.user.Rol === 'admin') {
            [rows] = await pool.query('SELECT * FROM cita WHERE ID_Cita = ?', [idCita]);
        } else {
            [rows] = await pool.query('SELECT * FROM cita WHERE ID_Cita = ? AND ID_Usuario = ?', [idCita, req.user.ID_Usuario]);
        }
        const cita = rows[0];
        if (!cita) return res.status(403).json({ error: 'No autorizado para cancelar esta cita.' });
        // Política de cancelación para usuarios (no admin)
        if (req.user.Rol !== 'admin') {
            const hrs = hoursUntil(cita.Fecha_Cita, cita.Hora_Cita);
            if (hrs < POLICY_CANCEL_MIN_HOURS) {
                return res.status(400).json({ error: `No puedes cancelar con menos de ${POLICY_CANCEL_MIN_HOURS} horas de anticipación.` });
            }
        }
        const [upd] = await pool.query('UPDATE cita SET Estado = ? WHERE ID_Cita = ?', ['Cancelada', idCita]);
        if (upd.affectedRows === 1) return res.json({ success: true });
        return res.status(400).json({ error: 'No se pudo cancelar la cita.' });
    } catch (e) {
        res.status(500).json({ error: 'Error al cancelar la cita.' });
    }
});