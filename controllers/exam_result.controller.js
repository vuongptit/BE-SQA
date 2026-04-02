import { Op } from "sequelize";
import sequelize from "../config/db.config.js";
import { ExamResultModel, ExamSessionModel, StudentAnswerModel, ExamModel, QuestionModel, QuestionAnswerModel, UserModel, ClassStudentModel, ExamClassModel } from "../models/index.model.js";
import { finalizeSessionResult } from "../services/exam_result.service.js";
import { notifyExamSubmitted, notifyFeedbackUpdated } from "../services/notification.service.js";

// Submit bài thi (nộp bài và tính điểm)
export const submitExam = async (req, res) => {
    try {
        const { session_id } = req.params;
        const student_id = req.userId;

        // Kiểm tra session có tồn tại và thuộc về student không
        const session = await ExamSessionModel.findOne({
            where: {
                id: session_id,
                student_id: student_id
            },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'total_score']
                }
            ]
        });

        if (!session) {
            return res.status(404).send({ 
                message: 'Exam session not found or you do not have permission' 
            });
        }

        const { result, summary, alreadySubmitted } = await finalizeSessionResult(session, student_id);

        if (alreadySubmitted) {
            return res.status(200).send({
                message: 'Exam already submitted',
                result
            });
        }

        // Gửi thông báo cho giáo viên khi student submit exam
        try {
            const score = result ? Number(result.total_score) : 0;
            await notifyExamSubmitted(student_id, session.exam.id, score);
        } catch (notifError) {
            console.error('Error sending notification:', notifError);
            // Không fail request nếu thông báo lỗi
        }

        return res.status(200).send({
            message: 'Exam submitted successfully',
            result,
            summary
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Lấy kết quả thi của một session
export const getResult = async (req, res) => {
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

        // Lấy kết quả
        const result = await ExamResultModel.findOne({
            where: { session_id: session_id },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'des', 'total_score', 'minutes', 'start_time', 'end_time']
                },
                {
                    model: ExamSessionModel,
                    as: 'session',
                    attributes: ['id', 'code', 'start_time', 'end_time', 'submitted_at', 'status']
                }
            ]
        });

        if (!result) {
            return res.status(404).send({ 
                message: 'Không tìm thấy kết quả. Vui lòng nộp bài thi trước.' 
            });
        }

        // Lấy tất cả câu hỏi của exam
        const allQuestions = await QuestionModel.findAll({
            where: { exam_id: result.exam_id },
            attributes: ['id', 'question_text', 'type', 'difficulty', 'order', 'image_url'],
            include: [
                {
                    model: QuestionAnswerModel,
                    as: 'answers',
                    attributes: ['id', 'text', 'is_correct']
                }
            ],
            order: [['order', 'ASC']]
        });

        // Lấy tất cả câu trả lời của session (chỉ những câu đã trả lời)
        const studentAnswers = await StudentAnswerModel.findAll({
            where: { session_id: session_id },
            include: [
                {
                    model: QuestionModel,
                    as: 'question',
                    attributes: ['id']
                },
                {
                    model: QuestionAnswerModel,
                    as: 'selectedAnswer',
                    attributes: ['id', 'text', 'is_correct'],
                    required: false
                }
            ]
        });

        // Tạo map để tra cứu nhanh câu trả lời theo question_id
        const answerMap = new Map();
        studentAnswers.forEach(answer => {
            answerMap.set(answer.exam_question_id, answer);
        });

        // Merge tất cả câu hỏi với câu trả lời (nếu có)
        const answersWithAllQuestions = allQuestions.map(question => {
            const studentAnswer = answerMap.get(question.id);
            
            if (studentAnswer) {
                // Câu hỏi đã được trả lời
                return {
                    id: studentAnswer.id,
                    exam_question_id: question.id,
                    question: {
                        id: question.id,
                        question_text: question.question_text,
                        type: question.type,
                        difficulty: question.difficulty,
                        order: question.order,
                        image_url: question.image_url,
                        answers: question.answers
                    },
                    selectedAnswer: studentAnswer.selectedAnswer,
                    answer_text: studentAnswer.answer_text,
                    is_correct: studentAnswer.is_correct,
                    score: studentAnswer.score
                };
            } else {
                // Câu hỏi chưa được trả lời (bỏ trống)
                return {
                    id: null,
                    exam_question_id: question.id,
                    question: {
                        id: question.id,
                        question_text: question.question_text,
                        type: question.type,
                        difficulty: question.difficulty,
                        order: question.order,
                        image_url: question.image_url,
                        answers: question.answers
                    },
                    selectedAnswer: null,
                    answer_text: null,
                    is_correct: false,
                    score: 0
                };
            }
        });

        return res.status(200).send({
            result: result,
            answers: answersWithAllQuestions
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Lấy tất cả kết quả thi của student
export const getStudentResults = async (req, res) => {
    try {
        const student_id = req.userId;
        const { exam_id } = req.query; // Optional: filter by exam_id

        let whereCondition = {
            student_id: student_id
        };

        if (exam_id) {
            whereCondition.exam_id = exam_id;
        }

        const results = await ExamResultModel.findAll({
            where: whereCondition,
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'des', 'total_score', 'minutes']
                },
                {
                    model: ExamSessionModel,
                    as: 'session',
                    attributes: ['id', 'code', 'start_time', 'end_time', 'submitted_at', 'status']
                }
            ],
            order: [['submitted_at', 'DESC']]
        });

        return res.status(200).send(results);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Lấy tất cả kết quả của một exam (cho teacher)
export const getExamResults = async (req, res) => {
    try {
        const { exam_id } = req.params;
        const userId = req.userId;
        const role = req.role;

        // Chỉ teacher mới có quyền xem kết quả của exam
        if (role !== 'teacher') {
            return res.status(403).send({ 
                message: 'Only teacher can view exam results' 
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

        // Lấy tất cả kết quả của exam
        const results = await ExamResultModel.findAll({
            where: { exam_id: exam_id },
            include: [
                {
                    model: ExamSessionModel,
                    as: 'session',
                    attributes: ['id', 'code', 'start_time', 'end_time', 'submitted_at', 'status']
                },
                {
                    model: UserModel,
                    as: 'student',
                    attributes: ['id', 'fullName', 'email']
                }
            ],
            order: [['submitted_at', 'DESC']]
        });

        return res.status(200).send({
            exam: {
                id: exam.id,
                title: exam.title,
                total_score: exam.total_score
            },
            results: results,
            total_submissions: results.length
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// So sánh kết quả của student với lớp và toàn bộ người làm đề
export const getStudentComparison = async (req, res) => {
    try {
        const { exam_id } = req.params;
        const student_id = req.userId;

        const studentResult = await ExamResultModel.findOne({
            where: {
                exam_id: exam_id,
                student_id: student_id
            },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'total_score']
                }
            ]
        });

        if (!studentResult) {
            return res.status(404).send({
                message: 'Không tìm thấy kết quả. Vui lòng nộp bài thi trước.'
            });
        }

        const studentScore = Number(studentResult.total_score);

        const [globalAggregate] = await ExamResultModel.findAll({
            where: { exam_id: exam_id },
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('Exam_results.id')), 'total'],
                [sequelize.fn('AVG', sequelize.col('total_score')), 'average_score'],
                [sequelize.fn('MAX', sequelize.col('total_score')), 'best_score'],
                [sequelize.fn('MIN', sequelize.col('total_score')), 'lowest_score']
            ],
            raw: true
        });

        const globalTotal = Number(globalAggregate?.total ?? 0);
        const globalAverage = globalAggregate?.average_score ? Number(globalAggregate.average_score) : 0;
        const globalBest = globalAggregate?.best_score ? Number(globalAggregate.best_score) : 0;
        const globalLowest = globalAggregate?.lowest_score ? Number(globalAggregate.lowest_score) : 0;

        const globalHigher = await ExamResultModel.count({
            where: {
                exam_id: exam_id,
                total_score: { [Op.gt]: studentScore }
            }
        });

        const globalRank = globalHigher + 1;
        const globalPercentile = globalTotal > 0 ? Number((((globalTotal - globalRank) / globalTotal) * 100).toFixed(2)) : null;

        let classComparison = {
            available: false,
            reason: 'Đề thi này không thuộc lớp nào.'
        };

        // Lấy class_ids từ Exam_Classes
        const examClasses = await ExamClassModel.findAll({
            where: { exam_id: exam_id },
            attributes: ['class_id']
        });
        
        const examClassIds = examClasses.map(ec => ec.class_id);

        if (examClassIds.length > 0) {
            // Lấy tất cả students từ các lớp mà exam được gắn vào
            const classStudents = await ClassStudentModel.findAll({
                where: {
                    class_id: { [Op.in]: examClassIds },
                    is_ban: false
                },
                attributes: ['student_id'],
                raw: true
            });

            const classStudentIds = [...new Set(classStudents.map((row) => row.student_id))];
            const belongsToClass = classStudentIds.includes(student_id);

            if (!belongsToClass) {
                classComparison = {
                    available: false,
                    reason: 'Bạn không thuộc lớp này.'
                };
            } else if (classStudentIds.length === 0) {
                classComparison = {
                    available: false,
                    reason: 'Không tìm thấy học sinh nào trong lớp này.'
                };
            } else {
                const classFilter = {
                    exam_id: exam_id,
                    student_id: { [Op.in]: classStudentIds }
                };

                const classTotal = await ExamResultModel.count({ where: classFilter });

                if (classTotal === 0) {
                    classComparison = {
                        available: false,
                        reason: 'Chưa có bạn học nào nộp bài thi này.'
                    };
                } else {
                    const classHigher = await ExamResultModel.count({
                        where: {
                            ...classFilter,
                            total_score: { [Op.gt]: studentScore }
                        }
                    });

                    const [classAggregate] = await ExamResultModel.findAll({
                        where: classFilter,
                        attributes: [
                            [sequelize.fn('AVG', sequelize.col('total_score')), 'average_score'],
                            [sequelize.fn('MAX', sequelize.col('total_score')), 'best_score']
                        ],
                        raw: true
                    });

                    const classRank = classHigher + 1;
                    const classPercentile = Number((((classTotal - classRank) / classTotal) * 100).toFixed(2));

                    classComparison = {
                        available: true,
                        rank: classRank,
                        total: classTotal,
                        percentile: classPercentile,
                        average_score: classAggregate?.average_score ? Number(classAggregate.average_score) : 0,
                        best_score: classAggregate?.best_score ? Number(classAggregate.best_score) : 0
                    };
                }
            }
        }

        return res.status(200).send({
            exam: {
                id: studentResult.exam.id,
                title: studentResult.exam.title,
                total_score: studentResult.exam.total_score
            },
            student: {
                id: studentResult.student_id,
                score: studentScore,
                correct_count: studentResult.correct_count,
                wrong_count: studentResult.wrong_count,
                submitted_at: studentResult.submitted_at
            },
            comparison: {
                global: {
                    rank: globalRank,
                    total: globalTotal,
                    percentile: globalPercentile,
                    average_score: globalAverage,
                    best_score: globalBest,
                    lowest_score: globalLowest
                },
                class: classComparison
            }
        });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Teacher cập nhật feedback cho exam result
export const updateFeedback = async (req, res) => {
    try {
        const { result_id } = req.params;
        const { feedback } = req.body;
        const userId = req.userId;
        const role = req.role;

        // Chỉ teacher mới có quyền cập nhật feedback
        if (role !== 'teacher') {
            return res.status(403).send({ 
                message: 'Only teacher can update feedback' 
            });
        }

        // Tìm exam result
        const result = await ExamResultModel.findOne({
            where: { id: result_id },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'created_by']
                }
            ]
        });

        if (!result) {
            return res.status(404).send({ 
                message: 'Exam result not found' 
            });
        }

        // Kiểm tra teacher có quyền với exam này không
        if (result.exam.created_by !== userId) {
            return res.status(403).send({ 
                message: 'You do not have permission to update feedback for this exam result' 
            });
        }

        // Cập nhật feedback
        await result.update({
            feedback: feedback || null
        });

        // Lấy lại result với đầy đủ thông tin
        const updatedResult = await ExamResultModel.findOne({
            where: { id: result_id },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'total_score']
                },
                {
                    model: ExamSessionModel,
                    as: 'session',
                    attributes: ['id', 'code', 'start_time', 'end_time', 'submitted_at', 'status']
                },
                {
                    model: UserModel,
                    as: 'student',
                    attributes: ['id', 'fullName', 'email']
                }
            ]
        });

        // Gửi thông báo cho student khi teacher cập nhật feedback
        if (updatedResult && feedback) {
            try {
                await notifyFeedbackUpdated(
                    updatedResult.student_id,
                    updatedResult.exam.id,
                    updatedResult.exam.title,
                    updatedResult.session_id
                );
            } catch (notifError) {
                console.error('Error sending notification:', notifError);
                // Không fail request nếu thông báo lỗi
            }
        }

        return res.status(200).send({
            message: 'Feedback updated successfully',
            result: updatedResult
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Export exam results to CSV
export const exportExamResults = async (req, res) => {
    try {
        const { exam_id } = req.params;
        const userId = req.userId;
        const role = req.role;
        const { format = 'csv' } = req.query;

        // Chỉ teacher mới có quyền export kết quả
        if (role !== 'teacher') {
            return res.status(403).send({ 
                message: 'Only teacher can export exam results' 
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

        // Lấy tất cả kết quả của exam
        const results = await ExamResultModel.findAll({
            where: { exam_id: exam_id },
            include: [
                {
                    model: ExamSessionModel,
                    as: 'session',
                    attributes: ['id', 'code', 'start_time', 'end_time', 'submitted_at', 'status']
                },
                {
                    model: UserModel,
                    as: 'student',
                    attributes: ['id', 'fullName', 'email']
                }
            ],
            order: [['submitted_at', 'DESC']]
        });

        if (format === 'csv') {
            // Generate CSV
            const csvHeader = 'STT,Họ và tên,Email,Điểm số,Tổng điểm,Tỷ lệ %,Đúng,Sai,Thời gian nộp,Feedback\n';
            
            const csvRows = results.map((result, index) => {
                const score = typeof result.total_score === 'number' ? result.total_score : parseFloat(result.total_score) || 0;
                const totalScore = exam.total_score || 100;
                const percentage = totalScore > 0 ? ((score / totalScore) * 100).toFixed(1) : '0';
                
                const fullName = (result.student?.fullName || 'Không tên').replace(/"/g, '""');
                const email = (result.student?.email || '').replace(/"/g, '""');
                const feedback = (result.feedback || '').replace(/"/g, '""').replace(/\n/g, ' ');
                const submittedAt = result.submitted_at 
                    ? new Date(result.submitted_at).toLocaleString('vi-VN')
                    : '';
                
                return `${index + 1},"${fullName}","${email}",${score},${totalScore},${percentage},${result.correct_count || 0},${result.wrong_count || 0},"${submittedAt}","${feedback}"`;
            }).join('\n');

            const csvContent = csvHeader + csvRows;

            // Set headers for CSV download
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="ket-qua-thi-${exam.title.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.csv"`);
            res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8'));

            return res.send('\ufeff' + csvContent); // BOM for Excel UTF-8 support
        } else {
            // For other formats, return JSON
            return res.status(200).json({
                exam: {
                    id: exam.id,
                    title: exam.title,
                    total_score: exam.total_score
                },
                results: results,
                total_submissions: results.length
            });
        }

    } catch (error) {
        console.error('Error exporting exam results:', error);
        return res.status(500).send({ message: error.message });
    }
};

