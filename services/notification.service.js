import NotificationModel from "../models/notification.model.js";
import { UserModel, ClassesModel, ExamModel, ClassStudentModel } from "../models/index.model.js";

/**
 * Tạo thông báo cho một người nhận
 * @param {number} recipientId - ID người nhận
 * @param {string} type - Loại thông báo
 * @param {string} title - Tiêu đề
 * @param {string} message - Nội dung
 * @param {object} data - Dữ liệu bổ sung (JSON)
 */
export const createNotification = async (recipientId, type, title, message, data = null) => {
    try {
        const notification = await NotificationModel.create({
            recipient_id: recipientId,
            type,
            title,
            message,
            data: data ? JSON.stringify(data) : null
        });
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};

/**
 * Tạo thông báo cho nhiều người nhận (bulk)
 * @param {Array<number>} recipientIds - Mảng ID người nhận
 * @param {string} type - Loại thông báo
 * @param {string} title - Tiêu đề
 * @param {string} message - Nội dung
 * @param {object} data - Dữ liệu bổ sung (JSON)
 */
export const createBulkNotifications = async (recipientIds, type, title, message, data = null) => {
    try {
        if (!recipientIds || recipientIds.length === 0) {
            return [];
        }

        const notifications = recipientIds.map(recipientId => ({
            recipient_id: recipientId,
            type,
            title,
            message,
            data: data ? JSON.stringify(data) : null,
            created_at: new Date()
        }));

        await NotificationModel.bulkCreate(notifications);
        return notifications;
    } catch (error) {
        console.error('Error creating bulk notifications:', error);
        throw error;
    }
};

/**
 * Thông báo khi student join class
 */
export const notifyStudentJoinedClass = async (studentId, classId) => {
    try {
        const student = await UserModel.findByPk(studentId, {
            attributes: ['id', 'fullName']
        });
        const classInfo = await ClassesModel.findByPk(classId, {
            attributes: ['id', 'className', 'teacher_id']
        });

        if (!student || !classInfo) {
            throw new Error('Student or class not found');
        }

        const title = 'Học sinh mới tham gia lớp';
        const message = `${student.fullName} đã tham gia lớp ${classInfo.className}`;
        const data = {
            student_id: studentId,
            student_name: student.fullName,
            class_id: classId,
            class_name: classInfo.className
        };

        return await createNotification(
            classInfo.teacher_id,
            'student_joined_class',
            title,
            message,
            data
        );
    } catch (error) {
        console.error('Error notifying student joined class:', error);
        throw error;
    }
};

/**
 * Thông báo khi teacher thêm exam vào class
 */
export const notifyExamAssignedToClass = async (examId, classId) => {
    try {
        const exam = await ExamModel.findByPk(examId, {
            attributes: ['id', 'title', 'created_by']
        });
        const classInfo = await ClassesModel.findByPk(classId, {
            attributes: ['id', 'className']
        });

        if (!exam || !classInfo) {
            throw new Error('Exam or class not found');
        }

        // Lấy danh sách students từ class (chỉ những người chưa bị ban)
        const classStudents = await ClassStudentModel.findAll({
            where: {
                class_id: classId,
                is_ban: false
            },
            attributes: ['student_id']
        });

        const studentIds = classStudents.map(cs => cs.student_id);
        
        if (studentIds.length === 0) {
            return [];
        }

        const title = 'Đề thi mới được đăng';
        const message = `Đề thi "${exam.title}" đã được đăng trong lớp ${classInfo.className}`;
        const data = {
            exam_id: examId,
            exam_title: exam.title,
            class_id: classId,
            class_name: classInfo.className,
            teacher_id: exam.created_by
        };

        return await createBulkNotifications(
            studentIds,
            'exam_assigned_to_class',
            title,
            message,
            data
        );
    } catch (error) {
        console.error('Error notifying exam assigned to class:', error);
        throw error;
    }
};

/**
 * Thông báo khi student submit exam
 */
export const notifyExamSubmitted = async (studentId, examId, score) => {
    try {
        const student = await UserModel.findByPk(studentId, {
            attributes: ['id', 'fullName']
        });
        const exam = await ExamModel.findByPk(examId, {
            attributes: ['id', 'title', 'created_by'],
            include: [{
                model: ClassesModel,
                as: 'classes',
                attributes: ['id', 'className', 'teacher_id'],
                through: { attributes: [] },
                required: false
            }]
        });

        if (!student || !exam) {
            throw new Error('Student or exam not found');
        }

        const title = 'Học sinh đã nộp bài thi';
        const message = `${student.fullName} đã nộp bài thi "${exam.title}" với điểm ${score}`;
        const data = {
            student_id: studentId,
            student_name: student.fullName,
            exam_id: examId,
            exam_title: exam.title,
            score: score
        };

        // Thông báo cho teacher tạo đề
        const notifications = [];
        
        if (exam.created_by) {
            notifications.push(
                await createNotification(
                    exam.created_by,
                    'exam_submitted',
                    title,
                    message,
                    data
                )
            );
        }

        // Nếu exam thuộc các class, cũng thông báo cho teacher của các class (nếu khác teacher tạo đề)
        if (exam.classes && exam.classes.length > 0) {
            for (const classItem of exam.classes) {
                if (classItem.teacher_id && classItem.teacher_id !== exam.created_by) {
                    notifications.push(
                        await createNotification(
                            classItem.teacher_id,
                            'exam_submitted',
                            title,
                            message,
                            { ...data, class_id: classItem.id, class_name: classItem.className }
                        )
                    );
                }
            }
        }

        return notifications;
    } catch (error) {
        console.error('Error notifying exam submitted:', error);
        throw error;
    }
};

/**
 * Thông báo khi teacher cập nhật feedback
 */
export const notifyFeedbackUpdated = async (studentId, examId, examTitle, sessionId) => {
    try {
        const exam = await ExamModel.findByPk(examId, {
            attributes: ['id', 'title']
        });

        if (!exam) {
            throw new Error('Exam not found');
        }

        const title = 'Giáo viên đã cập nhật feedback';
        const message = `Giáo viên đã cập nhật feedback cho bài thi "${examTitle || exam.title}"`;
        const data = {
            exam_id: examId,
            exam_title: examTitle || exam.title,
            session_id: sessionId || null
        };

        return await createNotification(
            studentId,
            'feedback_updated',
            title,
            message,
            data
        );
    } catch (error) {
        console.error('Error notifying feedback updated:', error);
        throw error;
    }
};

