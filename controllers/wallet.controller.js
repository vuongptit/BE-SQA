import axios from "axios";
import sequelize from "../config/db.config.js";
import { Op } from "sequelize";
import { DepositHistoryModel, TransactionHistoryModel, UserModel, WithdrawHistoryModel } from "../models/index.model.js";
import redisClient from "../config/redis.config.js";
import { sendOTPEmail } from "../utils/mailSender.js";
import CryptoJS from "crypto-js";
import 'dotenv/config.js';

const generateDepositCode = () => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 12; i++) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
};

//deposit_code unique
const generateUniqueDepositCode = async () => {
    let code;

    for (let i = 0; i < 5; i++) {
        code = generateDepositCode();
        const existing = await DepositHistoryModel.findOne({
            where: { deposit_code: code },
            attributes: ["id"]
        });
        if (!existing) {
            return code;
        }
    }
    return `${generateDepositCode()}-${Math.floor(Math.random() * 1000)}`;
};

// ma hoa payload cho qrCode gen



// Tạo yêu cầu nạp tiền: lưu pending và trả về QR base64
export const createDepositRequest = async (req, res) => {
    const { amount } = req.body;
    const userId = req.userId;

    const bankName = process.env.BANK_NAME;
    const bankAccountName = process.env.BANK_ACCOUNT_NAME;
    const bankAccountNumber = process.env.BANK_ACCOUNT_NUMBER;


    const depositAmount = parseFloat(amount);
    if (Number.isNaN(depositAmount) || depositAmount <= 0) {
        return res.status(400).json({
            success: false,
            message: "Giá trị amount không hợp lệ"
        });
    }

    try {
        const transactionCode = await generateUniqueDepositCode();

        const deposit = await DepositHistoryModel.create({
            user_id: userId,
            bankName,
            bankAccountName,
            bankAccountNumber,
            deposit_status: 'pending',
            deposit_code: transactionCode,
            deposit_type: 'bank',
            deposit_amount: depositAmount
        });

        // luu deposit vao ttl redis
        await redisClient.sAdd('pending_deposits', deposit.id.toString());
        // Lưu thông tin deposit với TTL để tự động expire
        await redisClient.set(`pending_deposit:${deposit.id}`, JSON.stringify({
            deposit_id: deposit.id,
            deposit_code: transactionCode,
            user_id: userId,
            amount: depositAmount,
            created_at: new Date().toISOString()
        }), { EX: 300 }); // 5 phút

        // Gọi sepay để lấy ảnh QR (base64)
        const amountParam = depositAmount.toFixed(3);
        const qrUrl = `https://qr.sepay.vn/img?bank=${encodeURIComponent(bankName)}&acc=${bankAccountNumber}&template=compact&amount=${amountParam}&des=${transactionCode}`;

        const qrResponse = await axios.get(qrUrl, { responseType: "arraybuffer" });
        const qrBase64 = Buffer.from(qrResponse.data, 'binary').toString('base64');

        return res.status(200).json({
            success: true,
            message: "Tạo yêu cầu nạp tiền thành công",
            data: {
                bankAccountName: deposit.bankAccountName,
                bankAccountNumber: deposit.bankAccountNumber,
                bankName: deposit.bankName,
                deposit_id: deposit.id,
                deposit_code: transactionCode,
                deposit_status: deposit.deposit_status,
                amount: depositAmount,
                qr_base64: qrBase64
            }
        });

    } catch (error) {
        console.error("Lỗi khi tạo yêu cầu nạp tiền:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi tạo yêu cầu nạp tiền",
            error: error.message
        });
    }
};

const extractDepositCode = (payload) => {
    console.log(payload.content)
    if (payload.content) {
        const match = String(payload.content).match(/([A-Za-z]{12})/);
        if (match) return match[1];
    }
    return null;
};

// webhook sepay
export const sepayWebhook = async (req, res) => {
    const payload = req.body || {};

    // pay in
    if (payload.transferType && payload.transferType !== 'in') {
        return res.status(200).json({ success: true, message: "Bỏ qua giao dịch tiền ra" });
    }

    const depositCode = extractDepositCode(payload);
    if (!depositCode) {
        return res.status(400).json({ success: false, message: "Không tìm thấy mã nạp tiền trong payload" });
    }

    let transaction;
    try {
        transaction = await sequelize.transaction();

        const deposit = await DepositHistoryModel.findOne({
            where: { deposit_code: depositCode },
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!deposit) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: "Không tìm thấy yêu cầu nạp" });
        }

        if (deposit.deposit_status === 'success') {
            await transaction.rollback();
            return res.status(200).json({ success: true, message: "Đã xử lý trước đó" });
        }

        const transferAmount = parseFloat(payload.transferAmount);
        const expectedAmount = parseFloat(deposit.deposit_amount);

        if (Number.isNaN(transferAmount) || transferAmount !== expectedAmount) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: "Số tiền giao dịch không khớp với yêu cầu nạp"
            });
        }

        const user = await UserModel.findByPk(deposit.user_id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!user) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
        }

        const beforeBalance = parseFloat(user.balance);
        const afterBalance = beforeBalance + transferAmount;

        await user.update({ balance: afterBalance }, { transaction });
        await deposit.update({
            deposit_status: 'success',
            bankName: payload.gateway || deposit.bankName,
            bankAccountNumber: payload.accountNumber || deposit.bankAccountNumber,
            deposit_amount: transferAmount
        }, { transaction });

        await TransactionHistoryModel.create({
            user_id: deposit.user_id,
            transactionType: 'deposit',
            referenceId: deposit.id,
            amount: transferAmount,
            beforeBalance,
            afterBalance,
            transactionStatus: 'success',
            transferType: payload.transferType || 'bank',
            description: `Nạp tiền thành công - Mã: ${depositCode}`
        }, { transaction });

        await transaction.commit();

        // Xóa deposit khỏi Redis khi đã xử lý thành công
        await redisClient.sRem('pending_deposits', deposit.id.toString());
        await redisClient.del(`pending_deposit:${deposit.id}`);

        return res.status(200).json({ success: true, message: "Nạp tiền thành công", deposit_code: depositCode });

    } catch (error) {
        if (transaction) {
            try { await transaction.rollback(); } catch (rbErr) { console.error("Lỗi rollback:", rbErr); }
        }
        console.error("Webhook sepay lỗi:", error);
        return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
    }
};

// Lấy danh sách deposit_history
export const getDepositHistory = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            sortBy = 'created_at',
            order = 'DESC',
            status,
            user_id,
            fromDate,
            toDate,
            minAmount,
            maxAmount,
            bankName,
            deposit_type
        } = req.query;

        const offset = (page - 1) * limit;
        const userId = req.userId;
        const isAdmin = req.role === 'admin';

        const where = {};

        // Nếu không phải admin, chỉ lấy dữ liệu của user hiện tại
        if (!isAdmin) {
            where.user_id = userId;
        } else {
            // Admin có thể filter theo user_id hoặc lấy tất cả
            if (user_id) {
                where.user_id = user_id;
            }
        }

        // Filter theo trạng thái
        if (status) {
            where.deposit_status = status;
        }

        // Filter theo loại nạp tiền
        if (deposit_type) {
            where.deposit_type = deposit_type;
        }

        // Filter theo ngân hàng
        if (bankName) {
            where.bankName = bankName;
        }

        // Filter theo khoảng thời gian
        if (fromDate || toDate) {
            where.created_at = {};
            if (fromDate) {
                where.created_at[Op.gte] = new Date(fromDate);
            }
            if (toDate) {
                // Thêm 1 ngày để bao gồm cả ngày cuối
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);
                where.created_at[Op.lte] = endDate;
            }
        }

        // Filter theo khoảng số tiền
        if (minAmount || maxAmount) {
            where.deposit_amount = {};
            if (minAmount) {
                where.deposit_amount[Op.gte] = parseFloat(minAmount);
            }
            if (maxAmount) {
                where.deposit_amount[Op.lte] = parseFloat(maxAmount);
            }
        }

        const { count, rows } = await DepositHistoryModel.findAndCountAll({
            where,
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email']
                }
            ],
            order: [[sortBy, order.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        return res.status(200).json({
            success: true,
            message: "Lấy danh sách lịch sử nạp tiền thành công",
            data: {
                deposits: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            }
        });

    } catch (error) {
        console.error("Lỗi khi lấy danh sách lịch sử nạp tiền:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi lấy danh sách lịch sử nạp tiền",
            error: error.message
        });
    }
};

// Lấy danh sách withdrawn_history
export const getWithdrawHistory = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            sortBy = 'created_at',
            order = 'DESC',
            status,
            user_id,
            fromDate,
            toDate,
            minAmount,
            maxAmount,
            bankName
        } = req.query;

        const offset = (page - 1) * limit;
        const userId = req.userId;
        const isAdmin = req.role === 'admin';

        const where = {};

        // Nếu không phải admin, chỉ lấy dữ liệu của user hiện tại
        if (!isAdmin) {
            where.user_id = userId;
        } else {
            // Admin có thể filter theo user_id hoặc lấy tất cả
            if (user_id) {
                where.user_id = user_id;
            }
        }

        // Filter theo trạng thái
        if (status) {
            where.status = status;
        }

        // Filter theo ngân hàng
        if (bankName) {
            where.bankName = bankName;
        }

        // Filter theo khoảng thời gian
        if (fromDate || toDate) {
            where.created_at = {};
            if (fromDate) {
                where.created_at[Op.gte] = new Date(fromDate);
            }
            if (toDate) {
                // Thêm 1 ngày để bao gồm cả ngày cuối
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);
                where.created_at[Op.lte] = endDate;
            }
        }

        // Filter theo khoảng số tiền
        if (minAmount || maxAmount) {
            where.amount = {};
            if (minAmount) {
                where.amount[Op.gte] = parseFloat(minAmount);
            }
            if (maxAmount) {
                where.amount[Op.lte] = parseFloat(maxAmount);
            }
        }

        const { count, rows } = await WithdrawHistoryModel.findAndCountAll({
            where,
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email']
                }
            ],
            order: [[sortBy, order.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        return res.status(200).json({
            success: true,
            message: "Lấy danh sách lịch sử rút tiền thành công",
            data: {
                withdraws: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            }
        });

    } catch (error) {
        console.error("Lỗi khi lấy danh sách lịch sử rút tiền:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi lấy danh sách lịch sử rút tiền",
            error: error.message
        });
    }
};

// Lấy danh sách transactions_history
export const getTransactionHistory = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            sortBy = 'created_at',
            order = 'DESC',
            transactionType,
            transactionStatus,
            user_id,
            fromDate,
            toDate,
            minAmount,
            maxAmount,
            transferType
        } = req.query;

        const offset = (page - 1) * limit;
        const userId = req.userId;
        const isAdmin = req.role === 'admin';

        const where = {};

        // Nếu không phải admin, chỉ lấy dữ liệu của user hiện tại
        if (!isAdmin) {
            where.user_id = userId;
        } else {
            // Admin có thể filter theo user_id hoặc lấy tất cả
            if (user_id) {
                where.user_id = user_id;
            }
        }

        // Filter theo loại giao dịch
        if (transactionType) {
            where.transactionType = transactionType;
        }

        // Filter theo trạng thái giao dịch
        if (transactionStatus) {
            where.transactionStatus = transactionStatus;
        }

        // Filter theo loại chuyển khoản
        if (transferType) {
            where.transferType = transferType;
        }

        // Filter theo khoảng thời gian
        if (fromDate || toDate) {
            where.created_at = {};
            if (fromDate) {
                where.created_at[Op.gte] = new Date(fromDate);
            }
            if (toDate) {
                // Thêm 1 ngày để bao gồm cả ngày cuối
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);
                where.created_at[Op.lte] = endDate;
            }
        }

        // Filter theo khoảng số tiền
        if (minAmount || maxAmount) {
            where.amount = {};
            if (minAmount) {
                where.amount[Op.gte] = parseFloat(minAmount);
            }
            if (maxAmount) {
                where.amount[Op.lte] = parseFloat(maxAmount);
            }
        }

        const { count, rows } = await TransactionHistoryModel.findAndCountAll({
            where,
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email']
                }
            ],
            order: [[sortBy, order.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        return res.status(200).json({
            success: true,
            message: "Lấy danh sách lịch sử giao dịch thành công",
            data: {
                transactions: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            }
        });

    } catch (error) {
        console.error("Lỗi khi lấy danh sách lịch sử giao dịch:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi lấy danh sách lịch sử giao dịch",
            error: error.message
        });
    }
};

// Admin cộng tiền cho user
export const adminAddBalance = async (req, res) => {
    let transaction;
    try {
        const { user_id, amount, note } = req.body;

        if (!user_id || !amount) {
            return res.status(400).json({
                success: false,
                message: "Thiếu user_id hoặc amount"
            });
        }

        const addAmount = parseFloat(amount);
        if (Number.isNaN(addAmount) || addAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Giá trị amount không hợp lệ"
            });
        }

        transaction = await sequelize.transaction();

        const user = await UserModel.findByPk(user_id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!user) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy người dùng"
            });
        }

        const beforeBalance = parseFloat(user.balance);
        const afterBalance = beforeBalance + addAmount;

        await user.update({ balance: afterBalance }, { transaction });

        await TransactionHistoryModel.create({
            user_id: user_id,
            transactionType: 'adjustment',
            referenceId: null,
            amount: addAmount,
            beforeBalance,
            afterBalance,
            transactionStatus: 'success',
            transferType: 'admin_adjustment',
            description: note || `Admin điều chỉnh số dư: +${addAmount.toLocaleString('vi-VN')} VNĐ`
        }, { transaction });

        await transaction.commit();

        return res.status(200).json({
            success: true,
            message: "Cộng tiền thành công",
            data: {
                user_id: user_id,
                amount_added: addAmount,
                before_balance: beforeBalance,
                after_balance: afterBalance
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

        console.error("Lỗi khi cộng tiền:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi cộng tiền",
            error: error.message
        });
    }
};


// Rút tiền với OTP - Gửi OTP
export const sendOTPForWithdraw = async (req, res) => {
    try {
        const { bankName, bankAccountName, bankAccountNumber, amount } = req.body;
        const userId = req.userId;

        if (!bankName || !bankAccountName || !bankAccountNumber || !amount) {
            return res.status(400).json({
                success: false,
                message: "Thiếu thông tin: bankName, bankAccountName, bankAccountNumber hoặc amount"
            });
        }

        const withdrawAmount = parseFloat(amount);
        if (Number.isNaN(withdrawAmount) || withdrawAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Số tiền không hợp lệ"
            });
        }


        const minWithdrawAmount = 50000;
        if (withdrawAmount < minWithdrawAmount) {
            return res.status(400).json({
                success: false,
                message: `Số tiền rút tối thiểu là ${minWithdrawAmount.toLocaleString('vi-VN')} VNĐ`
            });
        }

        const user = await UserModel.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy người dùng"
            });
        }

        const userBalance = parseFloat(user.balance || 0);
        if (userBalance < withdrawAmount) {
            return res.status(400).json({
                success: false,
                message: "Số dư không đủ để thực hiện rút tiền",
                current_balance: userBalance
            });
        }

        // Tạo OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const withdrawData = JSON.stringify({
            userId,
            bankName,
            bankAccountName,
            bankAccountNumber,
            amount: withdrawAmount,
            otp,
            type: 'withdraw'
        });

        // Lưu OTP vào Redis với thời gian hết hạn 10 phút
        await redisClient.set(`otp:withdraw:${userId}`, withdrawData, { EX: 600 });

        // Gửi email OTP
        await sendOTPEmail(user.email, otp);

        return res.status(200).json({
            success: true,
            message: "Mã OTP đã được gửi đến email của bạn. Vui lòng xác thực để hoàn tất rút tiền."
        });

    } catch (error) {
        console.error("Error sending OTP for withdraw:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi khi gửi mã OTP",
            error: error.message
        });
    }
};

// Xác thực OTP và thực hiện rút tiền
export const verifyOTPAndWithdraw = async (req, res) => {
    let transaction = null;
    try {
        const { otp } = req.body;
        const userId = req.userId;

        if (!otp) {
            return res.status(400).json({
                success: false,
                message: "OTP là bắt buộc"
            });
        }

        // Lấy dữ liệu từ Redis
        const rawData = await redisClient.get(`otp:withdraw:${userId}`);
        if (!rawData) {
            return res.status(400).json({
                success: false,
                message: "Mã OTP đã hết hạn hoặc không tồn tại"
            });
        }

        const storedData = JSON.parse(rawData);

        // Kiểm tra OTP
        if (storedData.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: "Mã OTP không chính xác"
            });
        }

        // Kiểm tra userId có khớp không
        if (storedData.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: "Không có quyền thực hiện giao dịch này"
            });
        }

        const withdrawAmount = parseFloat(storedData.amount);

        // Bắt đầu transaction
        transaction = await sequelize.transaction();

        // Lấy thông tin user và lock row
        const user = await UserModel.findByPk(userId, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!user) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy người dùng"
            });
        }

        // Kiểm tra lại số dư (có thể đã thay đổi)
        const userBalance = parseFloat(user.balance || 0);
        if (userBalance < withdrawAmount) {
            await transaction.rollback();
            await redisClient.del(`otp:withdraw:${userId}`);
            return res.status(400).json({
                success: false,
                message: "Số dư không đủ để thực hiện rút tiền",
                current_balance: userBalance
            });
        }

        // Tạo mã rút tiền unique
        const generateWithdrawCode = () => {
            const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            let code = "";
            for (let i = 0; i < 12; i++) {
                code += alphabet[Math.floor(Math.random() * alphabet.length)];
            }
            return code;
        };

        let withdrawCode;
        let isUnique = false;
        for (let i = 0; i < 5; i++) {
            withdrawCode = generateWithdrawCode();
            const existing = await WithdrawHistoryModel.findOne({
                where: { withdraw_code: withdrawCode },
                attributes: ["id"],
                transaction
            });
            if (!existing) {
                isUnique = true;
                break;
            }
        }
        if (!isUnique) {
            withdrawCode = `${generateWithdrawCode()}-${Math.floor(Math.random() * 1000)}`;
        }

        // Trừ tiền
        const newBalance = userBalance - withdrawAmount;
        await user.update({
            balance: newBalance
        }, { transaction });

        // Tạo bản ghi rút tiền
        const withdraw = await WithdrawHistoryModel.create({
            user_id: userId,
            bankName: storedData.bankName,
            bankAccountName: storedData.bankAccountName,
            bankAccountNumber: storedData.bankAccountNumber,
            amount: withdrawAmount,
            withdraw_code: withdrawCode,
            status: 'pending'
        }, { transaction });

        // Tạo transaction history
        await TransactionHistoryModel.create({
            user_id: userId,
            transactionType: 'withdraw',
            referenceId: withdraw.id,
            amount: withdrawAmount,
            transferType: 'out',
            beforeBalance: userBalance,
            afterBalance: newBalance,
            transactionStatus: 'pending',
            description: `Yêu cầu rút tiền: ${withdrawAmount.toLocaleString('vi-VN')} VNĐ - Mã: ${withdrawCode}`
        }, { transaction });

        await transaction.commit();
        transaction = null;

        // Xóa OTP khỏi Redis
        await redisClient.del(`otp:withdraw:${userId}`);

        return res.status(200).json({
            success: true,
            message: "Rút tiền thành công. Yêu cầu của bạn đang chờ admin duyệt.",
            data: {
                withdraw_id: withdraw.id,
                withdraw_code: withdrawCode,
                bankName: withdraw.bankName,
                bankAccountName: withdraw.bankAccountName,
                bankAccountNumber: withdraw.bankAccountNumber,
                amount: withdrawAmount,
                status: withdraw.status,
                before_balance: userBalance,
                after_balance: newBalance
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

        console.error("Error verifying OTP and withdrawing:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi khi thực hiện rút tiền",
            error: error.message
        });
    }
};



// Duyệt yêu cầu rút tiền (admin)
export const approveWithdrawRequest = async (req, res) => {
    let transaction = null;
    try {
        const { withdraw_id, action, note } = req.body; // action: 'approve' hoặc 'reject'

        if (!withdraw_id || !action) {
            return res.status(400).json({
                success: false,
                message: "Thiếu withdraw_id hoặc action (approve/reject)"
            });
        }

        if (action !== 'approve' && action !== 'reject') {
            return res.status(400).json({
                success: false,
                message: "Action phải là 'approve' hoặc 'reject'"
            });
        }

        transaction = await sequelize.transaction();

        // Lấy thông tin yêu cầu rút tiền và lock row
        const withdraw = await WithdrawHistoryModel.findByPk(withdraw_id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!withdraw) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy yêu cầu rút tiền"
            });
        }

        // Kiểm tra trạng thái hiện tại
        if (withdraw.status !== 'pending') {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Yêu cầu rút tiền đã được xử lý (status: ${withdraw.status})`
            });
        }

        const user = await UserModel.findByPk(withdraw.user_id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!user) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy người dùng"
            });
        }

        const withdrawAmount = parseFloat(withdraw.amount);
        const currentBalance = parseFloat(user.balance || 0);

        if (action === 'approve') {
            // Duyệt: Cập nhật status thành success
            await withdraw.update({
                status: 'success'
            }, { transaction });

            // Cập nhật transaction history từ pending -> success
            await TransactionHistoryModel.update({
                transactionStatus: 'success',
                description: note || `Rút tiền thành công: ${withdrawAmount.toLocaleString('vi-VN')} VNĐ - Mã: ${withdraw.withdraw_code}`
            }, {
                where: {
                    referenceId: withdraw.id,
                    transactionType: 'withdrawal'
                },
                transaction
            });

            await transaction.commit();
            transaction = null;

            return res.status(200).json({
                success: true,
                message: "Duyệt yêu cầu rút tiền thành công",
                data: {
                    withdraw_id: withdraw.id,
                    withdraw_code: withdraw.withdraw_code,
                    amount: withdrawAmount,
                    status: 'success',
                    bankName: withdraw.bankName,
                    bankAccountName: withdraw.bankAccountName,
                    bankAccountNumber: withdraw.bankAccountNumber
                }
            });

        } else {
            // Từ chối: Hoàn tiền lại cho user
            const refundBalance = currentBalance + withdrawAmount;

            await user.update({
                balance: refundBalance
            }, { transaction });

            await withdraw.update({
                status: 'failed'
            }, { transaction });

            // Cập nhật transaction history từ pending -> failed và tạo transaction refund
            await TransactionHistoryModel.update({
                transactionStatus: 'failed',
                description: note || `Yêu cầu rút tiền bị từ chối: ${withdrawAmount.toLocaleString('vi-VN')} VNĐ - Mã: ${withdraw.withdraw_code}`
            }, {
                where: {
                    referenceId: withdraw.id,
                    transactionType: 'withdrawal'
                },
                transaction
            });

            // Tạo transaction history cho việc hoàn tiền
            await TransactionHistoryModel.create({
                user_id: withdraw.user_id,
                transactionType: 'adjustment',
                referenceId: withdraw.id,
                amount: withdrawAmount,
                transferType: 'in',
                beforeBalance: currentBalance,
                afterBalance: refundBalance,
                transactionStatus: 'success',
                description: `Hoàn tiền do yêu cầu rút tiền bị từ chối: ${withdrawAmount.toLocaleString('vi-VN')} VNĐ - Mã: ${withdraw.withdraw_code}`
            }, { transaction });

            await transaction.commit();
            transaction = null;

            return res.status(200).json({
                success: true,
                message: "Từ chối yêu cầu rút tiền và đã hoàn tiền lại cho người dùng",
                data: {
                    withdraw_id: withdraw.id,
                    withdraw_code: withdraw.withdraw_code,
                    amount: withdrawAmount,
                    status: 'failed',
                    refunded_amount: withdrawAmount,
                    before_balance: currentBalance,
                    after_balance: refundBalance
                }
            });
        }

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

