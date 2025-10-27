CREATE TABLE staff_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);




INSERT INTO staff_accounts 
(staff_id, first_name, last_name, email, phone, username, password_hash, role, status)
VALUES
('STF006', 'Leo', 'Garcia', 'leo.garcia@mediese.com', '09501234567', 'leo_garcia',
'$2b$10$CwTycUXWue0Thq9StjUM0uJ8Q1Y5lG9x7pTt1Y7g8mG9f4Oe9Jk1e',
'Admin', 'active');

