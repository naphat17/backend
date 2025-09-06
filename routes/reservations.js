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
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const userId = req.user.id
        const {
            pool_resource_id,
            reservation_date,
            start_time,
            end_time,
            notes,
            payment_method,
            amount
        } = req.body

        // --- Input Validation ---
        if (!pool_resource_id || !reservation_date || !start_time || !end_time) {
            await connection.rollback();
            return res.status(400).json({ message: "Missing required reservation fields." });
        }

        // Check pool availability before creating reservation
        const [poolInfo] = await connection.execute(
            "SELECT id, name, capacity FROM pool_resources WHERE id = ? AND status = 'available'",
            [pool_resource_id]
        );

        if (poolInfo.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: "สระที่เลือกไม่พร้อมใช้งาน" });
        }

        // Check current reservations for the selected date and pool
        const [existingReservations] = await connection.execute(
            "SELECT COUNT(*) as count FROM reservations WHERE pool_resource_id = ? AND reservation_date = ? AND status IN ('pending', 'confirmed')",
            [pool_resource_id, reservation_date]
        );

        const currentReservations = existingReservations[0].count;
        const poolCapacity = poolInfo[0].capacity;

        if (currentReservations >= poolCapacity) {
            await connection.rollback();
            return res.status(400).json({ 
                message: `สระ ${poolInfo[0].name} เต็มแล้วสำหรับวันที่ ${reservation_date} กรุณาเลือกวันอื่น`,
                isFull: true,
                poolName: poolInfo[0].name,
                date: reservation_date
            });
        }

        // 1. Create the reservation
        const [reservationResult] = await connection.execute(
            `INSERT INTO reservations (user_id, pool_resource_id, reservation_date, start_time, end_time, status, notes)
             VALUES (?, ?, ?, ?, ?, 'pending', ?)`, [userId, pool_resource_id, reservation_date, start_time, end_time, notes || null]
        )
        const reservationId = reservationResult.insertId;

        let paymentId = null;

        // 2. If payment is required, create a payment record
        if (amount > 0) {
            const [paymentResult] = await connection.execute(
                `INSERT INTO payments (user_id, amount, status, payment_method, transaction_id)
                 VALUES (?, ?, ?, ?, ?)`, [userId, amount, 'pending', payment_method, `RSV-${reservationId}`]
            );
            paymentId = paymentResult.insertId;
        }

        await connection.commit();

        res.status(201).json({
            message: "Reservation created successfully",
            reservationId: reservationId,
            paymentId: paymentId // Send paymentId back to the client
        })
    } catch (error) {
        await connection.rollback();
        console.error("Create reservation error:", error)
        res.status(500).json({ message: "Failed to create reservation" })
    } finally {
        connection.release();
    }
})

// Cancel reservation
router.delete("/:id", authenticateToken, async(req, res) => {
    try {
        const userId = req.user.id
        const reservationId = req.params.id

        // Check if reservation exists and belongs to user
        const [reservations] = await db.execute(
            `SELECT id, status FROM reservations WHERE id = ? AND user_id = ?`,
            [reservationId, userId]
        )

        if (reservations.length === 0) {
            return res.status(404).json({ message: "Reservation not found" })
        }

        const reservation = reservations[0]
        
        // Check if reservation can be cancelled
        if (reservation.status === 'cancelled' || reservation.status === 'completed') {
            return res.status(400).json({ message: "Cannot cancel this reservation" })
        }

        // Update reservation status to cancelled
        await db.execute(
            `UPDATE reservations SET status = 'cancelled' WHERE id = ? AND user_id = ?`,
            [reservationId, userId]
        )

        res.json({ message: "Reservation cancelled successfully" })
    } catch (error) {
        console.error("Cancel reservation error:", error)
        res.status(500).json({ message: "Failed to cancel reservation" })
    }
})

module.exports = router