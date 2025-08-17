-- ข้อมูลตัวอย่างสำหรับระบบจัดการสระว่ายน้ำโรจนากร
USE swimming_pool_db;

-- เพิ่มประเภทผู้ใช้ (User Categories)
INSERT INTO user_categories (name, description, pay_per_session_price, annual_price) VALUES
('นักเรียน ร.ร. สาธิต (ฝ่ายประถม) (ก)', 'สำหรับนักเรียนโรงเรียนสาธิตมหาวิทยาลัยมหาสารคาม (ฝ่ายประถม)', 20.00, 300.00),
('นักเรียน ร.ร. สาธิต (ฝ่ายมัธยม) (ข)', 'สำหรับนักเรียนโรงเรียนสาธิตมหาวิทยาลัยมหาสารคาม (ฝ่ายมัธยม)', 30.00, 300.00),
('นิสิตมหาวิทยาลัยมหาสารคาม (ข)', 'สำหรับนิสิตปัจจุบันของมหาวิทยาลัยมหาสารคาม', 30.00, 300.00),
('บุคลากรมหาวิทยาลัยมหาสารคาม (ข)', 'สำหรับบุคลากรของมหาวิทยาลัยมหาสารคาม', 30.00, 300.00),
('บุคคลภายนอกทั่วไป (เด็ก) (ค)', 'สำหรับบุคคลภายนอกที่มีอายุต่ำกว่า 18 ปี', 30.00, 400.00),
('บุคคลภายนอกทั่วไป (ผู้ใหญ่) (ค)', 'สำหรับบุคคลภายนอกทั่วไป', 50.00, 500.00);

-- เพิ่มผู้ใช้งาน (รหัสผ่านจะถูก hash ในโค้ด)
-- Admin: admin/admin123
-- User1 (Adult): user1/user123
-- User2 (Student): user2/user23
INSERT INTO users (username, email, password, first_name, last_name, phone, role, status, user_category_id) VALUES
('admin', 'admin@pool.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ผู้ดูแล', 'ระบบ', '02-123-4567', 'admin', 'active', NULL),
('user1', 'user1@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'สมชาย', 'ใจดี', '081-234-5678', 'user', 'active', 6),
('user2', 'user2@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'สมหญิง', 'รักดี', '081-345-6789', 'user', 'active', 3);

-- เพิ่มประเภทสมาชิกภาพ (Membership Types)
INSERT INTO membership_types (id, name, description, price, duration_days) VALUES
(1, 'Pay per Session', 'Pay for a single session', 0.00, 1),
(2, 'Annual', 'Annual membership', 0.00, 365);

-- เพิ่มสมาชิกภาพตัวอย่าง (สถานะเริ่มต้นเป็น pending)
-- membership_type_id: 1 = รายครั้ง, 2 = รายปี
INSERT INTO memberships (user_id, membership_type_id, expires_at, status) VALUES
(2, 1, NOW(), 'pending'),  -- user1
(3, 1, NOW(), 'pending');  -- user2

-- เพิ่มสระว่ายน้ำ
INSERT INTO pool_resources (name, description, capacity, status) VALUES
('สระหลัก', 'สระว่ายน้ำหลักขนาดใหญ่ ความยาว 25 เมตร เหมาะสำหรับว่ายน้ำออกกำลังกาย', 50, 'available'),
('สระเด็ก', 'สระสำหรับเด็กและผู้เริ่มต้น ความลึกไม่เกิน 1.2 เมตร', 20, 'available');

-- เพิ่มตารางเวลาสระ (เปิด 6:00-22:00 ทุกวัน)
INSERT INTO pool_schedules (pool_resource_id, day_of_week, open_time, close_time, is_active) VALUES
(1, 'monday', '06:00:00', '22:00:00', TRUE),
(1, 'tuesday', '06:00:00', '22:00:00', TRUE),
(1, 'wednesday', '06:00:00', '22:00:00', TRUE),
(1, 'thursday', '06:00:00', '22:00:00', TRUE),
(1, 'friday', '06:00:00', '22:00:00', TRUE),
(1, 'saturday', '06:00:00', '22:00:00', TRUE),
(1, 'sunday', '06:00:00', '22:00:00', TRUE),
(2, 'monday', '08:00:00', '20:00:00', TRUE),
(2, 'tuesday', '08:00:00', '20:00:00', TRUE),
(2, 'wednesday', '08:00:00', '20:00:00', TRUE),
(2, 'thursday', '08:00:00', '20:00:00', TRUE),
(2, 'friday', '08:00:00', '20:00:00', TRUE),
(2, 'saturday', '08:00:00', '20:00:00', TRUE),
(2, 'sunday', '08:00:00', '20:00:00', TRUE);

-- เพิ่มการตั้งค่าระบบ
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('pool_name', 'สระว่ายน้ำโรจนากร', 'ชื่อสระว่ายน้ำ'),
('max_reservation_days', '7', 'จำนวนวันสูงสุดที่สามารถจองล่วงหน้าได้'),
('bank_account_number', '123-456-7890', 'เลขที่บัญชีธนาคารสำหรับรับชำระเงิน'),
('pool_price', '50', 'ราคาการจองสระว่ายน้ำต่อครั้ง (บาท)'),
('locker_price', '1500', 'ราคาการจองตู้เก็บของต่อครั้ง (บาท)');

-- เพิ่มตู้เก็บของ
INSERT INTO lockers (code, location, status) VALUES
('L01', 'Zone A', 'available'),
('L02', 'Zone A', 'available'),
('L03', 'Zone A', 'available'),
('L04', 'Zone A', 'available'),
('L05', 'Zone A', 'available'),
('L06', 'Zone A', 'available'),
('L07', 'Zone A', 'available'),
('L08', 'Zone A', 'available'),
('L09', 'Zone A', 'available'),
('L10', 'Zone A', 'available'),
('L11', 'Zone B', 'available'),
('L12', 'Zone B', 'available'),
('L13', 'Zone B', 'available'),
('L14', 'Zone B', 'available'),
('L15', 'Zone B', 'available'),
('L16', 'Zone B', 'available'),
('L17', 'Zone B', 'available'),
('L18', 'Zone B', 'available'),
('L19', 'Zone B', 'available'),
('L20', 'Zone B', 'available'),
('L21', 'Zone C', 'available'),
('L22', 'Zone C', 'available'),
('L23', 'Zone C', 'available'),
('L24', 'Zone C', 'available'),
('L25', 'Zone C', 'available'),
('L26', 'Zone C', 'available'),
('L27', 'Zone C', 'available'),
('L28', 'Zone C', 'available'),
('L29', 'Zone C', 'available'),
('L30', 'Zone C', 'available');

-- เพิ่มการจองตัวอย่าง (ใช้วันที่ปัจจุบัน)
INSERT INTO reservations (user_id, pool_resource_id, reservation_date, start_time, end_time, status, notes, created_at) VALUES
(2, 1, CURDATE(), '08:00:00', '09:30:00', 'confirmed', 'การจองปกติ', NOW()),
(3, 1, CURDATE(), '10:00:00', '11:30:00', 'confirmed', 'การจองปกติ', NOW()),
(2, 2, CURDATE(), '14:00:00', '15:30:00', 'pending', 'รอการยืนยัน', NOW()),
(3, 1, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '09:00:00', '10:30:00', 'confirmed', 'การจองล่วงหน้า', NOW()),
(2, 1, CURDATE(), '16:00:00', '17:30:00', 'confirmed', 'การจองเพิ่มเติม', NOW()),
(3, 2, CURDATE(), '18:00:00', '19:30:00', 'confirmed', 'การจองเย็น', NOW());

-- เพิ่มการชำระเงินตัวอย่าง (ใช้วันที่ปัจจุบัน)
INSERT INTO payments (user_id, amount, status, payment_method, transaction_id, created_at) VALUES
(2, 30.00, 'completed', 'bank_transfer', 'RSV1_TODAY', NOW()),
(3, 30.00, 'completed', 'bank_transfer', 'RSV2_TODAY', NOW()),
(2, 50.00, 'completed', 'bank_transfer', 'RSV3_TODAY', NOW()),
(3, 300.00, 'completed', 'bank_transfer', 'MEM1_TODAY', NOW()),
(2, 25.00, 'completed', 'bank_transfer', 'RSV4_TODAY', NOW()),
(3, 40.00, 'completed', 'bank_transfer', 'RSV5_TODAY', NOW());

-- อัพเดทสถานะตู้เก็บของบางตัวให้เป็น occupied
UPDATE lockers SET status = 'occupied' WHERE code IN ('L01', 'L02', 'L05', 'L11', 'L12', 'L15', 'L21', 'L22', 'L25', 'L26', 'L27', 'L28', 'L29', 'L30');

-- เพิ่มการจองตู้เก็บของ
INSERT INTO locker_reservations (user_id, locker_id, reservation_date, start_time, end_time, status) VALUES
(2, 1, CURDATE(), '08:00:00', '09:30:00', 'confirmed'),
(3, 2, CURDATE(), '10:00:00', '11:30:00', 'confirmed'),
(2, 5, CURDATE(), '14:00:00', '15:30:00', 'confirmed');

-- เพิ่มประกาศตัวอย่าง
INSERT INTO notifications (user_id, title, message, is_read, created_at) VALUES
(2, 'ปิดซ่อมบำรุงระบบกรองน้ำ', 'วันที่ 25-26 มีนาคม 2566 ขออภัยในความไม่สะดวก', FALSE, NOW()),
(3, 'ปิดซ่อมบำรุงระบบกรองน้ำ', 'วันที่ 25-26 มีนาคม 2566 ขออภัยในความไม่สะดวก', FALSE, NOW()),
(2, 'เปลี่ยนตารางเวลาในช่วงสอบ', 'วันที่ 10-20 เมษายน 2566 เปิดบริการเฉพาะช่วงบ่าย', FALSE, DATE_SUB(NOW(), INTERVAL 1 DAY)),
(3, 'เปลี่ยนตารางเวลาในช่วงสอบ', 'วันที่ 10-20 เมษายน 2566 เปิดบริการเฉพาะช่วงบ่าย', FALSE, DATE_SUB(NOW(), INTERVAL 1 DAY));
