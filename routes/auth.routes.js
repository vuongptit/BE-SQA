import {
    signin,
    signup,
    sendOTP,
    sendOTPForForgotPassword,
    resetPassword
} from "../controllers/auth.controller.js";

import CheckDuplicateEmail from "../middleware/verifySignUp.js";

const authRoutes = (app) => {

    // Đăng ký
    app.post('/api/auth/send-otp-signup', CheckDuplicateEmail, sendOTP);
    app.post('/api/auth/signup', CheckDuplicateEmail, signup);

    // Đăng nhập
    app.post('/api/auth/signin', signin);

    // Quên mật khẩu
    app.post('/api/auth/forgot-password/send-otp', sendOTPForForgotPassword);
    app.post('/api/auth/forgot-password/reset', resetPassword);
}



export default authRoutes