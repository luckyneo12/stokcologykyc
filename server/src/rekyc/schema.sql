-- ReKYC tables. Only CREATE TABLE IF NOT EXISTS: running this never alters or drops
-- any existing table (the KYC, Admin, Globe and AP portals are not affected).

CREATE TABLE IF NOT EXISTS rekyc_admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(191) NOT NULL,
  mobile VARCHAR(20) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(40) NOT NULL DEFAULT 'rekyc_viewer',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_rekyc_admin_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rekyc_requests (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  client_code VARCHAR(40) NOT NULL,
  workflow VARCHAR(40) NOT NULL DEFAULT 'modification',
  status VARCHAR(30) NOT NULL DEFAULT 'in_progress',
  client_name VARCHAR(200) NULL,
  pan VARCHAR(20) NULL,
  dob VARCHAR(20) NULL,
  mobile VARCHAR(20) NULL,
  email VARCHAR(191) NULL,
  original_data LONGTEXT NULL,
  changes LONGTEXT NULL,
  verifications LONGTEXT NULL,
  documents LONGTEXT NULL,
  selfie LONGTEXT NULL,
  esign LONGTEXT NULL,
  estamp_id INT NULL,
  pdf_url TEXT NULL,
  signed_pdf_url TEXT NULL,
  maker_id INT NULL,
  maker_action_at DATETIME NULL,
  maker_remarks TEXT NULL,
  checker_id INT NULL,
  checker_action_at DATETIME NULL,
  checker_remarks TEXT NULL,
  rejection_reason TEXT NULL,
  rejected_by INT NULL,
  rejected_at DATETIME NULL,
  backoffice_status VARCHAR(20) NULL,
  backoffice_response LONGTEXT NULL,
  pushed_at DATETIME NULL,
  trashed_from_status VARCHAR(30) NULL,
  esigned_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_rekyc_req_client (client_code),
  KEY idx_rekyc_req_status (status),
  KEY idx_rekyc_req_workflow (workflow),
  KEY idx_rekyc_req_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rekyc_estamps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  certificate_no VARCHAR(100) NOT NULL DEFAULT '',
  serial_no VARCHAR(100) NOT NULL DEFAULT '',
  file_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'available',
  assigned_request_id VARCHAR(36) NULL,
  assigned_at DATETIME NULL,
  consumed_request_id VARCHAR(36) NULL,
  used_at DATETIME NULL,
  uploaded_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_rekyc_estamp_status (status),
  KEY idx_rekyc_estamp_cert (certificate_no),
  KEY idx_rekyc_estamp_serial (serial_no),
  UNIQUE KEY uq_rekyc_estamp_request (assigned_request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rekyc_audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor_type VARCHAR(20) NOT NULL,
  actor_id VARCHAR(60) NULL,
  actor_name VARCHAR(200) NULL,
  request_id VARCHAR(36) NULL,
  action VARCHAR(80) NOT NULL,
  details LONGTEXT NULL,
  ip_address VARCHAR(80) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_rekyc_audit_request (request_id),
  KEY idx_rekyc_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
