const express = require("express")
const db = require("../config/database")
const { authenticateToken } = require("../middleware/auth")

const router = express.Router()

// Get user categories (public)
router.get("/categories", async(req, res) => {
    try {
        const [categories] = await db.execute(
            "SELECT id, name, description, pay_per_session_price, annual_price FROM user_categories ORDER BY id"
        )
        res.json({ categories: categories || [] })
    } catch (err) {
        res.status(500).json({ message: "Database error" })
    }
})

// Create a payment for a membership (pay-per-session or annual)
router.post("/purchase", authenticateToken, async(req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { purchase_type, payment_method, user_category_id } = req.body // purchase_type can be 'session' or 'annual'
        const userId = req.user.id;

        if (!purchase_type || !payment_method || !user_category_id) {
            await connection.rollback();
            return res.status(400).json({ message: "purchase_type, payment_method, and user_category_id are required" });
        }

        // Get selected user category pricing
        const [
            [selectedCategory]
        ] = await connection.execute(
            `SELECT id, pay_per_session_price, annual_price
       FROM user_categories
       WHERE id = ?`, [user_category_id]
        );

        if (!selectedCategory) {
            await connection.rollback();
            return res.status(404).json({ message: "Selected user category not found." });
        }

        const amount = purchase_type === 'annual' ? selectedCategory.annual_price : selectedCategory.pay_per_session_price;
        const membership_type_id = purchase_type === 'annual' ? 2 : 1; // 1 for session, 2 for annual (assuming these IDs)

        // Create payment
        const [paymentResult] = await connection.execute(
            `INSERT INTO payments (user_id, amount, status, payment_method, transaction_id)
       VALUES (?, ?, 'pending', ?, ?)`, [userId, amount, payment_method, `TXN${Date.now()}`]
        );

        // Update user's category if they are purchasing a membership for a different category
        await connection.execute(
            `UPDATE users SET user_category_id = ? WHERE id = ?`, [user_category_id, userId]
        );

        // Update or create membership entry
        // If annual, update existing pending membership or create new one
        if (purchase_type === 'annual') {
            // Check if user already has an active/pending annual membership
            const [existingMembership] = await connection.execute(
                `SELECT id FROM memberships WHERE user_id = ? AND membership_type_id = 2 AND status IN ('active', 'pending')`, [userId]
            );

            if (existingMembership.length > 0) {
                // Update existing annual membership
                await connection.execute(
                    `UPDATE memberships SET membership_type_id = ?, expires_at = DATE_ADD(NOW(), INTERVAL 1 YEAR), status = 'pending' WHERE id = ?`, [membership_type_id, existingMembership[0].id]
                );
            } else {
                // Create new annual membership
                await connection.execute(
                    `INSERT INTO memberships (user_id, membership_type_id, expires_at, status)
           VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 YEAR), 'pending')`, [userId, membership_type_id]
                );
            }
        } else {
            // For session-based, ensure a pending 'pay-per-session' membership exists or update it
            const [existingSessionMembership] = await connection.execute(
                `SELECT id FROM memberships WHERE user_id = ? AND membership_type_id = 1 AND status = 'pending'`, [userId]
            );
            if (existingSessionMembership.length === 0) {
                await connection.execute(
                    `INSERT INTO memberships (user_id, membership_type_id, expires_at, status)
           VALUES (?, 1, NOW(), 'pending')`, // Expires_at can be NOW() for session, updated on payment confirmation
                    [userId]
                );
            }
        }

        await connection.commit();

        res.status(201).json({
            message: "Payment created. Please proceed to payment.",
            payment_id: paymentResult.insertId,
            payment_status: 'pending',
        });

    } catch (err) {
        await connection.rollback();
        console.error("Purchase membership error:", err);
        res.status(500).json({ message: "Failed to create payment", error: err.message });
    } finally {
        connection.release();
    }
});

module.exports = router