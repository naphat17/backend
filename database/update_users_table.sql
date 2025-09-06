-- อัปเดตตารางผู้ใช้เพื่อเพิ่มฟิลด์ใหม่
USE swimming_pool_db;

-- เพิ่มฟิลด์ใหม่ในตาราง users
ALTER TABLE users 
ADD COLUMN organization VARCHAR(255) AFTER user_category_id,
ADD COLUMN age INT AFTER organization,
ADD COLUMN medical_condition TEXT AFTER age,
ADD COLUMN emergency_contact_name VARCHAR(100) AFTER medical_condition,
ADD COLUMN emergency_contact_relationship VARCHAR(50) AFTER emergency_contact_name,
ADD COLUMN emergency_contact_phone VARCHAR(20) AFTER emergency_contact_relationship,
ADD COLUMN profile_photo VARCHAR(255) AFTER emergency_contact_phone;

-- แสดงโครงสร้างตารางที่อัปเดตแล้ว
DESCRIBE users;