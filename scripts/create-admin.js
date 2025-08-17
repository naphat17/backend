const bcrypt = require("bcryptjs")
const db = require("../config/database")

async function createAdmin() {
    try {
        // Check if admin already exists
        const [existing] = await db.execute("SELECT id FROM users WHERE username = 'admin'")

        if (existing.length > 0) {
            console.log("✅ Admin user already exists")
            return
        }

        // Create admin user
        const hashedPassword = await bcrypt.hash("admin123", 10)

        await db.execute(
            `INSERT INTO users (username, email, password, first_name, last_name, phone, role, status, user_category_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['admin', 'admin@pool.com', hashedPassword, 'ผู้ดูแล', 'ระบบ', '02-123-4567', 'admin', 'active', null]
        )

        console.log("✅ Admin user created successfully")
        console.log("📧 Username: admin")
        console.log("🔑 Password: admin123")

        // Also set default locker price if not exists
        const [lockerPriceSetting] = await db.execute("SELECT setting_value FROM system_settings WHERE setting_key = 'locker_price'")

        if (lockerPriceSetting.length === 0) {
            await db.execute(
                "INSERT INTO system_settings (setting_key, setting_value, updated_at) VALUES (?, ?, NOW())", ['locker_price', '1500']
            )
            console.log("✅ Default locker price set to ฿1,500")
        }

    } catch (error) {
        console.error("❌ Error creating admin user:", error)
    } finally {
        process.exit(0)
    }
}

createAdmin()