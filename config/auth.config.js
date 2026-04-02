import 'dotenv/config.js'; // Tải biến môi trường

const authConfig = {
  secret: process.env.JWT_SECRET,
  jwtExpiration: parseInt(process.env.JWT_EXPIRATION_SECONDS, 10)
};

export default authConfig;