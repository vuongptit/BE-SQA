import { GetProfileInfo, UpdateProfileInfo, ChangePassword, sendOTPForChangePassword } from "../controllers/user.controller.js";
import { verifyToken } from "../middleware/authJWT.js";



const authUser = (app) => {

    // Get user profile
    app.get('/api/user/profile', verifyToken, GetProfileInfo);

    //
    app.post('/api/user/profile', verifyToken, UpdateProfileInfo);

    // Gửi OTP cho đổi mật khẩu
    app.post('/api/user/changepassword/send-otp', verifyToken, sendOTPForChangePassword);

    // Đổi mật khẩu với OTP
    app.post('/api/user/changepassword', verifyToken, ChangePassword)
}


export default authUser;