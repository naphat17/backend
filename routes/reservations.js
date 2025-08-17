const express = require("express")
const db = require("../config/database")
const { authenticateToken } = require("../middleware/auth")

const router = express.Router()

// Get user's reservations
router.get("/user", authenticateToken, async(req, res) => {
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
        console.error("Get user reservations error:", error)
        res.status(500).json({ message: "Database error" })
    }
})

// Create new reservation
router.post("/", authenticateToken, async(req, res) => {
    try {
        const userId = req.user.id
        const { pool_resource_id, reservation_date, start_time, end_time, notes } = req.body

        const [result] = await db.execute(
            `INSERT INTO reservations (user_id, pool_resource_id, reservation_date, start_time, end_time, status, notes)
             VALUES (?, ?, ?, ?, ?, 'pending', ?)`, [userId, pool_resource_id, reservation_date, start_time, end_time, notes]
        )

        res.status(201).json({
            message: "Reservation created successfully",
            reservationId: result.insertId
        })
    } catch (error) {
        console.error("Create reservation error:", error)
        res.status(500).json({ message: "Failed to create reservation" })
    }
})

module.exports = router