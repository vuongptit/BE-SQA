import { ExamModel, UserModel, QuestionModel, QuestionAnswerModel, ExamResultModel, ExamPurchaseModel, ClassesModel } from "../../models/index.model.js";
import { Op } from "sequelize";
import sequelize from "../../config/db.config.js";

export const getAllExams = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            creator_id,
            class_id,
            is_paid,
            is_public,
            search,
            sortBy = 'created_at',
            order = 'DESC'
        } = req.query;
        
        const offset = (page - 1) * limit;

        const whereClause = {};
        
        if (creator_id) whereClause.created_by = creator_id;
        if (class_id) whereClause.class_id = class_id;
        if (is_paid !== undefined) whereClause.is_paid = is_paid === 'true';
        if (is_public !== undefined) whereClause.is_public = is_public === 'true';
        if (search) whereClause.title = { [Op.like]: `%${search}%` };
        
        const { count, rows } = await ExamModel.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: UserModel,
                    as: 'creator',
                    attributes: ['id', 'fullName', 'email']
                },
                {
                    model: ClassesModel,
                    as: 'classes',
                    attributes: ['id', 'className'],
                    through: { attributes: [] },
                    required: false
                },
                {
                    model: ExamResultModel,
                    as: 'results',
                    attributes: []
                },
                {
                    model: ExamPurchaseModel,
                    as: 'purchases',
                    attributes: []
                }
            ],
            attributes: {
                include: [
                    [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('results.id'))), 'submission_count'],
                    [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('purchases.id'))), 'purchase_count'],
                    [sequelize.fn('AVG', sequelize.col('results.percentage')), 'avg_score']
                ]
            },
            group: ['Exams.id', 'creator.id', 'classes.id'],
            order: [[sortBy, order.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset),
            subQuery: false
        });
        
        // Calculate total revenue if has paid exams
        const totalRevenue = await ExamPurchaseModel.sum('purchase_price', {
            include: [{
                model: ExamModel,
                as: 'exam',
                where: whereClause,
                attributes: []
            }]
        });
        
        return res.status(200).json({
            success: true,
            data: {
                exams: rows,
                pagination: {
                    total: count.length || count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil((count.length || count) / limit)
                },
                summary: {
                    totalRevenue: totalRevenue ? parseFloat(totalRevenue).toFixed(2) : 0
                }
            }
        });
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error getting exams",
            error: error.message
        });
    }
};

export const getExamById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const exam = await ExamModel.findByPk(id, {
            include: [
                {
                    model: UserModel,
                    as: 'creator',
                    attributes: ['id', 'fullName', 'email']
                },
                {
                    model: ClassesModel,
                    as: 'classes',
                    attributes: ['id', 'className'],
                    through: { attributes: [] }
                },
                {
                    model: QuestionModel,
                    as: 'questions',
                    include: [{
                        model: QuestionAnswerModel,
                        as: 'answers'
                    }]
                }
            ]
        });
        
        if (!exam) {
            return res.status(404).json({
                success: false,
                message: "Exam not found"
            });
        }

        const submissionCount = await ExamResultModel.count({ where: { exam_id: id } });
        const purchaseCount = await ExamPurchaseModel.count({ where: { exam_id: id } });
        
        const avgScoreResult = await ExamResultModel.findOne({
            where: { exam_id: id },
            attributes: [[sequelize.fn('AVG', sequelize.col('percentage')), 'avgScore']]
        });
        
        const revenue = await ExamPurchaseModel.sum('purchase_price', { where: { exam_id: id } });
        
        return res.status(200).json({
            success: true,
            data: {
                exam,
                statistics: {
                    submissionCount,
                    purchaseCount,
                    avgScore: avgScoreResult ? parseFloat(avgScoreResult.dataValues.avgScore).toFixed(2) : 0,
                    revenue: revenue ? parseFloat(revenue).toFixed(2) : 0
                }
            }
        });
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error getting exam details",
            error: error.message
        });
    }
};

export const updateExam = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, des, minutes, start_time, end_time, is_paid, fee, is_public, total_score } = req.body;
        
        const exam = await ExamModel.findByPk(id);
        
        if (!exam) {
            return res.status(404).json({
                success: false,
                message: "Exam not found"
            });
        }

        if (title) exam.title = title;
        if (des !== undefined) exam.des = des;
        if (minutes) exam.minutes = minutes;
        if (start_time) exam.start_time = start_time;
        if (end_time) exam.end_time = end_time;
        if (is_paid !== undefined) exam.is_paid = is_paid;
        if (fee !== undefined) exam.fee = fee;
        if (is_public !== undefined) exam.is_public = is_public;
        if (total_score) exam.total_score = total_score;
        
        await exam.save();
        
        return res.status(200).json({
            success: true,
            message: "Exam updated successfully",
            data: exam
        });
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating exam",
            error: error.message
        });
    }
};

export const deleteExam = async (req, res) => {
    try {
        const { id } = req.params;
        
        const exam = await ExamModel.findByPk(id);
        
        if (!exam) {
            return res.status(404).json({
                success: false,
                message: "Exam not found"
            });
        }

        const questionCount = await QuestionModel.count({ where: { exam_id: id } });
        const submissionCount = await ExamResultModel.count({ where: { exam_id: id } });
        const purchaseCount = await ExamPurchaseModel.count({ where: { exam_id: id } });
        
        await exam.destroy();
        
        return res.status(200).json({
            success: true,
            message: "Exam deleted successfully",
            info: {
                questionsDeleted: questionCount,
                submissionsAffected: submissionCount,
                purchasesAffected: purchaseCount
            }
        });
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error deleting exam",
            error: error.message
        });
    }
};

export const getExamResults = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 10 } = req.query;
        
        const offset = (page - 1) * limit;
        
        const { count, rows } = await ExamResultModel.findAndCountAll({
            where: { exam_id: id },
            include: [
                {
                    model: UserModel,
                    as: 'student',
                    attributes: ['id', 'fullName', 'email']
                }
            ],
            order: [['submitted_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        const formattedResults = rows.map(result => ({
            id: result.id,
            session_id: result.session_id,
            student_id: result.student_id,
            exam_id: result.exam_id,
            total_score: parseFloat(result.total_score) || 0,
            correct_count: result.correct_count || 0,
            wrong_count: result.wrong_count || 0,
            percentage: parseFloat(result.percentage) || 0,
            submitted_at: result.submitted_at,
            student: result.student ? {
                id: result.student.id,
                fullName: result.student.fullName,
                email: result.student.email
            } : null
        }));
        
        return res.status(200).json({
            success: true,
            data: {
                results: formattedResults,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count,
                    totalPages: Math.ceil(count / parseInt(limit))
                }
            }
        });
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error getting exam results",
            error: error.message
        });
    }
};

