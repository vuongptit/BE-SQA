import { UserModel, ClassesModel, ExamModel, ExamPurchaseModel, ExamSessionModel, DepositHistoryModel } from "../../models/index.model.js";
import { Op } from "sequelize";
import sequelize from "../../config/db.config.js";

// ==================== DASHBOARD ====================

export const getDashboard = async (req, res) => {
    try {
        const totalUsers = await UserModel.count();
        const totalStudents = await UserModel.count({ where: { role: 'student' } });
        const totalTeachers = await UserModel.count({ where: { role: 'teacher' } });
        const totalAdmins = await UserModel.count({ where: { role: 'admin' } });
        
        const totalClasses = await ClassesModel.count();
        const totalExams = await ExamModel.count();
        const freeExams = await ExamModel.count({ where: { is_paid: false } });
        const paidExams = await ExamModel.count({ where: { is_paid: true } });

        const totalRevenue = await ExamPurchaseModel.sum('purchase_price') || 0;
        const totalPurchases = await ExamPurchaseModel.count();

        const totalDeposit = await DepositHistoryModel.sum('deposit_amount', {
            where: { deposit_status: 'success' }
        }) || 0;
        const totalTransactions = await DepositHistoryModel.count({
            where: { deposit_status: 'success' }
        });

        const activeSessions = await ExamSessionModel.count({
            where: { status: 'in_progress' }
        });

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentUsers = await UserModel.count({
            where: {
                created_at: {
                    [Op.gte]: thirtyDaysAgo
                }
            }
        });

        const newUsers = await UserModel.findAll({
            where: {
                created_at: {
                    [Op.gte]: thirtyDaysAgo
                }
            },
            attributes: [
                [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: [sequelize.fn('DATE', sequelize.col('created_at'))],
            order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
            raw: true
        });
        
        const newExams = await ExamModel.findAll({
            where: {
                created_at: {
                    [Op.gte]: thirtyDaysAgo
                }
            },
            attributes: [
                [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: [sequelize.fn('DATE', sequelize.col('created_at'))],
            order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
            raw: true
        });
        
        const examSessions = await ExamSessionModel.findAll({
            where: {
                start_time: {
                    [Op.gte]: thirtyDaysAgo
                }
            },
            attributes: [
                [sequelize.fn('DATE', sequelize.col('start_time')), 'date'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: [sequelize.fn('DATE', sequelize.col('start_time'))],
            order: [[sequelize.fn('DATE', sequelize.col('start_time')), 'ASC']],
            raw: true
        });

        const dailyStatsMap = {};
        const today = new Date();

        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            dailyStatsMap[dateStr] = { 
                date: dateStr, 
                newUsers: 0, 
                newExams: 0, 
                examSessions: 0 
            };
        }

        newUsers.forEach(item => {
            if (dailyStatsMap[item.date]) {
                dailyStatsMap[item.date].newUsers = parseInt(item.count);
            }
        });
        
        newExams.forEach(item => {
            if (dailyStatsMap[item.date]) {
                dailyStatsMap[item.date].newExams = parseInt(item.count);
            }
        });
        
        examSessions.forEach(item => {
            if (dailyStatsMap[item.date]) {
                dailyStatsMap[item.date].examSessions = parseInt(item.count);
            }
        });
        
        const dailyStats = Object.values(dailyStatsMap).sort((a, b) => a.date.localeCompare(b.date));

        const popularExams = await ExamModel.findAll({
            where: { is_paid: true },
            include: [
                {
                    model: ExamPurchaseModel,
                    as: 'purchases',
                    attributes: []
                },
                {
                    model: UserModel,
                    as: 'creator',
                    attributes: ['id', 'fullName', 'email']
                }
            ],
            attributes: [
                'id', 'title', 'fee',
                [sequelize.fn('COUNT', sequelize.col('purchases.id')), 'purchase_count']
            ],
            group: ['Exams.id', 'creator.id'],
            order: [[sequelize.fn('COUNT', sequelize.col('purchases.id')), 'DESC']],
            limit: 10,
            subQuery: false
        });
        
        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalUsers,
                    totalStudents,
                    totalTeachers,
                    totalAdmins,
                    totalClasses,
                    totalExams,
                    freeExams,
                    paidExams,
                    totalDeposit: parseFloat(totalDeposit).toFixed(2),
                    totalTransactions,
                    totalRevenue: parseFloat(totalRevenue).toFixed(2),
                    totalPurchases,
                    recentUsers,
                    activeSessions
                },
                charts: {
                    dailyStats
                },
                popularExams
            }
        });
        
    } catch (error) {
        console.error("Error getting dashboard:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting dashboard data",
            error: error.message
        });
    }
};

