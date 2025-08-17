const express = require("express")
const bcrypt = require("bcryptjs")
const db = require("../config/database")
const { authenticateToken, requireAdmin } = require("../middleware/auth")

const router = express.Router()

// Apply admin middleware to all routes
router.use(authenticateToken)
router.use(requireAdmin)

// Admin Dashboard
router.get("/dashboard", async(req, res) => {
    try {
        // Get basic stats first
        const [userStats] = await db.execute(
            `SELECT
                COUNT(*) as total_members,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_members
             FROM users
             WHERE role = 'user'`
        );

        // Get previous month member count for comparison
        const [prevMonthUserStats] = await db.execute(
            `SELECT COUNT(*) as prev_month_members
             FROM users
             WHERE role = 'user'
             AND created_at < DATE_FORMAT(NOW(), '%Y-%m-01')`
        );

        // Get reservation stats (today and yesterday)
        const [reservationStats] = await db.execute(
            `SELECT
                COUNT(CASE WHEN DATE(reservation_date) = CURDATE() THEN 1 END) as today_reservations,
                COUNT(CASE WHEN DATE(reservation_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN 1 END) as yesterday_reservations
             FROM reservations`
        );

        // Get payment stats (today and yesterday)
        const [paymentStats] = await db.execute(
            `SELECT
                COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN amount ELSE 0 END), 0) as today_revenue,
                COALESCE(SUM(CASE WHEN DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN amount ELSE 0 END), 0) as yesterday_revenue,
                COALESCE(SUM(CASE WHEN DATE(created_at) >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN amount ELSE 0 END), 0) as monthly_revenue
             FROM payments
             WHERE status = 'completed'`
        );

        // Get locker stats
        const [lockerStats] = await db.execute(
            `SELECT
                COUNT(*) as total_lockers,
                COUNT(CASE WHEN status = 'available' THEN 1 END) as available_lockers
             FROM lockers`
        );

        // Calculate differences
        const currentMembers = userStats[0] ? userStats[0].total_members : 0;
        const prevMembers = prevMonthUserStats[0] ? prevMonthUserStats[0].prev_month_members : 0;
        const membersDiff = currentMembers - prevMembers;

        const todayReservations = reservationStats[0] ? reservationStats[0].today_reservations : 0;
        const yesterdayReservations = reservationStats[0] ? reservationStats[0].yesterday_reservations : 0;
        const reservationsDiff = todayReservations - yesterdayReservations;

        // Combine stats
        const stats = {
            total_members: currentMembers,
            active_members: userStats[0] ? userStats[0].active_members : 0,
            members_diff: membersDiff,
            today_reservations: todayReservations,
            yesterday_reservations: yesterdayReservations,
            reservations_diff: reservationsDiff,
            today_revenue: paymentStats[0] ? paymentStats[0].today_revenue : 0,
            yesterday_revenue: paymentStats[0] ? paymentStats[0].yesterday_revenue : 0,
            monthly_revenue: paymentStats[0] ? paymentStats[0].monthly_revenue : 0,
            total_lockers: lockerStats[0] ? lockerStats[0].total_lockers : 0,
            available_lockers: lockerStats[0] ? lockerStats[0].available_lockers : 0,
            current_date: new Date().toISOString().split('T')[0]
        };

        // Get recent activities with simpler query
        const [activities] = await db.execute(
            `SELECT
                'reservation' as type,
                'New reservation created' as description,
                r.created_at,
                CONCAT(u.first_name, ' ', u.last_name) as user_name
             FROM
                reservations r
             JOIN
                users u ON r.user_id = u.id
             WHERE
                r.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             ORDER BY
                r.created_at DESC
             LIMIT 10`
        );

        res.json({
            stats: stats,
            recent_activities: activities || []
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        // Provide more detailed error information
        res.status(500).json({
            message: "Database error",
            error: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
            sql: err.sql
        });
    }
})

// Get all users
router.get("/users", async(req, res) => {
    try {
        const { role } = req.query
        let query = `
    SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.role, u.status, u.created_at,
           mt.name as membership_type, m.expires_at as membership_expires, m.status as membership_status
    FROM users u
    LEFT JOIN memberships m ON u.id = m.user_id AND m.status = 'active'
    LEFT JOIN membership_types mt ON m.membership_type_id = mt.id
  `
        const params = []
        if (role) {
            query += " WHERE u.role = ?"
            params.push(role)
        }
        query += " ORDER BY u.created_at DESC"
        const [users] = await db.execute(query, params)
            // Format users with membership info
        const formattedUsers = users.map((user) => ({
            ...user,
            membership: user.membership_type ? {
                type: user.membership_type,
                expires_at: user.membership_expires,
                status: user.membership_status,
            } : null,
        }))
        res.json({ users: formattedUsers })
    } catch (err) {
        res.status(500).json({ message: "Database error" })
    }
})

// Create user
router.post("/users", async(req, res) => {
    try {
        const { username, email, password, first_name, last_name, phone, role } = req.body
            // Check if user exists
        const [existing] = await db.execute("SELECT id FROM users WHERE username = ? OR email = ?", [username, email])
        if (existing.length > 0) {
            return res.status(400).json({ message: "Username or email already exists" })
        }
        const hashedPassword = await bcrypt.hash(password, 10)
        const [result] = await db.execute(
            `INSERT INTO users (username, email, password, first_name, last_name, phone, role, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`, [username, email, hashedPassword, first_name, last_name, phone, role]
        )
        res.status(201).json({
            message: "User created successfully",
            userId: result.insertId,
        })
    } catch (error) {
        res.status(500).json({ message: "Server error" })
    }
})

// Update user
router.put("/users/:id", async(req, res) => {
    try {
        const userId = req.params.id
        const { first_name, last_name, phone, status } = req.body
        const [result] = await db.execute(
            "UPDATE users SET first_name = ?, last_name = ?, phone = ?, status = ? WHERE id = ?", [first_name, last_name, phone, status, userId]
        )
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "User not found" })
        }
        res.json({ message: "User updated successfully" })
    } catch (err) {
        res.status(500).json({ message: "Failed to update user" })
    }
})

// Delete user
router.delete("/users/:id", async(req, res) => {
    try {
        const userId = req.params.id
        const [result] = await db.execute("DELETE FROM users WHERE id = ?", [userId])
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "User not found" })
        }
        res.json({ message: "User deleted successfully" })
    } catch (err) {
        res.status(500).json({ message: "Failed to delete user" })
    }
})

// Extend user membership
router.post("/users/:id/extend-membership", async(req, res) => {
    try {
        const userId = req.params.id
        const { membership_type_id, duration_days } = req.body
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + duration_days)
        await db.execute(
            `INSERT INTO memberships (user_id, membership_type_id, expires_at, status)
       VALUES (?, ?, ?, 'active')
       ON DUPLICATE KEY UPDATE membership_type_id = VALUES(membership_type_id), expires_at = VALUES(expires_at), status = 'active'`, [userId, membership_type_id, expiresAt.toISOString()]
        )
        res.json({ message: "Membership extended successfully" })
    } catch (err) {
        res.status(500).json({ message: "Failed to extend membership" })
    }
})

// Get all reservations
router.get("/reservations", async(req, res) => {
    try {
        const [reservations] = await db.execute(
                `SELECT r.id, r.reservation_date, r.start_time, r.end_time, r.status, r.notes, r.created_at,
              u.first_name, u.last_name, u.email as user_email,
              pr.name as pool_name,
              p.id as payment_id, p.amount as payment_amount, p.status as payment_status, p.payment_method, p.slip_url
     FROM reservations r
     JOIN users u ON r.user_id = u.id
     JOIN pool_resources pr ON r.pool_resource_id = pr.id
     LEFT JOIN payments p ON p.user_id = r.user_id AND p.transaction_id LIKE CONCAT('RSV', r.id, '%')
       ORDER BY r.reservation_date DESC, r.start_time DESC`
            )
            // Combine user_name and reservation_time
        const formatted = reservations.map(r => ({
            ...r,
            user_name: `${r.first_name} ${r.last_name}`,
            reservation_time: `${r.start_time.substring(0, 5)} - ${r.end_time.substring(0, 5)}`
        }))
        res.json({ reservations: formatted || [] })
    } catch (err) {
        res.status(500).json({ message: "Database error" })
    }
})

// Create reservation (admin)
router.post("/reservations", async(req, res) => {
    try {
        const { user_id, pool_resource_id, reservation_date, start_time, end_time, notes, status } = req.body
        const [result] = await db.execute(
            `INSERT INTO reservations (user_id, pool_resource_id, reservation_date, start_time, end_time, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [user_id, pool_resource_id, reservation_date, start_time, end_time, status || "confirmed", notes]
        )
        res.status(201).json({
            message: "Reservation created successfully",
            reservationId: result.insertId,
        })
    } catch (err) {
        res.status(500).json({ message: "Failed to create reservation" })
    }
})

// Update reservation status
router.put("/reservations/:id", async(req, res) => {
    try {
        const reservationId = req.params.id
        const { status } = req.body
        const [result] = await db.execute(
            "UPDATE reservations SET status = ? WHERE id = ?", [status, reservationId]
        )
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Reservation not found" })
        }
        res.json({ message: "Reservation updated successfully" })
    } catch (err) {
        res.status(500).json({ message: "Failed to update reservation" })
    }
})

// Get all pools
router.get("/pools", async(req, res) => {
    try {
        const [pools] = await db.execute("SELECT * FROM pool_resources ORDER BY name")
        res.json({ pools: pools || [] })
    } catch (err) {
        res.status(500).json({ message: "Database error" })
    }
})

// Get pool status
router.get("/pools/status", async(req, res) => {
    try {
        const [pools] = await db.execute("SELECT id, name, status FROM pool_resources ORDER BY name")
        res.json({ pools: pools || [] })
    } catch (err) {
        res.status(500).json({ message: "Database error" })
    }
})

// Create pool
router.post("/pools", async(req, res) => {
    try {
        const { name, description, capacity, status } = req.body
        const [result] = await db.execute(
            "INSERT INTO pool_resources (name, description, capacity, status) VALUES (?, ?, ?, ?)", [name, description, capacity, status]
        )
        res.status(201).json({
            message: "Pool created successfully",
            poolId: result.insertId,
        })
    } catch (err) {
        res.status(500).json({ message: "Failed to create pool" })
    }
})

// Update pool
router.put("/pools/:id", async(req, res) => {
    try {
        const poolId = req.params.id
        const { name, description, capacity, status } = req.body
        const [result] = await db.execute(
            "UPDATE pool_resources SET name = ?, description = ?, capacity = ?, status = ? WHERE id = ?", [name, description, capacity, status, poolId]
        )
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Pool not found" })
        }
        res.json({ message: "Pool updated successfully" })
    } catch (err) {
        res.status(500).json({ message: "Failed to update pool" })
    }
})

// Get pool schedule
router.get("/pools/:id/schedule", async(req, res) => {
    try {
        const poolId = req.params.id
        const [schedules] = await db.execute(
            "SELECT * FROM pool_schedules WHERE pool_resource_id = ? ORDER BY day_of_week", [poolId]
        )
        res.json({ schedules: schedules || [] })
    } catch (err) {
        res.status(500).json({ message: "Database error" })
    }
})

// Update pool schedule
router.put("/pools/:id/schedule", async(req, res) => {
    try {
        const poolId = req.params.id
        const { schedules } = req.body
            // Delete existing schedules
        await db.execute("DELETE FROM pool_schedules WHERE pool_resource_id = ?", [poolId])
            // Insert new schedules
        for (const schedule of schedules) {
            await db.execute(
                "INSERT INTO pool_schedules (pool_resource_id, day_of_week, open_time, close_time, is_active) VALUES (?, ?, ?, ?, ?)", [poolId, schedule.day_of_week, schedule.open_time, schedule.close_time, schedule.is_active]
            )
        }
        res.json({ message: "Schedule updated successfully" })
    } catch (err) {
        res.status(500).json({ message: "Failed to update schedule" })
    }
})

// Get system settings
router.get("/settings", async(req, res) => {
    try {
        const [settings] = await db.execute("SELECT setting_key, setting_value FROM system_settings")
        res.json({ settings: settings || [] })
    } catch (err) {
        res.status(500).json({ message: "Database error" })
    }
})

// Get bank account number
router.get("/settings/bank_account_number", async(req, res) => {
    try {
        const [settings] = await db.execute("SELECT setting_value FROM system_settings WHERE setting_key = 'bank_account_number'")
        res.json({ value: settings[0] ? settings[0].setting_value : "123-456-7890" })
    } catch (err) {
        res.status(500).json({ message: "Database error" })
    }
})

// Update system settings
router.put("/settings", async(req, res) => {
    try {
        const { settings } = req.body
        for (const setting of settings) {
            await db.execute(
                "INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)", [setting.setting_key, setting.setting_value]
            )
        }
        res.json({ message: "Settings updated successfully" })
    } catch (err) {
        res.status(500).json({ message: "Failed to update settings" })
    }
})

// Get membership types
router.get("/membership-types", async(req, res) => {
    try {
        const [membershipTypes] = await db.execute("SELECT * FROM membership_types ORDER BY price")
        res.json({ membership_types: membershipTypes || [] })
    } catch (err) {
        res.status(500).json({ message: "Database error" })
    }
})

// Create membership type
router.post("/membership-types", async(req, res) => {
    try {
        const { name, description, price, duration_days } = req.body
        const [result] = await db.execute(
            "INSERT INTO membership_types (name, description, price, duration_days) VALUES (?, ?, ?, ?)", [name, description, price, duration_days]
        )
        res.status(201).json({
            message: "Membership type created successfully",
            membershipTypeId: result.insertId,
        })
    } catch (err) {
        res.status(500).json({ message: "Failed to create membership type" })
    }
})

// Update membership type
router.put("/membership-types/:id", async(req, res) => {
    try {
        const membershipTypeId = req.params.id
        const { name, description, price, duration_days } = req.body
        const [result] = await db.execute(
            "UPDATE membership_types SET name = ?, description = ?, price = ?, duration_days = ? WHERE id = ?", [name, description, price, duration_days, membershipTypeId]
        )
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Membership type not found" })
        }
        res.json({ message: "Membership type updated successfully" })
    } catch (err) {
        res.status(500).json({ message: "Failed to update membership type" })
    }
})

// อนุมัติ membership (admin)
router.put("/memberships/:id/approve", async(req, res) => {
    try {
        const membershipId = req.params.id
        const [result] = await db.execute(
            "UPDATE memberships SET status = 'active' WHERE id = ? AND status = 'pending'", [membershipId]
        )
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Membership not found or not pending" })
        }
        res.json({ message: "Membership approved successfully" })
    } catch (err) {
        res.status(500).json({ message: "Failed to approve membership" })
    }
})

// ปฏิเสธ membership (admin)
router.put("/memberships/:id/reject", async(req, res) => {
    try {
        const membershipId = req.params.id
        const [result] = await db.execute(
            "UPDATE memberships SET status = 'rejected' WHERE id = ? AND status = 'pending'", [membershipId]
        )
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Membership not found or not pending" })
        }
        res.json({ message: "Membership rejected successfully" })
    } catch (err) {
        res.status(500).json({ message: "Failed to reject membership" })
    }
})

// ดูรายการ membership ที่ pending (admin)
router.get("/memberships/pending", async(req, res) => {
    try {
        const [memberships] = await db.execute(
            `SELECT m.id, m.user_id, u.username, u.first_name, u.last_name, m.membership_type_id, mt.name as membership_type, m.expires_at, m.status, m.created_at
       FROM memberships m
       JOIN users u ON m.user_id = u.id
       JOIN membership_types mt ON m.membership_type_id = mt.id
       WHERE m.status = 'pending'
       ORDER BY m.created_at DESC`
        )
        res.json({ memberships })
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch pending memberships" })
    }
})

// ดูรายการ membership ทั้งหมด (admin) พร้อม filter ตาม status
router.get("/memberships", async(req, res) => {
    try {
        const { status } = req.query
        let query = `SELECT m.id, m.user_id, u.username, u.first_name, u.last_name, m.membership_type_id, mt.name as membership_type, m.expires_at, m.status, m.created_at
      FROM memberships m
      JOIN users u ON m.user_id = u.id
      JOIN membership_types mt ON m.membership_type_id = mt.id`
        const params = []
        if (status) {
            query += " WHERE m.status = ?"
            params.push(status)
        }
        query += " ORDER BY m.created_at DESC"
        const [memberships] = await db.execute(query, params)
        res.json({ memberships })
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch memberships" })
    }
})

// ดูรายละเอียด membership รายบุคคล (admin)
router.get("/memberships/:id", async(req, res) => {
    try {
        const membershipId = req.params.id
        const [rows] = await db.execute(
            `SELECT m.id, m.user_id, u.username, u.first_name, u.last_name, m.membership_type_id, mt.name as membership_type, m.expires_at, m.status, m.created_at
       FROM memberships m
       JOIN users u ON m.user_id = u.id
       JOIN membership_types mt ON m.membership_type_id = mt.id
       WHERE m.id = ?`, [membershipId]
        )
        if (rows.length === 0) {
            return res.status(404).json({ message: "Membership not found" })
        }
        res.json({ membership: rows[0] })
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch membership detail" })
    }
})

// แก้ไขข้อมูล membership รายบุคคล (admin)
router.put("/memberships/:id", async(req, res) => {
    try {
        const membershipId = req.params.id
        const { expires_at, status, membership_type_id } = req.body
            // สร้าง dynamic update
        const fields = []
        const params = []
        if (expires_at) {
            fields.push("expires_at = ?")
            params.push(expires_at)
        }
        if (status) {
            fields.push("status = ?")
            params.push(status)
        }
        if (membership_type_id) {
            fields.push("membership_type_id = ?")
            params.push(membership_type_id)
        }
        if (fields.length === 0) {
            return res.status(400).json({ message: "No fields to update" })
        }
        params.push(membershipId)
        const [result] = await db.execute(
            `UPDATE memberships SET ${fields.join(", ")} WHERE id = ?`,
            params
        )
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Membership not found" })
        }
        res.json({ message: "Membership updated successfully" })
    } catch (err) {
        res.status(500).json({ message: "Failed to update membership" })
    }
})

// ลบ membership รายบุคคล (admin)
router.delete("/memberships/:id", async(req, res) => {
    try {
        const membershipId = req.params.id
        const [result] = await db.execute(
            "DELETE FROM memberships WHERE id = ?", [membershipId]
        )
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Membership not found" })
        }
        res.json({ message: "Membership deleted successfully" })
    } catch (err) {
        res.status(500).json({ message: "Failed to delete membership" })
    }
})

// ดูรายการจองตู้เก็บของทั้งหมด (admin)
router.get("/locker-reservations", async(req, res) => {
    try {
        const [reservations] = await db.execute(
            `SELECT lr.*, u.username, u.first_name, u.last_name, u.email as user_email, l.code as locker_code, l.location,
                    p.id as payment_id, p.amount as payment_amount, p.status as payment_status, p.payment_method, p.slip_url
       FROM locker_reservations lr
       JOIN users u ON lr.user_id = u.id
       JOIN lockers l ON lr.locker_id = l.id
       LEFT JOIN payments p ON p.user_id = lr.user_id AND p.transaction_id LIKE CONCAT('LKR', lr.id, '%')
       ORDER BY lr.reservation_date DESC, lr.start_time DESC`
        )
        res.json({ reservations })
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch locker reservations" })
    }
})

// อนุมัติ/ยกเลิก locker reservation
router.put("/locker-reservations/:id/confirm", async(req, res) => {
    try {
        const reservationId = req.params.id
        const { status } = req.body // 'confirmed' หรือ 'cancelled'
        if (!['confirmed', 'cancelled'].includes(status)) {
            return res.status(400).json({ message: "Invalid status" })
        }
        const [result] = await db.execute(
            `UPDATE locker_reservations SET status = ? WHERE id = ? AND status = 'pending'`, [status, reservationId]
        )
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Reservation not found or not pending" })
        }
        res.json({ message: `Reservation ${status} successfully` })
    } catch (err) {
        res.status(500).json({ message: "Failed to update reservation status" })
    }
})

// ลบ locker reservation (admin)
router.delete("/locker-reservations/:id", async(req, res) => {
    try {
        const reservationId = req.params.id
        const [result] = await db.execute(
            `DELETE FROM locker_reservations WHERE id = ?`, [reservationId]
        )
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Reservation not found" })
        }
        res.json({ message: "Reservation deleted successfully" })
    } catch (err) {
        res.status(500).json({ message: "Failed to delete reservation" })
    }
})

// Get all lockers (admin)
router.get("/lockers", async(req, res) => {
    try {
        const [lockers] = await db.execute("SELECT * FROM lockers ORDER BY code")
        res.json({ lockers: lockers || [] })
    } catch (err) {
        res.status(500).json({ message: "Database error" })
    }
})

// CRUD ตู้เก็บของ (admin)
router.post("/lockers", async(req, res) => {
    try {
        const { code, location, status } = req.body
        const [result] = await db.execute(
            `INSERT INTO lockers (code, location, status) VALUES (?, ?, ?)`, [code, location, status || 'available']
        )
        res.status(201).json({ message: "Locker created successfully", locker_id: result.insertId })
    } catch (err) {
        res.status(500).json({ message: "Failed to create locker" })
    }
})

router.put("/lockers/:id", async(req, res) => {
    try {
        const lockerId = req.params.id
        const { code, location, status } = req.body
        const fields = []
        const params = []
        if (code) {
            fields.push("code = ?");
            params.push(code)
        }
        if (location) {
            fields.push("location = ?");
            params.push(location)
        }
        if (status) {
            fields.push("status = ?");
            params.push(status)
        }
        if (fields.length === 0) {
            return res.status(400).json({ message: "No fields to update" })
        }
        params.push(lockerId)
        const [result] = await db.execute(
            `UPDATE lockers SET ${fields.join(", ")} WHERE id = ?`,
            params
        )
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Locker not found" })
        }
        res.json({ message: "Locker updated successfully" })
    } catch (err) {
        res.status(500).json({ message: "Failed to update locker" })
    }
})

router.delete("/lockers/:id", async(req, res) => {
    try {
        const lockerId = req.params.id
        const [result] = await db.execute(
            `DELETE FROM lockers WHERE id = ?`, [lockerId]
        )
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Locker not found" })
        }
        res.json({ message: "Locker deleted successfully" })
    } catch (err) {
        res.status(500).json({ message: "Failed to delete locker" })
    }
})

// Admin: Payments overview with filters (alias for payments admin list)
router.get("/payments", async(req, res) => {
    try {
        let query = `
            SELECT p.id, p.user_id,
                   CONCAT(u.first_name, ' ', u.last_name) as user_name,
                   u.email as user_email,
                   p.amount, p.status, p.payment_method, p.transaction_id, p.created_at, p.slip_url,
                   mt.name as membership_type,
                   CASE
                       WHEN p.transaction_id LIKE 'RSV%' THEN 'การจองสระว่ายน้ำ'
                       WHEN p.transaction_id LIKE 'LKR%' THEN 'การจองตู้เก็บของ'
                       WHEN mt.name IS NOT NULL THEN CONCAT('สมาชิกภาพ - ', mt.name)
                       ELSE 'อื่นๆ'
                   END as payment_type
            FROM payments p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN (
                SELECT *, ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY created_at DESC) as rn
                FROM memberships
            ) m ON p.user_id = m.user_id AND m.rn = 1
            LEFT JOIN membership_types mt ON m.membership_type_id = mt.id
        `;
        const params = [];
        const { status, dateFilter } = req.query;
        const conditions = [];

        if (status && status !== "all") {
            conditions.push("p.status = ?");
            params.push(status);
        }

        if (dateFilter && dateFilter !== "all") {
            switch (dateFilter) {
                case "day":
                    conditions.push("DATE(p.created_at) = CURDATE()");
                    break;
                case "week":
                    conditions.push("YEARWEEK(DATE(p.created_at), 1) = YEARWEEK(CURDATE(), 1)");
                    break;
                case "month":
                    conditions.push("YEAR(p.created_at) = YEAR(CURDATE()) AND MONTH(p.created_at) = MONTH(CURDATE())");
                    break;
                case "year":
                    conditions.push("YEAR(p.created_at) = YEAR(CURDATE())");
                    break;
                default:
                    break;
            }
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY p.created_at DESC";

        const [payments] = await db.execute(query, params);
        res.json({ payments: payments || [] });
    } catch (err) {
        console.error("Error fetching admin payments:", err);
        res.status(500).json({
            message: "Database error",
            error: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
            sql: err.sql
        });
    }
})

// Get all notifications (admin)
router.get("/notifications", async(req, res) => {
    try {
        const [notifications] = await db.execute(
            `SELECT id, user_id, title, message, is_read, created_at
             FROM notifications
             ORDER BY created_at DESC
             LIMIT 10`
        )
        res.json({ notifications: notifications || [] })
    } catch (err) {
        console.error("Error fetching notifications:", err)
        res.status(500).json({ message: "Database error" })
    }
})

// Create notification (admin)
router.post("/notifications", async(req, res) => {
    try {
        const { user_id, title, message } = req.body

        if (user_id === "all") {
            // Send to all users
            const [users] = await db.execute("SELECT id FROM users WHERE role = 'user'")

            for (const user of users) {
                await db.execute(
                    "INSERT INTO notifications (user_id, title, message, is_read) VALUES (?, ?, ?, FALSE)", [user.id, title, message]
                )
            }
        } else {
            // Send to specific user
            await db.execute(
                "INSERT INTO notifications (user_id, title, message, is_read) VALUES (?, ?, ?, FALSE)", [user_id, title, message]
            )
        }

        res.status(201).json({ message: "Notification created successfully" })
    } catch (err) {
        console.error("Error creating notification:", err)
        res.status(500).json({ message: "Failed to create notification" })
    }
})

// Delete notification (admin)
router.delete("/notifications/:id", async(req, res) => {
    try {
        const notificationId = req.params.id
        const [result] = await db.execute(
            "DELETE FROM notifications WHERE id = ?", [notificationId]
        )

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Notification not found" })
        }

        res.json({ message: "Notification deleted successfully" })
    } catch (err) {
        console.error("Error deleting notification:", err)
        res.status(500).json({ message: "Failed to delete notification" })
    }
})

// Get user categories
router.get("/user-categories", async(req, res) => {
    try {
        const [categories] = await db.execute(
            "SELECT * FROM user_categories ORDER BY name"
        )
        res.json({ categories: categories || [] })
    } catch (err) {
        console.error("Error fetching user categories:", err)
        res.status(500).json({ message: "Database error" })
    }
})

// Update user category prices
router.put("/user-categories/:id", async(req, res) => {
    try {
        const categoryId = req.params.id
        const { annual_price, pay_per_session_price } = req.body

        if (!annual_price || !pay_per_session_price || annual_price < 0 || pay_per_session_price < 0) {
            return res.status(400).json({ message: "Invalid prices" })
        }

        const [result] = await db.execute(
            "UPDATE user_categories SET annual_price = ?, pay_per_session_price = ? WHERE id = ?", [annual_price, pay_per_session_price, categoryId]
        )

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "User category not found" })
        }

        res.json({ message: "Prices updated successfully" })
    } catch (err) {
        console.error("Error updating user category prices:", err)
        res.status(500).json({ message: "Failed to update prices" })
    }
})

// Confirm payment status
router.put("/payments/:id/confirm", async(req, res) => {
    try {
        const paymentId = req.params.id
        const { status } = req.body

        if (!['completed', 'failed', 'refunded'].includes(status)) {
            return res.status(400).json({ message: "Invalid status" })
        }

        const [result] = await db.execute(
            "UPDATE payments SET status = ? WHERE id = ?", [status, paymentId]
        )

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Payment not found" })
        }

        res.json({ message: "Payment status updated successfully" })
    } catch (err) {
        console.error("Error updating payment status:", err)
        res.status(500).json({ message: "Failed to update payment status" })
    }
})

// Bulk update payment status
router.put("/payments/bulk-update", async(req, res) => {
    try {
        const { paymentIds, status } = req.body;

        if (!['completed', 'failed'].includes(status)) {
            return res.status(400).json({ message: "Invalid status provided." });
        }
        if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
            return res.status(400).json({ message: "Payment IDs must be a non-empty array." });
        }

        const [result] = await db.execute(
            `UPDATE payments SET status = ? WHERE id IN (?) AND status = 'pending'`, [status, paymentIds]
        );

        res.json({ message: `${result.affectedRows} payments updated successfully.` });
    } catch (err) {
        console.error("Error bulk updating payment status:", err);
        res.status(500).json({ message: "Failed to bulk update payment status." });
    }
});


module.exports = router