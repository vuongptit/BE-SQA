# Tài Liệu Giải Thích Chức Năng Làm Bài Thi

## Tổng Quan

Hệ thống quản lý bài thi với các chức năng chính:
- **Bắt đầu làm bài thi** (Start Exam)
- **Trả lời câu hỏi** (Answer Questions)
- **Nộp bài thi** (Submit Exam)
- **Xem kết quả** (View Results)
- **Tính điểm tự động** (Auto Grading)

---

## 1. BẮT ĐẦU LÀM BÀI THI (Start Exam)

### API Endpoint
```
POST /api/exams/:exam_id/start
```
**Middleware**: `verifyToken`, `verifyStudent`

### Quy Trình Chi Tiết

#### Bước 1: Kiểm tra quyền truy cập
- Kiểm tra exam có tồn tại không
- Kiểm tra exam có `is_public = true` không
- Nếu exam thuộc class (`class_id`), kiểm tra student có là thành viên của class không
- Kiểm tra thời gian exam (nếu có `start_time` và `end_time`)

#### Bước 2: Kiểm tra session đang tồn tại
- Tìm session có `status = 'in_progress'` của student cho exam này
- Nếu có session đang active và chưa hết thời gian → trả về session đó (không tạo mới)
- Nếu session đã hết thời gian → cập nhật `status = 'expired'`

#### Bước 3: Xử lý thanh toán (nếu exam trả phí)
- Nếu `exam.is_paid = true`:
  - Kiểm tra số dư của student
  - Trừ tiền từ balance của student (toàn bộ `exam.fee`)
  - Tạo bản ghi `ExamPurchase` với `purchase_price = exam.fee * 0.8` (80% cho teacher)
  - Cộng tiền cho teacher: `teacher.balance += exam.fee * 0.8`
  - Tạo transaction history cho cả student và teacher

#### Bước 4: Tạo Exam Session mới
- Tạo `ExamSession` với:
  - `start_time`: Thời điểm hiện tại
  - `end_time`: `start_time + exam.minutes * 60000` (milliseconds)
  - `status`: `'in_progress'`
  - `code`: Mã session unique (10 ký tự)
  - `total_score`: `null` (chưa có điểm)

#### Bước 5: Cập nhật tracking
- Tăng `exam.count` (số lượt tham gia)
- Cập nhật `StudentExamStatus`:
  - Nếu lần đầu: `status = 'in_progress'`, `first_attempt_at = now`
  - Nếu đã từng làm: `status = 'in_progress'`, `current_session_id = session_id`

### Response
```json
{
  "message": "Exam session started successfully",
  "session": {
    "id": 1,
    "exam_id": 1,
    "student_id": 1,
    "code": "ABC123XYZ",
    "start_time": "2024-01-01T10:00:00Z",
    "end_time": "2024-01-01T11:00:00Z",
    "status": "in_progress",
    "exam": {
      "id": 1,
      "title": "Bài thi Toán",
      "total_score": 100,
      "minutes": 60
    }
  }
}
```

---

## 2. LẤY ĐỀ THI (Get Questions)

### API Endpoint
```
GET /api/sessions/:session_id/questions
```
**Middleware**: `verifyToken`, `verifyStudent`

### Quy Trình

#### Bước 1: Kiểm tra session
- Kiểm tra session có tồn tại và thuộc về student không
- Kiểm tra session còn hợp lệ (chưa hết thời gian)
- Nếu hết thời gian → tự động submit và trả về kết quả

#### Bước 2: Lấy câu hỏi
- Lấy tất cả câu hỏi của exam (không bao gồm `is_correct` trong đáp án)
- Đảo ngẫu nhiên thứ tự câu hỏi dựa trên `session_id` (seeded shuffle)
- Đảo ngẫu nhiên thứ tự đáp án trong mỗi câu hỏi (dựa trên `session_id + question_id`)

#### Bước 3: Trả về đề thi
- Không hiển thị đáp án đúng (`is_correct` bị ẩn)
- Thứ tự câu hỏi và đáp án đã được đảo ngẫu nhiên

### Response
```json
{
  "session": {
    "id": 1,
    "exam_id": 1,
    "start_time": "2024-01-01T10:00:00Z",
    "end_time": "2024-01-01T11:00:00Z",
    "remaining_time_ms": 3600000
  },
  "exam": {
    "id": 1,
    "title": "Bài thi Toán",
    "minutes": 60
  },
  "questions": [
    {
      "id": 1,
      "question_text": "2 + 2 = ?",
      "type": "single_choice",
      "answers": [
        { "id": 1, "text": "3" },
        { "id": 2, "text": "4" },
        { "id": 3, "text": "5" }
      ]
    }
  ]
}
```

---

## 3. TRẢ LỜI CÂU HỎI (Answer Question)

### API Endpoint
```
POST /api/sessions/:session_id/answer
```
**Middleware**: `verifyToken`, `verifyStudent`

### Request Body
```json
{
  "question_id": 1,
  "selected_answer_id": 2,  // Cho single_choice, multiple_choice, true_false
  "answer_text": "Câu trả lời"  // Cho short_answer, essay
}
```

### Quy Trình

#### Bước 1: Validation
- Kiểm tra session có tồn tại và thuộc về student
- Kiểm tra session còn `status = 'in_progress'`
- Kiểm tra session chưa hết thời gian
- Kiểm tra question thuộc exam của session

#### Bước 2: Validate answer theo loại câu hỏi
- **Single choice / Multiple choice / True-False**: Cần `selected_answer_id`
- **Short answer / Essay**: Cần `answer_text`

#### Bước 3: Tính điểm tự động (chỉ cho câu hỏi trắc nghiệm)
- Đối với `single_choice`, `multiple_choice`, `true_false`:
  - Lấy `is_correct` từ `QuestionAnswer`
  - Tính điểm: `pointsPerQuestion = exam.total_score / totalQuestions`
  - Nếu đúng: `score = pointsPerQuestion`
  - Nếu sai: `score = 0`
  - Lưu `is_correct` và `score` vào `StudentAnswer`

- Đối với `short_answer`, `essay`:
  - `score = null`, `is_correct = null` (cần teacher chấm thủ công)

#### Bước 4: Lưu/Update câu trả lời
- Nếu đã có câu trả lời → Update
- Nếu chưa có → Tạo mới

### Response
```json
{
  "message": "Answer saved successfully",
  "answer": {
    "id": 1,
    "session_id": 1,
    "exam_question_id": 1,
    "selected_answer_id": 2,
    "score": 10.0,
    "is_correct": true,
    "answered_at": "2024-01-01T10:15:00Z"
  }
}
```

---

## 4. NỘP BÀI THI (Submit Exam)

### API Endpoint
```
POST /api/sessions/:session_id/submit
```
**Middleware**: `verifyToken`, `verifyStudent`

### Quy Trình Chi Tiết

#### Bước 1: Kiểm tra session
- Kiểm tra session có tồn tại và thuộc về student
- Nếu đã submit (`status != 'in_progress'`) → trả về kết quả đã có

#### Bước 2: Tính điểm (trong `finalizeSessionResult`)

**Hàm `computeSessionScore` thực hiện:**

1. **Lấy tất cả câu trả lời của session**
   ```javascript
   studentAnswers = StudentAnswer.findAll({ session_id })
   ```

2. **Lấy tất cả câu hỏi của exam**
   ```javascript
   allQuestions = Question.findAll({ exam_id })
   ```

3. **Tính tổng điểm**
   ```javascript
   totalScore = 0
   correctCount = 0
   wrongCount = 0
   
   for each answer in studentAnswers:
     if answer.score !== null:
       totalScore += answer.score
     
     if answer.is_correct === true:
       correctCount++
     else if answer.is_correct === false:
       wrongCount++
   ```

4. **Tính số câu chưa trả lời**
   ```javascript
   answeredQuestionIds = studentAnswers.map(a => a.exam_question_id)
   unansweredCount = allQuestions.length - answeredQuestionIds.length
   ```

5. **Tính phần trăm**
   ```javascript
   percentage = (totalScore / exam.total_score) * 100
   ```

#### Bước 3: Cập nhật Exam Session
```javascript
session.update({
  status: 'submitted',
  submitted_at: now,
  total_score: totalScore
})
```

#### Bước 4: Tạo/Cập nhật Exam Result
```javascript
ExamResult.create/update({
  session_id: session.id,
  student_id: student_id,
  exam_id: exam_id,
  total_score: totalScore,
  correct_count: correctCount,
  wrong_count: wrongCount,
  percentage: percentage,
  submitted_at: now,
  status: 'graded'
})
```

#### Bước 5: Cập nhật Student Exam Status
```javascript
StudentExamStatus.update({
  attempt_count: attempt_count + 1,
  status: 'completed',
  last_attempt_at: now,
  last_score: totalScore,
  best_score: Math.max(best_score, totalScore),
  last_percentage: percentage,
  best_percentage: Math.max(best_percentage, percentage),
  completed_at: now,
  current_session_id: null
})
```

#### Bước 6: Gửi thông báo
- Gửi notification cho teacher khi student submit exam

### Response
```json
{
  "message": "Exam submitted successfully",
  "result": {
    "id": 1,
    "session_id": 1,
    "student_id": 1,
    "exam_id": 1,
    "total_score": 85.5,
    "correct_count": 8,
    "wrong_count": 2,
    "percentage": 85.5,
    "status": "graded",
    "submitted_at": "2024-01-01T10:55:00Z"
  },
  "summary": {
    "total_score": 85.5,
    "exam_total_score": 100,
    "correct_count": 8,
    "wrong_count": 2,
    "unanswered_count": 0,
    "percentage": 85.5
  }
}
```

---

## 5. XEM KẾT QUẢ THI (View Results)

### API Endpoint
```
GET /api/sessions/:session_id/result
```
**Middleware**: `verifyToken`, `verifyStudent`

### Quy Trình

#### Bước 1: Lấy Exam Result
- Tìm `ExamResult` theo `session_id`
- Nếu không có → trả về lỗi "Vui lòng nộp bài thi trước"

#### Bước 2: Lấy tất cả câu hỏi và đáp án
- Lấy tất cả câu hỏi của exam (bao gồm `is_correct` trong đáp án)
- Lấy tất cả câu trả lời của student

#### Bước 3: Merge dữ liệu
- Với mỗi câu hỏi:
  - Nếu student đã trả lời → hiển thị câu trả lời, điểm, đúng/sai
  - Nếu student chưa trả lời → hiển thị `selectedAnswer: null`, `score: 0`, `is_correct: false`

### Response
```json
{
  "result": {
    "id": 1,
    "total_score": 85.5,
    "correct_count": 8,
    "wrong_count": 2,
    "percentage": 85.5,
    "submitted_at": "2024-01-01T10:55:00Z",
    "feedback": "Làm tốt lắm!",
    "exam": {
      "id": 1,
      "title": "Bài thi Toán",
      "total_score": 100
    }
  },
  "answers": [
    {
      "id": 1,
      "exam_question_id": 1,
      "question": {
        "id": 1,
        "question_text": "2 + 2 = ?",
        "type": "single_choice",
        "answers": [
          { "id": 1, "text": "3", "is_correct": false },
          { "id": 2, "text": "4", "is_correct": true },
          { "id": 3, "text": "5", "is_correct": false }
        ]
      },
      "selectedAnswer": {
        "id": 2,
        "text": "4",
        "is_correct": true
      },
      "is_correct": true,
      "score": 10.0
    },
    {
      "id": 2,
      "exam_question_id": 2,
      "question": {
        "id": 2,
        "question_text": "5 + 5 = ?",
        "answers": [...]
      },
      "selectedAnswer": null,
      "answer_text": null,
      "is_correct": false,
      "score": 0
    }
  ]
}
```

---

## 6. CÁCH TÍNH ĐIỂM CHI TIẾT

### Công Thức Tính Điểm

#### 1. Điểm mỗi câu hỏi (Points Per Question)
```javascript
pointsPerQuestion = exam.total_score / totalQuestions
```

**Ví dụ:**
- Exam có `total_score = 100`
- Có 10 câu hỏi
- → Mỗi câu = `100 / 10 = 10 điểm`

#### 2. Tính điểm cho từng câu trả lời

**Câu hỏi trắc nghiệm (single_choice, multiple_choice, true_false):**
```javascript
if (selectedAnswer.is_correct === true) {
  score = pointsPerQuestion
  is_correct = true
} else {
  score = 0
  is_correct = false
}
```

**Câu hỏi tự luận (short_answer, essay):**
```javascript
score = null  // Cần teacher chấm thủ công
is_correct = null
```

#### 3. Tổng điểm
```javascript
totalScore = sum(all answer.score where score !== null)
```

#### 4. Phần trăm
```javascript
percentage = (totalScore / exam.total_score) * 100
```

#### 5. Thống kê
```javascript
correctCount = count(answer where is_correct === true)
wrongCount = count(answer where is_correct === false)
unansweredCount = totalQuestions - answeredQuestions.length
```

### Ví Dụ Cụ Thể

**Exam:**
- `total_score = 100`
- Có 10 câu hỏi
- Mỗi câu = 10 điểm

**Student trả lời:**
- Câu 1: Đúng → `score = 10`, `is_correct = true`
- Câu 2: Sai → `score = 0`, `is_correct = false`
- Câu 3: Đúng → `score = 10`, `is_correct = true`
- Câu 4: Chưa trả lời → `score = 0`, `is_correct = false`
- Câu 5-10: Tương tự...

**Kết quả:**
- `totalScore = 10 + 0 + 10 + 0 + ... = 70`
- `correctCount = 7`
- `wrongCount = 2`
- `unansweredCount = 1`
- `percentage = (70 / 100) * 100 = 70%`

---

## 7. TỰ ĐỘNG NỘP BÀI KHI HẾT THỜI GIAN

### Auto Submit Scheduler

Hệ thống có scheduler tự động nộp bài khi hết thời gian:

```javascript
// Chạy mỗi 60 giây (có thể cấu hình)
startAutoSubmitScheduler(60000)
```

### Quy Trình Auto Submit

1. **Tìm các session hết thời gian**
   ```javascript
   expiredSessions = ExamSession.findAll({
     where: {
       status: 'in_progress',
       end_time: { [Op.lt]: now }
     }
   })
   ```

2. **Tự động tính điểm và submit**
   - Gọi `computeSessionScore()` cho mỗi session
   - Cập nhật `status = 'submitted'`
   - Tạo `ExamResult`

3. **Xử lý lỗi**
   - Nếu một session lỗi, tiếp tục xử lý session khác
   - Log lỗi nhưng không crash server

---

## 8. CÁC TRẠNG THÁI (Status)

### Exam Session Status
- `in_progress`: Đang làm bài
- `submitted`: Đã nộp bài
- `expired`: Hết thời gian (tự động chuyển sang submitted)
- `completed`: Đã hoàn thành (deprecated, dùng submitted)

### Exam Result Status
- `pending`: Đang chờ chấm (không dùng trong hệ thống hiện tại)
- `graded`: Đã chấm điểm tự động
- `reviewed`: Đã được teacher review
- `finalized`: Đã hoàn tất

### Student Exam Status
- `not_started`: Chưa bắt đầu
- `in_progress`: Đang làm bài
- `completed`: Đã hoàn thành

---

## 9. CÁC LOẠI CÂU HỎI

### 1. Single Choice
- Chọn 1 đáp án
- Tự động chấm điểm
- `selected_answer_id` bắt buộc

### 2. Multiple Choice
- Chọn nhiều đáp án (có thể)
- Tự động chấm điểm
- `selected_answer_id` bắt buộc

### 3. True/False
- Chọn Đúng/Sai
- Tự động chấm điểm
- `selected_answer_id` bắt buộc

### 4. Short Answer
- Nhập câu trả lời ngắn
- Cần teacher chấm thủ công
- `answer_text` bắt buộc
- `score = null` cho đến khi teacher chấm

### 5. Essay
- Nhập câu trả lời dài
- Cần teacher chấm thủ công
- `answer_text` bắt buộc
- `score = null` cho đến khi teacher chấm

---

## 10. BẢO MẬT VÀ CHỐNG GIAN LẬN

### 1. Đảo ngẫu nhiên đề thi
- Thứ tự câu hỏi được đảo dựa trên `session_id`
- Thứ tự đáp án được đảo dựa trên `session_id + question_id`
- Mỗi student có đề thi khác nhau

### 2. Không hiển thị đáp án đúng khi làm bài
- Khi lấy đề thi (`getSessionQuestionsForStudent`), không trả về `is_correct`
- Chỉ hiển thị `is_correct` sau khi submit

### 3. Kiểm tra thời gian
- Session có `end_time` cố định
- Không thể trả lời sau khi hết thời gian
- Tự động submit khi hết thời gian

### 4. Kiểm tra quyền truy cập
- Student chỉ có thể xem session của mình
- Student chỉ có thể trả lời trong session của mình
- Kiểm tra `student_id` trong mọi request

---

## 11. FLOW DIAGRAM

```
[Student chọn exam]
        ↓
[POST /api/exams/:exam_id/start]
        ↓
[Kiểm tra quyền, thời gian, thanh toán]
        ↓
[Tạo ExamSession (status: in_progress)]
        ↓
[GET /api/sessions/:session_id/questions]
        ↓
[Lấy đề thi (đã đảo ngẫu nhiên)]
        ↓
[POST /api/sessions/:session_id/answer] (nhiều lần)
        ↓
[Tính điểm tự động cho mỗi câu trả lời]
        ↓
[POST /api/sessions/:session_id/submit]
        ↓
[Tính tổng điểm, tạo ExamResult]
        ↓
[GET /api/sessions/:session_id/result]
        ↓
[Xem kết quả chi tiết với đáp án đúng]
```

---

## 12. CÁC API LIÊN QUAN KHÁC

### Lấy tất cả kết quả của student
```
GET /api/exam-results/my-results
```

### So sánh kết quả với lớp và toàn bộ
```
GET /api/exams/:exam_id/my-comparison
```

### Teacher xem kết quả của exam
```
GET /api/exams/:exam_id/results
```

### Teacher export kết quả (CSV)
```
GET /api/exams/:exam_id/results/export?format=csv
```

### Teacher cập nhật feedback
```
PUT /api/exam-results/:result_id/feedback
```

---

## 13. LƯU Ý QUAN TRỌNG

1. **Thanh toán**: Mỗi lần bắt đầu làm bài (`startExam`), nếu exam trả phí sẽ trừ tiền ngay
2. **Điểm số**: Chỉ câu hỏi trắc nghiệm được tính điểm tự động. Câu tự luận cần teacher chấm
3. **Thời gian**: Session có thời gian cố định, không thể gia hạn
4. **Đảo đề**: Mỗi student có đề thi khác nhau (đảo câu hỏi và đáp án)
5. **Auto submit**: Hệ thống tự động nộp bài khi hết thời gian
6. **Tracking**: Hệ thống track số lần làm bài, điểm cao nhất, điểm lần cuối

---

## Kết Luận

Hệ thống làm bài thi được thiết kế với các tính năng:
- ✅ Bảo mật cao (đảo đề, kiểm tra quyền)
- ✅ Tính điểm tự động cho trắc nghiệm
- ✅ Hỗ trợ nhiều loại câu hỏi
- ✅ Tự động nộp bài khi hết thời gian
- ✅ Tracking chi tiết
- ✅ Thanh toán tích hợp
- ✅ So sánh kết quả với lớp và toàn bộ

