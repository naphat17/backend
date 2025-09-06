const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const multer = require("multer")
const path = require("path")
const db = require("../config/database")

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

// Configure multer for handling multipart/form-data
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '..', 'uploads', 'profiles')
        cb(null, uploadPath)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        const fileExtension = path.extname(file.originalname)
        cb(null, uniqueSuffix + fileExtension)
    }
})
const upload = multer({ storage: storage })

// Register
router.post("/register", upload.single('profile_photo'), async(req, res) => {
    try {
        const { 
            username, email, password, first_name, last_name, phone, address, 
            date_of_birth, id_card, user_category_id, organization, age, gender,
            medical_condition, emergency_contact_name, emergency_contact_relationship, 
            emergency_contact_phone 
        } = req.body
        
        // จัดการไฟล์รูปภาพที่อัปโหลด
        const profilePhotoPath = req.file ? req.file.filename : null

        // Validate required fields
        if (!username || !email || !password || !first_name || !last_name) {
            return res.status(400).json({ message: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน" })
        }

        // Check if user exists
        const [existingUsers] = await db.execute("SELECT id FROM users WHERE username = ? OR email = ?", [username, email])
        if (existingUsers.length > 0) {
            return res.status(400).json({ message: "ชื่อผู้ใช้หรืออีเมลนี้มีอยู่ในระบบแล้ว" })
        }

        // Check if ID card already exists
        if (id_card) {
            const [existingIdCard] = await db.execute("SELECT id FROM users WHERE id_card = ?", [id_card])
            if (existingIdCard.length > 0) {
                return res.status(400).json({ message: "เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว" })
            }
        }

        // Check if first name and last name combination already exists
        const [existingName] = await db.execute("SELECT id FROM users WHERE first_name = ? AND last_name = ?", [first_name, last_name])
        if (existingName.length > 0) {
            return res.status(400).json({ message: "ชื่อและนามสกุลนี้มีอยู่ในระบบแล้ว" })
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10)
        
        // Generate member number: SP + ปีปัจจุบัน + เลขลำดับ 4 หลัก
        const currentYear = new Date().getFullYear()
        const [countResult] = await db.execute("SELECT COUNT(*) as count FROM users")
        const memberCount = countResult[0].count + 1
        const memberNumber = `SP${currentYear}${memberCount.toString().padStart(4, '0')}`

        // Insert user with gender column and member_number
        const [result] = await db.execute(
            `INSERT INTO users (member_number, username, email, password, first_name, last_name, phone, address, date_of_birth, id_card, user_category_id, organization, age, gender, medical_condition, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, profile_photo, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'user', 'active')`, 
            [memberNumber, username, email, hashedPassword, first_name, last_name, phone || null, address || null, date_of_birth || null, id_card || null, user_category_id || null, organization || null, age || null, gender || null, medical_condition || null, emergency_contact_name || null, emergency_contact_relationship || null, emergency_contact_phone || null, profilePhotoPath],
        )

        const userId = result.insertId

        // Create a default 'pay-per-session' membership for the new user
        // We'll use a placeholder expiry date for now, as it will be updated upon first payment.
        const expiresAt = new Date();
        // Format date for MySQL DATETIME format (YYYY-MM-DD HH:MM:SS)
        const mysqlDateTime = expiresAt.toISOString().slice(0, 19).replace('T', ' ');
        // The membership_type_id for 'pay-per-session' is assumed to be 1, this might need to be made more robust
        await db.execute(
            `INSERT INTO memberships (user_id, membership_type_id, expires_at, status)
       VALUES (?, 1, ?, 'pending')`, [userId, mysqlDateTime]
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