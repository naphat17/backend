const mysql = require("mysql2/promise")

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "swimming_pool_db",
  port: process.env.DB_PORT || 3306,
  charset: "utf8mb4",
  timezone: "+07:00",
}

// Create connection pool
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

// Test connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection()
    console.log("🗄️  Connected to MySQL database")
    connection.release()
  } catch (error) {
    console.error("❌ Database connection failed:", error.message)
    process.exit(1)
  }
}

testConnection()

module.exports = pool
