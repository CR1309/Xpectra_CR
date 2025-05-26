require('dotenv').config();
const express = require('express');
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

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// Configuración MySQL
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'Clinica',
    password: process.env.DB_PASSWORD || 'clinica12345',
    database: process.env.DB_NAME || 'clinicaradiografias',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Middleware para verificar JWT
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No autenticado' });
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

// Precios por categoría (puedes ajustar estos valores)
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
        // Nombre: rad-<timestamp>-<original>
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'rad-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Endpoint: Registro de usuario
app.post('/api/register',
    body('Nombre_Usuario').isLength({ min: 3 }),
    body('Correo').isEmail(),
    body('Contrasena').isLength({ min: 6 }),
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
app.post('/api/login',
    body('Correo').isEmail(),
    body('Contrasena').isLength({ min: 6 }),
    async (req, res, next) => {
        const { Correo, Contrasena } = req.body;
        if (!Correo || !Contrasena) return res.status(400).json({ error: 'Correo y contraseña requeridos' });
        try {
            const [users] = await pool.query(
                'SELECT * FROM usuario WHERE Correo = ?',
                [Correo]
            );
            if (users.length === 0) return res.status(401).json({ error: 'Usuario no encontrado' });
            const user = users[0];
            // Asegúrate de comparar con el campo correcto
            const valid = await bcrypt.compare(Contrasena, user.Contrasena_Hash);
            if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta' });
            const token = jwt.sign({
                ID_Usuario: user.ID_Usuario,
                Rol: user.Rol,
                Correo: user.Correo
            }, SECRET, { expiresIn: '8h' });
            // Devuelve más datos del usuario para el frontend
            res.json({ 
                token, 
                user: { 
                    ID_Usuario: user.ID_Usuario, 
                    Rol: user.Rol, 
                    Correo: user.Correo,
                    Nombre_Usuario: user.Nombre_Usuario // <-- Añadido
                } 
            });
        } catch (error) {
            next(error);
        }
    }
);

// Endpoint: Logout (opcional, solo frontend borra el token)
app.post('/api/logout', (req, res) => {
    res.json({ success: true });
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

// Modifica el endpoint de crear cita para aceptar método y fecha de pago
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
    body('ID_Categoria').isInt(), // Cambia a isInt para requerir ID numérico
    body('Fecha_Cita').custom(value => {
        const fecha = new Date(value);
        const hoy = new Date();
        if (fecha < hoy) {
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
        ID_Categoria
    } = req.body;

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

        // Verifica si ya existe una cita para este paciente en la misma fecha y hora
        const [citaExistente] = await connection.query(
            `SELECT ID_Cita FROM cita WHERE ID_Paciente = ? AND Fecha_Cita = ? AND Hora_Cita = ?`,
            [idPaciente, Fecha_Cita, Hora_Cita]
        );
        if (citaExistente.length > 0) {
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
                    'INSERT INTO pago (Fecha_Pago, Monto, Metodo_Pago, Estado, ID_Paciente, ID_Cita) VALUES (?, ?, ?, ?, ?, ?)',
                    [Fecha_Pago, 0, Metodo_Pago, 'Pendiente', idPaciente, result.insertId]
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
            return res.status(403).json({ error: 'No tienes permiso para eliminar esta cita.' });
        }
        // Eliminar cita
        const [result] = await pool.query('DELETE FROM cita WHERE ID_Cita = ?', [idCita]);
        if (result.affectedRows === 1) {
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'No se pudo eliminar la cita.' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Listar todos los usuarios (solo admin)
app.get('/api/usuarios', authMiddleware, async (req, res) => {
    if (!req.user || req.user.Rol !== 'admin') {
        return res.status(403).json({ error: 'Solo los administradores pueden ver todos los usuarios.' });
    }
    try {
        const [usuarios] = await pool.query(
            'SELECT ID_Usuario, Nombre_Usuario, Correo, Rol, Nombre_Completo, Telefono, Direccion, Fecha_Nacimiento, Sexo, Foto_Perfil FROM usuario'
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
        const [[usuario]] = await pool.query(
            'SELECT ID_Usuario, Nombre_Usuario, Correo, Rol, Nombre_Completo, Telefono, Direccion, Fecha_Nacimiento, Sexo, Foto_Perfil FROM usuario WHERE ID_Usuario = ?',
            [id]
        );
        if (!usuario) {
            return res.json({});
        }
        res.json(usuario);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Editar perfil de usuario (propio o admin)
app.put('/api/usuarios/:id', authMiddleware, async (req, res) => {
    const id = parseInt(req.params.id);
    if (req.user.Rol !== 'admin' && req.user.ID_Usuario !== id) {
        return res.status(403).json({ error: 'No autorizado.' });
    }
    const { Nombre_Usuario, Nombre_Completo, Telefono, Direccion, Fecha_Nacimiento, Sexo, Foto_Perfil } = req.body;
    try {
        let query = `
            UPDATE usuario SET 
                Nombre_Usuario = COALESCE(?, Nombre_Usuario),
                Nombre_Completo = COALESCE(?, Nombre_Completo),
                Telefono = COALESCE(?, Telefono),
                Direccion = COALESCE(?, Direccion),
                Fecha_Nacimiento = COALESCE(?, Fecha_Nacimiento),
                Sexo = COALESCE(?, Sexo)
        `;
        const params = [Nombre_Usuario, Nombre_Completo, Telefono, Direccion, Fecha_Nacimiento, Sexo];
        if (Foto_Perfil) {
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

// Endpoint: Obtener pago de una cita por ID de cita
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

// Endpoint: Obtener informe de una cita por ID de radiografía (corregido)
app.get('/api/informes/:id', authMiddleware, async (req, res) => {
    const idRad = req.params.id;
    try {
        const [informes] = await pool.query(
            'SELECT * FROM informe WHERE ID_Radiografia = ?',
            [idRad]
        );
        if (!informes || informes.length === 0) {
            // Devuelve 404 si no hay informe
            return res.status(404).json({ error: 'Informe no encontrado' });
        }
        res.json(informes[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Editar informe (solo admin)
app.put('/api/informes/:id', authMiddleware, async (req, res) => {
    if (req.user.Rol !== 'admin') {
        return res.status(403).json({ error: 'Solo los administradores pueden editar informes.' });
    }
    const idInforme = req.params.id;
    const { Diagnostico, Recomendaciones, Fecha_Informe, IA_Prediccion, Validado_Por } = req.body;
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
    const { nombre, correo, mensaje } = req.body;
    if (!nombre || !correo || !mensaje) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }
    try {
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
// Mover este endpoint antes del catch-all de rutas frontend
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
        console.log('CITAS SIN INFORME:', rows.length, rows); // <-- Añadido para depuración
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Listar informes del usuario autenticado (solo sus propios informes)
app.get('/api/informes/mios', authMiddleware, async (req, res) => {
    // Log de usuario autenticado
    console.log('GET /api/informes/mios', req.user); 
    try {
        // Verifica que el usuario existe en la base de datos
        const [[usuario]] = await pool.query(
            'SELECT ID_Usuario, Nombre_Usuario, Correo, Rol FROM usuario WHERE ID_Usuario = ?',
            [req.user.ID_Usuario]
        );
        if (!usuario) {
            // Devuelve array vacío si el usuario no existe
            return res.json([]);
        }
        // Busca informes de citas asociadas al usuario autenticado
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
            WHERE c.ID_Usuario = ?
            ORDER BY i.Fecha_Informe DESC
        `, [req.user.ID_Usuario]);
        // Siempre devuelve array (vacío si no hay informes)
        res.json(Array.isArray(rows) ? rows : []);
    } catch (error) {
        console.error('Error en /api/informes/mios:', error);
        res.status(500).json({ error: error.message });
    }
});

// El catch-all debe ir DESPUÉS de todos los endpoints API

// Redirige la raíz "/" a la landing
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/landing.html'));
});

// Sirve el index solo si se accede explícitamente a /index.html
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// El resto de rutas frontend (excepto /api y archivos estáticos) redirige a la landing
app.get(/^\/(?!api)(?!.*\.[a-zA-Z0-9]+$).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../client/landing.html'));
});

// Manejo centralizado de errores (debe ir al final)
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
        await pool.query(
            `INSERT INTO informe (Diagnostico, Recomendaciones, Fecha_Informe, IA_Prediccion, Validado_Por, ID_Radiografia)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [Diagnostico, Recomendaciones || null, Fecha_Informe, IA_Prediccion || null, req.user.ID_Usuario, ID_Radiografia]
        );
        res.json({ success: true });
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
app.get('/api/informes/:id/descargar', authMiddleware, async (req, res) => {
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
        // Imagen_URL es tipo "/uploads/archivo.jpg"
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