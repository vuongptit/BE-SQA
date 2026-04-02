import { ExamModel, UserModel, ExamPurchaseModel, TransactionHistoryModel } from "../models/index.model.js";
import { Op } from "sequelize";
import sequelize from "../config/db.config.js";

// Mua luot thi
export const purchaseExam = async (req, res) => {
    let transaction = null;
    let newBalance = null;

    try {
        const userId = req.userId;
        const { exam_id } = req.body;

        if (!exam_id) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp exam_id"
            });
        }

        // ccheck ton tai de thi
        const exam = await ExamModel.findByPk(exam_id);
        if (!exam) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy đề thi"
            });
        }

        if (!exam.is_paid) {
            return res.status(400).json({
                success: false,
                message: "Đề thi này không cần mua"
            });
        }


        // Kiem tra so du
        const user = await UserModel.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy người dùng"
            });
        }


        const userBalance = parseFloat(user.balance);
        const examFee = parseFloat(exam.fee);

        if (userBalance < examFee) {
            return res.status(400).json({
                success: false,
                message: "Số dư không đủ để mua đề thi này",
                currentBalance: user.balance,
                requiredAmount: exam.fee
            });
        }

        // init trans
        transaction = await sequelize.transaction();

        // tru tien
        newBalance = userBalance - examFee;
        await user.update({
            balance: newBalance
        }, { transaction });

        const purchase = await ExamPurchaseModel.create({
            user_id: userId,
            exam_id: exam_id,
            purchase_price: exam.fee
        }, { transaction });

        // transaction history student purchase
        await TransactionHistoryModel.create({
            user_id: userId,
            transactionType: 'purchase',
            referenceId: purchase.id,
            transferType: 'out',
            amount: examFee,
            beforeBalance: userBalance,
            afterBalance: newBalance,
            transactionStatus: 'success',
            description: `Mua lượt thi: ${exam.title}`
        }, { transaction });

        // cong tien cho teacher -20% phi 
        if (exam.created_by) {
            const teacher = await UserModel.findByPk(exam.created_by, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (teacher) {
                const teacherBalance = parseFloat(teacher.balance || 0);
                const teacherNewBalance = teacherBalance + (examFee * 0.8);

                await teacher.update({
                    balance: teacherNewBalance
                }, { transaction });

                // tao transaction teacher
                await TransactionHistoryModel.create({
                    user_id: exam.created_by,
                    transactionType: 'purchase',
                    transferType: 'in', // doanh thu
                    referenceId: purchase.id,
                    amount: examFee,
                    beforeBalance: teacherBalance,
                    afterBalance: teacherNewBalance,
                    transactionStatus: 'success',
                    description: `Doanh thu từ đề thi: ${exam.title || `Exam ID: ${exam_id}`}`
                }, { transaction });
            }
        }

        await transaction.commit();
        transaction = null; // complete transaction

        return res.status(200).json({
            success: true,
            message: "Mua đề thi thành công",
            data: {
                purchase,
                remainingBalance: newBalance
            }
        });

    } catch (error) {
        if (transaction && !transaction.finished) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error("Error rolling back transaction:", rollbackError);
            }
        }
        console.error("Lỗi khi mua đề thi:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi mua đề thi",
            error: error.message
        });
    }
};

// Xem danh sách đề thi đã mua
export const getPurchasedExams = async (req, res) => {
    try {
        const userId = req.userId; // Lấy từ middleware authJWT
        const { page = 1, limit = 10, sortBy = 'purchase_date', order = 'DESC' } = req.query;

        const offset = (page - 1) * limit;

        const { count, rows } = await ExamPurchaseModel.findAndCountAll({
            where: {
                user_id: userId
            },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'des', 'total_score', 'minutes', 'start_time', 'end_time', 'fee', 'is_public', 'created_by'],
                    include: [
                        {
                            model: UserModel,
                            as: 'creator',
                            attributes: ['id', 'fullName', 'email']
                        }
                    ]
                }
            ],
            order: [[sortBy, order.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        return res.status(200).json({
            success: true,
            message: "Lấy danh sách đề thi đã mua thành công",
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
        console.error("Lỗi khi lấy danh sách đề thi đã mua:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi lấy danh sách đề thi đã mua",
            error: error.message
        });
    }
};

// Kiểm tra xem người dùng đã mua đề thi chưa
export const checkPurchaseStatus = async (req, res) => {
    try {
        const userId = req.userId;
        const { exam_id } = req.params;

        const purchase = await ExamPurchaseModel.findOne({
            where: {
                user_id: userId,
                exam_id: exam_id
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                isPurchased: !!purchase,
                purchase: purchase
            }
        });

    } catch (error) {
        console.error("Lỗi khi kiểm tra trạng thái mua:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi kiểm tra trạng thái mua",
            error: error.message
        });
    }
};

// Lấy thống kê về các đề thi đã mua
export const getPurchaseStatistics = async (req, res) => {
    try {
        const userId = req.userId;

        // Tổng số đề thi đã mua
        const totalPurchases = await ExamPurchaseModel.count({
            where: { user_id: userId }
        });

        // Tổng số tiền đã chi tiêu
        const totalSpent = await ExamPurchaseModel.sum('purchase_price', {
            where: { user_id: userId }
        });

        // Số dư hiện tại
        const user = await UserModel.findByPk(userId, {
            attributes: ['balance']
        });

        return res.status(200).json({
            success: true,
            message: "Lấy thống kê thành công",
            data: {
                totalPurchasedExams: totalPurchases,
                totalSpent: totalSpent || 0,
                currentBalance: user ? user.balance : 0
            }
        });

    } catch (error) {
        console.error("Lỗi khi lấy thống kê:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi lấy thống kê",
            error: error.message
        });
    }
};

