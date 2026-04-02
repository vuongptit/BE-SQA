import { verifyToken, verifyAdmin, verifyTeacher } from "../middleware/authJWT.js";
import {
    createDepositRequest,
    sepayWebhook,
    getDepositHistory,
    getWithdrawHistory,
    getTransactionHistory,
    adminAddBalance,
    sendOTPForWithdraw,
    verifyOTPAndWithdraw,
    approveWithdrawRequest
} from "../controllers/wallet.controller.js";

export default function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    // deposit pending +  base64
    app.post(
        "/api/wallet/deposit",
        [verifyToken],
        createDepositRequest
    );

    // Webhook SePay 
    app.post(
        "/api/wallet/deposit/webhook",
        sepayWebhook
    );

    // eposit_history
    app.get(
        "/api/wallet/deposit-history",
        [verifyToken],
        getDepositHistory
    );

    // withdrawn_history
    app.get(
        "/api/wallet/withdraw-history",
        [verifyToken],
        getWithdrawHistory
    );

    // transactions_history
    app.get(
        "/api/wallet/transaction-history",
        [verifyToken],
        getTransactionHistory
    );

    // Admin cộng tiền cho user
    app.post(
        "/api/wallet/admin/add-balance",
        [verifyToken, verifyAdmin],
        adminAddBalance
    );

    // Teacher rút tiền - Gửi OTP
    app.post(
        "/api/wallet/withdraw/send-otp",
        [verifyToken, verifyTeacher],
        sendOTPForWithdraw
    );

    // Teacher rút tiền - Xác thực OTP và thực hiện rút tiền
    app.post(
        "/api/wallet/withdraw/verify-otp",
        [verifyToken, verifyTeacher],
        verifyOTPAndWithdraw
    );

    // Admin duyệt/từ chối yêu cầu rút tiền
    app.post(
        "/api/wallet/admin/approve-withdraw",
        [verifyToken, verifyAdmin],
        approveWithdrawRequest
    );
}

