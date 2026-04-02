import { Op } from "sequelize";
import { WithdrawHistoryModel, UserModel, TransactionHistoryModel } from "../../models/index.model.js";
import sequelize from "../../config/db.config.js";

export const getAllWithdrawals = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            status = 'all',
            sortBy = 'created_at',
            order = 'DESC',
            fromDate,
            toDate
        } = req.query;

        const offset = (page - 1) * limit;
        const where = {};

        if (status !== 'all') {
            where.status = status;
        }

        if (fromDate || toDate) {
            where.created_at = {};
            if (fromDate) {
                where.created_at[Op.gte] = new Date(fromDate);
            }
            if (toDate) {
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);
                where.created_at[Op.lte] = endDate;
            }
        }

        const includeOptions = [
            {
                model: UserModel,
                as: 'user',
                attributes: ['id', 'fullName', 'email', 'balance'],
                where: search ? {
                    email: {
                        [Op.like]: `%${search}%`
                    }
                } : undefined
            },
            {
                model: UserModel,
                as: 'processedBy',
                attributes: ['id', 'fullName', 'email'],
                required: false
            }
        ];

        const { count, rows } = await WithdrawHistoryModel.findAndCountAll({
            where,
            include: includeOptions,
            order: [[sortBy, order.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset),
            distinct: true
        });

        const summaryQuery = await WithdrawHistoryModel.findAll({
            attributes: [
                'status',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount']
            ],
            group: ['status'],
            raw: true
        });

        const summary = {
            totalPending: 0,
            totalApproved: 0,
            totalRejected: 0,
            totalAmountPending: 0,
            totalAmountApproved: 0
        };

        summaryQuery.forEach(item => {
            const status = item.status;
            const count = parseInt(item.count) || 0;
            const amount = parseFloat(item.total_amount) || 0;

            if (status === 'pending') {
                summary.totalPending = count;
                summary.totalAmountPending = amount;
            } else if (status === 'approved') {
                summary.totalApproved = count;
                summary.totalAmountApproved = amount;
            } else if (status === 'rejected') {
                summary.totalRejected = count;
            }
        });

        return res.status(200).json({
            success: true,
            message: "Lấy danh sách rút tiền thành công",
            data: {
                withdrawals: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                },
                summary
            }
        });

    } catch (error) {
        console.error("Lỗi khi lấy danh sách rút tiền:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi lấy danh sách rút tiền",
            error: error.message
        });
    }
};

export const approveWithdrawal = async (req, res) => {
    let transaction = null;
    try {
        const { id } = req.params;
        const { admin_note } = req.body;
        const adminId = req.userId;

        transaction = await sequelize.transaction();

        const withdrawal = await WithdrawHistoryModel.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!withdrawal) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy yêu cầu rút tiền"
            });
        }

        if (withdrawal.status !== 'pending') {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Không thể duyệt yêu cầu rút tiền đã ở trạng thái '${withdrawal.status}'`
            });
        }

        // Cập nhật withdrawal status
        withdrawal.status = 'approved';
        withdrawal.admin_note = admin_note || null;
        withdrawal.processed_by = adminId;
        withdrawal.processed_at = new Date();

        await withdrawal.save({ transaction });

        // Tìm và cập nhật transaction history
        const withdrawAmount = parseFloat(withdrawal.amount);
        const transactionHistory = await TransactionHistoryModel.findOne({
            where: {
                referenceId: withdrawal.id,
                transactionType: 'withdraw'
            },
            transaction
        });

        if (transactionHistory) {
            await transactionHistory.update({
                transactionStatus: 'success',
                description: admin_note
                    ? `Rút tiền đã được duyệt: ${withdrawAmount.toLocaleString('vi-VN')} VNĐ - Mã: ${withdrawal.withdraw_code}. Ghi chú: ${admin_note}`
                    : `Rút tiền đã được duyệt: ${withdrawAmount.toLocaleString('vi-VN')} VNĐ - Mã: ${withdrawal.withdraw_code}`
            }, { transaction });
        }

        await transaction.commit();

        return res.status(200).json({
            success: true,
            message: "Đã duyệt yêu cầu rút tiền thành công",
            data: {
                id: withdrawal.id,
                status: withdrawal.status,
                admin_note: withdrawal.admin_note,
                processed_by: withdrawal.processed_by,
                processed_at: withdrawal.processed_at
            }
        });

    } catch (error) {
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error("Lỗi rollback transaction:", rollbackError);
            }
        }
        console.error("Lỗi khi duyệt yêu cầu rút tiền:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi duyệt yêu cầu rút tiền",
            error: error.message
        });
    }
};

export const rejectWithdrawal = async (req, res) => {
    let transaction = null;
    try {
        const { id } = req.params;
        const { reject_reason } = req.body;
        const adminId = req.userId;

        // Validate reject_reason
        if (!reject_reason || reject_reason.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp lý do từ chối"
            });
        }

        transaction = await sequelize.transaction();

        const withdrawal = await WithdrawHistoryModel.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!withdrawal) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy yêu cầu rút tiền"
            });
        }

        if (withdrawal.status !== 'pending' && withdrawal.status !== 'approved') {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Không thể từ chối yêu cầu rút tiền đã ở trạng thái '${withdrawal.status}'`
            });
        }

        // Nếu withdrawal đang ở trạng thái pending, cần hoàn tiền lại cho user
        // (vì khi user tạo withdrawal request, tiền đã bị trừ)
        if (withdrawal.status === 'pending') {
            const user = await UserModel.findByPk(withdrawal.user_id, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (user) {
                const withdrawAmount = parseFloat(withdrawal.amount);
                const currentBalance = parseFloat(user.balance || 0);
                const refundBalance = currentBalance + withdrawAmount;

                await user.update({
                    balance: refundBalance
                }, { transaction });

                // Tạo transaction history cho việc hoàn tiền
                await TransactionHistoryModel.create({
                    user_id: withdrawal.user_id,
                    transactionType: 'adjustment',
                    referenceId: withdrawal.id,
                    amount: withdrawAmount,
                    transferType: 'refund',
                    beforeBalance: currentBalance,
                    afterBalance: refundBalance,
                    transactionStatus: 'success',
                    description: `Hoàn tiền do yêu cầu rút tiền bị từ chối: ${withdrawAmount.toLocaleString('vi-VN')} VNĐ - Mã: ${withdrawal.withdraw_code}. Lý do: ${reject_reason}`
                }, { transaction });
            }
        }

        // Cập nhật withdrawal status
        withdrawal.status = 'rejected';
        withdrawal.reject_reason = reject_reason;
        withdrawal.processed_by = adminId;
        withdrawal.processed_at = new Date();

        await withdrawal.save({ transaction });

        // Tìm và cập nhật transaction history của withdrawal
        const withdrawAmount = parseFloat(withdrawal.amount);
        const transactionHistory = await TransactionHistoryModel.findOne({
            where: {
                referenceId: withdrawal.id,
                transactionType: 'withdraw'
            },
            transaction
        });

        if (transactionHistory) {
            await transactionHistory.update({
                transactionStatus: 'failed',
                description: `Yêu cầu rút tiền bị từ chối: ${withdrawAmount.toLocaleString('vi-VN')} VNĐ - Mã: ${withdrawal.withdraw_code}. Lý do: ${reject_reason}`
            }, { transaction });
        }

        await transaction.commit();

        return res.status(200).json({
            success: true,
            message: "Đã từ chối yêu cầu rút tiền",
            data: {
                id: withdrawal.id,
                status: withdrawal.status,
                reject_reason: withdrawal.reject_reason,
                processed_by: withdrawal.processed_by,
                processed_at: withdrawal.processed_at
            }
        });

    } catch (error) {
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error("Lỗi rollback transaction:", rollbackError);
            }
        }
        console.error("Lỗi khi từ chối yêu cầu rút tiền:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi từ chối yêu cầu rút tiền",
            error: error.message
        });
    }
};

export const getWithdrawalById = async (req, res) => {
    try {
        const { id } = req.params;

        const withdrawal = await WithdrawHistoryModel.findByPk(id, {
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email', 'balance', 'phoneNumber', 'role']
                },
                {
                    model: UserModel,
                    as: 'processedBy',
                    attributes: ['id', 'fullName', 'email', 'role'],
                    required: false
                }
            ]
        });

        if (!withdrawal) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy yêu cầu rút tiền"
            });
        }

        return res.status(200).json({
            success: true,
            data: withdrawal
        });

    } catch (error) {
        console.error("Lỗi khi lấy chi tiết yêu cầu rút tiền:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi lấy chi tiết yêu cầu rút tiền",
            error: error.message
        });
    }
};
