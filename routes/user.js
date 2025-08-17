const express = require("express")
const bcrypt = require("bcryptjs")
const db = require("../config/database")
const { authenticateToken } = require("../middleware/auth")

const router = express.Router()

// Get user profile
router.get("/profile", authenticateToken, async(req, res) => {
    try {
        const [users] = await db.execute(
            "SELECT id, username, email, first_name, last_name, phone, address, date_of_birth, id_card, role, status, created_at FROM users WHERE id = ?", [req.user.id],
        )

        if (users.length === 0) {
            return res.status(404).json({ message: "User not found" })
        }

        res.json({ user: users[0] })
    } catch (error) {
        console.error("Profile error:", error)
        res.status(500).json({ message: "Database error" })
    }
})

// Update user profile
router.put("/profile", authenticateToken, async(req, res) => {
    try {
        const { first_name, last_name, phone, address } = req.body

        await db.execute("UPDATE users SET first_name = ?, last_name = ?, phone = ?, address = ? WHERE id = ?", [
            first_name,
            last_name,
            phone,
            address,
            req.user.id,
        ])

        res.json({ message: "Profile updated successfully" })
    } catch (error) {
        console.error("Update profile error:", error)
        res.status(500).json({ message: "Failed to update profile" })
    }
})

// Change password
router.put("/change-password", authenticateToken, async(req, res) => {
    try {
        const { current_password, new_password } = req.body

        // Get current password
        const [users] = await db.execute("SELECT password FROM users WHERE id = ?", [req.user.id])

        if (users.length === 0) {
            return res.status(404).json({ message: "User not found" })
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(current_password, users[0].password)
        if (!isValidPassword) {
            return res.status(400).json({ message: "Current password is incorrect" })
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(new_password, 10)

        // Update password
        await db.execute("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, req.user.id])

        res.json({ message: "Password changed successfully" })
    } catch (error) {
        console.error("Change password error:", error)
        res.status(500).json({ message: "Server error" })
    }
})

// Get user dashboard data
router.get("/dashboard", authenticateToken, async(req, res) => {
    try {
        const userId = req.user.id

        // Get user's current category details
        const [
            [userCategoryDetails]
        ] = await db.execute(
            `SELECT uc.id, uc.name, uc.description, uc.pay_per_session_price, uc.annual_price
             FROM users u
             JOIN user_categories uc ON u.user_category_id = uc.id
             WHERE u.id = ?`, [userId]
        );

        // Get membership info (only active ones)
        const [memberships] = await db.execute(
            `SELECT mt.name as type, m.expires_at, m.status
             FROM memberships m 
             JOIN membership_types mt ON m.membership_type_id = mt.id 
             WHERE m.user_id = ? AND m.status = 'active'
             ORDER BY m.expires_at DESC LIMIT 1`, [userId],
        )

        let membershipData = memberships[0] || null;

        // If there's an active membership, augment it with user category details
        if (membershipData && userCategoryDetails) {
            membershipData = {
                ...membershipData,
                user_category: userCategoryDetails.name,
                pay_per_session_price: userCategoryDetails.pay_per_session_price,
                annual_price: userCategoryDetails.annual_price,
            };
        } else if (!membershipData && userCategoryDetails) {
            // If no active membership, but user has a category, still provide category info
            // This is crucial for the frontend to display the user's category and relevant pricing
            membershipData = {
                type: 'No Active Membership', // Default type if no active membership
                expires_at: null,
                status: 'inactive', // Default status
                user_category: userCategoryDetails.name,
                pay_per_session_price: userCategoryDetails.pay_per_session_price,
                annual_price: userCategoryDetails.annual_price,
            };
        }


        // Get upcoming reservations
        const [reservations] = await db.execute(
            `SELECT r.id, r.reservation_date, r.start_time, r.end_time, r.status, r.notes,
              pr.name as pool_name
       FROM reservations r
       JOIN pool_resources pr ON r.pool_resource_id = pr.id
       WHERE r.user_id = ? AND r.reservation_date >= CURDATE()
       ORDER BY r.reservation_date, r.start_time LIMIT 5`, [userId],
        )

        // Get notifications
        const [notifications] = await db.execute(
            `SELECT id, title, message, created_at, is_read
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 10`, [userId],
        )

        // Get usage stats
        const [stats] = await db.execute(
            `SELECT 
         COUNT(*) as total_reservations,
         COUNT(CASE WHEN r.reservation_date >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN 1 END) as this_month_reservations
       FROM reservations r
       WHERE r.user_id = ?`, [userId],
        )

        res.json({
            membership: membershipData, // Send the augmented membership data
            upcoming_reservations: reservations || [],
            notifications: notifications || [],
            usage_stats: stats[0] || { total_reservations: 0, this_month_reservations: 0 },
        })
    } catch (error) {
        console.error("Dashboard error:", error)
        res.status(500).json({ message: "Database error" })
    }
})

// Get user's reservations
router.get("/reservations", authenticateToken, async(req, res) => {
    try {
        const userId = req.user.id

        const [reservations] = await db.execute(
            `SELECT r.id, r.reservation_date, r.start_time, r.end_time, r.status, r.notes, r.created_at,
               pr.name as pool_name
             FROM reservations r
             JOIN pool_resources pr ON r.pool_resource_id = pr.id
             WHERE r.user_id = ?
             ORDER BY r.reservation_date DESC, r.start_time DESC`, [userId]
        )

        res.json({ reservations: reservations || [] })
    } catch (error) {
        console.error("Get reservations error:", error)
        res.status(500).json({ message: "Database error" })
    }
})

module.exports = router