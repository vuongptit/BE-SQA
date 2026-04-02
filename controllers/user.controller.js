import { UserModel } from "../models/index.model.js";
import { RecentLoginModel } from "../models/index.model.js";
import { sendOTPEmail } from '../utils/mailSender.js';
import redisClient from '../config/redis.config.js';
import bcrypt from 'bcryptjs';

// Get information of a user
export const GetProfileInfo = async (req, res) => {
    try {

        const userId = req.userId;



        const userInfor = await UserModel.findOne({
            where: {
                id: userId
            },
            attributes: { exclude: ['password'] },
            include: [
                {
                    model: RecentLoginModel,
                    as: 'login_list',
                    separate: true,
                    limit: 5,
                    order: [
                        ['login_time', 'DESC']
                    ]
                }

            ]
        })

        if (!userInfor) {
            return res.status(401).send({ message: "User not found" })
        }

        return res.status(200).send(userInfor)

    } catch (error) {
        return res.status(500).send({ message: error.message })
    }
}


// Update profile
export const UpdateProfileInfo = async (req, res) => {

    try {

        const userId = req.userId;

        const { fullName, email, avatar_url } = req.body;

        if (!fullName || !email) {
            res.status(400).send("Missing information");
        }

        //Check if user existed?

        const userInfor = await UserModel.findOne({ where: { id: userId }, attributes: { exclude: ["password"] } });

        if (!userInfor) {
            return res.status(404).send("Not found User")
        }

        userInfor.fullName = fullName;
        userInfor.email = email;

        // Cập nhật avatar_url nếu có
        if (avatar_url !== undefined) {
            userInfor.avatar_url = avatar_url;
        }

        await userInfor.save()


        return res.status(200).send({ message: "Updated Successfully", user: { userInfor } })

    } catch (error) {
        return res.status(500).send({ message: error.message })
    }

}

// Gửi OTP cho đổi mật khẩu
export const sendOTPForChangePassword = async (req, res) => {
    try {
        const userId = req.userId;

        // Lấy thông tin user
        const userInfo = await UserModel.findOne({ where: { id: userId } });
        if (!userInfo) {
            return res.status(404).send({ status: false, message: "Không tìm thấy người dùng" });
        }

        // Tạo OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(otp);
        const changePasswordData = JSON.stringify({
            userId: userId,
            email: userInfo.email,
            otp,
            type: 'change_password'
        });

        // Lưu OTP vào Redis với thời gian hết hạn 10 phút
        await redisClient.set(`otp:change_password:${userId}`, changePasswordData, { EX: 600 });

        // Gửi email OTP
        await sendOTPEmail(userInfo.email, otp);

        return res.status(200).send({
            status: true,
            message: "Mã OTP đã được gửi đến email của bạn"
        });

    } catch (error) {
        console.error("Error sending OTP for change password:", error);
        return res.status(500).send({
            status: false,
            message: "Lỗi khi gửi mã OTP"
        });
    }
};

// Đổi mật khẩu với xác thực OTP
export const ChangePassword = async (req, res) => {
    try {

        const userId = req.userId;

        const { currentPassword, newPassword, otp } = req.body


        if (!currentPassword || !newPassword || !otp) {
            return res.status(400).send({
                status: false,
                message: "Vui lòng nhập đầy đủ thông tin: mật khẩu hiện tại, mật khẩu mới và mã OTP"
            });
        }

        // Kiểm tra độ dài mật khẩu mới
        if (newPassword.length < 6) {
            return res.status(400).send({
                status: false,
                message: "Mật khẩu mới phải có ít nhất 6 ký tự"
            });
        }

        // Lấy thông tin user
        const userInfo = await UserModel.findOne({ where: { id: userId } })
        if (!userInfo) {
            return res.status(404).send({
                status: false,
                message: "Không tìm thấy người dùng"
            });
        }

        // Kiểm tra mật khẩu hiện tại (so sánh với hash)
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userInfo.password);
        if (!isCurrentPasswordValid) {
            return res.status(403).send({
                status: false,
                message: "Mật khẩu hiện tại không chính xác"
            });
        }

        // Lấy OTP từ Redis
        const rawData = await redisClient.get(`otp:change_password:${userId}`);
        if (!rawData) {
            return res.status(400).send({
                status: false,
                message: "Mã OTP đã hết hạn hoặc không tồn tại. Vui lòng yêu cầu mã OTP mới"
            });
        }

        const storedData = JSON.parse(rawData);

        // Kiểm tra OTP
        if (storedData.otp !== otp) {
            return res.status(400).send({
                status: false,
                message: "Mã OTP không chính xác"
            });
        }

        // Hash mật khẩu mới và cập nhật
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        userInfo.password = hashedNewPassword;
        await userInfo.save()

        // Xóa OTP khỏi Redis sau khi đổi mật khẩu thành công
        await redisClient.del(`otp:change_password:${userId}`);

        return res.status(200).send({
            status: true,
            message: "Đổi mật khẩu thành công"
        })

    } catch (error) {
        return res.status(500).send({
            status: false,
            message: error.message
        })
    }
}