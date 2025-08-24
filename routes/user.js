const express = require("express")
const bcrypt = require("bcryptjs")
const multer = require("multer")
const { CloudinaryStorage } = require("multer-storage-cloudinary")
const cloudinary = require("cloudinary").v2
const db = require("../config/database")
const { authenticateToken } = require("../middleware/auth")

const router = express.Router()

// Cloudinary config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Configure multer for profile photo uploads to Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "profiles",
        format: async (req, file) => "png",
        public_id: (req, file) => `profile_${req.user.id}_${Date.now()}`,
    },
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed!'), false)
    }
  }
})

// Get user profile
router.get("/profile", authenticateToken, async(req, res) => {
    try {
        const [users] = await db.execute(
            "SELECT id, username, email, first_name, last_name, phone, address, date_of_birth, id_card, organization, age, medical_condition, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, profile_photo, role, status, created_at, member_number FROM users WHERE id = ?", [req.user.id],
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
        const { 
            first_name, 
            last_name, 
            phone, 
            address, 
            date_of_birth, 
            id_card, 
            organization, 
            age, 
            medical_condition, 
            emergency_contact_name, 
            emergency_contact_relationship, 
            emergency_contact_phone 
        } = req.body

        await db.execute(
            "UPDATE users SET first_name = ?, last_name = ?, phone = ?, address = ?, date_of_birth = ?, id_card = ?, organization = ?, age = ?, medical_condition = ?, emergency_contact_name = ?, emergency_contact_relationship = ?, emergency_contact_phone = ? WHERE id = ?", 
            [
                first_name,
                last_name,
                phone,
                address,
                date_of_birth,
                id_card,
                organization,
                age,
                medical_condition,
                emergency_contact_name,
                emergency_contact_relationship,
                emergency_contact_phone,
                req.user.id,
            ]
        )

        res.json({ message: "Profile updated successfully" })
    } catch (error) {
        console.error("Update profile error:", error)
        res.status(500).json({ message: "Failed to update profile" })
    }
})

// Upload profile photo
router.post("/profile/upload-photo", authenticateToken, upload.single('profile_photo'), async(req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" })
        }

        // Get the Cloudinary URL
        const photoUrl = req.file.path // Cloudinary URL

        // Update user's profile_photo in database
        await db.execute(
            "UPDATE users SET profile_photo = ? WHERE id = ?",
            [photoUrl, req.user.id]
        )

        res.json({ 
            message: "Profile photo uploaded successfully",
            profile_photo: photoUrl
        })
    } catch (error) {
        console.error("Upload photo error:", error)
        res.status(500).json({ message: "Failed to upload photo" })
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
            `SELECT mt.name as type, m.expires_at, m.status, m.membership_type_id
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
                membership_type_id: membershipData.membership_type_id, // Ensure this is included
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
                membership_type_id: null, // No membership type ID for inactive membership
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