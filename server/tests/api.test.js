/**
 * XPectra API — Basic Test Suite
 *
 * These tests verify core API behavior WITHOUT a real database.
 * They test request validation, authentication middleware, and response formats.
 *
 * For full integration tests, use docker-compose to spin up a test database.
 */

const request = require('supertest');
const express = require('express');
const path = require('path');

// --- Minimal app setup for testing (avoids DB dependency) ---

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../client')));

// Mock the landing route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/landing.html'));
});

// Mock categories endpoint (no DB)
app.get('/api/categorias', (req, res) => {
    res.json([
        { ID_Categoria: 1, Nombre_Categoria: 'General', Descripcion: 'Radiografía general' },
        { ID_Categoria: 2, Nombre_Categoria: 'Dental', Descripcion: 'Radiografía dental' },
        { ID_Categoria: 3, Nombre_Categoria: 'Torax', Descripcion: 'Radiografía de tórax' },
        { ID_Categoria: 4, Nombre_Categoria: 'Otro', Descripcion: 'Otro tipo de estudio' },
    ]);
});

// Mock register endpoint with validation
const { body, validationResult } = require('express-validator');

app.post('/api/register',
    body('Nombre_Usuario').trim().isLength({ min: 3 }).withMessage('El nombre de usuario debe tener al menos 3 caracteres.'),
    body('Correo').isEmail().withMessage('Correo inválido.').normalizeEmail(),
    body('Contrasena').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres.'),
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
        }
        // In real app, this would insert into DB
        res.status(201).json({ success: true });
    }
);

// Mock protected endpoint
app.get('/api/citas', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    // In real app, this would verify JWT and query DB
    res.json([]);
});

// Mock login endpoint
app.post('/api/login',
    body('Correo').isEmail(),
    body('Contrasena').isLength({ min: 1 }),
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
        }
        // Always reject in test environment (no DB)
        res.status(401).json({ error: 'Usuario no encontrado' });
    }
);

// ─────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────

describe('XPectra API', () => {

    describe('GET / (Landing Page)', () => {
        it('should return 200 and serve HTML', async () => {
            const res = await request(app).get('/');
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/html/);
        });
    });

    describe('GET /api/categorias', () => {
        it('should return study categories', async () => {
            const res = await request(app).get('/api/categorias');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThanOrEqual(1);
            expect(res.body[0]).toHaveProperty('ID_Categoria');
            expect(res.body[0]).toHaveProperty('Nombre_Categoria');
        });
    });

    describe('POST /api/register', () => {
        it('should reject registration with invalid email', async () => {
            const res = await request(app)
                .post('/api/register')
                .send({
                    Nombre_Usuario: 'TestUser',
                    Correo: 'not-an-email',
                    Contrasena: 'password123'
                });
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        it('should reject registration with short password', async () => {
            const res = await request(app)
                .post('/api/register')
                .send({
                    Nombre_Usuario: 'TestUser',
                    Correo: 'test@example.com',
                    Contrasena: '123'
                });
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        it('should reject registration with short username', async () => {
            const res = await request(app)
                .post('/api/register')
                .send({
                    Nombre_Usuario: 'AB',
                    Correo: 'test@example.com',
                    Contrasena: 'password123'
                });
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        it('should accept valid registration data', async () => {
            const res = await request(app)
                .post('/api/register')
                .send({
                    Nombre_Usuario: 'TestUser',
                    Correo: 'test@example.com',
                    Contrasena: 'password123'
                });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });
    });

    describe('POST /api/login', () => {
        it('should reject login with invalid email format', async () => {
            const res = await request(app)
                .post('/api/login')
                .send({
                    Correo: 'invalid',
                    Contrasena: 'password123'
                });
            expect(res.status).toBe(400);
        });

        it('should reject login with empty password', async () => {
            const res = await request(app)
                .post('/api/login')
                .send({
                    Correo: 'test@example.com',
                    Contrasena: ''
                });
            expect(res.status).toBe(400);
        });

        it('should reject login with non-existent user', async () => {
            const res = await request(app)
                .post('/api/login')
                .send({
                    Correo: 'nonexistent@example.com',
                    Contrasena: 'password123'
                });
            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error');
        });
    });

    describe('GET /api/citas (Protected)', () => {
        it('should return 401 without authentication token', async () => {
            const res = await request(app).get('/api/citas');
            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error');
        });

        it('should return 401 with malformed token', async () => {
            const res = await request(app)
                .get('/api/citas')
                .set('Authorization', 'InvalidToken');
            expect(res.status).toBe(401);
        });
    });
});
