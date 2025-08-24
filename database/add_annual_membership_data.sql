-- เพิ่มข้อมูลการชำระเงินสำหรับสมาชิกรายปี
USE swimming_pool_db;

-- เพิ่มสมาชิกภาพรายปีสำหรับผู้ใช้
INSERT INTO memberships (user_id, membership_type_id, expires_at, status) VALUES
(2, 2, DATE_ADD(NOW(), INTERVAL 365 DAY), 'active'),  -- user1 สมาชิกรายปี
(3, 2, DATE_ADD(NOW(), INTERVAL 365 DAY), 'active');  -- user2 สมาชิกรายปี

-- เพิ่มการชำระเงินสำหรับสมาชิกรายปี
INSERT INTO payments (user_id, amount, status, payment_method, transaction_id, created_at) VALUES
(2, 500.00, 'completed', 'bank_transfer', 'ANNUAL_2024_001', NOW()),
(3, 300.00, 'completed', 'bank_transfer', 'ANNUAL_2024_002', NOW()),
(2, 400.00, 'pending', 'bank_transfer', 'ANNUAL_2024_003', NOW());

-- เพิ่มการชำระเงินสำหรับตู้เก็บของ
INSERT INTO payments (user_id, amount, status, payment_method, transaction_id, created_at) VALUES
(2, 1500.00, 'completed', 'bank_transfer', 'LKR_2024_001', NOW()),
(3, 1500.00, 'pending', 'bank_transfer', 'LKR_2024_002', NOW());