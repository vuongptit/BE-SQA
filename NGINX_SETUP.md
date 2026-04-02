# Hướng dẫn cấu hình Nginx Reverse Proxy cho Be-Quiz-Sys

## Yêu cầu
- Nginx đã được cài đặt trên server
- Node.js application đang chạy trên port 5005 (hoặc port được cấu hình trong biến môi trường PORT)

## Các bước cài đặt

### 1. Copy file cấu hình vào Nginx

```bash
# Copy file cấu hình vào sites-available
sudo cp nginx.conf /etc/nginx/sites-available/be-quiz-sys

# Tạo symlink để enable site
sudo ln -s /etc/nginx/sites-available/be-quiz-sys /etc/nginx/sites-enabled/

# Hoặc nếu muốn dùng file cấu hình chính
sudo cp nginx.conf /etc/nginx/conf.d/be-quiz-sys.conf
```

### 2. Chỉnh sửa cấu hình

Mở file cấu hình và thay đổi các giá trị sau:

```bash
sudo nano /etc/nginx/sites-available/be-quiz-sys
```

**Các thay đổi cần thiết:**

1. **Domain name:**
   ```nginx
   server_name your-domain.com www.your-domain.com;
   ```
   Thay `your-domain.com` bằng domain thực tế của bạn, hoặc dùng `_` nếu chưa có domain:
   ```nginx
   server_name _;
   ```

2. **Đường dẫn uploads:**
   ```nginx
   location /uploads/ {
       alias /path/to/Be-Quiz-Sys/public/uploads/;
   ```
   Thay `/path/to/Be-Quiz-Sys/public/uploads/` bằng đường dẫn thực tế, ví dụ:
   ```nginx
   alias /home/user/Be-Quiz-Sys/public/uploads/;
   ```

3. **Port của Node.js (nếu khác 5005):**
   ```nginx
   upstream be_quiz_backend {
       server 127.0.0.1:5005;  # Thay đổi nếu cần
   }
   ```

### 3. Kiểm tra cấu hình Nginx

```bash
# Kiểm tra syntax
sudo nginx -t

# Nếu có lỗi, sửa lại file cấu hình
# Nếu thành công, bạn sẽ thấy:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 4. Tạo thư mục log (nếu chưa có)

```bash
sudo mkdir -p /var/log/nginx
sudo chown www-data:www-data /var/log/nginx
```

### 5. Khởi động lại Nginx

```bash
# Reload cấu hình (không downtime)
sudo systemctl reload nginx

# Hoặc restart
sudo systemctl restart nginx

# Kiểm tra status
sudo systemctl status nginx
```

### 6. Cấu hình firewall (nếu cần)

```bash
# Cho phép HTTP và HTTPS
sudo ufw allow 'Nginx Full'
# hoặc
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## Cấu hình SSL/HTTPS (Let's Encrypt)

### Sử dụng Certbot:

```bash
# Cài đặt Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Lấy SSL certificate tự động
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Certbot sẽ tự động cấu hình Nginx và renew certificate
```

Sau khi có SSL, uncomment phần HTTPS trong file `nginx.conf`.

## Load Balancing (nếu chạy nhiều instance)

Nếu bạn chạy nhiều instance Node.js, uncomment dòng thứ 2 trong upstream:

```nginx
upstream be_quiz_backend {
    server 127.0.0.1:5005;
    server 127.0.0.1:5006;  # Instance thứ 2
    keepalive 64;
}
```

## Kiểm tra hoạt động

1. **Kiểm tra health check:**
   ```bash
   curl http://your-domain.com/health
   # Kết quả: healthy
   ```

2. **Kiểm tra API:**
   ```bash
   curl http://your-domain.com/api/auth/signin
   ```

3. **Kiểm tra uploads:**
   ```bash
   curl http://your-domain.com/uploads/test.png
   ```

## Troubleshooting

### Lỗi 502 Bad Gateway
- Kiểm tra Node.js app có đang chạy không: `ps aux | grep node`
- Kiểm tra port: `netstat -tulpn | grep 5005`
- Kiểm tra logs: `sudo tail -f /var/log/nginx/be-quiz-error.log`

### Lỗi 403 Forbidden
- Kiểm tra quyền truy cập thư mục uploads: `ls -la /path/to/Be-Quiz-Sys/public/uploads/`
- Đảm bảo Nginx có quyền đọc: `sudo chmod -R 755 /path/to/Be-Quiz-Sys/public/uploads/`

### Lỗi 413 Request Entity Too Large
- Tăng `client_max_body_size` trong nginx.conf nếu cần upload file lớn hơn

### Xem logs
```bash
# Access logs
sudo tail -f /var/log/nginx/be-quiz-access.log

# Error logs
sudo tail -f /var/log/nginx/be-quiz-error.log

# Nginx error log chung
sudo tail -f /var/log/nginx/error.log
```

## Tối ưu hóa

### 1. Enable gzip compression
Thêm vào block `server`:
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
```

### 2. Cache static files
Đã được cấu hình trong location `/uploads/` với `expires 30d`

### 3. Rate limiting (chống DDoS)
Thêm vào block `server`:
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    # ... các cấu hình khác
}
```

## Lưu ý

- Đảm bảo Node.js app chạy với process manager như PM2 để tự động restart
- Cấu hình firewall để chỉ mở port 80, 443 và đóng port 5005 (chỉ cho phép localhost)
- Thường xuyên cập nhật Nginx và SSL certificates
- Backup file cấu hình trước khi thay đổi


