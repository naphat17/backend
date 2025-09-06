-- เพิ่มคอลัมน์ member_number ในตาราง users
-- Member number จะเป็นรหัสสมาชิกที่ unique และ auto-generate

USE swimming_pool_db;

-- เพิ่มคอลัมน์ member_number
ALTER TABLE users 
ADD COLUMN member_number VARCHAR(20) UNIQUE AFTER id;

-- สร้าง index สำหรับ member_number เพื่อความเร็วในการค้นหา
CREATE INDEX idx_member_number ON users(member_number);

-- อัปเดต member_number สำหรับผู้ใช้ที่มีอยู่แล้ว (ถ้ามี)
-- รูปแบบ: SP + ปี + เลขลำดับ 4 หลัก (เช่น SP2025001)
UPDATE users 
SET member_number = CONCAT('SP', YEAR(CURDATE()), LPAD(id, 4, '0'))
WHERE member_number IS NULL;