ตัวอย่าง **request/response** สำหรับ endpoint ระบบตู้เก็บของ (user + admin) ที่เพิ่งเพิ่มให้:

---

## USER

### 1. ดูรายการตู้เก็บของทั้งหมด  
**GET /api/lockers**

**Request:**  
```
GET /api/lockers
GET /api/lockers?status=available
```

**Response:**
```json
{
  "lockers": [
    { "id": 1, "code": "L01", "location": "โซน A", "status": "available", "created_at": "...", "updated_at": "..." },
    ...
  ]
}
```

---

### 2. ดูสถานะตู้เก็บของรายตัว  
**GET /api/lockers/:id**

**Request:**  
```
GET /api/lockers/1
```

**Response:**
```json
{
  "locker": { "id": 1, "code": "L01", "location": "โซน A", "status": "available", "created_at": "...", "updated_at": "..." }
}
```

---

### 3. จองตู้เก็บของ  
**POST /api/lockers/reserve**  
**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "locker_id": 1,
  "reservation_date": "2024-07-01",
  "start_time": "08:00:00",
  "end_time": "10:00:00",
  "notes": "ใช้เก็บของว่ายน้ำ"
}
```

**Response:**
```json
{
  "message": "Locker reserved successfully",
  "reservation_id": 123
}
```

---

### 4. ดูรายการจองตู้เก็บของของตัวเอง  
**GET /api/lockers/my-reservations**  
**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "reservations": [
    {
      "id": 123,
      "locker_id": 1,
      "locker_code": "L01",
      "location": "โซน A",
      "reservation_date": "2024-07-01",
      "start_time": "08:00:00",
      "end_time": "10:00:00",
      "status": "pending",
      "notes": "ใช้เก็บของว่ายน้ำ",
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

---

### 5. ยกเลิกการจองของตัวเอง  
**DELETE /api/lockers/my-reservations/:id**  
**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{ "message": "Reservation cancelled successfully" }
```

---

## ADMIN

### 1. ดูรายการจองตู้เก็บของทั้งหมด  
**GET /api/admin/locker-reservations**

**Response:**
```json
{
  "reservations": [
    {
      "id": 123,
      "user_id": 2,
      "username": "user1",
      "locker_id": 1,
      "locker_code": "L01",
      "location": "โซน A",
      "reservation_date": "2024-07-01",
      "start_time": "08:00:00",
      "end_time": "10:00:00",
      "status": "pending",
      "notes": "ใช้เก็บของว่ายน้ำ",
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

---

### 2. อนุมัติ/ปฏิเสธการจอง  
**PUT /api/admin/locker-reservations/:id/confirm**

**Request:**
```json
{ "status": "confirmed" } // หรือ "rejected"
```

**Response:**
```json
{ "message": "Reservation confirmed successfully" }
```
หรือ
```json
{ "message": "Reservation rejected successfully" }
```

---

### 3. ลบ locker reservation  
**DELETE /api/admin/locker-reservations/:id**

**Response:**
```json
{ "message": "Reservation deleted successfully" }
```

---

### 4. สร้าง locker  
**POST /api/admin/lockers**

**Request:**
```json
{ "code": "L51", "location": "โซน B", "status": "available" }
```

**Response:**
```json
{ "message": "Locker created successfully", "locker_id": 51 }
```

---

### 5. แก้ไข locker  
**PUT /api/admin/lockers/:id**

**Request:**
```json
{ "location": "โซน C", "status": "maintenance" }
```

**Response:**
```json
{ "message": "Locker updated successfully" }
```

---

### 6. ลบ locker  
**DELETE /api/admin/lockers/:id**

**Response:**
```json
{ "message": "Locker deleted successfully" }
```

---

หากต้องการตัวอย่าง request/response เพิ่มเติม หรือรายละเอียด field อื่น ๆ แจ้งได้เลย!