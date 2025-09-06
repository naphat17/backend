# Swimming Pool Management System API

Express.js API backend for the Swimming Pool Management System.

## 🚀 Quick Start

### 1. Install Dependencies
\`\`\`bash
cd api
npm install
\`\`\`

### 2. Initialize Database
สร้างฐานข้อมูลใน phpMyAdmin หรือ MySQL:

**วิธีที่ 1: ใช้ phpMyAdmin**
1. เปิด http://localhost/phpmyadmin
2. สร้างฐานข้อมูลใหม่ชื่อ `swimming_pool_db`
3. Import ไฟล์ `database/schema.sql` และ `database/sample_data.sql`

**วิธีที่ 2: ใช้ Command Line**
\`\`\`bash
mysql -u root -p < database/schema.sql
mysql -u root -p swimming_pool_db < database/sample_data.sql
\`\`\`

**วิธีที่ 3: ใช้ Script อัตโนมัติ**
\`\`\`bash
npm run init-db
\`\`\`

### 3. Start Development Server
\`\`\`bash
npm run dev
\`\`\`

The API will be running on `https://backend-l7q9.onrender.com`

## 📋 Sample Accounts

After running `npm run init-db`, you can use these accounts:

- **Admin**: `username=admin`, `password=admin123`
- **User**: `username=user1`, `password=user123`

## 🛠 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/forgot-password` - Forgot password

### User Routes
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `PUT /api/user/change-password` - Change password
- `GET /api/user/dashboard` - Get dashboard data

### Pools & Schedules
- `GET /api/pools/status` - Get pool status
- `GET /api/pool-schedule` - Get pool schedules

### Reservations
- `GET /api/reservations/user` - Get user reservations
- `POST /api/reservations` - Create reservation
- `DELETE /api/reservations/:id` - Cancel reservation
- `GET /api/reservations/available` - Get available time slots

### Memberships
- `GET /api/membership-types` - Get membership types
- `POST /api/memberships` - Purchase membership

### Payments
- `GET /api/payments/user` - Get user payments
- `GET /api/payments/:id/receipt` - Get payment receipt

### Admin Routes (Require Admin Role)
- `GET /api/admin/dashboard` - Admin dashboard
- `GET /api/admin/users` - Get all users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/reservations` - Get all reservations
- `POST /api/admin/reservations` - Create reservation
- `PUT /api/admin/reservations/:id` - Update reservation
- `GET /api/admin/pools` - Get all pools
- `POST /api/admin/pools` - Create pool
- `PUT /api/admin/pools/:id` - Update pool
- `GET /api/admin/payments` - Get all payments
- `PUT /api/admin/payments/:id/confirm` - Confirm payment
- `GET /api/admin/settings` - Get system settings
- `PUT /api/admin/settings` - Update system settings

## 🗄 Database Schema

The system uses SQLite with the following main tables:
- `users` - User accounts
- `membership_types` - Membership plans
- `memberships` - User memberships
- `pool_resources` - Swimming pools
- `pool_schedules` - Pool operating hours
- `reservations` - Pool reservations
- `payments` - Payment records
- `notifications` - User notifications
- `system_settings` - System configuration

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication:
1. Login with username/password
2. Receive JWT token
3. Include token in Authorization header: `Bearer <token>`

## 🛡 Security Features

- Password hashing with bcrypt
- JWT token authentication
- Role-based access control (User/Admin)
- SQL injection protection
- CORS configuration

## 📝 Environment Variables

Create a `.env` file with:
\`\`\`
# Server Configuration
PORT=3001
NODE_ENV=development

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# MySQL Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=swimming_pool_db
DB_PORT=3306

# CORS
CORS_ORIGIN=http://localhost:3000
\`\`\`

## 🔧 Development

- `npm run dev` - Start with nodemon (auto-restart)
- `npm start` - Start production server
- `npm run init-db` - Initialize/reset database
\`\`\`

## 🚀 การรันระบบ

### 1. รัน API Server
\`\`\`bash
cd api
npm install
npm run init-db
npm run dev
\`\`\`

### 2. รัน Frontend (Terminal ใหม่)
\`\`\`bash
npm run dev
\`\`\`

### 3. เข้าใช้งาน
- Frontend: `http://localhost:3000`
- API: `https://backend-l7q9.onrender.com`
- phpMyAdmin: `http://localhost/phpmyadmin`
- Health Check: `https://backend-l7q9.onrender.com/api/health`

## 📊 การจัดการฐานข้อมูลผ่าน phpMyAdmin

1. เปิด `http://localhost/phpmyadmin`
2. เลือกฐานข้อมูล `swimming_pool_db`
3. สามารถดู/แก้ไขข้อมูลในตารางต่างๆ ได้
4. ใช้ SQL tab สำหรับรัน query ที่ซับซ้อน

ระบบพร้อมใช้งานแล้วครับ! 🏊‍♂️✨
