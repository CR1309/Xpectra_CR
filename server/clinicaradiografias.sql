-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 12-05-2025 a las 04:39:04
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

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `cita`
--

CREATE TABLE `cita` (
  `ID_Cita` int(11) NOT NULL,
  `Fecha_Cita` date NOT NULL,
  `Hora_Cita` time NOT NULL,
  `Estado` varchar(20) DEFAULT 'Pendiente',
  `ID_Paciente` int(11) NOT NULL,
  `ID_Usuario` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
(1, 'Cristian', 'Rivas', '0000-00-00', NULL, NULL, NULL, NULL),
(2, 'Cristian', 'Rivas', '0000-00-00', NULL, NULL, NULL, NULL),
(3, 'Cristian', 'Rivas', '0000-00-00', NULL, NULL, NULL, NULL),
(4, 'Cristian', 'Rivas', '0000-00-00', NULL, NULL, NULL, NULL),
(5, 'Cristian', 'Rivas', '0000-00-00', NULL, NULL, NULL, NULL),
(6, 'Cristian', 'Rivas', '0000-00-00', NULL, NULL, NULL, NULL),
(7, 'Cristian', 'Rivas', '0000-00-00', NULL, NULL, NULL, NULL),
(8, 'Cristian', 'Rivas', '0000-00-00', NULL, NULL, NULL, NULL),
(9, 'Cristian', 'Rivas', '0000-00-00', NULL, NULL, NULL, NULL),
(10, 'Cristian', 'Rivas', '0000-00-00', NULL, NULL, NULL, NULL),
(11, 'Cristian', 'Rivas', '0000-00-00', NULL, NULL, NULL, NULL),
(12, 'CE', 'EC', '0000-00-00', NULL, NULL, NULL, NULL);

-- Ejemplo de pacientes
INSERT INTO paciente (ID_Paciente, Nombre, Apellido, Fecha_Nacimiento, Sexo, Direccion, Telefono, Correo_Electronico) VALUES
(1, 'Juan', 'Pérez', '1990-05-10', 'Masculino', 'Calle Falsa 123', '555-111-2222', 'juan@email.com'),
(2, 'María', 'López', '1985-08-22', 'Femenino', 'Av. Real 456', '555-333-4444', 'maria@email.com');

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
-- Estructura de tabla para la tabla `radiografia`
--

CREATE TABLE `radiografia` (
  `ID_Radiografia` int(11) NOT NULL,
  `Fecha_Realizacion` date NOT NULL,
  `Imagen_URL` varchar(255) NOT NULL,
  `ID_Cita` int(11) NOT NULL,
  `ID_Categoria` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuario`
--

CREATE TABLE `usuario` (
  `ID_Usuario` int(11) NOT NULL,
  `Nombre_Usuario` varchar(100) NOT NULL,
  `Rol` varchar(50) NOT NULL,
  `Correo` varchar(100) NOT NULL,
  `Contrasena_Hash` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `usuario`
--

INSERT INTO usuario (ID_Usuario, Nombre_Usuario, Rol, Correo, Contrasena_Hash)
VALUES (1, 'admin', 'admin', 'admin@clinica.com', 'admin123');

-- Ejemplo de usuarios
INSERT INTO usuario (ID_Usuario, Nombre_Usuario, Rol, Correo, Contrasena_Hash)
VALUES
(1, 'admin', 'admin', 'admin@clinica.com', 'admin123'),
(2, 'juanp', 'usuario', 'juan@email.com', 'juan123'),
(3, 'maria', 'usuario', 'maria@email.com', 'maria123');

-- Ejemplo de categorías de estudio
INSERT INTO categoria_estudio (ID_Categoria, Nombre_Categoria, Descripcion) VALUES
(1, 'General', 'Radiografía general'),
(2, 'Dental', 'Radiografía dental'),
(3, 'Torax', 'Radiografía de tórax'),
(4, 'Otro', 'Otro tipo de estudio');

-- Ejemplo de citas
INSERT INTO cita (ID_Cita, Fecha_Cita, Hora_Cita, Estado, ID_Paciente, ID_Usuario) VALUES
(1, '2025-06-10', '10:00:00', 'Confirmada', 1, 2),
(2, '2025-06-12', '12:30:00', 'Pendiente', 2, 3);

-- Ejemplo de radiografías
INSERT INTO radiografia (ID_Radiografia, Fecha_Realizacion, Imagen_URL, ID_Cita, ID_Categoria) VALUES
(1, '2025-06-10', 'https://cdn.pixabay.com/photo/2017/01/31/13/13/medical-2027768_1280.png', 1, 2),
(2, '2025-06-12', '', 2, 1);

-- Ejemplo de pagos
INSERT INTO pago (ID_Pago, Fecha_Pago, Monto, Metodo_Pago, Estado, ID_Paciente, ID_Cita) VALUES
(1, '2025-06-10', 300.00, 'Efectivo', 'Pagado', 1, 1),
(2, '2025-06-12', 500.00, 'Tarjeta', 'Pendiente', 2, 2);

-- Ejemplo de informes
INSERT INTO informe (ID_Informe, Diagnostico, Recomendaciones, Fecha_Informe, IA_Prediccion, Validado_Por, ID_Radiografia) VALUES
(1, 'Sin anomalías dentales detectadas.', 'Control anual recomendado.', '2025-06-10', 'Normal', 1, 1),
(2, 'Leve desviación observada.', 'Consultar con especialista.', '2025-06-12', 'Requiere revisión', 1, 2);

-- --------------------------------------------------------
-- Estructura de tabla para la tabla `pregunta`
--

CREATE TABLE IF NOT EXISTS `pregunta` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `correo` varchar(100) NOT NULL,
  `mensaje` varchar(500) NOT NULL,
  `fecha` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
  MODIFY `ID_Categoria` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `cita`
--
ALTER TABLE `cita`
  MODIFY `ID_Cita` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT de la tabla `informe`
--
ALTER TABLE `informe`
  MODIFY `ID_Informe` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `paciente`
--
ALTER TABLE `paciente`
  MODIFY `ID_Paciente` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT de la tabla `pago`
--
ALTER TABLE `pago`
  MODIFY `ID_Pago` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `radiografia`
--
ALTER TABLE `radiografia`
  MODIFY `ID_Radiografia` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `usuario`
--
ALTER TABLE `usuario`
  MODIFY `ID_Usuario` int(11) NOT NULL AUTO_INCREMENT;

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
  ADD CONSTRAINT `informe_ibfk_2` FOREIGN KEY (`ID_Radiografia`) REFERENCES `radiografia` (`ID_Radiografia`);

--
-- Filtros para la tabla `pago`
--
ALTER TABLE `pago`
  ADD CONSTRAINT `pago_ibfk_1` FOREIGN KEY (`ID_Paciente`) REFERENCES `paciente` (`ID_Paciente`),
  ADD CONSTRAINT `pago_ibfk_2` FOREIGN KEY (`ID_Cita`) REFERENCES `cita` (`ID_Cita`);

--
-- Filtros para la tabla `radiografia`
--
ALTER TABLE `radiografia`
  ADD CONSTRAINT `radiografia_ibfk_1` FOREIGN KEY (`ID_Cita`) REFERENCES `cita` (`ID_Cita`),
  ADD CONSTRAINT `radiografia_ibfk_2` FOREIGN KEY (`ID_Categoria`) REFERENCES `categoria_estudio` (`ID_Categoria`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
