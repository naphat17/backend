const mysql = require("mysql2/promise")
const fs = require("fs").promises
const path = require("path")
require("dotenv").config()

const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    port: process.env.DB_PORT || 3306,
    multipleStatements: true, // Allow multiple SQL statements
}

const DB_NAME = process.env.DB_NAME || "swimming_pool_db";

const initDatabase = async() => {
    let connection;

    try {
        console.log("🔧 Initializing MySQL database...");

        // Connect to MySQL server (without specifying a database)
        connection = await mysql.createConnection(dbConfig);
        console.log("✅ Connected to MySQL server");

        // Drop the database if it exists, then create it
        console.log(`💧 Dropping database \`${DB_NAME}\` if it exists...`);
        await connection.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
        console.log(`✨ Creating database \`${DB_NAME}\`...`);
        await connection.query(`CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        console.log("✅ Database created.");

        // Switch to the newly created database
        await connection.changeUser({ database: DB_NAME });
        console.log(`✅ Switched to database \`${DB_NAME}\``);

        // Read and execute the schema file
        const schemaPath = path.join(__dirname, "../database/schema.sql");
        const schema = await fs.readFile(schemaPath, "utf8");
        // Remove comments and split statements to execute them one by one
        const schemaStatements = schema.replace(/--.*$/gm, '').split(';').filter(query => query.trim());
        console.log("🏗️ Creating tables from schema.sql...");
        for (const statement of schemaStatements) {
            await connection.query(statement);
        }
        console.log("✅ Database schema created successfully.");

        // Read and execute the sample data file
        const sampleDataPath = path.join(__dirname, "../database/sample_data.sql");
        const sampleData = await fs.readFile(sampleDataPath, "utf8");
        const sampleDataStatements = sampleData.replace(/--.*$/gm, '').split(';').filter(query => query.trim());
        console.log("📊 Inserting sample data from sample_data.sql...");
        for (const statement of sampleDataStatements) {
            await connection.query(statement);
        }
        console.log("✅ Sample data inserted successfully.");

        console.log("\n🎉 Database initialization completed!");
        console.log("\n🚀 You can now start the API and frontend servers.");

    } catch (error) {
        console.error("❌ Database initialization failed:", error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

initDatabase();