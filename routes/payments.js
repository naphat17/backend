const express = require("express")
const db = require("../config/database")
const { authenticateToken } = require("../middleware/auth")
const multer = require("multer")
const path = require("path")
const fs = require("fs")

const router = express.Router()

// Multer config สำหรับ slip
const slipsDir = path.join(__dirname, "../public/slips")
if (!fs.existsSync(slipsDir)) fs.mkdirSync(slipsDir, { recursive: true })
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, slipsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname)
        cb(null, `slip_${req.params.id}_${Date.now()}${ext}`)
    },
})
const upload = multer({ storage })

// Get user payments
router.get("/user", authenticateToken, async(req, res) => {
    try {
        const [payments] = await db.execute(
            `SELECT p.id, p.amount, p.status, p.payment_method, p.transaction_id, p.created_at,
              mt.name as membership_type
       FROM payments p
       LEFT JOIN memberships m ON p.user_id = m.user_id
       LEFT JOIN membership_types mt ON m.membership_type_id = mt.id
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC`, [req.user.id]
        )
        res.json({ payments: payments || [] })
    } catch (err) {
        res.status(500).json({ message: "Database error" })
    }
})

// (สำหรับ admin) ดึงรายการการชำระเงินทั้งหมดพร้อม filter
router.get("/admin/payments", authenticateToken, async(req, res) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Admins only." });
    }

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
            LEFT JOIN memberships m ON p.user_id = m.user_id AND p.created_at BETWEEN m.created_at AND m.expires_at
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
        res.status(500).json({ message: "Database error" });
    }
});

// Get payment receipt
router.get("/:id/receipt", authenticateToken, async(req, res) => {
    try {
        const paymentId = req.params.id
        const [paymentRows] = await db.execute(
            "SELECT * FROM payments WHERE id = ? AND user_id = ?", [paymentId, req.user.id]
        )
        if (paymentRows.length === 0) {
            return res.status(404).json({ message: "Payment not found" })
        }
        // In a real app, you would generate a PDF receipt
        res.json({
            receipt_url: `#receipt-${paymentId}`,
            payment: paymentRows[0],
        })
    } catch (err) {
        res.status(500).json({ message: "Database error" })
    }
})

// อัปโหลด slip (กรณีโอนเงินผ่านบัญชี)
router.post("/:id/upload-slip", authenticateToken, upload.single("slip"), async(req, res) => {
    try {
        const paymentId = req.params.id
        if (!req.file) {
            return res.status(400).json({ message: "No slip file uploaded" })
        }
        const slipUrl = `/slips/${req.file.filename}`
            // อัปเดต payment
        await db.execute(
            "UPDATE payments SET slip_url = ?, status = 'pending' WHERE id = ? AND user_id = ?", [slipUrl, paymentId, req.user.id]
        )
        res.json({ message: "Slip uploaded successfully", slip_url: slipUrl })
    } catch (err) {
        console.error("Upload slip error:", err)
        res.status(500).json({ message: "Failed to upload slip", error: err.message })
    }
})

// (สำหรับ admin) ยืนยันการชำระเงิน
router.put("/:id/confirm", authenticateToken, async(req, res) => {
    // TODO: Add proper admin role check
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const paymentId = req.params.id;
        const { status } = req.body; // 'completed' or 'failed'

        if (!['completed', 'failed', 'refunded'].includes(status)) {
            await connection.rollback();
            return res.status(400).json({ message: "Invalid status" });
        }

        // 1. Update payment status
        const [paymentUpdateResult] = await connection.execute(
            "UPDATE payments SET status = ? WHERE id = ?", [status, paymentId]
        );

        if (paymentUpdateResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Payment not found" });
        }

        if (status === 'failed') {
            await connection.commit();
            return res.json({ message: "Payment status updated to failed" });
        }

        // --- Logic for 'refunded' payments ---
        if (status === 'refunded') {
            // Get payment details to check if it was previously completed
            const [paymentRows] = await connection.execute(
                "SELECT status, user_id FROM payments WHERE id = ?", [paymentId]
            );

            if (paymentRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: "Payment not found" });
            }

            const previousStatus = paymentRows[0].status;
            const user_id = paymentRows[0].user_id;

            // Only allow refund if payment was previously completed
            if (previousStatus !== 'completed') {
                await connection.rollback();
                return res.status(400).json({ message: "Can only refund completed payments" });
            }

            // Get membership details associated with this payment
            const [membershipRows] = await connection.execute(
                `SELECT m.id as membership_id, m.membership_type_id, m.status, m.expires_at
                 FROM payments p
                 LEFT JOIN memberships m ON p.user_id = m.user_id
                 WHERE p.id = ? AND m.status = 'active'
                 ORDER BY m.created_at DESC LIMIT 1`, [paymentId]
            );

            // If there's an active membership, we need to handle it
            if (membershipRows.length > 0) {
                const membership = membershipRows[0];

                if (membership.membership_type_id === 2) { // Annual Membership
                    // For annual membership, reduce expiry by 1 year
                    const currentExpiry = new Date(membership.expires_at);
                    currentExpiry.setFullYear(currentExpiry.getFullYear() - 1);

                    // If the new expiry is in the past, deactivate the membership
                    if (currentExpiry <= new Date()) {
                        await connection.execute(
                            "UPDATE memberships SET status = 'expired' WHERE id = ?", [membership.membership_id]
                        );
                    } else {
                        await connection.execute(
                            "UPDATE memberships SET expires_at = ? WHERE id = ?", [currentExpiry.toISOString(), membership.membership_id]
                        );
                    }
                } else { // Pay-per-session
                    // For pay-per-session, deactivate the membership
                    await connection.execute(
                        "UPDATE memberships SET status = 'expired' WHERE id = ?", [membership.membership_id]
                    );
                }
            }

            await connection.commit();
            return res.json({ message: "Payment refunded and membership adjusted successfully" });
        }

        // --- Logic for 'completed' payments ---

        // 2. Get payment and user details
        const [
            [paymentDetails]
        ] = await connection.execute(
            `SELECT p.user_id, m.id as membership_id, m.membership_type_id
       FROM payments p
       LEFT JOIN memberships m ON p.user_id = m.user_id
       WHERE p.id = ? ORDER BY m.created_at DESC LIMIT 1`, [paymentId]
        );

        if (!paymentDetails) {
            await connection.rollback();
            return res.status(404).json({ message: "Payment details not found." });
        }

        const { user_id, membership_id, membership_type_id } = paymentDetails;

        // If this payment isn't associated with any membership record, skip membership logic
        if (!membership_id) {
            await connection.commit();
            return res.json({ message: "Payment confirmed (non-membership payment)" });
        }

        // 3. Handle membership activation/extension
        if (membership_type_id === 2) { // Annual Membership
            const [
                [activeAnnual]
            ] = await connection.execute(
                "SELECT id, expires_at FROM memberships WHERE user_id = ? AND status = 'active' AND membership_type_id = 2", [user_id]
            );

            if (activeAnnual) {
                const currentExpiry = new Date(activeAnnual.expires_at);
                currentExpiry.setFullYear(currentExpiry.getFullYear() + 1);
                await connection.execute("UPDATE memberships SET expires_at = ? WHERE id = ?", [currentExpiry.toISOString(), activeAnnual.id]);
            } else {
                const newExpiry = new Date();
                newExpiry.setFullYear(newExpiry.getFullYear() + 1);
                await connection.execute("UPDATE memberships SET status = 'active', expires_at = ? WHERE id = ?", [newExpiry.toISOString(), membership_id]);
            }
        } else { // Pay-per-session
            const newExpiry = new Date();
            newExpiry.setHours(23, 59, 59, 999); // End of the current day
            await connection.execute(
                "UPDATE memberships SET status = 'active', expires_at = ? WHERE id = ?", [newExpiry.toISOString(), membership_id]
            );
        }

        await connection.commit();
        res.json({ message: "Payment confirmed and membership updated successfully" });

    } catch (err) {
        await connection.rollback();
        console.error("Confirm payment error:", err);
        res.status(500).json({ message: "Failed to update payment status", error: err.message });
    } finally {
        connection.release();
    }
});

module.exports = router