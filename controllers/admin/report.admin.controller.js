import { UserModel, ExamModel, ExamPurchaseModel, ExamResultModel, DepositHistoryModel, WithdrawHistoryModel } from "../../models/index.model.js";
import { Op } from "sequelize";
import sequelize from "../../config/db.config.js";

// ==================== REPORTS & ANALYTICS ====================

const calculatePeriodStats = async (daysAgo, periodName) => {

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo + 1);
    startDate.setHours(0, 0, 0, 0);

    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    prevEndDate.setHours(23, 59, 59, 999);

    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - daysAgo + 1);
    prevStartDate.setHours(0, 0, 0, 0);
    
    const currentDeposit = await DepositHistoryModel.sum('deposit_amount', {
        where: {
            deposit_status: 'success',
            created_at: { [Op.between]: [startDate, endDate] }
        }
    }) || 0;
    
    const currentWithdrawal = await WithdrawHistoryModel.sum('amount', {
        where: {
            status: 'approved',
            created_at: { [Op.between]: [startDate, endDate] }
        }
    }) || 0;
    
    const currentPurchase = await ExamPurchaseModel.sum('purchase_price', {
        where: {
            purchase_date: { [Op.between]: [startDate, endDate] }
        }
    }) || 0;

    const prevDeposit = await DepositHistoryModel.sum('deposit_amount', {
        where: {
            deposit_status: 'success',
            created_at: { [Op.between]: [prevStartDate, prevEndDate] }
        }
    }) || 0;
    
    const prevWithdrawal = await WithdrawHistoryModel.sum('amount', {
        where: {
            status: 'approved',
            created_at: { [Op.between]: [prevStartDate, prevEndDate] }
        }
    }) || 0;
    
    const prevPurchase = await ExamPurchaseModel.sum('purchase_price', {
        where: {
            purchase_date: { [Op.between]: [prevStartDate, prevEndDate] }
        }
    }) || 0;

    const currentRevenue = currentDeposit - currentWithdrawal;
    const prevRevenue = prevDeposit - prevWithdrawal;

    const calcPercentChange = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return parseFloat((((current - previous) / previous) * 100).toFixed(1));
    };
    
    return {
        current: {
            deposit: parseFloat(currentDeposit.toFixed(2)),
            withdrawal: parseFloat(currentWithdrawal.toFixed(2)),
            purchase: parseFloat(currentPurchase.toFixed(2)),
            revenue: parseFloat(currentRevenue.toFixed(2))
        },
        previous: {
            deposit: parseFloat(prevDeposit.toFixed(2)),
            withdrawal: parseFloat(prevWithdrawal.toFixed(2)),
            purchase: parseFloat(prevPurchase.toFixed(2)),
            revenue: parseFloat(prevRevenue.toFixed(2))
        },
        percentChange: {
            deposit: calcPercentChange(currentDeposit, prevDeposit),
            withdrawal: calcPercentChange(currentWithdrawal, prevWithdrawal),
            purchase: calcPercentChange(currentPurchase, prevPurchase),
            revenue: calcPercentChange(currentRevenue, prevRevenue)
        }
    };
};

export const getRevenueReport = async (req, res) => {
    try {
        const { year = new Date().getFullYear(), group_by = 'month' } = req.query;

        const todayStats = await calculatePeriodStats(1, 'today');
        const sevenDaysStats = await calculatePeriodStats(7, '7days');
        const thirtyDaysStats = await calculatePeriodStats(30, '30days');

        const monthlyData = [];
        for (let month = 1; month <= 12; month++) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59, 999);
            
            const monthDeposit = await DepositHistoryModel.sum('deposit_amount', {
                where: {
                    deposit_status: 'success',
                    created_at: { [Op.between]: [startDate, endDate] }
                }
            }) || 0;
            
            const monthWithdrawal = await WithdrawHistoryModel.sum('amount', {
                where: {
                    status: 'approved',
                    created_at: { [Op.between]: [startDate, endDate] }
                }
            }) || 0;
            
            monthlyData.push({
                month: `${year}-${String(month).padStart(2, '0')}`,
                revenue: parseFloat((monthDeposit - monthWithdrawal).toFixed(2)),
                deposit: parseFloat(monthDeposit.toFixed(2)),
                withdrawal: parseFloat(monthWithdrawal.toFixed(2))
            });
        }

        const dailyData = [];
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const startOfDay = new Date(date.setHours(0, 0, 0, 0));
            const endOfDay = new Date(date.setHours(23, 59, 59, 999));
            
            const dayDeposit = await DepositHistoryModel.sum('deposit_amount', {
                where: {
                    deposit_status: 'success',
                    created_at: { [Op.between]: [startOfDay, endOfDay] }
                }
            }) || 0;
            
            const dayWithdrawal = await WithdrawHistoryModel.sum('amount', {
                where: {
                    status: 'approved',
                    created_at: { [Op.between]: [startOfDay, endOfDay] }
                }
            }) || 0;
            
            const dayPurchase = await ExamPurchaseModel.sum('purchase_price', {
                where: {
                    purchase_date: { [Op.between]: [startOfDay, endOfDay] }
                }
            }) || 0;
            
            const dateStr = startOfDay.toISOString().split('T')[0];
            dailyData.push({
                date: dateStr,
                deposit: parseFloat(dayDeposit.toFixed(2)),
                withdrawal: parseFloat(dayWithdrawal.toFixed(2)),
                purchase: parseFloat(dayPurchase.toFixed(2))
            });
        }
        
        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    today: todayStats,
                    "7days": sevenDaysStats,
                    "30days": thirtyDaysStats
                },
                monthly: monthlyData,
                daily: dailyData
            }
        });
        
    } catch (error) {
        console.error("Error getting revenue report:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting revenue report",
            error: error.message
        });
    }
};

export const getUserActivityReport = async (req, res) => {
    try {
        const { date_from, date_to, role } = req.query;
        
        const whereClause = {};
        
        if (date_from || date_to) {
            whereClause.created_at = {};
            if (date_from) whereClause.created_at[Op.gte] = new Date(date_from);
            if (date_to) whereClause.created_at[Op.lte] = new Date(date_to);
        }
        
        if (role) {
            whereClause.role = role;
        }
        const totalUsers = await UserModel.count({ where: whereClause });
        const registrationsByDay = await UserModel.findAll({
            where: whereClause,
            attributes: [
                [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                'role'
            ],
            group: [sequelize.fn('DATE', sequelize.col('created_at')), 'role'],
            order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
            raw: true
        });

        const mostActiveUsers = await ExamResultModel.findAll({
            include: [
                {
                    model: UserModel,
                    as: 'student',
                    attributes: ['id', 'fullName', 'email']
                }
            ],
            attributes: [
                'student_id',
                [sequelize.fn('COUNT', sequelize.col('student_id')), 'submission_count'],
                [sequelize.fn('AVG', sequelize.col('percentage')), 'avg_score']
            ],
            group: ['student_id', 'student.id'],
            order: [[sequelize.fn('COUNT', sequelize.col('student_id')), 'DESC']],
            limit: 10,
            subQuery: false
        });
        
        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalUsers,
                    averageUsersPerDay: registrationsByDay.length > 0 ? 
                        (totalUsers / registrationsByDay.length).toFixed(2) : 0
                },
                registrationsByDay,
                mostActiveUsers
            }
        });
        
    } catch (error) {
        console.error("Error getting user activity report:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting user activity report",
            error: error.message
        });
    }
};

export const getExamStatsReport = async (req, res) => {
    try {
        const { date_from, date_to, class_id, teacher_id } = req.query;
        
        const whereClause = {};
        
        if (date_from || date_to) {
            whereClause.created_at = {};
            if (date_from) whereClause.created_at[Op.gte] = new Date(date_from);
            if (date_to) whereClause.created_at[Op.lte] = new Date(date_to);
        }
        
        if (class_id) whereClause.class_id = class_id;
        if (teacher_id) whereClause.created_by = teacher_id;

        const totalExams = await ExamModel.count({ where: whereClause });

        const totalSubmissions = await ExamResultModel.count({
            include: [{
                model: ExamModel,
                as: 'exam',
                where: whereClause,
                attributes: []
            }]
        });

        const avgScoreResult = await ExamResultModel.findOne({
            include: [{
                model: ExamModel,
                as: 'exam',
                where: whereClause,
                attributes: []
            }],
            attributes: [[sequelize.fn('AVG', sequelize.col('percentage')), 'avgScore']]
        });

        const passedCount = await ExamResultModel.count({
            where: { percentage: { [Op.gte]: 50 } },
            include: [{
                model: ExamModel,
                as: 'exam',
                where: whereClause,
                attributes: []
            }]
        });
        
        const passRate = totalSubmissions > 0 ? ((passedCount / totalSubmissions) * 100).toFixed(2) : 0;
        
        // Exams by status
        const now = new Date();
        const examsByStatus = {
            upcoming: await ExamModel.count({ 
                where: { 
                    ...whereClause, 
                    start_time: { [Op.gt]: now } 
                } 
            }),
            ongoing: await ExamModel.count({ 
                where: { 
                    ...whereClause, 
                    start_time: { [Op.lte]: now },
                    end_time: { [Op.gte]: now }
                } 
            }),
            ended: await ExamModel.count({ 
                where: { 
                    ...whereClause, 
                    end_time: { [Op.lt]: now } 
                } 
            })
        };
        
        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalExams,
                    totalSubmissions,
                    avgScoreOverall: avgScoreResult ? parseFloat(avgScoreResult.dataValues.avgScore).toFixed(2) : 0,
                    passRate: parseFloat(passRate)
                },
                examsByStatus
            }
        });
        
    } catch (error) {
        console.error("Error getting exam stats report:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting exam statistics report",
            error: error.message
        });
    }
};

