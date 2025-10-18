-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: hospital_managment
-- ------------------------------------------------------
-- Server version	8.0.43

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
-- Table structure for table `account_info`
--

DROP TABLE IF EXISTS `account_info`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `account_info` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `email` varchar(100) NOT NULL,
  `last_login` datetime DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `account_info_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `role` (`role_id`)
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `account_info`
--

LOCK TABLES `account_info` WRITE;
/*!40000 ALTER TABLE `account_info` DISABLE KEYS */;
INSERT INTO `account_info` VALUES (1,1,'admin_user','hashed_password_1','admin@clinic.com',NULL),(2,2,'drtan','hashed_password_2','drtan@clinic.com',NULL),(3,3,'reception_siti','hashed_password_3','siti@clinic.com',NULL),(4,2,'drlim','hashed_password_4','drlim@clinic.com',NULL),(6,2,'reception_siti1','placeholder_hash','siticlinic.com',NULL),(7,1,'admin1','admin123','admin@gmail.com',NULL),(8,1,'lekshan','$2b$10$xxoSo8xwOQoFzGjnb9O/oOaL8xCypg75Maam2YEgmZEcY7P6i0jly','llekshan@gmail.com',NULL),(9,3,'user1','$2b$10$aSEVJuHq8pScIrT0RfwrVexKN9TQ9ecrksHivDijLe21BwJVir1u6','user1@gmail.com',NULL),(10,2,'doc1','$2b$10$z3EZX/jcU700XLv151.0DuiMdBPEqOBqYdHSAEizwJYX6zx6SBjL6','doc@gmail.com',NULL),(17,2,'doca2','$2b$10$TvmC5h.yUSBrwxp3TgEvce.3IyR5nK4bkRyxINTi2v4xXIduz7/vq','doca2@gmail.com',NULL),(18,2,'Dr.Dinuka','$2b$10$d.QylxidWWpfPftwYTQ69OfJrqnW9abSx4Uas2Bc.sUxoiTmbVgra','dinuka@gmail.com',NULL),(36,4,'manager1','$2b$10$HMrfBDiJbueoUP4Q1VUYfeL.unP1qRl6xmdFtxrldeMbPAuE8IuSW','manager@gmail.com',NULL),(38,4,'user2','$2b$10$OZWu2N64qssfEok38A8j/eg6okpP2A8b5vW6D5X8oiyyjtezePUwK','malshi@gmail.com',NULL),(39,1,'malshi','$2b$10$o.KEp5kOI348VYkdRJJkqOPZagEBcI/dZEOZr/F1cr0OlNJJ9YiKS','naduni@gmail.com',NULL),(42,1,'user3','$2b$10$R1I973HsPkQDL.Ss0v6G5ee.VGV2S/4LW91JJvve0jFIzMRZtNih6','kavi@gmail.com',NULL),(44,4,'manager2','$2b$10$EluBmMMg7LYiCGcyl96ntuahvifrsraOPDiaAEhjiV5LMMPrWbo7G','mana@gmail.com',NULL);
/*!40000 ALTER TABLE `account_info` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `appointment`
--

DROP TABLE IF EXISTS `appointment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointment` (
  `appointment_id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `doctor_id` int DEFAULT NULL,
  `branch_id` int DEFAULT NULL,
  `schedule_date` datetime NOT NULL,
  `status` enum('Scheduled','Completed','Cancelled','Rescheduled') NOT NULL DEFAULT 'Scheduled',
  `is_emergency` tinyint(1) DEFAULT '0',
  `reschedule_id` int DEFAULT NULL,
  PRIMARY KEY (`appointment_id`),
  KEY `patient_id` (`patient_id`),
  KEY `doctor_id` (`doctor_id`),
  KEY `branch_id` (`branch_id`),
  CONSTRAINT `appointment_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patient` (`patient_id`) ON DELETE CASCADE,
  CONSTRAINT `appointment_ibfk_2` FOREIGN KEY (`doctor_id`) REFERENCES `doctor` (`doctor_id`) ON DELETE SET NULL,
  CONSTRAINT `appointment_ibfk_3` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`branch_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `appointment`
--

LOCK TABLES `appointment` WRITE;
/*!40000 ALTER TABLE `appointment` DISABLE KEYS */;
/*!40000 ALTER TABLE `appointment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `appointment_treatment`
--

DROP TABLE IF EXISTS `appointment_treatment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointment_treatment` (
  `appointment_id` int NOT NULL,
  `service_code` varchar(50) NOT NULL,
  `notes` text,
  `actual_price` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`appointment_id`,`service_code`),
  KEY `service_code` (`service_code`),
  CONSTRAINT `appointment_treatment_ibfk_1` FOREIGN KEY (`appointment_id`) REFERENCES `appointment` (`appointment_id`) ON DELETE CASCADE,
  CONSTRAINT `appointment_treatment_ibfk_2` FOREIGN KEY (`service_code`) REFERENCES `treatment_catalogue` (`service_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `appointment_treatment`
--

LOCK TABLES `appointment_treatment` WRITE;
/*!40000 ALTER TABLE `appointment_treatment` DISABLE KEYS */;
/*!40000 ALTER TABLE `appointment_treatment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `branch`
--

DROP TABLE IF EXISTS `branch`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `branch` (
  `branch_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `contact_number` varchar(20) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `manager_user_id` int DEFAULT NULL,
  PRIMARY KEY (`branch_id`),
  KEY `fk_branch_manager` (`manager_user_id`),
  CONSTRAINT `fk_branch_manager` FOREIGN KEY (`manager_user_id`) REFERENCES `staff` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `branch`
--

LOCK TABLES `branch` WRITE;
/*!40000 ALTER TABLE `branch` DISABLE KEYS */;
INSERT INTO `branch` VALUES (9,'Hospital 1','0712017844','Hospital 1/ Maradana /Colombo',44);
/*!40000 ALTER TABLE `branch` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doctor`
--

DROP TABLE IF EXISTS `doctor`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `doctor` (
  `doctor_id` int NOT NULL AUTO_INCREMENT,
  `staff_id` int NOT NULL,
  PRIMARY KEY (`doctor_id`),
  UNIQUE KEY `staff_id` (`staff_id`),
  CONSTRAINT `doctor_ibfk_1` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`staff_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctor`
--

LOCK TABLES `doctor` WRITE;
/*!40000 ALTER TABLE `doctor` DISABLE KEYS */;
/*!40000 ALTER TABLE `doctor` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `PreventDoctorDeletionWithAppointments` BEFORE DELETE ON `doctor` FOR EACH ROW BEGIN
  DECLARE future_appointments INT;

  SELECT COUNT(*) INTO future_appointments
  FROM Appointment
  WHERE doctor_id = OLD.doctor_id AND schedule_date >= CURDATE();

  IF future_appointments > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot delete doctor. They have future appointments scheduled.';
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `doctor_specialties`
--

DROP TABLE IF EXISTS `doctor_specialties`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `doctor_specialties` (
  `doctor_id` int NOT NULL,
  `specialty_id` int NOT NULL,
  PRIMARY KEY (`doctor_id`,`specialty_id`),
  KEY `specialty_id` (`specialty_id`),
  CONSTRAINT `doctor_specialties_ibfk_1` FOREIGN KEY (`doctor_id`) REFERENCES `doctor` (`doctor_id`),
  CONSTRAINT `doctor_specialties_ibfk_2` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`specialty_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctor_specialties`
--

LOCK TABLES `doctor_specialties` WRITE;
/*!40000 ALTER TABLE `doctor_specialties` DISABLE KEYS */;
/*!40000 ALTER TABLE `doctor_specialties` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `insurance_claim`
--

DROP TABLE IF EXISTS `insurance_claim`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `insurance_claim` (
  `claim_id` int NOT NULL AUTO_INCREMENT,
  `invoice_id` int NOT NULL,
  `insurance_provider_id` int NOT NULL,
  `claimed_amount` decimal(10,2) NOT NULL,
  `claim_status` varchar(20) NOT NULL,
  PRIMARY KEY (`claim_id`),
  KEY `insurance_provider_id` (`insurance_provider_id`),
  KEY `insurance_claim_ibfk_1` (`invoice_id`),
  CONSTRAINT `insurance_claim_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `invoice` (`invoice_id`) ON DELETE CASCADE,
  CONSTRAINT `insurance_claim_ibfk_2` FOREIGN KEY (`insurance_provider_id`) REFERENCES `insurance_provider` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4002 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `insurance_claim`
--

LOCK TABLES `insurance_claim` WRITE;
/*!40000 ALTER TABLE `insurance_claim` DISABLE KEYS */;
/*!40000 ALTER TABLE `insurance_claim` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `insurance_provider`
--

DROP TABLE IF EXISTS `insurance_provider`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `insurance_provider` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `contact_number` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `insurance_provider`
--

LOCK TABLES `insurance_provider` WRITE;
/*!40000 ALTER TABLE `insurance_provider` DISABLE KEYS */;
INSERT INTO `insurance_provider` VALUES (1,'MediLife Singapore','68277988'),(2,'Prudential Assurance','18003330333'),(3,'Great Eastern Life','18002482888');
/*!40000 ALTER TABLE `insurance_provider` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoice`
--

DROP TABLE IF EXISTS `invoice`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice` (
  `invoice_id` int NOT NULL AUTO_INCREMENT,
  `appointment_id` int NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `insurance_coverage` decimal(10,2) DEFAULT '0.00',
  `out_of_pocket_amount` decimal(10,2) NOT NULL,
  `due_amount` decimal(10,2) NOT NULL,
  `status` varchar(20) NOT NULL,
  `issued_date` date NOT NULL,
  `due_date` date NOT NULL,
  PRIMARY KEY (`invoice_id`),
  UNIQUE KEY `appointment_id` (`appointment_id`),
  CONSTRAINT `invoice_ibfk_1` FOREIGN KEY (`appointment_id`) REFERENCES `appointment` (`appointment_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2008 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoice`
--

LOCK TABLES `invoice` WRITE;
/*!40000 ALTER TABLE `invoice` DISABLE KEYS */;
/*!40000 ALTER TABLE `invoice` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `patient`
--

DROP TABLE IF EXISTS `patient`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patient` (
  `patient_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `gender` varchar(10) DEFAULT NULL,
  `date_of_birth` date NOT NULL,
  `contact_info` varchar(255) DEFAULT NULL,
  `emergency_contact` varchar(255) DEFAULT NULL,
  `insurance_provider_id` int DEFAULT NULL,
  `policy_number` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`patient_id`),
  KEY `insurance_provider_id` (`insurance_provider_id`),
  CONSTRAINT `patient_ibfk_1` FOREIGN KEY (`insurance_provider_id`) REFERENCES `insurance_provider` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `patient`
--

LOCK TABLES `patient` WRITE;
/*!40000 ALTER TABLE `patient` DISABLE KEYS */;
INSERT INTO `patient` VALUES (1,'Anura Perera','Male','2003-02-13','0773301089','0773302240',NULL,NULL);
/*!40000 ALTER TABLE `patient` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment`
--

DROP TABLE IF EXISTS `payment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment` (
  `payment_id` int NOT NULL AUTO_INCREMENT,
  `invoice_id` int NOT NULL,
  `paid_amount` decimal(10,2) NOT NULL,
  `payment_date` datetime NOT NULL,
  `method_of_payment` varchar(50) DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  PRIMARY KEY (`payment_id`),
  KEY `payment_ibfk_1` (`invoice_id`),
  CONSTRAINT `payment_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `invoice` (`invoice_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3011 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment`
--

LOCK TABLES `payment` WRITE;
/*!40000 ALTER TABLE `payment` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `UpdateInvoiceStatusAfterPayment` AFTER INSERT ON `payment` FOR EACH ROW BEGIN
  DECLARE total_paid DECIMAL(10, 2);
  DECLARE invoice_total DECIMAL(10, 2);

  -- Get total amount of the invoice
  SELECT total_amount INTO invoice_total FROM Invoice WHERE invoice_id = NEW.invoice_id;

  -- Get sum of all payments for this invoice
  SELECT SUM(paid_amount) INTO total_paid FROM Payment WHERE invoice_id = NEW.invoice_id;

  -- Update invoice status
  IF total_paid >= invoice_total THEN
    UPDATE Invoice SET status = 'Paid' WHERE invoice_id = NEW.invoice_id;
  ELSEIF total_paid > 0 THEN
    UPDATE Invoice SET status = 'Partially Paid' WHERE invoice_id = NEW.invoice_id;
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `rescheduled_appointments`
--

DROP TABLE IF EXISTS `rescheduled_appointments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rescheduled_appointments` (
  `reschedule_id` int NOT NULL AUTO_INCREMENT,
  `previous_appointment_id` int NOT NULL,
  `previous_date` datetime NOT NULL,
  `new_date` datetime NOT NULL,
  `rescheduled_by_staff_id` int NOT NULL,
  `reschedule_reason` text,
  PRIMARY KEY (`reschedule_id`),
  KEY `rescheduled_by_staff_id` (`rescheduled_by_staff_id`),
  KEY `fk_rescheduled_to_appointment` (`previous_appointment_id`),
  CONSTRAINT `fk_rescheduled_appt_id` FOREIGN KEY (`previous_appointment_id`) REFERENCES `appointment` (`appointment_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rescheduled_to_appointment` FOREIGN KEY (`previous_appointment_id`) REFERENCES `appointment` (`appointment_id`) ON DELETE CASCADE,
  CONSTRAINT `rescheduled_appointments_ibfk_2` FOREIGN KEY (`rescheduled_by_staff_id`) REFERENCES `staff` (`staff_id`)
) ENGINE=InnoDB AUTO_INCREMENT=532 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rescheduled_appointments`
--

LOCK TABLES `rescheduled_appointments` WRITE;
/*!40000 ALTER TABLE `rescheduled_appointments` DISABLE KEYS */;
/*!40000 ALTER TABLE `rescheduled_appointments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role`
--

DROP TABLE IF EXISTS `role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role` (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `access_details` text,
  PRIMARY KEY (`role_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role`
--

LOCK TABLES `role` WRITE;
/*!40000 ALTER TABLE `role` DISABLE KEYS */;
INSERT INTO `role` VALUES (1,'Admin','Full access to all system functionalities.'),(2,'Doctor','Access to patient records, appointments, and treatment modules.'),(3,'Receptionist','Access to appointments, patient registration, and billing modules.'),(4,'Branch Manager','Each Branch Full Access');
/*!40000 ALTER TABLE `role` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `specialties`
--

DROP TABLE IF EXISTS `specialties`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `specialties` (
  `specialty_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text,
  PRIMARY KEY (`specialty_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `specialties`
--

LOCK TABLES `specialties` WRITE;
/*!40000 ALTER TABLE `specialties` DISABLE KEYS */;
INSERT INTO `specialties` VALUES (1,'Cardiology','Deals with disorders of the heart and blood vessels.'),(2,'Dermatology','Deals with the skin, nails, and hair and its diseases.'),(3,'Pediatrics','The medical care of infants, children, and adolescents.');
/*!40000 ALTER TABLE `specialties` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `staff`
--

DROP TABLE IF EXISTS `staff`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `staff` (
  `staff_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `contact_info` varchar(255) DEFAULT NULL,
  `is_medical_staff` tinyint(1) DEFAULT '0',
  `branch_id` int DEFAULT NULL,
  PRIMARY KEY (`staff_id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `branch_id` (`branch_id`),
  CONSTRAINT `staff_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `account_info` (`user_id`),
  CONSTRAINT `staff_ibfk_2` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`branch_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `staff`
--

LOCK TABLES `staff` WRITE;
/*!40000 ALTER TABLE `staff` DISABLE KEYS */;
INSERT INTO `staff` VALUES (1,36,'Manager','0712017844',0,9),(2,38,'Anura Perera','0773301080',0,9),(3,39,'RAJAPURAGE LEKSHAN DINUJAYA RAJAPAKSHA','0773301080',0,9),(4,42,'Demo Tutor','0773301089',0,9),(5,44,'manager','0923234234',0,9);
/*!40000 ALTER TABLE `staff` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `treatment_catalogue`
--

DROP TABLE IF EXISTS `treatment_catalogue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `treatment_catalogue` (
  `service_code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `price` decimal(10,2) NOT NULL,
  PRIMARY KEY (`service_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `treatment_catalogue`
--

LOCK TABLES `treatment_catalogue` WRITE;
/*!40000 ALTER TABLE `treatment_catalogue` DISABLE KEYS */;
INSERT INTO `treatment_catalogue` VALUES ('CON-001','General Consultation',NULL,80.00),('DERM-001','Skin Allergy Test',NULL,250.00),('LAB-001','Standard Blood Test',NULL,150.50),('XRAY-001','Chest X-Ray',NULL,120.00);
/*!40000 ALTER TABLE `treatment_catalogue` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-13 21:40:28
