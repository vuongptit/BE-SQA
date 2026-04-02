import { ExamModel, UserModel, ExamPurchaseModel } from "../models/index.model.js";
import { Op } from "sequelize";
import sequelize from "../config/db.config.js";

// Get exam purchases for teacher's exams
export const getTeacherExamPurchases = async (req, res) => {
    try {
        const teacher_id = req.userId;
        const { exam_id, page = 1, limit = 20 } = req.query;

        // Get teacher's exam IDs
        const examWhere = { created_by: teacher_id, is_paid: true };
        if (exam_id) {
            examWhere.id = exam_id;
        }

        const teacherExams = await ExamModel.findAll({
            where: examWhere,
            attributes: ['id']
        });
        const examIds = teacherExams.map(e => e.id);

        if (examIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    purchases: [],
                    pagination: {
                        total: 0,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: 0
                    }
                }
            });
        }

        const offset = (page - 1) * limit;

        const { count, rows } = await ExamPurchaseModel.findAndCountAll({
            where: {
                exam_id: { [Op.in]: examIds }
            },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'fee', 'created_by'],
                    where: { created_by: teacher_id }
                },
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email']
                }
            ],
            order: [['purchase_date', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        return res.status(200).json({
            success: true,
            data: {
                purchases: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            }
        });

    } catch (error) {
        console.error("Error getting teacher exam purchases:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting exam purchases",
            error: error.message
        });
    }
};

// Get revenue statistics for teacher
export const getTeacherExamRevenue = async (req, res) => {
    try {
        const teacher_id = req.userId;
        const { exam_id, date_from, date_to } = req.query;

        // Get teacher's exam IDs
        const examWhere = { created_by: teacher_id, is_paid: true };
        if (exam_id) {
            examWhere.id = exam_id;
        }

        const teacherExams = await ExamModel.findAll({
            where: examWhere,
            attributes: ['id', 'title', 'fee']
        });
        const examIds = teacherExams.map(e => e.id);
        const totalPaidExams = teacherExams.length;

        if (examIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    totalRevenue: 0,
                    totalPurchases: 0,
                    totalPaidExams: 0,
                    revenueByExam: [],
                    recentPurchases: []
                }
            });
        }

        // Build date filter
        const purchaseWhere = {
            exam_id: { [Op.in]: examIds }
        };

        if (date_from || date_to) {
            purchaseWhere.purchase_date = {};
            if (date_from) purchaseWhere.purchase_date[Op.gte] = new Date(date_from);
            if (date_to) purchaseWhere.purchase_date[Op.lte] = new Date(date_to);
        }

        // Total revenue
        const totalRevenue = await ExamPurchaseModel.sum('purchase_price', {
            where: purchaseWhere
        }) || 0;

        // Total purchases
        const totalPurchases = await ExamPurchaseModel.count({
            where: purchaseWhere
        });

        // Revenue by exam - Get exam info first
        const revenueByExamRaw = await ExamPurchaseModel.findAll({
            where: purchaseWhere,
            attributes: [
                'exam_id',
                [sequelize.fn('COUNT', sequelize.col('ExamPurchase.id')), 'purchase_count'],
                [sequelize.fn('SUM', sequelize.col('purchase_price')), 'revenue']
            ],
            group: ['exam_id'],
            raw: true
        });

        // Get exam details for each exam_id
        const revenueByExam = await Promise.all(
            revenueByExamRaw.map(async (item) => {
                const exam = await ExamModel.findOne({
                    where: { 
                        id: item.exam_id,
                        created_by: teacher_id 
                    },
                    attributes: ['id', 'title', 'fee']
                });
                return {
                    exam_id: item.exam_id,
                    exam_title: exam?.title || 'Unknown',
                    purchase_count: parseInt(item.purchase_count),
                    revenue: parseFloat(item.revenue)
                };
            })
        );

        // Recent purchases (last 10)
        const recentPurchases = await ExamPurchaseModel.findAll({
            where: purchaseWhere,
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title'],
                    where: { created_by: teacher_id }
                },
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email']
                }
            ],
            order: [['purchase_date', 'DESC']],
            limit: 10
        });

        return res.status(200).json({
            success: true,
            data: {
                totalRevenue: parseFloat(totalRevenue),
                totalPurchases,
                totalPaidExams: totalPaidExams,
                revenueByExam: revenueByExam,
                recentPurchases
            }
        });

    } catch (error) {
        console.error("Error getting teacher exam revenue:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting exam revenue",
            error: error.message
        });
    }
};

