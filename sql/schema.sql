-- Schema for the astronomy_hub database.
--
-- Extracted verbatim from Cloud_SQL_Export_2026-08-04 (10_48_42).sql,
-- a Cloud SQL export. Table definitions are byte-for-byte as exported;
-- only the data (LOCK TABLES / INSERT / UNLOCK TABLES) has been removed.
--
-- Stored procedures and triggers are NOT here -- the export omitted them.
-- Install those with: python sql/install_stored_programs.py
--
-- MySQL dump 10.13  Distrib 8.0.44, for Linux (x86_64)
--
-- Host: 127.0.0.1    Database: mysql
-- ------------------------------------------------------
-- Server version	8.0.44-google

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `astronomy_hub`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `astronomy_hub` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `astronomy_hub`;

--
-- Table structure for table `CelestialObject`
--

DROP TABLE IF EXISTS `CelestialObject`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CelestialObject` (
  `ObjectID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(250) DEFAULT NULL,
  `Magnitude` float DEFAULT NULL,
  `ObjectCategory` varchar(250) DEFAULT NULL,
  `RightAscension` float DEFAULT NULL,
  `Declination` float DEFAULT NULL,
  `Constellation` varchar(250) DEFAULT NULL,
  PRIMARY KEY (`ObjectID`)
) ENGINE=InnoDB AUTO_INCREMENT=147454 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CommunityReport`
--

DROP TABLE IF EXISTS `CommunityReport`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CommunityReport` (
  `ReportID` int NOT NULL AUTO_INCREMENT,
  `UserID` int DEFAULT NULL,
  `Latitude` float DEFAULT NULL,
  `Longitude` float DEFAULT NULL,
  `ReportText` text,
  `CreatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ReportID`),
  KEY `UserID` (`UserID`),
  CONSTRAINT `CommunityReport_ibfk_1` FOREIGN KEY (`UserID`) REFERENCES `Users` (`UserID`) ON DELETE SET NULL,
  CONSTRAINT `chk_community_report_latitude` CHECK (((`Latitude` is null) or (`Latitude` between -(90) and 90))),
  CONSTRAINT `chk_community_report_longitude` CHECK (((`Longitude` is null) or (`Longitude` between -(180) and 180))),
  CONSTRAINT `chk_community_report_not_empty` CHECK (((`ReportText` is not null) and (char_length(trim(`ReportText`)) > 0)))
) ENGINE=InnoDB AUTO_INCREMENT=137 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `LightPollutionObservation`
--

DROP TABLE IF EXISTS `LightPollutionObservation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `LightPollutionObservation` (
  `ObservationID` int NOT NULL AUTO_INCREMENT,
  `Latitude` float DEFAULT NULL,
  `Longitude` float DEFAULT NULL,
  `LimitingMag` float DEFAULT NULL,
  PRIMARY KEY (`ObservationID`)
) ENGINE=InnoDB AUTO_INCREMENT=16384 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ObservationList`
--

DROP TABLE IF EXISTS `ObservationList`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ObservationList` (
  `ListID` int NOT NULL AUTO_INCREMENT,
  `UserID` int NOT NULL,
  `Latitude` float DEFAULT NULL,
  `Longitude` float DEFAULT NULL,
  `ListName` varchar(250) DEFAULT NULL,
  `CreatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ListID`),
  UNIQUE KEY `uq_observation_list_user_name` (`UserID`,`ListName`),
  CONSTRAINT `ObservationList_ibfk_1` FOREIGN KEY (`UserID`) REFERENCES `Users` (`UserID`) ON DELETE CASCADE,
  CONSTRAINT `chk_observation_list_latitude` CHECK (((`Latitude` is null) or (`Latitude` between -(90) and 90))),
  CONSTRAINT `chk_observation_list_longitude` CHECK (((`Longitude` is null) or (`Longitude` between -(180) and 180)))
) ENGINE=InnoDB AUTO_INCREMENT=58 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SavedObject`
--

DROP TABLE IF EXISTS `SavedObject`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SavedObject` (
  `ListID` int NOT NULL,
  `ObjectID` int NOT NULL,
  `AddedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `IsObserved` tinyint(1) NOT NULL DEFAULT '0',
  `Notes` varchar(250) DEFAULT NULL,
  PRIMARY KEY (`ListID`,`ObjectID`),
  KEY `ObjectID` (`ObjectID`),
  CONSTRAINT `SavedObject_ibfk_1` FOREIGN KEY (`ListID`) REFERENCES `ObservationList` (`ListID`) ON DELETE CASCADE,
  CONSTRAINT `SavedObject_ibfk_2` FOREIGN KEY (`ObjectID`) REFERENCES `CelestialObject` (`ObjectID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Users`
--

DROP TABLE IF EXISTS `Users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Users` (
  `UserID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(250) DEFAULT NULL,
  `Email` varchar(250) NOT NULL,
  PRIMARY KEY (`UserID`),
  UNIQUE KEY `Email` (`Email`)
) ENGINE=InnoDB AUTO_INCREMENT=2066 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ga_n_2025`
--

DROP TABLE IF EXISTS `ga_n_2025`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ga_n_2025` (
  `id` int NOT NULL,
  `obs_type` varchar(20) DEFAULT NULL,
  `latitude` decimal(15,10) DEFAULT NULL,
  `longitude` decimal(15,10) DEFAULT NULL,
  `elevation_m` decimal(10,2) DEFAULT NULL,
  `local_date` date DEFAULT NULL,
  `local_time` time DEFAULT NULL,
  `ut_date` date DEFAULT NULL,
  `ut_time` time DEFAULT NULL,
  `limiting_mag` int DEFAULT NULL,
  `sqm_reading` decimal(6,2) DEFAULT NULL,
  `sqm_serial` varchar(100) DEFAULT NULL,
  `cloud_cover` varchar(100) DEFAULT NULL,
  `constellation` varchar(100) DEFAULT NULL,
  `sky_comment` text,
  `location_comment` text,
  `country` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `hyg_v42`
--

DROP TABLE IF EXISTS `hyg_v42`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hyg_v42` (
  `id` int NOT NULL,
  `hip` int DEFAULT NULL,
  `hd` int DEFAULT NULL,
  `hr` int DEFAULT NULL,
  `gl` varchar(50) DEFAULT NULL,
  `bf` varchar(50) DEFAULT NULL,
  `proper` varchar(100) DEFAULT NULL,
  `ra` decimal(15,10) DEFAULT NULL,
  `dec` decimal(15,10) DEFAULT NULL,
  `dist` decimal(15,6) DEFAULT NULL,
  `pmra` decimal(15,8) DEFAULT NULL,
  `pmdec` decimal(15,8) DEFAULT NULL,
  `rv` decimal(15,6) DEFAULT NULL,
  `mag` decimal(10,4) DEFAULT NULL,
  `absmag` decimal(10,4) DEFAULT NULL,
  `spect` varchar(50) DEFAULT NULL,
  `ci` decimal(10,4) DEFAULT NULL,
  `x` decimal(20,10) DEFAULT NULL,
  `y` decimal(20,10) DEFAULT NULL,
  `z` decimal(20,10) DEFAULT NULL,
  `vx` decimal(20,12) DEFAULT NULL,
  `vy` decimal(20,12) DEFAULT NULL,
  `vz` decimal(20,12) DEFAULT NULL,
  `rarad` decimal(20,15) DEFAULT NULL,
  `decrad` decimal(20,15) DEFAULT NULL,
  `pmrarad` decimal(25,18) DEFAULT NULL,
  `pmdecrad` decimal(25,18) DEFAULT NULL,
  `bayer` varchar(20) DEFAULT NULL,
  `flam` varchar(20) DEFAULT NULL,
  `con` varchar(10) DEFAULT NULL,
  `comp` int DEFAULT NULL,
  `comp_primary` int DEFAULT NULL,
  `base` varchar(50) DEFAULT NULL,
  `lum` decimal(25,10) DEFAULT NULL,
  `var` varchar(50) DEFAULT NULL,
  `var_min` decimal(10,4) DEFAULT NULL,
  `var_max` decimal(10,4) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ngc_objects`
--

DROP TABLE IF EXISTS `ngc_objects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ngc_objects` (
  `messier_id` varchar(20) DEFAULT NULL,
  `ngc_id` varchar(50) NOT NULL,
  `v_mag` decimal(6,2) DEFAULT NULL,
  `object_type` varchar(20) DEFAULT NULL,
  `comments` varchar(255) DEFAULT NULL,
  `ra` decimal(10,4) DEFAULT NULL,
  `dec` decimal(10,4) DEFAULT NULL,
  `ref` varchar(100) DEFAULT NULL,
  `is_up` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`ngc_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-04 15:49:59
