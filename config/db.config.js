import 'dotenv/config.js'; // Tải biến môi trường
import { Sequelize } from 'sequelize';

const dbConfig = {
  HOST: process.env.DB_HOST,
  USER: process.env.DB_USER,
  PASSWORD: process.env.DB_PASSWORD,
  DB: process.env.DB_NAME,
  dialect: "mysql",
  pool: {
    max: 30,  // Tăng lên 30 để xử lý nhiều requests cùng lúc từ test
    min: 0,
    acquire: 120000,  // Tăng lên 120 giây (2 phút) để tránh timeout
    idle: 10000,
    evict: 10000  // Evict idle connections
  },
  logging: false,  // Tắt logging để giảm I/O (có thể bật khi cần debug)
  retry: {
    max: 3  // Retry 3 lần nếu connection bị lỗi
  }
};

const sequelize = new Sequelize(
  dbConfig.DB,
  dbConfig.USER,
  dbConfig.PASSWORD,
  {
    host:dbConfig.HOST,
    dialect: dbConfig.dialect,
    pool: dbConfig.pool
  }
)


export default sequelize;