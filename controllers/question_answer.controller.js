import { QuestionAnswerModel, QuestionModel, ExamModel } from "../models/index.model.js";
import { Op } from "sequelize";

// Create answer
export const createAnswer = async (req, res) => {
    try {
        const { question_id, text, is_correct } = req.body;
        const userId = req.userId; // Get from middleware

        // Validate required fields
        if (!question_id || !text) {
            return res.status(400).send({ 
                message: 'Missing required fields: question_id, text' 
            });
        }

        // Validate that the question exists and belongs to the teacher
        const question = await QuestionModel.findOne({
            where: { id: question_id },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'created_by']
                }
            ]
        });

        if (!question) {
            return res.status(404).send({ 
                message: 'Question not found' 
            });
        }

        // Check if user is the teacher who created the question
        if (question.teacher_id !== userId) {
            return res.status(403).send({ 
                message: 'You do not have permission to create answer for this question' 
            });
        }

        // Create answer
        const answer = await QuestionAnswerModel.create({
            question_id,
            text,
            is_correct: is_correct || false
        });

        // Return answer with question info
        const answerWithQuestion = await QuestionAnswerModel.findOne({
            where: { id: answer.id },
            include: [
                {
                    model: QuestionModel,
                    as: 'question',
                    attributes: ['id', 'question_text', 'exam_id']
                }
            ]
        });

        return res.status(201).send(answerWithQuestion);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Get answer by ID
export const getAnswerById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const role = req.role;

        const answer = await QuestionAnswerModel.findOne({
            where: { id },
            include: [
                {
                    model: QuestionModel,
                    as: 'question',
                    attributes: ['id', 'question_text', 'teacher_id', 'exam_id'],
                    include: [
                        {
                            model: ExamModel,
                            as: 'exam',
                            attributes: ['id', 'title']
                        }
                    ]
                }
            ]
        });

        if (!answer) {
            return res.status(404).send({ message: 'Answer not found' });
        }

        // Teacher can only see answers for their own questions
        if (role === 'teacher' && answer.question.teacher_id !== userId) {
            return res.status(403).send({ 
                message: 'You do not have permission to view this answer' 
            });
        }

        return res.status(200).send(answer);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Get all answers (by question or all for teacher)
export const getAnswers = async (req, res) => {
    try {
        const userId = req.userId;
        const role = req.role;
        const { question_id } = req.query;

        let whereCondition = {};

        if (question_id) {
            whereCondition.question_id = question_id;
            
            // If filtering by question, verify teacher owns the question
            if (role === 'teacher') {
                const question = await QuestionModel.findOne({
                    where: { 
                        id: question_id,
                        teacher_id: userId
                    }
                });

                if (!question) {
                    return res.status(403).send({ 
                        message: 'You do not have permission to view answers for this question' 
                    });
                }
            }
        } else if (role === 'teacher') {
            // If no question_id, get all answers for teacher's questions
            const teacherQuestions = await QuestionModel.findAll({
                where: { teacher_id: userId },
                attributes: ['id']
            });
            
            const questionIds = teacherQuestions.map(q => q.id);
            if (questionIds.length === 0) {
                return res.status(200).send([]);
            }
            
            whereCondition.question_id = {
                [Op.in]: questionIds
            };
        }

        const answers = await QuestionAnswerModel.findAll({
            where: whereCondition,
            include: [
                {
                    model: QuestionModel,
                    as: 'question',
                    attributes: ['id', 'question_text', 'exam_id'],
                    include: [
                        {
                            model: ExamModel,
                            as: 'exam',
                            attributes: ['id', 'title']
                        }
                    ]
                }
            ],
            order: [['created_at', 'DESC']]
        });

        return res.status(200).send(answers);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Update answer
export const updateAnswer = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const { text, is_correct } = req.body;

        // Find answer
        const answer = await QuestionAnswerModel.findOne({
            where: { id },
            include: [
                {
                    model: QuestionModel,
                    as: 'question',
                    attributes: ['id', 'teacher_id']
                }
            ]
        });

        if (!answer) {
            return res.status(404).send({ message: 'Answer not found' });
        }

        // Check if user is the teacher who created the question
        if (answer.question.teacher_id !== userId) {
            return res.status(403).send({ 
                message: 'You do not have permission to update this answer' 
            });
        }

        // Update answer
        const updateData = {};
        if (text !== undefined) updateData.text = text;
        if (is_correct !== undefined) updateData.is_correct = is_correct;

        await answer.update(updateData);

        // Return updated answer
        const updatedAnswer = await QuestionAnswerModel.findOne({
            where: { id },
            include: [
                {
                    model: QuestionModel,
                    as: 'question',
                    attributes: ['id', 'question_text', 'exam_id'],
                    include: [
                        {
                            model: ExamModel,
                            as: 'exam',
                            attributes: ['id', 'title']
                        }
                    ]
                }
            ]
        });

        return res.status(200).send(updatedAnswer);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Delete answer
export const deleteAnswer = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        // Find answer
        const answer = await QuestionAnswerModel.findOne({
            where: { id },
            include: [
                {
                    model: QuestionModel,
                    as: 'question',
                    attributes: ['id', 'teacher_id']
                }
            ]
        });

        if (!answer) {
            return res.status(404).send({ message: 'Answer not found' });
        }

        // Check if user is the teacher who created the question
        if (answer.question.teacher_id !== userId) {
            return res.status(403).send({ 
                message: 'You do not have permission to delete this answer' 
            });
        }

        // Check if this is the last answer for the question
        const answerCount = await QuestionAnswerModel.count({
            where: { question_id: answer.question_id }
        });

        if (answerCount <= 1) {
            return res.status(400).send({ 
                message: 'Cannot delete the last answer. A question must have at least one answer.' 
            });
        }

        // Delete answer
        await answer.destroy();

        return res.status(200).send({ 
            message: 'Answer deleted successfully' 
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

