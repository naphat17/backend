const express = require("express")
const db = require("../config/database")
const { authenticateToken } = require("../middleware/auth")
const multer = require("multer")
const { CloudinaryStorage } = require("multer-storage-cloudinary")
const cloudinary = require("cloudinary").v2

const router = express.Router()

// Cloudinary config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Multer config สำหรับ Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "locker_slips",
        format: async(req, file) => "png",
        public_id: (req, file) => `locker_slip_${Date.now()}`,
    },
})

const upload = multer({ storage: storage })

// Admin: Get all lockers, with optional date for reservation status
router.get("/", authenticateToken, async(req, res) => {
    // Ensure only admins can access this route
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admins only." });
    }
    try {
        const { date } = req.query;
        let query = "SELECT l.* FROM lockers l ORDER BY l.code";
        let params = [];

        if (date) {
            // If a date is provided, fetch reservation status for that date
            query = `
                SELECT 
                    l.*,
                    CASE WHEN lr.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_reserved_on_selected_date
                FROM 
                    lockers l
                LEFT JOIN 
                    locker_reservations lr ON l.id = lr.locker_id 
                    AND lr.reservation_date = ? 
                    AND lr.status IN ('pending', 'confirmed')
                ORDER BY 
                    l.code
            `;
            params.push(date);
        }

        const [lockers] = await db.execute(query, params);
        res.json({ lockers });
    } catch (err) {
        console.error("Error fetching all lockers:", err);
        res.status(500).json({ message: "Failed to fetch all lockers" });
    }
});

// Admin: Create a new locker
router.post("/", authenticateToken, async(req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admins only." });
    }
    try {
        const { code, location, status } = req.body;
        if (!code || !location || !status) {
            return res.status(400).json({ message: "Code, location, and status are required." });
        }
        const [result] = await db.execute(
            `INSERT INTO lockers (code, location, status) VALUES (?, ?, ?)`, [code, location, status]
        );
        res.status(201).json({ message: "Locker created successfully", locker_id: result.insertId });
    } catch (err) {
        console.error("Error creating locker:", err);
        res.status(500).json({ message: "Failed to create locker" });
    }
});

// Admin: Update an existing locker
router.put("/:id", authenticateToken, async(req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admins only." });
    }
    try {
        const lockerId = req.params.id;
        const { code, location, status } = req.body;
        if (!code || !location || !status) {
            return res.status(400).json({ message: "Code, location, and status are required." });
        }
        const [result] = await db.execute(
            `UPDATE lockers SET code = ?, location = ?, status = ? WHERE id = ?`, [code, location, status, lockerId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Locker not found" });
        }
        res.json({ message: "Locker updated successfully" });
    } catch (err) {
        console.error("Error updating locker:", err);
        res.status(500).json({ message: "Failed to update locker" });
    }
});

// Admin: Delete a locker
router.delete("/:id", authenticateToken, async(req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admins only." });
    }
    try {
        const lockerId = req.params.id;
        const [result] = await db.execute(`DELETE FROM lockers WHERE id = ?`, [lockerId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Locker not found" });
        }
        res.json({ message: "Locker deleted successfully" });
    } catch (err) {
        console.error("Error deleting locker:", err);
        res.status(500).json({ message: "Failed to delete locker" });
    }
});

// User: Get all available lockers
router.get("/available", async(req, res) => {
    try {
        const { date } = req.query;
        let query = "SELECT * FROM lockers WHERE status = 'available' ORDER BY code";
        let params = [];

        if (date) {
            // If a date is provided, fetch only lockers that are not reserved on that date
            query = `
                SELECT 
                    l.*,
                    CASE WHEN lr.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_reserved_on_selected_date
                FROM 
                    lockers l
                LEFT JOIN 
                    locker_reservations lr ON l.id = lr.locker_id 
                    AND lr.reservation_date = ? 
                    AND lr.status IN ('pending', 'confirmed')
                WHERE 
                    l.status = 'available'
                    AND lr.id IS NULL
                ORDER BY 
                    l.code
            `;
            params.push(date);
        }

        const [lockers] = await db.execute(query, params);
        res.json({ lockers });
    } catch (err) {
        console.error("Error fetching available lockers:", err);
        res.status(500).json({ message: "Failed to fetch available lockers" });
    }
});

// Admin: Get specific locker reservation info for a date
router.get("/:id/reservation", authenticateToken, async(req, res) => {
    // Ensure only admins can access this route
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admins only." });
    }
    try {
        const lockerId = req.params.id;
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({ message: "Date parameter is required" });
        }
        
        const [reservations] = await db.execute(
            `SELECT 
                lr.*,
                u.username as user_name,
                u.email as user_email,
                l.code as locker_code
            FROM locker_reservations lr
            JOIN users u ON lr.user_id = u.id
            JOIN lockers l ON lr.locker_id = l.id
            WHERE lr.locker_id = ? AND lr.reservation_date = ? 
            AND lr.status IN ('pending', 'confirmed')
            ORDER BY lr.created_at DESC
            LIMIT 1`,
            [lockerId, date]
        );
        
        if (reservations.length > 0) {
            res.json({ reservation: reservations[0] });
        } else {
            res.status(404).json({ message: "No reservation found for this locker on the specified date" });
        }
    } catch (err) {
        console.error("Error fetching locker reservation:", err);
        res.status(500).json({ message: "Failed to fetch locker reservation" });
    }
});

// User: Get user's locker reservations
router.get("/reservations/user", authenticateToken, async(req, res) => {
    try {
        const [reservations] = await db.execute(
            `SELECT lr.*, l.code as locker_code FROM locker_reservations lr
       JOIN lockers l ON lr.locker_id = l.id
       WHERE lr.user_id = ? ORDER BY lr.reservation_date DESC`, [req.user.id]
        );
        res.json({ reservations });
    } catch (err) {
        console.error("Error fetching user reservations:", err);
        res.status(500).json({ message: "Failed to fetch reservations" });
    }
});

// User: Create a new locker reservation with payment (fixed 30 THB), no time range
router.post("/reservations", authenticateToken, upload.single("slip"), async(req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { locker_id, reservation_date, payment_method, amount } = req.body;
        if (!locker_id || !reservation_date || !payment_method) {
            await connection.rollback();
            return res.status(400).json({ message: "locker_id, reservation_date and payment_method are required" });
        }

        // Prevent duplicate reservation for the same locker and date
        const [existing] = await connection.execute(
            `SELECT id FROM locker_reservations WHERE locker_id = ? AND reservation_date = ? AND status IN ('pending','confirmed')`, [locker_id, reservation_date]
        );
        if (existing.length > 0) {
            await connection.rollback();
            return res.status(400).json({ message: "Locker is already reserved for this date" });
        }

        const finalAmount = amount || 30; // use provided amount or default to 30 THB

        let reservationStatus = 'pending';
        let paymentStatus = 'pending';

        if (payment_method === 'cash') {
            reservationStatus = 'pending';
            paymentStatus = 'pending';
        } else if (payment_method === 'bank_transfer') {
            reservationStatus = 'pending';
            paymentStatus = 'pending';
        } else if (payment_method === 'system') {
            reservationStatus = 'confirmed';
            paymentStatus = 'completed';
        } else {
            await connection.rollback();
            return res.status(400).json({ message: 'Invalid payment method' });
        }

        // Create locker reservation (no time fields)
        const [reservationResult] = await connection.execute(
            `INSERT INTO locker_reservations (user_id, locker_id, reservation_date, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, ?)`, [req.user.id, locker_id, reservation_date, '00:00:00', '23:59:59', reservationStatus]
        );
        const reservationId = reservationResult.insertId;

        // Handle slip upload for bank transfer
        let slipUrl = null
        if (payment_method === 'bank_transfer' && req.file) {
            slipUrl = req.file.path // URL from Cloudinary
        }

        // Create payment
        const [paymentResult] = await connection.execute(
            `INSERT INTO payments (user_id, amount, status, payment_method, transaction_id, slip_url)
       VALUES (?, ?, ?, ?, ?, ?)`, [req.user.id, finalAmount, paymentStatus, payment_method, `LKR${reservationId}_${Date.now()}`, slipUrl]
        )
        const paymentId = paymentResult.insertId;

        await connection.commit();

        res.status(201).json({
            message: 'Locker reserved successfully',
            reservation_id: reservationId,
            paymentId,
            reservation_status: reservationStatus,
        });
    } catch (err) {
        await connection.rollback();
        console.error("Error creating locker reservation:", err);
        res.status(500).json({ message: "Failed to reserve locker", error: err.message });
    } finally {
        connection.release();
    }
});

// User: Cancel a locker reservation
router.delete("/reservations/:id", authenticateToken, async(req, res) => {
    try {
        const reservationId = req.params.id;
        const [result] = await db.execute(
            `UPDATE locker_reservations SET status = 'cancelled' WHERE id = ? AND user_id = ?`, [reservationId, req.user.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Reservation not found or cannot be cancelled" });
        }
        res.json({ message: "Reservation cancelled successfully" });
    } catch (err) {
        console.error("Error cancelling reservation:", err);
        res.status(500).json({ message: "Failed to cancel reservation" });
    }
});

module.exports = router;