-- =============================================================
-- XPectra — Clínica de Radiografías
-- Schema + seed data (safe for version control)
-- MySQL 8 / MariaDB 10.4+
-- =============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- -------------------------------------------------
-- Database
-- -------------------------------------------------
CREATE DATABASE IF NOT EXISTS `clinicaradiografias`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE `clinicaradiografias`;

-- -------------------------------------------------
-- Tables
-- -------------------------------------------------

CREATE TABLE IF NOT EXISTS `categoria_estudio` (
  `ID_Categoria` int(11) NOT NULL AUTO_INCREMENT,
  `Nombre_Categoria` varchar(100) NOT NULL,
  `Descripcion` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID_Categoria`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `usuario` (
  `ID_Usuario` int(11) NOT NULL AUTO_INCREMENT,
  `Nombre_Usuario` varchar(100) NOT NULL,
  `Rol` varchar(50) NOT NULL,
  `Correo` varchar(100) NOT NULL,
  `Contrasena_Hash` varchar(255) NOT NULL,
  `Foto_Perfil` longtext DEFAULT NULL,
  PRIMARY KEY (`ID_Usuario`),
  UNIQUE KEY `Correo` (`Correo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `paciente` (
  `ID_Paciente` int(11) NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) NOT NULL,
  `Apellido` varchar(100) NOT NULL,
  `Fecha_Nacimiento` date NOT NULL,
  `Sexo` varchar(10) DEFAULT NULL,
  `Direccion` varchar(255) DEFAULT NULL,
  `Telefono` varchar(20) DEFAULT NULL,
  `Correo_Electronico` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`ID_Paciente`),
  KEY `idx_paciente_nombre` (`Nombre`,`Apellido`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `cita` (
  `ID_Cita` int(11) NOT NULL AUTO_INCREMENT,
  `Fecha_Cita` date NOT NULL,
  `Hora_Cita` time NOT NULL,
  `Motivo` varchar(255) DEFAULT NULL,
  `Estado` varchar(20) DEFAULT 'Pendiente',
  `ID_Paciente` int(11) NOT NULL,
  `ID_Usuario` int(11) NOT NULL,
  PRIMARY KEY (`ID_Cita`),
  KEY `ID_Paciente` (`ID_Paciente`),
  KEY `ID_Usuario` (`ID_Usuario`),
  KEY `idx_cita_fecha` (`Fecha_Cita`),
  CONSTRAINT `cita_ibfk_1` FOREIGN KEY (`ID_Paciente`) REFERENCES `paciente` (`ID_Paciente`),
  CONSTRAINT `cita_ibfk_2` FOREIGN KEY (`ID_Usuario`) REFERENCES `usuario` (`ID_Usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `radiografia` (
  `ID_Radiografia` int(11) NOT NULL AUTO_INCREMENT,
  `Fecha_Realizacion` date NOT NULL,
  `Imagen_URL` varchar(255) NOT NULL,
  `ID_Cita` int(11) NOT NULL,
  `ID_Categoria` int(11) NOT NULL,
  PRIMARY KEY (`ID_Radiografia`),
  UNIQUE KEY `ID_Cita` (`ID_Cita`),
  KEY `ID_Categoria` (`ID_Categoria`),
  CONSTRAINT `radiografia_ibfk_1` FOREIGN KEY (`ID_Cita`) REFERENCES `cita` (`ID_Cita`) ON DELETE CASCADE,
  CONSTRAINT `radiografia_ibfk_2` FOREIGN KEY (`ID_Categoria`) REFERENCES `categoria_estudio` (`ID_Categoria`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `informe` (
  `ID_Informe` int(11) NOT NULL AUTO_INCREMENT,
  `Diagnostico` text NOT NULL,
  `Recomendaciones` text DEFAULT NULL,
  `Fecha_Informe` date NOT NULL,
  `IA_Prediccion` varchar(255) DEFAULT NULL,
  `Validado_Por` int(11) NOT NULL,
  `ID_Radiografia` int(11) NOT NULL,
  PRIMARY KEY (`ID_Informe`),
  UNIQUE KEY `ID_Radiografia` (`ID_Radiografia`),
  KEY `Validado_Por` (`Validado_Por`),
  CONSTRAINT `informe_ibfk_1` FOREIGN KEY (`Validado_Por`) REFERENCES `usuario` (`ID_Usuario`),
  CONSTRAINT `informe_ibfk_2` FOREIGN KEY (`ID_Radiografia`) REFERENCES `radiografia` (`ID_Radiografia`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `pago` (
  `ID_Pago` int(11) NOT NULL AUTO_INCREMENT,
  `Fecha_Pago` date NOT NULL,
  `Monto` decimal(10,2) NOT NULL,
  `Metodo_Pago` varchar(50) NOT NULL,
  `Estado` varchar(20) DEFAULT 'Pendiente',
  `ID_Paciente` int(11) NOT NULL,
  `ID_Cita` int(11) NOT NULL,
  `Tipo_Pago` varchar(50) DEFAULT 'Completo',
  PRIMARY KEY (`ID_Pago`),
  UNIQUE KEY `ID_Cita` (`ID_Cita`),
  KEY `ID_Paciente` (`ID_Paciente`),
  CONSTRAINT `pago_ibfk_1` FOREIGN KEY (`ID_Paciente`) REFERENCES `paciente` (`ID_Paciente`),
  CONSTRAINT `pago_ibfk_2` FOREIGN KEY (`ID_Cita`) REFERENCES `cita` (`ID_Cita`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `pregunta` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `correo` varchar(100) NOT NULL,
  `mensaje` varchar(500) NOT NULL,
  `fecha` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `login_attempts` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `failed_count` int(11) NOT NULL DEFAULT 0,
  `stage` tinyint NOT NULL DEFAULT 0,
  `lock_until` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `uniq_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------
-- Seed data (fictional — safe for version control)
-- -------------------------------------------------

-- Study categories
INSERT INTO `categoria_estudio` (`ID_Categoria`, `Nombre_Categoria`, `Descripcion`) VALUES
(1, 'General', 'Radiografía general'),
(2, 'Dental', 'Radiografía dental'),
(3, 'Torax', 'Radiografía de tórax'),
(4, 'Otro', 'Otro tipo de estudio');

-- Demo users (password for both: "demo123456")
-- To generate your own hash: node -e "require('bcryptjs').hash('yourpassword',10).then(console.log)"
INSERT INTO `usuario` (`ID_Usuario`, `Nombre_Usuario`, `Rol`, `Correo`, `Contrasena_Hash`) VALUES
(1, 'admin_demo', 'admin', 'admin@demo.com', '$2b$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'),
(2, 'usuario_demo', 'usuario', 'usuario@demo.com', '$2b$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');

-- NOTE: The hashes above are placeholders. After importing this schema,
-- register new users through the app or generate real hashes with:
--   node -e "require('bcryptjs').hash('yourpassword',10).then(console.log)"
-- Then update the rows manually:
--   UPDATE usuario SET Contrasena_Hash = '<your_hash>' WHERE Correo = 'admin@demo.com';

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
