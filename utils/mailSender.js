import nodemailer from 'nodemailer';
import 'dotenv/config.js';

export const sendOTPEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS
            }
        })

        await transporter.sendMail({
            from: process.env.MAIL_USER,
            to: email,
            subject: "OTP for verification account in PTIT edu",
            text: `Your OTP is ${otp}`
        })
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}
