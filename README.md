# Plataforma de Gestión de Radiografías y Citas Clínicas (Enfoque ODS 3)

## Novedades recientes (2025-10-04)

Este resumen documenta los últimos cambios incorporados, el porqué de cada ajuste y cómo benefician al proyecto (usabilidad, seguridad y flujo clínico).

### 1) UX: Notificaciones modernas en lugar de alert()
- Qué cambió: Se reemplazaron los `alert()` por tarjetas de notificación coherentes con la estética (módulo `client/scripts/notifications.js` + estilos en `style.css`).
- Dónde: `client/app.js`, `client/admin_informes.js`, `index.html`, `admin_informes.html`.
- Por qué: Evitar interrupciones modales nativas y unificar feedback con el look&feel del sitio.
- Beneficio: Mejor experiencia de usuario, mensajes claros, accesibles y no bloqueantes.

### 2) Seguridad: Bloqueo progresivo de intentos de login
- Qué cambió: Lógica de bloqueo por usuario tras intentos fallidos (3 fallos → 1 min; siguientes 3 → 5 min; siguientes 3 → 10 min). Reinicio de contador tras cada bloqueo y reset total al iniciar sesión correctamente.
- Endpoints: `/api/login` (aplica y comunica bloqueo), `/api/login/status` (consulta estado y “intentos restantes”).
- Cliente: `index.html` muestra contador en el botón “Entrar”, hint con intentos restantes y backoff automático si hay rate limit.
- Por qué: Mitigar fuerza bruta y brindar feedback útil sin exponer información sensible.
- Beneficio: +Seguridad, +claridad para el usuario y cumplimiento de buenas prácticas.

Detalles técnicos relevantes:
- Tabla `login_attempts` creada automáticamente (user_id, failed_count, stage, lock_until, updated_at).
- Corrección de desfase horario: ahora `lock_until` se fija con `DATE_ADD(NOW(), INTERVAL N MINUTE)` y se compara directamente (se solucionó el fallo que provocaba bloqueos de ~360 minutos).
- Rate limit de `/api/login/status` ampliado y encabezado `Retry-After` expuesto; el cliente respeta el backoff.
- “Cooldown” opcional de etapa: tras inactividad prolongada (configurable), la etapa puede volver a 0.

### 3) Registro: Validación robusta y comprobación de disponibilidad
- Qué cambió: Validación con mensajes claros en `/api/register` (nombre ≥ 3, contraseña ≥ 6, correo válido) y endpoint `/api/usuarios/disponible` para verificar si un correo ya está registrado.
- Cliente: validación previa y aviso “en vivo” para evitar errores 400 al enviar.
- Por qué: Reducir fricción en el alta de usuarios y evitar intentos redundantes.
- Beneficio: Menos errores, registros más fluidos.

### 4) Flujo clínico: Informe → cita “Completada” + UI coherente
- Qué cambió: Al crear un informe (`POST /api/informes`) se cambia automáticamente el estado de la cita asociada a “Completada” en una transacción atómica.
- Cliente (index):
    - Badge de estado coloreado (Completada=verde, Confirmada=azul, Cancelada=rojo, Pendiente=gris).
    - Deshabilitar editar/cancelar cuando la cita está “Completada”.
    - Notificación al usuario cuando hay citas completadas nuevas con acceso directo a “Mis Informes”.
- Por qué: Cerrar el episodio clínico y reflejarlo tanto en backend como en la UI.
- Beneficio: Menos incoherencias operativas, mayor claridad en el estado de cada caso.

### 5) Estabilidad y DX
- Ajustes de rate limits y polling (2s) para evitar 429 en cascada.
- Mensajería de error más explícita en login/registro.

---

### Checklist de verificación rápida
- Login:
    - Tras 3 fallos: bloqueo 1 min; hint de intentos restantes y botón con contador.
    - Tras desbloqueo: siguientes 3 fallos → 5 min; luego 10 min.
    - Éxito de login: se resetea stage y fallos.
- Registro:
    - Nombre ≥ 3, contraseña ≥ 6, correo formato válido.
    - Aviso “correo ya registrado” antes de enviar.
- Informes:
    - Al crear informe: cita cambia a “Completada”.
    - En index: badge verde, acciones bloqueadas, notificación y acceso a “Mis Informes”.

### Impacto en el proyecto (beneficios)
- UX consistente y accesible: feedback no intrusivo, estados claros y acciones coherentes.
- Seguridad reforzada: protección contra fuerza bruta con bloqueo progresivo, rate limiting y backoff.
- Integridad del flujo clínico: cita se cierra al emitir informe, evitando estados intermedios inconsistentes.
- Soporte y observabilidad: mensajes de error y estados más informativos tanto para el usuario como para soporte.


## 1. Resumen del Proyecto (visión general no técnica)
Esta plataforma digital permite que una clínica o centro de diagnóstico gestione de forma integral el proceso relacionado con estudios radiológicos (por ejemplo, radiografías): desde que una persona solicita una cita, hasta que recibe un informe médico validado (y opcionalmente enriquecido con una predicción asistida por IA) y puede consultarlo o descargarlo de manera segura.

Su propósito principal es mejorar la organización, rapidez y continuidad del cuidado de la salud en tres ejes, integrando además un componente preparado para Inteligencia Artificial (IA) que facilite priorizar estudios potencialmente críticos:
1. Acceso ordenado: evita duplicidad de dsatos y reduce pérdidas de información (cada cita genera su estudio y luego su informe).  
2. Seguimiento claro: es fácil identificar qué estudios ya tienen diagnóstico y cuáles aún están pendientes.  
3. Comunicación segura: los resultados se entregan solo a usuarios autorizados, protegiendo datos sensibles.

¿Para quién es útil?
- Clínicas pequeñas o medianas que necesitan modernizar su gestión sin depender de sistemas complejos.  s
- Profesionales que validan informes y requieren un flujo claro y auditable.  
- Pacientes que desean acceder a sus resultados sin trámites presenciales innecesarios.

Sobre la IA en radiografías (valor agregado desde el inicio):
r
 
Proyecto base desarrollado para gestión integral de radiografías clínicas con enfoque en alineación al **ODS 3: Salud y Bienestar**.

## 13. Modelo Económico y Sostenibilidad
Una plataforma de salud digital sostenible asegura continuidad operativa, inversión en mejora diagnóstica (IA) y disponibilidad para usuarios finales, reforzando el ODS 3 (acceso sostenido a servicios de calidad). A continuación se describe un marco adaptable de costos e ingresos.

### 13.1 Estructura de Gastos
1. Desarrollo (fase inicial / evolutivo): análisis funcional, backend (seguridad, auditoría, endpoints), frontend (usabilidad, accesibilidad), pruebas, documentación, pipeline de integración de IA.
2. Costos fijos mensuales (referenciales):
    - Infraestructura (hosting + BD gestionada): 70–140 USD
    - Almacenamiento imágenes (radiografías + backups): 20–50 USD
    - Monitoreo / logs / alertas: 10–25 USD
    - Dominio + certificados SSL (prorrateado): 2–5 USD
    - Mantenimiento / soporte (horas técnicas): 100–200 USD
3. Costos variables:
    - Incremento almacenamiento según volumen de estudios.
    - Consumo de ancho de banda / descargas de informes.
    - Inferencia IA (si se externaliza): pago por imagen / GPU.
    - Difusión / marketing (campañas segmentadas clínicas o comunitarias).
    - Material educativo y eventos (webinars, talleres de adopción).

Ejemplo sintético mensual (escenario base):
| Categoría | Monto (USD) | Nota |
|-----------|-------------|------|
| Hosting + BD | 110 | App + DB básica |
| Almacenamiento | 30 | Crecimiento moderado |
| Monitoreo + Backups | 25 | Logs + snapshots |
| Dominio / SSL | 3 | Prorrateado |
| Soporte / Mantenimiento | 150 | 6–8 h nivel 1–2 |
| Marketing / Difusión | 55 | Campañas ligeras |
| Total estimado | 373 | Referencia inicial |

### 13.2 Fuentes de Ingresos Potenciales
Adaptadas a un ecosistema de radiología y soporte diagnóstico asistido por IA:
1. Suscripciones escalonadas (Básico / Profesional / Avanzado IA) según límites de estudios, métricas y características de exportación / triage.
2. Add-on por volumen excedente de radiografías procesadas.
3. Módulo IA premium: priorización y clasificación asistida (utiliza campos `IA_Prediccion`, `IA_Confianza`, `Modelo_Version`).
4. Integraciones (PACS, HIS, EMR): cuota de habilitación + mantenimiento.
5. Alianzas con municipalidades / ONG para tele-diagnóstico comunitario (licencias institucionales subsidiadas).
6. Servicios profesionales (migración de datos legacy, personalización de reportes, analítica avanzada).
7. Licenciamiento white‑label para redes de clínicas.
8. Datos agregados anonimizados (reportes epidemiológicos) bajo marco legal y consentimiento.
9. r

### 13.3 Alineación de Ingresos con ODS 3
Se propone un modelo freemium o de planes escalonados donde funciones críticas (acceso a informes) permanezcan accesibles; las capas de analítica avanzada e IA financian expansión y mejoras, evitando crear barreras injustas.

### 13.4 Ejemplo de Retorno Económico (Escenario Adaptado)
Supuestos de referencia (pueden ajustarse según mercado):
| Concepto | Valor |
|----------|-------|
| Costos fijos + marketing mensual | 373 USD |
| ARPU (ingreso promedio por clínica suscrita) | 55 USD |
| Punto de equilibrio (clínicas) | 373 / 55 ≈ 7 |
| Proyección mes 6 (clínicas) | 12 |
| Ingreso proyectado mes 6 | 12 * 55 = 660 USD |
| Utilidad estimada mes 6 | 660 - 373 = 287 USD |

Escenario escalonado (mezcla de planes):
| Plan | # | Ingreso Unitario | Subtotal |
|------|---|------------------|----------|
| Básico | 5 | 35 USD | 175 USD |
| Profesional | 4 | 65 USD | 260 USD |
| Avanzado IA | 3 | 95 USD | 285 USD |
| Total | 12 | — | 720 USD |
| Costos | — | — | 373 USD |
| Resultado | — | — | 347 USD |

Fórmulas clave:
```
Punto de Equilibrio = Costos Fijos / ARPU
Utilidad = (Clientes * ARPU) - Costos Totales
ARPU = Ingreso Total / Clientes de Pago
```

Si se alcanzan 20 clínicas (ARPU medio 58 USD):
```
Ingreso = 20 * 58 = 1,160 USD
Utilidad = 1,160 - 373 ≈ 787 USD (Margen ≈ 68%)
```

### 13.5 Escalamiento con IA
- Coste incremental por 1,000 radiografías inferidas (modelo externo/GPU): 12–25 USD.
- Ajustar precio del add-on IA manteniendo margen ≥60% sobre costo variable.
- Cache de inferencias y priorización nocturna para reducir picos de cómputo.

### 13.6 Estrategias de Optimización
- Compresión y políticas de retención (archivar estudios > 12 meses).
- Auto-escalado sólo en horas pico; apagado de workers IA en baja demanda.
- Métricas de severidad para justificar valor clínico (reducción de tiempo a informe en X%).
- Anonimización eficiente para habilitar convenios académicos sin riesgo legal.

### 13.7 Riesgos Comerciales y Mitigación
| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Adopción lenta | Retraso ingresos | Pilotos controlados y casos de éxito documentados |
| Coste IA creciente | Disminuye margen | Optimización batch + negociación proveedor + modelos propios |
| Competencia integrada | Presión precio | Diferenciación en exportaciones, auditoría y transparencia IA |
| Regulación más estricta | Retrasos funcionales | Diseño privacy-by-default + asesoría regulatoria temprana |
| Saturación almacenamiento | Aumento de costos | Lifecycle policies + deduplicación + compresión |

### 13.8 Contribución Económica a la Sostenibilidad del ODS 3
Un modelo financiero sano permite:
- Mantener acceso continuo a informes (evita interrupciones del servicio).
- Reinvertir en mejoras de soporte diagnóstico (IA explicable, alertas tempranas).
- Expandir cobertura a clínicas de menor recurso mediante planes subvencionados.
- Generar datos agregados útiles para planificación sanitaria local.

r

> Nota: Los detalles técnicos (tecnologías empleadas) se describen más adelante para quienes los necesiten.

## 2. Relación con el ODS 3 (Salud y Bienestar)
El ODS 3 persigue garantizar una vida sana y promover el bienestar para todos. La plataforma aporta a este objetivo mediante:

| Aspecto ODS 3 | Implementación Técnica | Beneficio Sanitario |
|---------------|------------------------|---------------------|
| Acceso a servicios de salud | Endpoints `/api/citas`, gestión de pacientes y categorías de estudio | Organización y reducción de barreras para programar estudios radiológicos |
| Diagnóstico oportuno | Módulo de radiografías + informes (`radiografia`, `informe`) | Permite registrar hallazgos y recomendaciones rápidamente |
| Calidad y seguridad | Roles (admin/usuario), JWT, validaciones `express-validator` | Minimiza accesos indebidos y errores de entrada |
| Continuidad asistencial | Historial de informes exportable y filtrable | Facilita derivaciones y segunda opinión |
| Innovación clínica | Campos para IA (`IA_Prediccion`, extensión a `IA_Confianza`, `Modelo_Version`) | Base para soporte diagnóstico asistido |
| Prevención y seguimiento | Estados de cita, categorización y control de informes pendientes | Permite identificar estudios no informados o críticos |
| Confidencialidad y gobernanza | Migración de auditoría (`audit_log`) propuesta en `migrations_ods.sql` | Futura trazabilidad de accesos y modificaciones |

### 2.1 Componentes Clave Vinculados al ODS 3
- **Gestión de Pacientes**: Tabla `paciente` con datos clínicos básicos que soportan correlación longitudinal.
- **Citas**: Tabla `cita` vinculada a `paciente` y `usuario` (quien solicita / gestiona). Estado de la cita permite flujo asistencial (Pendiente, Confirmada, Completada, etc.).
- **Radiografías**: Tabla `radiografia` + carga de imágenes con `multer`. Asociadas 1:1 a la cita para integridad del episodio.
- **Informes Clínicos**: Tabla `informe` con diagnóstico, recomendaciones y validación por usuario con rol administrador. Posibilidad de indicadores automatizados (campo IA_Prediccion y migración para confianza del modelo).
- **Clasificación Clínica**: `categoria_estudio` favorece análisis epidemiológico y priorización.
- **Exportación Segura de Informes**: El frontend (`client/app.js`) genera exportaciones estructuradas (resumen estadístico, detalle, watermark, clasificación de severidad) que facilitan seguimiento y comunicación clínica.
- **Seguridad y Privacidad**: Autenticación JWT, hashing de contraseñas con `bcryptjs`, verificación de rol en endpoints críticos, planeación de auditoría (`audit_log`).

### 2.2 Métricas Propuestas alineadas a ODS 3
Para evaluar impacto sanitario se recomienda instrumentar:
- Tiempo medio entre `Fecha_Cita` y `Fecha_Informe`.
- Porcentaje de informes con clasificación severa (alerta alta / observación) vs total.
- Porcentaje de citas sin informe después de X días.
- Tasa de reprogramaciones o cancelaciones.
- Número de exportaciones clínicas generadas para continuidad asistencial.

## 3. Arquitectura Técnica
```
Cliente (HTML/CSS/JS)  <--->  API REST (Express + JWT)  <--->  MySQL (modelo relacional)
                                   |                         
                                   |-- Multer (almacenamiento de imágenes radiográficas)
                                   |-- Futuro: Capa IA / Auditoría
```

### 3.1 Stack
- **Backend**: Node.js (Express), middleware CORS, validación de entradas, JWT para autenticación, `multer` para manejo de ficheros.
- **Base de Datos**: MySQL/MariaDB con claves foráneas y restricciones (integridad referencial entre `cita`, `radiografia`, `informe`, `paciente`, `usuario`).
- **Frontend**: Vanilla JS con manipulación dinámica del DOM y modales para gestión de informes, citas y usuarios.

### 3.2 Modelo de Datos (Resumen)
| Entidad | Propósito | Relación Principal |
|---------|-----------|--------------------|
| `usuario` | Control de acceso / roles | 1:N con `cita`, 1:N valida `informe` |
| `paciente` | Información demográfica | 1:N con `cita` |
| `cita` | Episodio agendado | 1:1 con `radiografia`, N:1 `usuario`, N:1 `paciente` |
| `radiografia` | Imagen diagnóstica | 1:1 `informe`, N:1 `cita`, N:1 `categoria_estudio` |
| `informe` | Resultado clínico | 1:1 `radiografia`, validado por `usuario` |
| `categoria_estudio` | Clasificación clínica | 1:N `radiografia` |
| `pago` | (Opcional administrativo) | 1:1 `cita`, N:1 `paciente` |
| `audit_log` (migración) | Trazabilidad | N:1 `usuario` |

## 4. Flujo Funcional Relacionado a Salud
1. Usuario se registra (rol básico) y crea una cita con datos del paciente.
2. El administrador valida / gestiona el estado de la cita.
3. Se asocia o sube la radiografía correspondiente (evidencia diagnóstica).
4. El administrador emite y valida el informe (diagnóstico + recomendaciones + posible salida IA).
5. El paciente/usuario consulta y descarga su informe con controles de acceso.
6. Se exportan informes agregados para seguimiento clínico o derivación externa.

## 5. Contribución Diferenciadora a ODS 3
| Diferenciador | Impacto Salud | Oportunidad Evolutiva |
|---------------|---------------|------------------------|
| Exportación con severidad y filtros | Priorización de casos críticos | Integrar alertas en tiempo real |
| Campos IA (predicción) | Base para apoyo a diagnóstico | Añadir endpoint de inferencia y registro de métricas de precisión |
| Migración audit_log | Transparencia y gobernanza | Dashboards de cumplimiento y seguridad |
| Clasificación por categoría | Vigilancia epidemiológica básica | Reportes agregados (incidencia por tipo) |

## 6. Riesgos y Mitigaciones (Salud / Ética / Datos)
| Riesgo | Mitigación Propuesta |
|--------|----------------------|
| Acceso indebido a informes | Integrar auditoría + expiración tokens + rotación de SECRET |
| Datos identificables en exportaciones | Modo anonimizado (hash ID_Paciente, remover correo) |
| Sesgo en IA_Prediccion | Registrar `Modelo_Version`, `IA_Confianza` y validar con conjunto de control |
| Citas sin cierre clínico | Dashboard de citas sin informe (`/api/citas-sin-informe`) + SLA interno |

## 7. Roadmap Recomendado (ODS 3 + Escalabilidad)
| Fase | Acción | Beneficio ODS 3 |
|------|--------|------------------|
| Corto | Implementar auditoría (ya migrada la tabla) | Trazabilidad y seguridad de datos clínicos |
| Corto | Endpoint métricas (tiempos, severidad) | Monitoreo de calidad asistencial |
| Medio | Anonimización para exportaciones docentes | Formación y expansión segura del conocimiento |
| Medio | Integrar clasificación automática real (modelo IA) | Diagnóstico más rápido / triage |
| Medio | Recordatorios de seguimiento (ej. controles anuales) | Prevención y continuidad |
| Largo | Interoperabilidad (FHIR ImagingStudy/DiagnosticReport) | Integración con sistemas clínicos externos |
| Largo | Panel epidemiológico (tendencias por categoría) | Vigilancia y planificación sanitaria |

## 8. Instalación y Ejecución
### 8.1 Requisitos
- Node.js >= 18
- MySQL/MariaDB

### 8.2 Variables de Entorno (.env)
```
PORT=3000
DB_HOST=localhost
DB_USER=usuario
DB_PASSWORD=contraseña
DB_NAME=clinicaradiografias
JWT_SECRET=tu_secreto_seguro
CORS_ORIGIN=http://localhost:3000
```

### 8.3 Pasos
1. Crear base de datos e importar `clinicaradiografias.sql` (y luego ejecutar migraciones incrementales `migrations_ods.sql`).
2. Instalar dependencias en `server/`:
```
npm install
```
3. Iniciar backend:
```
node server.js
```
4. Abrir cliente (sirve archivos estáticos desde `client/`). Navega a: `http://localhost:3000/`.

## 9. Endpoints Principales (Resumen)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/register | Registro de usuario |
| POST | /api/login | Autenticación JWT |
| GET | /api/citas | Listado (paginable, restringido por rol) |
| POST | /api/citas | Crear cita + paciente asociado |
| PUT | /api/citas/:id | Editar cita |
| PUT | /api/citas/:id/estado | Cambiar estado (admin) |
| DELETE | /api/citas/:id | Eliminar cita (dueño/admin) |
| GET | /api/radiografias/:idCita | Listar radiografías de cita |
| POST | /api/radiografias/:id/upload | Subir imagen (admin) |
| POST | /api/informes | Crear informe (admin) |
| GET | /api/informes/mios | Informes del usuario autenticado |
| GET | /api/informes | Listar todos (admin) |
| GET | /api/informes/:id/descargar | Descargar imagen asociada |
| GET | /api/citas-sin-informe | Identificar brechas diagnósticas (admin) |

## 10. Extensiones para Maximizar Impacto ODS 3
- Implementar colas (ej. RabbitMQ) para procesar IA y no bloquear respuesta.
- Añadir notificaciones (correo / push) para resultados críticos.
- Registrar métricas en tabla `kpi_clinica` (tiempos, severidades, incidencias por categoría).
- Soportar modos de exportación “anonimizado” y “clínico”.
- Endpoints de agregación: `/api/metrics/severidad`, `/api/metrics/tiempos`.

## 11. Licencia y Responsabilidad
Este software es una herramienta de apoyo. No sustituye la evaluación médica presencial. Las decisiones clínicas deben ser tomadas por profesionales certificados.

## 12. Créditos / Autoría
Proyecto base desarrollado para gestión integral de radiografías clínicas con enfoque en alineación al **ODS 3: Salud y Bienestar**.

---
¿Necesitas que añada ejemplos de métricas o el esquema de la tabla de auditoría en código? Puedo prepararlo como siguiente paso.
