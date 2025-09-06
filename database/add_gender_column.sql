-- เพิ่มคอลัมน์ gender ในตาราง users
USE swimming_pool_db;

ALTER TABLE users ADD COLUMN gender ENUM('male', 'female') AFTER age;