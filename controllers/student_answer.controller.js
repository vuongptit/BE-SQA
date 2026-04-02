import { StudentAnswerModel, ExamSessionModel, QuestionModel, QuestionAnswerModel, ExamModel } from "../models/index.model.js";
import { Op } from "sequelize";

// Trả lời một câu hỏi trong exam session
export const answerQuestion = async (req, res) => {
    try {
        const { session_id } = req.params;
        const { question_id, selected_answer_id, answer_text } = req.body;
        const student_id = req.userId;

        // Validate required fields
        if (!question_id) {
            return res.status(400).send({ 
                message: 'Missing required field: question_id' 
            });
        }

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
                    attributes: ['id', 'title', 'minutes']
                }
            ]
        });

        if (!session) {
            return res.status(404).send({ 
                message: 'Exam session not found or you do not have permission' 
            });
        }

        // Kiểm tra session còn active không
        if (session.status !== 'in_progress') {
            const statusMessages = {
                'expired': 'Phiên làm bài đã hết hạn',
                'submitted': 'Bài thi đã được nộp',
                'cancelled': 'Phiên làm bài đã bị hủy'
            };
            return res.status(400).send({ 
                message: statusMessages[session.status] || `Không thể trả lời câu hỏi. Trạng thái: ${session.status}` 
            });
        }

        // Kiểm tra thời gian session còn hợp lệ không
        const now = new Date();
        const sessionEndTime = new Date(session.end_time);
        
        if (now > sessionEndTime) {
            await session.update({ status: 'expired' });
            return res.status(400).send({ 
                message: 'Phiên làm bài đã hết hạn' 
            });
        }

        // Kiểm tra question có tồn tại và thuộc exam không
        const question = await QuestionModel.findOne({
            where: {
                id: question_id,
                exam_id: session.exam_id
            },
            include: [
                {
                    model: QuestionAnswerModel,
                    as: 'answers',
                    attributes: ['id', 'text', 'is_correct']
                }
            ]
        });

        if (!question) {
            return res.status(404).send({ 
                message: 'Question not found or does not belong to this exam' 
            });
        }

        // Validate answer dựa trên type của question
        if (question.type === 'single_choice' || question.type === 'multiple_choice' || question.type === 'true_false') {
            // Single choice/Multiple choice/True-False cần selected_answer_id
            if (!selected_answer_id) {
                return res.status(400).send({ 
                    message: 'selected_answer_id is required for single choice/multiple choice/true-false questions' 
                });
            }

            // Kiểm tra selected_answer_id có thuộc question không
            const answerExists = question.answers.find(a => a.id === selected_answer_id);
            if (!answerExists) {
                return res.status(400).send({ 
                    message: 'Selected answer does not belong to this question' 
                });
            }
        } else if (question.type === 'short_answer' || question.type === 'essay') {
            // Short answer/Essay cần answer_text
            if (!answer_text || answer_text.trim() === '') {
                return res.status(400).send({ 
                    message: 'answer_text is required for short answer/essay questions' 
                });
            }
        }

        // Kiểm tra xem student đã trả lời câu hỏi này chưa
        let studentAnswer = await StudentAnswerModel.findOne({
            where: {
                session_id: session_id,
                exam_question_id: question_id
            }
        });

        // Tính điểm và is_correct
        let score = null;
        let is_correct = null;

        if (question.type === 'single_choice' || question.type === 'multiple_choice' || question.type === 'true_false') {
            // Tự động tính điểm cho single choice/multiple choice/true-false
            const selectedAnswer = await QuestionAnswerModel.findOne({
                where: { id: selected_answer_id }
            });

            if (selectedAnswer) {
                is_correct = selectedAnswer.is_correct;
                // Tính điểm dựa trên tổng điểm của exam và số câu hỏi
                // Giả sử điểm được chia đều cho mỗi câu hỏi
                const exam = await ExamModel.findOne({
                    where: { id: session.exam_id },
                    include: [
                        {
                            model: QuestionModel,
                            as: 'questions',
                            attributes: ['id']
                        }
                    ]
                });

                if (exam && exam.questions) {
                    const totalQuestions = exam.questions.length;
                    if (totalQuestions > 0) {
                        const pointsPerQuestion = parseFloat(exam.total_score) / totalQuestions;
                        score = is_correct ? pointsPerQuestion : 0;
                    }
                }
            }
        }
        // Đối với short_answer/essay, điểm và is_correct sẽ null (cần teacher chấm thủ công)

        if (studentAnswer) {
            // Cập nhật câu trả lời đã có
            await studentAnswer.update({
                selected_answer_id: selected_answer_id || null,
                answer_text: answer_text || null,
                score: score !== null ? score : studentAnswer.score,
                is_correct: is_correct !== null ? is_correct : studentAnswer.is_correct,
                answered_at: now
            });
        } else {
            // Tạo câu trả lời mới
            studentAnswer = await StudentAnswerModel.create({
                session_id: session_id,
                exam_question_id: question_id,
                selected_answer_id: selected_answer_id || null,
                answer_text: answer_text || null,
                score: score,
                is_correct: is_correct,
                answered_at: now
            });
        }

        // Lấy lại student answer với đầy đủ thông tin
        const answerWithDetails = await StudentAnswerModel.findOne({
            where: { id: studentAnswer.id },
            include: [
                {
                    model: QuestionModel,
                    as: 'question',
                    attributes: ['id', 'question_text', 'type', 'difficulty']
                },
                {
                    model: QuestionAnswerModel,
                    as: 'selectedAnswer',
                    attributes: ['id', 'text', 'is_correct'],
                    required: false
                }
            ]
        });

        return res.status(200).send({
            message: studentAnswer ? 'Answer updated successfully' : 'Answer saved successfully',
            answer: answerWithDetails
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Lấy tất cả câu trả lời của một session
export const getSessionAnswers = async (req, res) => {
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

        // Lấy tất cả câu trả lời
        const answers = await StudentAnswerModel.findAll({
            where: {
                session_id: session_id
            },
            include: [
                {
                    model: QuestionModel,
                    as: 'question',
                    attributes: ['id', 'question_text', 'type', 'difficulty', 'image_url', 'order'],
                    include: [
                        {
                            model: QuestionAnswerModel,
                            as: 'answers',
                            attributes: ['id', 'text', 'is_correct']
                        }
                    ]
                },
                {
                    model: QuestionAnswerModel,
                    as: 'selectedAnswer',
                    attributes: ['id', 'text', 'is_correct'],
                    required: false
                }
            ],
            order: [
                [{ model: QuestionModel, as: 'question' }, 'order', 'ASC']
            ]
        });

        return res.status(200).send({
            session_id: session_id,
            answers: answers
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Lấy một câu trả lời cụ thể
export const getAnswer = async (req, res) => {
    try {
        const { session_id, question_id } = req.params;
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

        // Lấy câu trả lời
        const answer = await StudentAnswerModel.findOne({
            where: {
                session_id: session_id,
                exam_question_id: question_id
            },
            include: [
                {
                    model: QuestionModel,
                    as: 'question',
                    attributes: ['id', 'question_text', 'type', 'difficulty', 'image_url'],
                    include: [
                        {
                            model: QuestionAnswerModel,
                            as: 'answers',
                            attributes: ['id', 'text', 'is_correct']
                        }
                    ]
                },
                {
                    model: QuestionAnswerModel,
                    as: 'selectedAnswer',
                    attributes: ['id', 'text', 'is_correct'],
                    required: false
                }
            ]
        });

        if (!answer) {
            return res.status(404).send({ 
                message: 'Answer not found' 
            });
        }

        return res.status(200).send(answer);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

