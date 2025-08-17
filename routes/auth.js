const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const db = require("../config/database")

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

// Register
router.post("/register", async(req, res) => {
    try {
        const { username, email, password, first_name, last_name, phone, address, date_of_birth, id_card, user_category_id } = req.body

        // Check if user exists
        const [existingUsers] = await db.execute("SELECT id FROM users WHERE username = ? OR email = ?", [username, email])
        if (existingUsers.length > 0) {
            return res.status(400).json({ message: "Username or email already exists" })
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10)

        // Insert user
        const [result] = await db.execute(
            `INSERT INTO users (username, email, password, first_name, last_name, phone, address, date_of_birth, id_card, user_category_id, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'user', 'active')`, [username, email, hashedPassword, first_name, last_name, phone, address, date_of_birth, id_card, user_category_id || null],
        )

        const userId = result.insertId

        // Create a default 'pay-per-session' membership for the new user
        // We'll use a placeholder expiry date for now, as it will be updated upon first payment.
        const expiresAt = new Date();
        // The membership_type_id for 'pay-per-session' is assumed to be 1, this might need to be made more robust
        await db.execute(
            `INSERT INTO memberships (user_id, membership_type_id, expires_at, status)
       VALUES (?, 1, ?, 'pending')`, [userId, expiresAt.toISOString()]
        );


        res.status(201).json({
            message: "User created successfully",
            userId: userId,
        })
    } catch (error) {
        console.error("Register error:", error)
        res.status(500).json({ message: "Server error" })
    }
})

// Login
router.post("/login", async(req, res) => {
    try {
        const { username, password } = req.body

        const [users] = await db.execute('SELECT * FROM users WHERE username = ? AND status = "active"', [username])

        if (users.length === 0) {
            return res.status(401).json({ message: "Invalid credentials" })
        }

        const user = users[0]
        const isValidPassword = await bcrypt.compare(password, user.password)

        if (!isValidPassword) {
            return res.status(401).json({ message: "Invalid credentials" })
        }

        // Generate JWT token
        const token = jwt.sign({
                id: user.id,
                username: user.username,
                role: user.role,
            },
            JWT_SECRET, { expiresIn: "24h" },
        )

        // Remove password from response
        delete user.password

        res.json({
            token,
            user,
        })
    } catch (error) {
        console.error("Login error:", error)
        res.status(500).json({ message: "Server error" })
    }
})

// Forgot Password
router.post("/forgot-password", (req, res) => {
    const { email } = req.body

    // In a real app, you would send an email with reset link
    // For demo purposes, we'll just return success
    res.json({
        message: "Password reset email sent",
        email,
    })
})

module.exports = router