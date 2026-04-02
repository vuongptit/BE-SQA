import { ExamPurchaseModel, ExamModel, UserModel, DepositHistoryModel, WithdrawHistoryModel } from "../../models/index.model.js";
import { Op } from "sequelize";
import sequelize from "../../config/db.config.js";

// ==================== PURCHASE MANAGEMENT ====================

export const getAllPurchases = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            user_id,
            exam_id,
            date_from,
            date_to,
            sortBy = 'purchase_date',
            order = 'DESC'
        } = req.query;
        
        const offset = (page - 1) * limit;

        const whereClause = {};
        
        if (user_id) whereClause.user_id = user_id;
        if (exam_id) whereClause.exam_id = exam_id;
        
        if (date_from || date_to) {
            whereClause.purchase_date = {};
            if (date_from) whereClause.purchase_date[Op.gte] = new Date(date_from);
            if (date_to) whereClause.purchase_date[Op.lte] = new Date(date_to);
        }
        
        const { count, rows } = await ExamPurchaseModel.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email', 'balance']
                },
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'fee', 'is_paid'],
                    include: [{
                        model: UserModel,
                        as: 'creator',
                        attributes: ['id', 'fullName', 'email']
                    }]
                }
            ],
            order: [[sortBy, order.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        const totalRevenue = await ExamPurchaseModel.sum('purchase_price', { where: whereClause });
        
        return res.status(200).json({
            success: true,
            data: {
                purchases: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                },
                summary: {
                    totalPurchases: count,
                    totalRevenue: totalRevenue ? parseFloat(totalRevenue).toFixed(2) : 0,
                    avgPurchaseValue: count > 0 ? (parseFloat(totalRevenue) / count).toFixed(2) : 0
                }
            }
        });
        
    } catch (error) {
        console.error("Error getting purchases:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting purchases",
            error: error.message
        });
    }
};

export const getPurchaseById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const purchase = await ExamPurchaseModel.findByPk(id, {
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email', 'balance']
                },
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'fee', 'is_paid', 'created_by'],
                    include: [{
                        model: UserModel,
                        as: 'creator',
                        attributes: ['id', 'fullName', 'email']
                    }]
                }
            ]
        });
        
        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: "Purchase not found"
            });
        }
        
        return res.status(200).json({
            success: true,
            data: purchase
        });
        
    } catch (error) {
        console.error("Error getting purchase:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting purchase details",
            error: error.message
        });
    }
};

export const refundPurchase = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
        const { id } = req.params;
        const { reason, amount } = req.body;
        
        if (!reason) {
            return res.status(400).json({
                success: false,
                message: "Refund reason is required"
            });
        }
        
        const purchase = await ExamPurchaseModel.findByPk(id, {
            include: [
                {
                    model: UserModel,
                    as: 'user'
                },
                {
                    model: ExamModel,
                    as: 'exam'
                }
            ]
        });
        
        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: "Purchase not found"
            });
        }

        const refundAmount = amount ? parseFloat(amount) : parseFloat(purchase.purchase_price);
        
        if (refundAmount > parseFloat(purchase.purchase_price)) {
            return res.status(400).json({
                success: false,
                message: "Refund amount cannot exceed purchase price"
            });
        }

        const user = purchase.user;
        user.balance = parseFloat(user.balance) + refundAmount;
        await user.save({ transaction });

        await purchase.destroy({ transaction });
        
        await transaction.commit();

        return res.status(200).json({
            success: true,
            message: "Refund processed successfully",
            data: {
                refundAmount: refundAmount,
                newBalance: parseFloat(user.balance),
                reason,
                purchaseInfo: {
                    exam: purchase.exam.title,
                    originalPrice: parseFloat(purchase.purchase_price)
                }
            }
        });
        
    } catch (error) {
        await transaction.rollback();
        console.error("Error processing refund:", error);
        return res.status(500).json({
            success: false,
            message: "Error processing refund",
            error: error.message
        });
    }
};

export const getTransactionHistory = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            type = 'all', // all, deposit, withdraw
            dateFrom,
            dateTo
        } = req.query;
        
        const offset = (page - 1) * limit;

        const dateFilter = {};
        if (dateFrom || dateTo) {
            if (dateFrom) dateFilter[Op.gte] = new Date(dateFrom);
            if (dateTo) {
                const endDate = new Date(dateTo);
                endDate.setHours(23, 59, 59, 999);
                dateFilter[Op.lte] = endDate;
            }
        }

        const userSearchFilter = search ? {
            [Op.or]: [
                { fullName: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } }
            ]
        } : {};
        
        let allTransactions = [];

        if (type === 'all' || type === 'deposit') {
            const depositWhere = { deposit_status: 'success' };
            if (Object.keys(dateFilter).length > 0) {
                depositWhere.created_at = dateFilter;
            }
            
            const deposits = await DepositHistoryModel.findAll({
                where: depositWhere,
                include: [{
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email'],
                    where: userSearchFilter,
                    required: Object.keys(userSearchFilter).length > 0
                }],
                raw: true,
                nest: true
            });
            
            allTransactions = allTransactions.concat(deposits.map(d => ({
                id: d.id,
                user: {
                    fullName: d.user.fullName,
                    email: d.user.email,
                    bankAccount: d.bankAccountNumber || 'N/A',
                    bankAccountName: d.bankAccountName || 'N/A',
                    bankName: d.bankName || 'N/A'
                },
                transactionType: 'deposit',
                amount: parseFloat(d.deposit_amount),
                transferType: 'in',
                created_at: d.created_at,
                referenceId: d.deposit_code
            })));
        }
        
        // Fetch withdrawals
        if (type === 'all' || type === 'withdraw') {
            const withdrawWhere = { status: 'approved' }; // Only approved withdrawals
            if (Object.keys(dateFilter).length > 0) {
                withdrawWhere.created_at = dateFilter;
            }
            
            const withdrawals = await WithdrawHistoryModel.findAll({
                where: withdrawWhere,
                include: [{
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email'],
                    where: userSearchFilter,
                    required: Object.keys(userSearchFilter).length > 0
                }],
                raw: true,
                nest: true
            });
            
            allTransactions = allTransactions.concat(withdrawals.map(w => ({
                id: w.id,
                user: {
                    fullName: w.user.fullName,
                    email: w.user.email,
                    bankAccount: w.bankAccountNumber || 'N/A',
                    bankAccountName: w.bankAccountName || 'N/A',
                    bankName: w.bankName || 'N/A'
                },
                transactionType: 'withdraw',
                amount: parseFloat(w.amount),
                transferType: 'out',
                created_at: w.created_at,
                referenceId: w.withdraw_code
            })));
        }
        
        // Sort by created_at DESC
        allTransactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        // Pagination
        const total = allTransactions.length;
        const paginatedTransactions = allTransactions.slice(offset, offset + parseInt(limit));
        
        return res.status(200).json({
            success: true,
            data: {
                transactions: paginatedTransactions,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
        
    } catch (error) {
        console.error("Error getting transaction history:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting transaction history",
            error: error.message
        });
    }
};

