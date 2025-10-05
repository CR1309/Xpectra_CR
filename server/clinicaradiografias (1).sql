-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 05-10-2025 a las 05:15:38
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `clinicaradiografias`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `audit_log`
--

CREATE TABLE `audit_log` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `accion` varchar(50) NOT NULL,
  `recurso` varchar(50) DEFAULT NULL,
  `recurso_id` int(11) DEFAULT NULL,
  `ip` varchar(64) DEFAULT NULL,
  `meta` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`meta`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `audit_log`
--

INSERT INTO `audit_log` (`id`, `user_id`, `accion`, `recurso`, `recurso_id`, `ip`, `meta`, `created_at`) VALUES
(1, 4, 'login', 'usuario', 4, '::1', NULL, '2025-10-01 02:23:41'),
(2, 1, 'login', 'usuario', 1, '::1', NULL, '2025-10-01 02:25:28'),
(3, 1, 'crear', 'cita', 14, '::1', '{\"fecha\":\"2025-10-11\",\"hora\":\"13:00\"}', '2025-10-01 02:26:44'),
(4, 1, 'subir', 'radiografia', 5, '::1', '{\"archivo\":\"/uploads/rad-1759285649872-129991455.jpeg\"}', '2025-10-01 02:27:29'),
(5, 1, 'crear', 'informe', NULL, '::1', '{\"ID_Radiografia\":5}', '2025-10-01 02:27:29'),
(6, 1, 'exportar', 'informe', NULL, '::1', '{\"cantidad\":5}', '2025-10-01 02:28:16'),
(7, 1, 'exportar', 'informe', NULL, '::1', '{\"cantidad\":5}', '2025-10-01 02:30:07'),
(8, 1, 'exportar', 'informe', NULL, '::1', '{\"cantidad\":5}', '2025-10-01 02:32:01'),
(9, 1, 'exportar', 'informe', NULL, '::1', '{\"cantidad\":5,\"formato\":\"tabla\"}', '2025-10-01 02:32:31'),
(10, 1, 'exportar', 'informe', NULL, '::1', '{\"cantidad\":5,\"formato\":\"detalle\"}', '2025-10-01 02:32:52'),
(11, 1, 'cambiar_estado', 'cita', 13, '::1', '{\"estado\":\"Cancelada\"}', '2025-10-01 03:54:51'),
(12, 1, 'cambiar_estado', 'cita', 13, '::1', '{\"estado\":\"Cancelada\"}', '2025-10-01 03:54:53'),
(13, 1, 'cambiar_estado', 'cita', 13, '::1', '{\"estado\":\"Confirmada\"}', '2025-10-01 03:54:54'),
(14, 1, 'cambiar_estado', 'cita', 2, '::1', '{\"estado\":\"Cancelada\"}', '2025-10-01 03:54:58'),
(15, 1, 'cambiar_estado', 'cita', 12, '::1', '{\"estado\":\"Cancelada\"}', '2025-10-01 03:55:01'),
(16, 1, 'cambiar_estado', 'cita', 12, '::1', '{\"estado\":\"Cancelada\"}', '2025-10-01 03:55:05'),
(17, 1, 'crear', 'cita', 15, '::1', '{\"fecha\":\"2025-10-13\",\"hora\":\"13:00\"}', '2025-10-01 04:02:32');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `categoria_estudio`
--

CREATE TABLE `categoria_estudio` (
  `ID_Categoria` int(11) NOT NULL,
  `Nombre_Categoria` varchar(100) NOT NULL,
  `Descripcion` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `categoria_estudio`
--

INSERT INTO `categoria_estudio` (`ID_Categoria`, `Nombre_Categoria`, `Descripcion`) VALUES
(1, 'General', 'Radiografía general'),
(3, 'Torax', 'Radiografía de tórax');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `cita`
--

CREATE TABLE `cita` (
  `ID_Cita` int(11) NOT NULL,
  `Fecha_Cita` date NOT NULL,
  `Hora_Cita` time NOT NULL,
  `Motivo` varchar(255) DEFAULT NULL,
  `Estado` varchar(20) DEFAULT 'Pendiente',
  `ID_Paciente` int(11) NOT NULL,
  `ID_Usuario` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `cita`
--

INSERT INTO `cita` (`ID_Cita`, `Fecha_Cita`, `Hora_Cita`, `Motivo`, `Estado`, `ID_Paciente`, `ID_Usuario`) VALUES
(12, '2025-06-30', '12:46:00', 'Radiografia anual', 'Cancelada', 17, 1),
(13, '2025-06-30', '14:52:00', 'Radiografia anual', 'Confirmada', 18, 4),
(14, '2025-10-11', '13:00:00', 'Radiografia anual', 'Pendiente', 17, 1),
(15, '2025-10-13', '13:00:00', 'Radiografia anual', 'Pendiente', 19, 1),
(16, '2025-10-05', '13:00:00', 'Radiografia anual', 'Completada', 17, 1),
(17, '2025-10-05', '11:30:00', 'Radiografia anual', 'Pendiente', 20, 4),
(18, '2025-10-05', '12:00:00', 'Radiografia anual', 'Pendiente', 21, 1),
(19, '2025-10-04', '15:00:00', 'Radiografia anual', 'Completada', 22, 1),
(20, '2025-10-05', '14:30:00', 'Radiografia anual', 'Cancelada', 23, 8);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `informe`
--

CREATE TABLE `informe` (
  `ID_Informe` int(11) NOT NULL,
  `Diagnostico` text NOT NULL,
  `Recomendaciones` text DEFAULT NULL,
  `Fecha_Informe` date NOT NULL,
  `IA_Prediccion` varchar(255) DEFAULT NULL,
  `Validado_Por` int(11) NOT NULL,
  `ID_Radiografia` int(11) NOT NULL,
  `IA_Confianza` decimal(5,2) DEFAULT NULL,
  `Modelo_Version` varchar(40) DEFAULT NULL,
  `Validado` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `informe`
--

INSERT INTO `informe` (`ID_Informe`, `Diagnostico`, `Recomendaciones`, `Fecha_Informe`, `IA_Prediccion`, `Validado_Por`, `ID_Radiografia`, `IA_Confianza`, `Modelo_Version`, `Validado`) VALUES
(3, 'orem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry\'s standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.', 'Prueba', '2025-06-29', 'Covid-19 (100.0%)', 1, 3, NULL, NULL, 0),
(4, 'Normal', 'Normal', '2025-06-29', 'Normal (100.0%)', 1, 4, NULL, NULL, 0),
(5, 'Alta probabilidad de Neumonía. Correlacionar con hallazgos clínicos.\n(IA: Neumonía 100.0%)', 'Recomendación: actuar según protocolo clínico para Neumonía y confirmar con pruebas complementarias.\n(IA: Neumonía 100.0%)', '2025-09-30', 'Neumonía (100.0%) [Torax]', 1, 5, NULL, NULL, 0),
(6, 'Alta probabilidad de Neumonía. Correlacionar con hallazgos clínicos.\n(IA: Neumonía 99.9%)', 'Recomendación: actuar según protocolo clínico para Neumonía y confirmar con pruebas complementarias.\n(IA: Neumonía 99.9%)', '2025-10-04', 'Neumonía (99.9%) [Torax]', 1, 6, NULL, NULL, 0),
(7, 'Patrón radiográfico que podría ser compatible con proceso tuberculoso. Reforzar estudio con baciloscopía / pruebas específicas.\n(IA: Tuberculosis 93.8%)', 'Derivar a programa de tuberculosis. Solicitar baciloscopía / PCR y aplicar medidas de aislamiento según normativa local.\n(IA: Tuberculosis 93.8%)', '2025-10-04', 'Tuberculosis (93.8%) [Torax]', 1, 8, NULL, NULL, 0),
(8, 'Radiografía de tórax sin hallazgos agudos evidentes. Parénquima pulmonar y estructuras óseas dentro de parámetros normales.\n(IA: Normal 100.0%)', 'Continuar controles clínicos rutinarios. No se requieren estudios adicionales salvo criterio clínico.\n(IA: Normal 100.0%)', '2025-10-04', 'Normal (100.0%) [Torax]', 6, 9, NULL, NULL, 0),
(9, 'Patrón radiográfico que podría ser compatible con proceso tuberculoso. Reforzar estudio con baciloscopía / pruebas específicas.\n(IA: Tuberculosis 93.8%)', 'Derivar a programa de tuberculosis. Solicitar baciloscopía / PCR y aplicar medidas de aislamiento según normativa local.\n(IA: Tuberculosis 93.8%)', '2025-10-04', 'Tuberculosis (93.8%) [Torax]', 6, 7, NULL, NULL, 0),
(10, 'Radiografía de tórax sin hallazgos agudos evidentes. Parénquima pulmonar y estructuras óseas dentro de parámetros normales.\n(IA: Normal 100.0%)', 'Continuar controles clínicos rutinarios. No se requieren estudios adicionales salvo criterio clínico.\n(IA: Normal 100.0%)', '2025-10-05', 'Normal (100.0%) [Torax]', 6, 10, NULL, NULL, 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `login_attempts`
--

CREATE TABLE `login_attempts` (
  `ID` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `failed_count` int(11) NOT NULL DEFAULT 0,
  `stage` tinyint(4) NOT NULL DEFAULT 0,
  `lock_until` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `login_attempts`
--

INSERT INTO `login_attempts` (`ID`, `user_id`, `failed_count`, `stage`, `lock_until`, `created_at`, `updated_at`) VALUES
(1, 4, 0, 1, '2025-10-05 02:32:00', '2025-10-04 19:52:18', '2025-10-04 20:31:00'),
(2, 1, 0, 1, '2025-10-05 01:53:23', '2025-10-04 19:52:20', '2025-10-04 19:52:23'),
(3, 5, 0, 1, '2025-10-05 02:23:21', '2025-10-04 20:22:01', '2025-10-04 20:22:21'),
(4, 6, 0, 0, NULL, '2025-10-04 20:25:56', '2025-10-04 20:25:56'),
(5, 7, 0, 2, '2025-10-04 20:45:57', '2025-10-04 20:39:39', '2025-10-04 20:40:57'),
(6, 8, 0, 0, NULL, '2025-10-04 20:43:59', '2025-10-04 20:43:59');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `paciente`
--

CREATE TABLE `paciente` (
  `ID_Paciente` int(11) NOT NULL,
  `Nombre` varchar(100) NOT NULL,
  `Apellido` varchar(100) NOT NULL,
  `Fecha_Nacimiento` date NOT NULL,
  `Sexo` varchar(10) DEFAULT NULL,
  `Direccion` varchar(255) DEFAULT NULL,
  `Telefono` varchar(20) DEFAULT NULL,
  `Correo_Electronico` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `paciente`
--

INSERT INTO `paciente` (`ID_Paciente`, `Nombre`, `Apellido`, `Fecha_Nacimiento`, `Sexo`, `Direccion`, `Telefono`, `Correo_Electronico`) VALUES
(1, 'Juan', 'Pérez', '1990-05-10', 'Masculino', 'Calle Falsa 123', '555-111-2222', 'juan@email.com'),
(2, 'María', 'López', '1985-08-22', 'Femenino', 'Av. Real 456', '555-333-4444', 'maria@email.com'),
(17, 'admin', 'Rivas', '2006-09-13', 'Masculino', 'blabla', '7652289', 'admin@clinica.com'),
(18, 'Cristian', 'Rivas', '2006-09-13', 'Masculino', 'apopa', '7652289', 'cristianuser@gmail.com'),
(19, 'admin', 'Nochez', '2025-08-12', 'Masculino', 'calle123,apopa', '726621', 'admin@clinica.com'),
(20, 'Cristian', 'Rivas', '2006-02-13', 'Masculino', 'apopa', '232323', 'cristianuser@gmail.com'),
(21, 'admin', 'Rivas', '2000-02-13', 'Masculino', 'apopa', '78769241', 'admin@clinica.com'),
(22, 'admin', 'Rivas', '2025-09-13', 'Masculino', 'apopa', '726621', 'admin@clinica.com'),
(23, 'Cristian', 'Rivas', '2025-09-13', 'Masculino', 'apopa', '726621', 'cristisnrivas@gmail.com');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pago`
--

CREATE TABLE `pago` (
  `ID_Pago` int(11) NOT NULL,
  `Fecha_Pago` date NOT NULL,
  `Monto` decimal(10,2) NOT NULL,
  `Metodo_Pago` varchar(50) NOT NULL,
  `Estado` varchar(20) DEFAULT 'Pendiente',
  `ID_Paciente` int(11) NOT NULL,
  `ID_Cita` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pregunta`
--

CREATE TABLE `pregunta` (
  `id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `correo` varchar(100) NOT NULL,
  `mensaje` varchar(500) NOT NULL,
  `fecha` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `pregunta`
--

INSERT INTO `pregunta` (`id`, `nombre`, `correo`, `mensaje`, `fecha`) VALUES
(1, 'Cristian', 'cristianuser@gmail.com', 'P1', '2025-10-04 13:21:42');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `radiografia`
--

CREATE TABLE `radiografia` (
  `ID_Radiografia` int(11) NOT NULL,
  `Fecha_Realizacion` date NOT NULL,
  `Imagen_URL` varchar(255) NOT NULL,
  `ID_Cita` int(11) NOT NULL,
  `ID_Categoria` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `radiografia`
--

INSERT INTO `radiografia` (`ID_Radiografia`, `Fecha_Realizacion`, `Imagen_URL`, `ID_Cita`, `ID_Categoria`) VALUES
(3, '2025-06-30', '/uploads/rad-1751255202856-911118652.png', 12, 1),
(4, '2025-06-30', '/uploads/rad-1751259216635-838638309.jpeg', 13, 1),
(5, '2025-10-11', '/uploads/rad-1759285649872-129991455.jpeg', 14, 3),
(6, '2025-10-13', '/uploads/rad-1759625447807-448391228.jpeg', 15, 1),
(7, '2025-10-05', '/uploads/rad-1759632665687-474783305.png', 16, 3),
(8, '2025-10-05', '/uploads/rad-1759628189472-853953767.png', 17, 3),
(9, '2025-10-05', '/uploads/rad-1759632597650-608572056.jpeg', 18, 3),
(10, '2025-10-04', '/uploads/rad-1759633669364-53855983.jpeg', 19, 3),
(11, '2025-10-05', '', 20, 3);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuario`
--

CREATE TABLE `usuario` (
  `ID_Usuario` int(11) NOT NULL,
  `Nombre_Usuario` varchar(100) NOT NULL,
  `Rol` varchar(50) NOT NULL,
  `Correo` varchar(100) NOT NULL,
  `Contrasena_Hash` varchar(255) NOT NULL,
  `Foto_Perfil` longtext DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `usuario`
--

INSERT INTO `usuario` (`ID_Usuario`, `Nombre_Usuario`, `Rol`, `Correo`, `Contrasena_Hash`, `Foto_Perfil`) VALUES
(1, 'admin', 'admin', 'admin@clinica.com', '$2a$12$4d6DeLzXzlKHwTxdSGK.NuK1HEVq3tEYunKxzYiNaWQLLwb2qs67i', NULL),
(2, 'juanp', 'usuario', 'juan@email.com', '$$2a$12$FXzWZoMhUM9VJoSXvRA7m./2JUG6KgPJ23hszfqWPISF2.xbmzY6u', NULL),
(3, 'maria', 'usuario', 'maria@email.com', '$2a$12$FxBWRoAZQzWbJxzg8ONQf.TKfF4oqdZ9AhWu2pBkDEIWxv2pxjMwC', NULL),
(4, 'Cristian', 'usuario', 'cristianuser@gmail.com', '$2b$10$CWaB7FfLDr9hcbaYACFQb.ahaBNVIeF6c.gB1W6l9Jykcf53wNOaq', NULL),
(5, 'Carlos', 'usuario', 'carlos@gmail.com', '$2b$10$1VOCw8LIEcdsD6d5vf..b.tW1HW2pcolHRHO21aAwgCyAiaumX7na', NULL),
(6, 'admin2', 'admin', 'admin@gmail.com', '$2b$10$YNvITQUMDLv2BjTJ7u7LxepTBmivoMNJCaw0udnWJelVpO0dVyMqW', NULL),
(7, 'p123', 'usuario', 'jose@gmail.com', '$2b$10$yyk3putgneShWkMxIJf81eJCMOc6Saw.tyVXYcZb4/yPOYaabcRYy', NULL),
(8, 'Cristian', 'usuario', 'cristisnrivas@gmail.com', '$2b$10$sQkaqnG9DH9yUYkdWgFtWuISFz3rs28nwVZkT6RQDAlNgy0AxuoLK', NULL);

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `audit_log`
--
ALTER TABLE `audit_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_accion` (`accion`),
  ADD KEY `idx_recurso` (`recurso`),
  ADD KEY `idx_created` (`created_at`),
  ADD KEY `fk_audit_user` (`user_id`);

--
-- Indices de la tabla `categoria_estudio`
--
ALTER TABLE `categoria_estudio`
  ADD PRIMARY KEY (`ID_Categoria`);

--
-- Indices de la tabla `cita`
--
ALTER TABLE `cita`
  ADD PRIMARY KEY (`ID_Cita`),
  ADD KEY `ID_Paciente` (`ID_Paciente`),
  ADD KEY `ID_Usuario` (`ID_Usuario`),
  ADD KEY `idx_cita_fecha` (`Fecha_Cita`);

--
-- Indices de la tabla `informe`
--
ALTER TABLE `informe`
  ADD PRIMARY KEY (`ID_Informe`),
  ADD UNIQUE KEY `ID_Radiografia` (`ID_Radiografia`),
  ADD KEY `Validado_Por` (`Validado_Por`);

--
-- Indices de la tabla `login_attempts`
--
ALTER TABLE `login_attempts`
  ADD PRIMARY KEY (`ID`),
  ADD UNIQUE KEY `uniq_user` (`user_id`);

--
-- Indices de la tabla `paciente`
--
ALTER TABLE `paciente`
  ADD PRIMARY KEY (`ID_Paciente`),
  ADD KEY `idx_paciente_nombre` (`Nombre`,`Apellido`);

--
-- Indices de la tabla `pago`
--
ALTER TABLE `pago`
  ADD PRIMARY KEY (`ID_Pago`),
  ADD UNIQUE KEY `ID_Cita` (`ID_Cita`),
  ADD KEY `ID_Paciente` (`ID_Paciente`);

--
-- Indices de la tabla `pregunta`
--
ALTER TABLE `pregunta`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `radiografia`
--
ALTER TABLE `radiografia`
  ADD PRIMARY KEY (`ID_Radiografia`),
  ADD UNIQUE KEY `ID_Cita` (`ID_Cita`),
  ADD KEY `ID_Categoria` (`ID_Categoria`);

--
-- Indices de la tabla `usuario`
--
ALTER TABLE `usuario`
  ADD PRIMARY KEY (`ID_Usuario`),
  ADD UNIQUE KEY `Correo` (`Correo`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `audit_log`
--
ALTER TABLE `audit_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT de la tabla `categoria_estudio`
--
ALTER TABLE `categoria_estudio`
  MODIFY `ID_Categoria` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `cita`
--
ALTER TABLE `cita`
  MODIFY `ID_Cita` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT de la tabla `informe`
--
ALTER TABLE `informe`
  MODIFY `ID_Informe` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT de la tabla `login_attempts`
--
ALTER TABLE `login_attempts`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de la tabla `paciente`
--
ALTER TABLE `paciente`
  MODIFY `ID_Paciente` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT de la tabla `pago`
--
ALTER TABLE `pago`
  MODIFY `ID_Pago` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `pregunta`
--
ALTER TABLE `pregunta`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `radiografia`
--
ALTER TABLE `radiografia`
  MODIFY `ID_Radiografia` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT de la tabla `usuario`
--
ALTER TABLE `usuario`
  MODIFY `ID_Usuario` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `audit_log`
--
ALTER TABLE `audit_log`
  ADD CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `usuario` (`ID_Usuario`) ON DELETE SET NULL;

--
-- Filtros para la tabla `cita`
--
ALTER TABLE `cita`
  ADD CONSTRAINT `cita_ibfk_1` FOREIGN KEY (`ID_Paciente`) REFERENCES `paciente` (`ID_Paciente`),
  ADD CONSTRAINT `cita_ibfk_2` FOREIGN KEY (`ID_Usuario`) REFERENCES `usuario` (`ID_Usuario`);

--
-- Filtros para la tabla `informe`
--
ALTER TABLE `informe`
  ADD CONSTRAINT `informe_ibfk_1` FOREIGN KEY (`Validado_Por`) REFERENCES `usuario` (`ID_Usuario`),
  ADD CONSTRAINT `informe_ibfk_2` FOREIGN KEY (`ID_Radiografia`) REFERENCES `radiografia` (`ID_Radiografia`) ON DELETE CASCADE;

--
-- Filtros para la tabla `pago`
--
ALTER TABLE `pago`
  ADD CONSTRAINT `pago_ibfk_1` FOREIGN KEY (`ID_Paciente`) REFERENCES `paciente` (`ID_Paciente`),
  ADD CONSTRAINT `pago_ibfk_2` FOREIGN KEY (`ID_Cita`) REFERENCES `cita` (`ID_Cita`) ON DELETE CASCADE;

--
-- Filtros para la tabla `radiografia`
--
ALTER TABLE `radiografia`
  ADD CONSTRAINT `radiografia_ibfk_1` FOREIGN KEY (`ID_Cita`) REFERENCES `cita` (`ID_Cita`) ON DELETE CASCADE,
  ADD CONSTRAINT `radiografia_ibfk_2` FOREIGN KEY (`ID_Categoria`) REFERENCES `categoria_estudio` (`ID_Categoria`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
