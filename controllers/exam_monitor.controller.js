import { ExamCheatingLogModel, ExamSessionModel, ExamModel, UserModel } from "../models/index.model.js";
import { Op } from "sequelize";
import { getIO } from "../config/socket.config.js";

// Ghi log gian lận trong lúc thi (API được gọi từ client khi phát hiện hành vi gian lận)
export const logCheatingEvent = async (req, res) => {
    try {
        const { session_id } = req.params;
        const student_id = req.userId;
        const { 
            cheating_type, 
            description, 
            metadata, 
            severity = 'medium' 
        } = req.body;

        // Validate required fields
        if (!cheating_type) {
            return res.status(400).send({
                message: 'Missing required field: cheating_type'
            });
        }

        // Validate cheating_type enum
        const validTypes = [
            'tab_switch', 'window_blur', 'fullscreen_exit', 'copy_paste',
            'right_click', 'keyboard_shortcut', 'multiple_tabs', 'time_suspicious',
            'answer_pattern', 'device_change', 'ip_change', 'browser_change', 'other'
        ];
        
        if (!validTypes.includes(cheating_type)) {
            return res.status(400).send({
                message: 'Invalid cheating_type. Must be one of: ' + validTypes.join(', ')
            });
        }

        // Kiểm tra session có tồn tại và thuộc về student không
        const session = await ExamSessionModel.findOne({
            where: {
                id: session_id,
                student_id: student_id,
                status: 'in_progress'
            },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id']
                }
            ]
        });

        if (!session) {
            return res.status(404).send({
                message: 'Exam session not found, not in progress, or you do not have permission'
            });
        }

        // Tạo log gian lận
        const cheatingLog = await ExamCheatingLogModel.create({
            session_id: session_id,
            student_id: student_id,
            exam_id: session.exam_id,
            cheating_type: cheating_type,
            description: description || null,
            metadata: metadata || null,
            severity: severity,
            detected_at: new Date()
        });

        // Lấy thông tin student để gửi qua WebSocket
        const student = await UserModel.findByPk(student_id, {
            attributes: ['id', 'fullName', 'email']
        });

        // Lấy thông tin session để gửi qua WebSocket
        const sessionInfo = await ExamSessionModel.findByPk(session_id, {
            attributes: ['id', 'code', 'start_time', 'end_time', 'status']
        });

        // Emit WebSocket event để thông báo cho teacher đang theo dõi exam này
        try {
            const io = getIO();
            const logWithRelations = {
                ...cheatingLog.toJSON(),
                student: student,
                session: sessionInfo
            };
            
            // Emit đến room của exam cụ thể
            io.to(`exam_${session.exam_id}`).emit('new_cheating_event', {
                exam_id: session.exam_id,
                log: logWithRelations
            });
        } catch (socketError) {
            // Nếu WebSocket chưa khởi tạo hoặc lỗi, chỉ log, không ảnh hưởng đến response
            console.error('Error emitting WebSocket event:', socketError);
        }

        return res.status(201).send({
            message: 'Cheating event logged successfully',
            log: cheatingLog
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Lấy lịch sử gian lận của một session (cho student xem lịch sử của mình)
export const getSessionCheatingLogs = async (req, res) => {
    try {
        const { session_id } = req.params;
        const student_id = req.userId;

        // Kiểm tra session có tồn tại và thuộc về student không
        const session = await ExamSessionModel.findOne({
            where: {
                id: session_id,
                student_id: student_id
            }
        });

        if (!session) {
            return res.status(404).send({
                message: 'Exam session not found or you do not have permission'
            });
        }

        // Lấy tất cả logs gian lận của session
        const logs = await ExamCheatingLogModel.findAll({
            where: {
                session_id: session_id
            },
            order: [['detected_at', 'DESC']]
        });

        return res.status(200).send({
            session_id: session_id,
            total_events: logs.length,
            logs: logs
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Lấy lịch sử gian lận của một exam (cho teacher xem tất cả gian lận trong exam)
export const getExamCheatingLogs = async (req, res) => {
    try {
        const { exam_id } = req.params;
        const userId = req.userId;
        const role = req.role;

        // Chỉ teacher mới có quyền xem lịch sử gian lận của exam
        if (role !== 'teacher') {
            return res.status(403).send({
                message: 'Only teacher can view exam cheating logs'
            });
        }

        // Kiểm tra exam có tồn tại và thuộc về teacher không
        const exam = await ExamModel.findOne({
            where: {
                id: exam_id,
                created_by: userId
            }
        });

        if (!exam) {
            return res.status(404).send({
                message: 'Exam not found or you do not have permission'
            });
        }

        // Lấy tất cả logs gian lận của exam
        const logs = await ExamCheatingLogModel.findAll({
            where: {
                exam_id: exam_id
            },
            include: [
                {
                    model: UserModel,
                    as: 'student',
                    attributes: ['id', 'fullName', 'email']
                },
                {
                    model: ExamSessionModel,
                    as: 'session',
                    attributes: ['id', 'code', 'start_time', 'end_time', 'status']
                }
            ],
            order: [['detected_at', 'DESC']]
        });

        // Thống kê theo student
        const studentStats = {};
        logs.forEach(log => {
            const studentId = log.student_id;
            if (!studentStats[studentId]) {
                studentStats[studentId] = {
                    student: log.student,
                    total_events: 0,
                    events_by_type: {},
                    events_by_severity: {},
                    first_event: log.detected_at,
                    last_event: log.detected_at
                };
            }
            studentStats[studentId].total_events++;
            studentStats[studentId].events_by_type[log.cheating_type] = 
                (studentStats[studentId].events_by_type[log.cheating_type] || 0) + 1;
            studentStats[studentId].events_by_severity[log.severity] = 
                (studentStats[studentId].events_by_severity[log.severity] || 0) + 1;
            if (new Date(log.detected_at) < new Date(studentStats[studentId].first_event)) {
                studentStats[studentId].first_event = log.detected_at;
            }
            if (new Date(log.detected_at) > new Date(studentStats[studentId].last_event)) {
                studentStats[studentId].last_event = log.detected_at;
            }
        });

        return res.status(200).send({
            exam_id: exam_id,
            total_events: logs.length,
            total_students: Object.keys(studentStats).length,
            logs: logs,
            statistics: {
                by_student: Object.values(studentStats),
                by_type: logs.reduce((acc, log) => {
                    acc[log.cheating_type] = (acc[log.cheating_type] || 0) + 1;
                    return acc;
                }, {}),
                by_severity: logs.reduce((acc, log) => {
                    acc[log.severity] = (acc[log.severity] || 0) + 1;
                    return acc;
                }, {})
            }
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Lấy lịch sử gian lận của một student trong một exam (cho teacher)
export const getStudentExamCheatingLogs = async (req, res) => {
    try {
        const { exam_id, student_id } = req.params;
        const userId = req.userId;
        const role = req.role;

        // Chỉ teacher mới có quyền xem
        if (role !== 'teacher') {
            return res.status(403).send({
                message: 'Only teacher can view student cheating logs'
            });
        }

        // Kiểm tra exam có tồn tại và thuộc về teacher không
        const exam = await ExamModel.findOne({
            where: {
                id: exam_id,
                created_by: userId
            }
        });

        if (!exam) {
            return res.status(404).send({
                message: 'Exam not found or you do not have permission'
            });
        }

        // Lấy tất cả logs gian lận của student trong exam
        const logs = await ExamCheatingLogModel.findAll({
            where: {
                exam_id: exam_id,
                student_id: student_id
            },
            include: [
                {
                    model: UserModel,
                    as: 'student',
                    attributes: ['id', 'fullName', 'email']
                },
                {
                    model: ExamSessionModel,
                    as: 'session',
                    attributes: ['id', 'code', 'start_time', 'end_time', 'status']
                }
            ],
            order: [['detected_at', 'DESC']]
        });

        if (logs.length === 0) {
            return res.status(200).send({
                exam_id: exam_id,
                student_id: student_id,
                message: 'No cheating events found for this student in this exam',
                total_events: 0,
                logs: []
            });
        }

        // Thống kê
        const statistics = {
            total_events: logs.length,
            events_by_type: logs.reduce((acc, log) => {
                acc[log.cheating_type] = (acc[log.cheating_type] || 0) + 1;
                return acc;
            }, {}),
            events_by_severity: logs.reduce((acc, log) => {
                acc[log.severity] = (acc[log.severity] || 0) + 1;
                return acc;
            }, {}),
            first_event: logs[logs.length - 1].detected_at,
            last_event: logs[0].detected_at
        };

        return res.status(200).send({
            exam_id: exam_id,
            student: logs[0].student,
            total_events: logs.length,
            logs: logs,
            statistics: statistics
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Lấy tất cả lịch sử gian lận của một student (cho student xem tất cả gian lận của mình)
export const getStudentAllCheatingLogs = async (req, res) => {
    try {
        const student_id = req.userId;
        const { exam_id, page = 1, limit = 20 } = req.query;

        let whereCondition = {
            student_id: student_id
        };

        if (exam_id) {
            whereCondition.exam_id = exam_id;
        }

        const offset = (page - 1) * limit;

        const { count, rows: logs } = await ExamCheatingLogModel.findAndCountAll({
            where: whereCondition,
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title']
                },
                {
                    model: ExamSessionModel,
                    as: 'session',
                    attributes: ['id', 'code', 'start_time', 'end_time', 'status']
                }
            ],
            order: [['detected_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        return res.status(200).send({
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit),
            logs: logs
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

