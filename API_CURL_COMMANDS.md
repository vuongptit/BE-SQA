# Wallet API - cURL Commands

## Lưu ý
- Thay `YOUR_TOKEN` bằng JWT token thực tế
- Thay `http://localhost:5005` bằng URL server của bạn
- Tất cả API (trừ webhook) đều cần header `Authorization: Bearer YOUR_TOKEN`

---

## 1. Tạo yêu cầu nạp tiền (POST /api/wallet/deposit)

```bash
curl -X POST http://localhost:5005/api/wallet/deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "bankName": "ACB",
    "bankAccountName": "DAO TUNG LAM",
    "bankAccountNumber": "2291827",
    "amount": 77000
  }'
```

**Response mẫu:**
```json
{
  "success": true,
  "message": "Tạo yêu cầu nạp tiền thành công",
  "data": {
    "deposit_id": 1,
    "deposit_code": "ABCDEFGHIJKL",
    "deposit_status": "pending",
    "amount": 77000,
    "qr_base64": "iVBORw0KGgoAAAANSUhEUgAA..."
  }
}
```

---

## 2. Webhook từ SePay (POST /api/wallet/deposit/webhook)

**Lưu ý:** API này không cần token, được gọi tự động bởi SePay

```bash
curl -X POST http://localhost:5005/api/wallet/deposit/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "id": 92704,
    "gateway": "Vietcombank",
    "transactionDate": "2023-03-25 14:02:37",
    "accountNumber": "0123499999",
    "code": null,
    "content": "ABCDEFGHIJKL chuyen tien mua iphone",
    "transferType": "in",
    "transferAmount": 77000,
    "accumulated": 19077000,
    "subAccount": null,
    "referenceCode": "MBVCB.3278907687",
    "description": ""
  }'
```

---

## 3. Lấy danh sách deposit_history (GET /api/wallet/deposit-history)

**Lưu ý:** 
- User thường chỉ lấy được dữ liệu của chính mình (tự động filter theo user_id từ token)
- Chỉ Admin mới có thể filter theo `user_id` khác hoặc lấy tất cả (không truyền `user_id`)

### 3.1. User thường - Lấy dữ liệu của chính mình
```bash
curl -X GET "http://localhost:5005/api/wallet/deposit-history" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3.2. User thường - Với pagination và filter status
```bash
curl -X GET "http://localhost:5005/api/wallet/deposit-history?page=1&limit=20&sortBy=created_at&order=DESC&status=success" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3.3. Admin - Lấy tất cả (không filter user_id)
```bash
curl -X GET "http://localhost:5005/api/wallet/deposit-history?page=1&limit=20" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 3.4. Admin - Filter theo user_id cụ thể
```bash
curl -X GET "http://localhost:5005/api/wallet/deposit-history?user_id=1&page=1&limit=10" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 3.5. Filter theo khoảng thời gian
```bash
# Từ ngày 2024-01-01 đến 2024-01-31
curl -X GET "http://localhost:5005/api/wallet/deposit-history?fromDate=2024-01-01&toDate=2024-01-31&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3.6. Filter theo khoảng số tiền
```bash
# Từ 50000 đến 200000
curl -X GET "http://localhost:5005/api/wallet/deposit-history?minAmount=50000&maxAmount=200000&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3.7. Filter theo ngân hàng
```bash
curl -X GET "http://localhost:5005/api/wallet/deposit-history?bankName=ACB&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3.8. Filter theo loại nạp tiền
```bash
curl -X GET "http://localhost:5005/api/wallet/deposit-history?deposit_type=bank&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3.9. Admin - Kết hợp nhiều filter
```bash
curl -X GET "http://localhost:5005/api/wallet/deposit-history?status=success&user_id=1&fromDate=2024-01-01&toDate=2024-01-31&minAmount=50000&maxAmount=200000&bankName=ACB&deposit_type=bank&page=1&limit=10&sortBy=deposit_amount&order=ASC" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Response mẫu:**
```json
{
  "success": true,
  "message": "Lấy danh sách lịch sử nạp tiền thành công",
  "data": {
    "deposits": [
      {
        "id": 1,
        "user_id": 1,
        "bankName": "ACB",
        "bankAccountName": "DAO TUNG LAM",
        "bankAccountNumber": "2291827",
        "deposit_status": "success",
        "deposit_code": "ABCDEFGHIJKL",
        "deposit_type": "bank",
        "deposit_amount": "77000.0000",
        "created_at": "2023-03-25T14:02:37.000Z",
        "user": {
          "id": 1,
          "fullName": "Nguyen Van A",
          "email": "user@example.com"
        }
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

---

## 4. Lấy danh sách withdrawn_history (GET /api/wallet/withdraw-history)

**Lưu ý:** 
- User thường chỉ lấy được dữ liệu của chính mình (tự động filter theo user_id từ token)
- Chỉ Admin mới có thể filter theo `user_id` khác hoặc lấy tất cả (không truyền `user_id`)

### 4.1. User thường - Lấy dữ liệu của chính mình
```bash
curl -X GET "http://localhost:5005/api/wallet/withdraw-history" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4.2. User thường - Với pagination và filter status
```bash
curl -X GET "http://localhost:5005/api/wallet/withdraw-history?page=1&limit=20&status=pending" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4.3. Filter theo khoảng thời gian
```bash
curl -X GET "http://localhost:5005/api/wallet/withdraw-history?fromDate=2024-01-01&toDate=2024-01-31&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4.4. Filter theo khoảng số tiền
```bash
curl -X GET "http://localhost:5005/api/wallet/withdraw-history?minAmount=50000&maxAmount=200000&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4.5. Filter theo ngân hàng
```bash
curl -X GET "http://localhost:5005/api/wallet/withdraw-history?bankName=VCB&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4.6. Admin - Kết hợp nhiều filter
```bash
curl -X GET "http://localhost:5005/api/wallet/withdraw-history?status=pending&user_id=1&fromDate=2024-01-01&toDate=2024-01-31&minAmount=50000&maxAmount=200000&bankName=VCB&page=1&limit=20" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Response mẫu:**
```json
{
  "success": true,
  "message": "Lấy danh sách lịch sử rút tiền thành công",
  "data": {
    "withdraws": [
      {
        "id": 1,
        "user_id": 1,
        "bankName": "VCB",
        "bankNoaccount": "1234567890",
        "amount": "50000.0000",
        "status": "pending",
        "created_at": "2023-03-25T14:02:37.000Z",
        "user": {
          "id": 1,
          "fullName": "Nguyen Van A",
          "email": "user@example.com"
        }
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

---

## 5. Lấy danh sách transactions_history (GET /api/wallet/transaction-history)

**Lưu ý:** 
- User thường chỉ lấy được dữ liệu của chính mình (tự động filter theo user_id từ token)
- Chỉ Admin mới có thể filter theo `user_id` khác hoặc lấy tất cả (không truyền `user_id`)

### 5.1. User thường - Lấy dữ liệu của chính mình
```bash
curl -X GET "http://localhost:5005/api/wallet/transaction-history" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5.2. User thường - Filter theo transactionType và transactionStatus
```bash
curl -X GET "http://localhost:5005/api/wallet/transaction-history?transactionType=deposit&transactionStatus=success&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5.3. Admin - Lấy tất cả (không filter user_id)
```bash
curl -X GET "http://localhost:5005/api/wallet/transaction-history?page=1&limit=20" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 5.4. Admin - Filter theo user_id cụ thể
```bash
curl -X GET "http://localhost:5005/api/wallet/transaction-history?user_id=1&page=1&limit=10" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 5.5. Filter theo khoảng thời gian
```bash
curl -X GET "http://localhost:5005/api/wallet/transaction-history?fromDate=2024-01-01&toDate=2024-01-31&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5.6. Filter theo khoảng số tiền
```bash
curl -X GET "http://localhost:5005/api/wallet/transaction-history?minAmount=50000&maxAmount=200000&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5.7. Filter theo loại chuyển khoản
```bash
curl -X GET "http://localhost:5005/api/wallet/transaction-history?transferType=bank&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5.8. Admin - Kết hợp nhiều filter
```bash
curl -X GET "http://localhost:5005/api/wallet/transaction-history?transactionType=deposit&transactionStatus=success&user_id=1&fromDate=2024-01-01&toDate=2024-01-31&minAmount=50000&maxAmount=200000&transferType=bank&page=1&limit=20&sortBy=amount&order=DESC" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Response mẫu:**
```json
{
  "success": true,
  "message": "Lấy danh sách lịch sử giao dịch thành công",
  "data": {
    "transactions": [
      {
        "id": 1,
        "user_id": 1,
        "transactionType": "deposit",
        "referenceId": 1,
        "amount": "77000.0000",
        "beforeBalance": "100000.0000",
        "afterBalance": "177000.0000",
        "transactionStatus": "success",
        "transferType": "bank",
        "created_at": "2023-03-25T14:02:37.000Z",
        "user": {
          "id": 1,
          "fullName": "Nguyen Van A",
          "email": "user@example.com"
        }
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

---

## 6. Admin cộng tiền cho user (POST /api/wallet/admin/add-balance)

**Lưu ý:** Chỉ admin/superadmin mới có quyền sử dụng API này

```bash
curl -X POST http://localhost:5005/api/wallet/admin/add-balance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "user_id": 1,
    "amount": 100000,
    "note": "Cộng tiền thưởng"
  }'
```

**Response mẫu:**
```json
{
  "success": true,
  "message": "Cộng tiền thành công",
  "data": {
    "user_id": 1,
    "amount_added": 100000,
    "before_balance": "177000.0000",
    "after_balance": "277000.0000"
  }
}
```

---

## Query Parameters Reference

### Pagination
- `page` (default: 1) - Số trang
- `limit` (default: 10) - Số bản ghi mỗi trang
- `sortBy` (default: 'created_at') - Trường để sắp xếp
- `order` (default: 'DESC') - Thứ tự sắp xếp (ASC/DESC)

### Filter cho deposit_history
- `status` - Filter theo trạng thái: 'pending', 'success', 'failed'
- `user_id` - **(Chỉ Admin)** Filter theo ID người dùng. User thường tự động filter theo user_id từ token (không cần truyền)
- `fromDate` - Ngày bắt đầu (format: YYYY-MM-DD, ví dụ: 2024-01-01)
- `toDate` - Ngày kết thúc (format: YYYY-MM-DD, ví dụ: 2024-01-31)
- `minAmount` - Số tiền tối thiểu
- `maxAmount` - Số tiền tối đa
- `bankName` - Filter theo tên ngân hàng (ví dụ: 'ACB', 'VCB', 'Vietcombank')
- `deposit_type` - Filter theo loại nạp tiền (ví dụ: 'bank', 'manual')

### Filter cho withdraw_history
- `status` - Filter theo trạng thái: 'pending', 'success', 'failed'
- `user_id` - **(Chỉ Admin)** Filter theo ID người dùng. User thường tự động filter theo user_id từ token (không cần truyền)
- `fromDate` - Ngày bắt đầu (format: YYYY-MM-DD)
- `toDate` - Ngày kết thúc (format: YYYY-MM-DD)
- `minAmount` - Số tiền tối thiểu
- `maxAmount` - Số tiền tối đa
- `bankName` - Filter theo tên ngân hàng

### Filter cho transaction_history
- `transactionType` - Filter theo loại: 'deposit', 'withdraw', 'purchase', 'adjustment'
- `transactionStatus` - Filter theo trạng thái: 'pending', 'success', 'failed'
- `user_id` - **(Chỉ Admin)** Filter theo ID người dùng. User thường tự động filter theo user_id từ token (không cần truyền)
- `fromDate` - Ngày bắt đầu (format: YYYY-MM-DD)
- `toDate` - Ngày kết thúc (format: YYYY-MM-DD)
- `minAmount` - Số tiền tối thiểu
- `maxAmount` - Số tiền tối đa
- `transferType` - Filter theo loại chuyển khoản (ví dụ: 'bank', 'admin_adjustment')

---

## Ví dụ sử dụng trong PowerShell (Windows)

```powershell
# Tạo yêu cầu nạp tiền
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer YOUR_TOKEN"
}
$body = @{
    bankName = "ACB"
    bankAccountName = "DAO TUNG LAM"
    bankAccountNumber = "2291827"
    amount = 77000
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5005/api/wallet/deposit" -Method POST -Headers $headers -Body $body

# Lấy danh sách deposit history
$headers = @{
    "Authorization" = "Bearer YOUR_TOKEN"
}
Invoke-RestMethod -Uri "http://localhost:5005/api/wallet/deposit-history?page=1&limit=10" -Method GET -Headers $headers
```

