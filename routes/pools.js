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

// Get pool availability for a specific date
router.get("/availability", async(req, res) => {
    try {
        const { date, pool_id } = req.query
        
        if (!date) {
            return res.status(400).json({ message: "Date parameter is required" })
        }
        
        // Get pool capacity
        let poolQuery = "SELECT id, name, capacity FROM pool_resources WHERE status = 'available'"
        let poolParams = []
        
        if (pool_id) {
            poolQuery += " AND id = ?"
            poolParams.push(pool_id)
        }
        
        const [pools] = await db.execute(poolQuery, poolParams)
        
        if (pools.length === 0) {
            return res.json({ isFull: true, message: "ไม่พบสระที่ใช้งานได้" })
        }
        
        // Check reservations for the specified date
        const reservationQuery = `
            SELECT pool_resource_id, COUNT(*) as reservation_count
            FROM reservations 
            WHERE reservation_date = ? AND status IN ('pending', 'confirmed')
            ${pool_id ? 'AND pool_resource_id = ?' : ''}
            GROUP BY pool_resource_id
        `
        
        let reservationParams = [date]
        if (pool_id) {
            reservationParams.push(pool_id)
        }
        
        const [reservations] = await db.execute(reservationQuery, reservationParams)
        
        // Check if any pool is full
        let isFull = false
        let message = ""
        
        for (const pool of pools) {
            const reservation = reservations.find(r => r.pool_resource_id === pool.id)
            const currentReservations = reservation ? reservation.reservation_count : 0
            
            if (currentReservations >= pool.capacity) {
                isFull = true
                message = `สระ ${pool.name} เต็มแล้วสำหรับวันที่ ${date} กรุณาเลือกวันอื่น`
                break
            }
        }
        
        if (!isFull && pools.length > 0) {
            message = "มีที่ว่างสำหรับการจอง"
        }
        
        res.json({ 
            isFull, 
            message,
            pools: pools.map(pool => {
                const reservation = reservations.find(r => r.pool_resource_id === pool.id)
                const currentReservations = reservation ? reservation.reservation_count : 0
                return {
                    id: pool.id,
                    name: pool.name,
                    capacity: pool.capacity,
                    currentReservations,
                    available: pool.capacity - currentReservations
                }
            })
        })
    } catch (error) {
        console.error("Error checking pool availability:", error)
        res.status(500).json({ message: "Database error" })
    }
})

// Get booking statistics for a specific pool and month
router.get("/:id/bookings/stats", async(req, res) => {
    try {
        const poolId = req.params.id
        const { year, month } = req.query
        
        if (!year || !month) {
            return res.status(400).json({ message: "Year and month parameters are required" })
        }
        
        // Validate pool exists
        const [pools] = await db.execute(
            "SELECT id, name, capacity FROM pool_resources WHERE id = ?",
            [poolId]
        )
        
        if (pools.length === 0) {
            return res.status(404).json({ message: "Pool not found" })
        }
        
        const pool = pools[0]
        
        // Get booking statistics for the month
        const query = `
            SELECT 
                DATE(reservation_date) as date,
                COUNT(*) as total_bookings,
                ? - COUNT(*) as available_slots
            FROM reservations 
            WHERE pool_resource_id = ? 
                AND YEAR(reservation_date) = ? 
                AND MONTH(reservation_date) = ?
                AND status IN ('pending', 'confirmed')
            GROUP BY DATE(reservation_date)
            ORDER BY date
        `
        
        const [stats] = await db.execute(query, [pool.capacity, poolId, year, month])
        
        res.json({ 
            pool_id: parseInt(poolId),
            pool_name: pool.name,
            capacity: pool.capacity,
            year: parseInt(year),
            month: parseInt(month),
            stats: stats || []
        })
    } catch (error) {
        console.error("Error getting booking stats:", error)
        res.status(500).json({ message: "Database error" })
    }
})

module.exports = router