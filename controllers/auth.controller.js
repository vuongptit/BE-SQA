
import authConfig from '../config/auth.config.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { RecentLoginModel } from '../models/index.model.js'
import { UAParser } from 'ua-parser-js'
import requestIp from 'request-ip'
import geoip from 'geoip-lite'
import { UserModel } from '../models/index.model.js'
import { sendOTPEmail } from '../utils/mailSender.js'
import redisClient from '../config/redis.config.js'
import { Json } from 'sequelize/lib/utils'

// Sign In / Sign Up module
export const sendOTP = async (req, res) => {

    try {
        const { fullName, email, password, role } = req.body;

        if (!fullName || !email || !password || !role) {
            return res.status(400).send({ message: "Need to full information" });
        }

        // Ma hoa password
        const hashedPassword = await bcrypt.hash(password, 10);

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const signUpData = JSON.stringify({ fullName, email, password: hashedPassword, role, otp });
        await redisClient.set(`otp:${email}`, signUpData, { EX: 300 });
        await sendOTPEmail(email, otp);
        return res.status(200).send({ message: "OTP sent successfully" });

    } catch (error) {
        return res.status(500).send({ message: "Error sending OTP" });
    }
};


export const signup = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).send({ message: "email or otp is required" });
        }

        const rawData = await redisClient.get(`otp:${email}`);
        if (!rawData) {
            return res.status(400).send({ message: "Mã OTP đã hết hạn hoặc không tồn tại" });
        }
        const storedData = JSON.parse(rawData);
        console.log(storedData);
        console.log(otp);

        if (storedData.otp !== otp) {
            return res.status(400).send({ message: "Mã OTP không chính xác" });
        }

        await UserModel.create({
            fullName: storedData.fullName,
            email: storedData.email,
            password: storedData.password,
            role: storedData.role
        });

        await redisClient.del(`otp:${email}`);

        res.status(201).send({ message: 'Đăng ký tài khoản thành công!' });

    } catch (error) {
        return res.status(500).send({ message: "Error verifying OTP" });
    }
}




export const signin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).send({ message: "Need full information" })
        }

        const user = await UserModel.findOne({ where: { email: email } })


        if (!user) {
            return res.status(404).send({ message: 'Not found email' })

        }

        // ma hoa password roi so sanh
        const passwordisValid = await bcrypt.compare(password, user.password)

        if (!passwordisValid) {
            return res.status(401).send({ access_token: null, message: "Wrong password!!" })
        }

        const token = jwt.sign({ id: user.id, role: user.role }, authConfig.secret, { expiresIn: authConfig.jwtExpiration })

        user.last_login = new Date();

        await user.save()

        //Set recent_logins
        const uaString = req.headers['user-agent'];

        const parser = new UAParser(uaString);
        const result_ua = parser.getResult()

        const osName = result_ua.os.name || "Unknown OS";
        const osVersion = result_ua.os.version || "";
        const browserName = result_ua.browser.name || "Unknown Browser";


        let deviceDisplayName = `${osName} ${osVersion} - ${browserName}`;

        // Lấy IP thực tế của client
        const clientIp = requestIp.getClientIp(req) || req.ip || req.connection.remoteAddress || "Unknown IP";

        const geo = geoip.lookup(clientIp);
        const locationString = geo ? `${geo.city}, ${geo.country}` : "Unknown Location";

        const createRecentLogin = await RecentLoginModel.create({
            user_id: user.id,
            device: deviceDisplayName,
            ip_address: clientIp,
            location: locationString,
            login_time: new Date()
        })



        res.status(200).send({
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            accessToken: token
        })


    } catch (error) {
        res.status(500).send({ message: error.message })
    }
}

// send otp for forgot password
export const sendOTPForForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).send({ message: "Email là bắt buộc" });
        }


        const user = await UserModel.findOne({ where: { email: email } });
        if (!user) {

            return res.status(404).send({ message: "Email không tồn tại" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const forgotPasswordData = JSON.stringify({ email, otp, type: 'forgot_password' });


        await redisClient.set(`otp:forgot_password:${email}`, forgotPasswordData, { EX: 600 });

        // send otp
        await sendOTPEmail(email, otp);

        return res.status(200).send({ message: "Mã OTP đã được gửi đến email của bạn" });

    } catch (error) {
        console.error("Error sending OTP for forgot password:", error);
        return res.status(500).send({ message: "Lỗi khi gửi mã OTP" });
    }
};

// verify password with otp
export const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).send({ message: "Email, OTP và mật khẩu mới là bắt buộc" });
        }


        if (newPassword.length < 6) {
            return res.status(400).send({ message: "Mật khẩu phải có ít nhất 6 ký tự" });
        }


        const rawData = await redisClient.get(`otp:forgot_password:${email}`);
        if (!rawData) {
            return res.status(400).send({ message: "Mã OTP đã hết hạn hoặc không tồn tại" });
        }

        const storedData = JSON.parse(rawData);


        if (storedData.otp !== otp) {
            return res.status(400).send({ message: "Mã OTP không chính xác" });
        }


        const user = await UserModel.findOne({ where: { email: email } });
        if (!user) {
            return res.status(404).send({ message: "Không tìm thấy người dùng" });
        }


        const hashedPassword = await bcrypt.hash(newPassword, 10);


        await user.update({
            password: hashedPassword
        });


        await redisClient.del(`otp:forgot_password:${email}`);

        return res.status(200).send({ message: "Đặt lại mật khẩu thành công" });

    } catch (error) {
        console.error("Error resetting password:", error);
        return res.status(500).send({ message: "Lỗi khi đặt lại mật khẩu" });
    }
};

