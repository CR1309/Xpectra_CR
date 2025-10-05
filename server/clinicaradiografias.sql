-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 30-06-2025 a las 08:12:24
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
(2, 'Dental', 'Radiografía dental'),
(3, 'Torax', 'Radiografía de tórax'),
(4, 'Otro', 'Otro tipo de estudio');

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
(1, '2025-06-10', '10:00:00', NULL, 'Confirmada', 1, 2),
(2, '2025-06-12', '12:30:00', NULL, 'Pendiente', 2, 3),
(12, '2025-06-30', '12:46:00', 'Radiografia anual', 'Pendiente', 17, 1),
(13, '2025-06-30', '14:52:00', 'Radiografia anual', 'Pendiente', 18, 4);

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
  `ID_Radiografia` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `informe`
--

INSERT INTO `informe` (`ID_Informe`, `Diagnostico`, `Recomendaciones`, `Fecha_Informe`, `IA_Prediccion`, `Validado_Por`, `ID_Radiografia`) VALUES
(1, 'Sin anomalías dentales detectadas.', 'Control anual recomendado.', '2025-06-10', 'Normal', 1, 1),
(2, 'Leve desviación observada.', 'Consultar con especialista.', '2025-06-12', 'Requiere revisión', 1, 2),
(3, 'orem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry\'s standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.', 'Prueba', '2025-06-29', 'Covid-19 (100.0%)', 1, 3),
(4, 'Normal', 'Normal', '2025-06-29', 'Normal (100.0%)', 1, 4);

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
(18, 'Cristian', 'Rivas', '2006-09-13', 'Masculino', 'apopa', '7652289', 'cristianuser@gmail.com');

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

--
-- Volcado de datos para la tabla `pago`
--

INSERT INTO `pago` (`ID_Pago`, `Fecha_Pago`, `Monto`, `Metodo_Pago`, `Estado`, `ID_Paciente`, `ID_Cita`) VALUES
(1, '2025-06-10', 300.00, 'Efectivo', 'Pagado', 1, 1),
(2, '2025-06-12', 500.00, 'Tarjeta', 'Pendiente', 2, 2);

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
(1, '2025-06-10', 'https://cdn.pixabay.com/photo/2017/01/31/13/13/medical-2027768_1280.png', 1, 2),
(2, '2025-06-12', '', 2, 1),
(3, '2025-06-30', '/uploads/rad-1751255202856-911118652.png', 12, 1),
(4, '2025-06-30', '/uploads/rad-1751259216635-838638309.jpeg', 13, 1);

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
(4, 'Cristian', 'usuario', 'cristianuser@gmail.com', '$2b$10$CWaB7FfLDr9hcbaYACFQb.ahaBNVIeF6c.gB1W6l9Jykcf53wNOaq', NULL);

--
-- Índices para tablas volcadas
--

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
-- AUTO_INCREMENT de la tabla `categoria_estudio`
--
ALTER TABLE `categoria_estudio`
  MODIFY `ID_Categoria` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `cita`
--
ALTER TABLE `cita`
  MODIFY `ID_Cita` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT de la tabla `informe`
--
ALTER TABLE `informe`
  MODIFY `ID_Informe` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `paciente`
--
ALTER TABLE `paciente`
  MODIFY `ID_Paciente` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT de la tabla `pago`
--
ALTER TABLE `pago`
  MODIFY `ID_Pago` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `pregunta`
--
ALTER TABLE `pregunta`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `radiografia`
--
ALTER TABLE `radiografia`
  MODIFY `ID_Radiografia` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `usuario`
--
ALTER TABLE `usuario`
  MODIFY `ID_Usuario` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Restricciones para tablas volcadas
--

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
