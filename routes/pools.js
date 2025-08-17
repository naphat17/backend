const express = require("express")
const db = require("../config/database")
const { authenticateToken } = require("../middleware/auth")

const router = express.Router()

// Get pool status (public)
router.get("/status", async(req, res) => {
    try {
        const [pools] = await db.execute("SELECT id, name, description, capacity, status FROM pool_resources ORDER BY name")
        res.json({ pools: pools || [] })
    } catch (err) {
        res.status(500).json({ message: "Database error" })
    }
})

// Get pool schedules (public)
router.get("/", async(req, res) => {
    try {
        const [rows] = await db.execute(
                `SELECT pr.id, pr.name, pr.description, pr.capacity, pr.status,
              ps.day_of_week, ps.open_time, ps.close_time, ps.is_active
       FROM pool_resources pr
       LEFT JOIN pool_schedules ps ON pr.id = ps.pool_resource_id
       ORDER BY pr.name, ps.day_of_week`
            )
            // Group schedules by pool
        const poolsMap = {}
        rows.forEach((row) => {
            if (!poolsMap[row.id]) {
                poolsMap[row.id] = {
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    capacity: row.capacity,
                    status: row.status,
                    schedules: [],
                }
            }
            if (row.day_of_week) {
                poolsMap[row.id].schedules.push({
                    day_of_week: row.day_of_week,
                    open_time: row.open_time,
                    close_time: row.close_time,
                    is_active: row.is_active,
                })
            }
        })
        const schedules = Object.values(poolsMap)
        res.json({ schedules })
    } catch (err) {
        res.status(500).json({ message: "Database error" })
    }
})

module.exports = router