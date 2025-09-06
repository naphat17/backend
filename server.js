const express = require("express")
const cors = require("cors")
const path = require("path")
require("dotenv").config()
const multer = require("multer")

const authRoutes = require("./routes/auth")
const userRoutes = require("./routes/user")
const adminRoutes = require("./routes/admin")
const poolRoutes = require("./routes/pools")
const reservationRoutes = require("./routes/reservations")
const membershipRoutes = require("./routes/memberships")
const paymentRoutes = require("./routes/payments")
const lockersRoutes = require("./routes/lockers")
const settingsRoutes = require("./routes/settings")

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Static path สำหรับ slip (legacy support)
const slipsPath = path.join(__dirname, "public", "slips")
app.use("/slips", express.static(slipsPath))

// Static path สำหรับ profile uploads
const uploadsPath = path.join(__dirname, "uploads", "profiles")
app.use("/uploads/profiles", express.static(uploadsPath))

// Note: Profile uploads now use local storage

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/user", userRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/pools", poolRoutes)
app.use("/api/reservations", reservationRoutes)
app.use("/api/memberships", membershipRoutes)
app.use("/api/membership-types", membershipRoutes)
app.use("/api/payments", paymentRoutes)
app.use("/api/pool-schedule", poolRoutes)
app.use("/api/lockers", lockersRoutes)
app.use("/api/settings", settingsRoutes)

// Health check
app.get("/api/health", (req, res) => {
    res.json({ status: "OK", message: "Swimming Pool API is running" })
})

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).json({ message: "Something went wrong!" })
})

// 404 handler
app.use("*", (req, res) => {
    res.status(404).json({ message: "Route not found" })
})

app.listen(PORT, () => {
    console.log(`🏊‍♂️ Swimming Pool API Server running on port ${PORT}`)
    console.log(`📍 Health check: http://localhost:${PORT}/api/health`)
    console.log(`🔑 JWT_SECRET used: ${process.env.JWT_SECRET ? 'Loaded' : 'Not Loaded or using default'}`)
})