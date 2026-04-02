import { ExamRatingModel, ExamModel, ExamResultModel, UserModel } from "../models/index.model.js";
import { Op } from "sequelize";
import sequelize from "../config/db.config.js";

// Tạo hoặc cập nhật rating cho exam
export const createOrUpdateRating = async (req, res) => {
    try {
        const { exam_id, rating, comment, result_id } = req.body;
        const user_id = req.userId;

        // Validate required fields
        if (!exam_id || !rating) {
            return res.status(400).send({ 
                message: 'Missing required fields: exam_id and rating are required' 
            });
        }

        // Validate rating range
        if (rating < 1 || rating > 5) {
            return res.status(400).send({ 
                message: 'Rating must be between 1 and 5' 
            });
        }

        // Validate exam exists
        const exam = await ExamModel.findOne({
            where: { id: exam_id }
        });

        if (!exam) {
            return res.status(404).send({ 
                message: 'Exam not found' 
            });
        }

        // Nếu có result_id, kiểm tra result có tồn tại và thuộc về user không
        if (result_id) {
            const result = await ExamResultModel.findOne({
                where: {
                    id: result_id,
                    student_id: user_id,
                    exam_id: exam_id
                }
            });

            if (!result) {
                return res.status(404).send({ 
                    message: 'Exam result not found or you do not have permission' 
                });
            }
        }

        // Tìm rating hiện tại
        const existingRating = await ExamRatingModel.findOne({
            where: {
                user_id,
                exam_id
            }
        });

        let ratingData;
        if (existingRating) {
            // Cập nhật rating hiện tại
            await existingRating.update({
                rating,
                comment: comment || null,
                result_id: result_id || null
            });
            ratingData = existingRating;
        } else {
            // Tạo rating mới
            ratingData = await ExamRatingModel.create({
                user_id,
                exam_id,
                rating,
                comment: comment || null,
                result_id: result_id || null
            });
        }

        // Lấy rating với thông tin user
        const ratingWithUser = await ExamRatingModel.findOne({
            where: { id: ratingData.id },
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email']
                }
            ]
        });

        return res.status(200).send(ratingWithUser);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Lấy rating trung bình của exam
export const getExamAverageRating = async (req, res) => {
    try {
        const { exam_id } = req.params;

        const result = await ExamRatingModel.findOne({
            where: { exam_id },
            attributes: [
                [sequelize.fn('AVG', sequelize.col('rating')), 'average_rating'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'total_ratings']
            ],
            raw: true
        });

        const averageRating = result ? parseFloat(result.average_rating) || 0 : 0;
        const totalRatings = result ? parseInt(result.total_ratings) || 0 : 0;

        return res.status(200).send({
            exam_id: parseInt(exam_id),
            average_rating: parseFloat(averageRating.toFixed(2)),
            total_ratings: totalRatings
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Lấy rating của user cho exam
export const getUserRating = async (req, res) => {
    try {
        const { exam_id } = req.params;
        const user_id = req.userId;

        const rating = await ExamRatingModel.findOne({
            where: {
                user_id,
                exam_id
            },
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email']
                }
            ]
        });

        if (!rating) {
            return res.status(200).send(null);
        }

        return res.status(200).send(rating);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Lấy tất cả ratings của exam (với phân trang)
export const getExamRatings = async (req, res) => {
    try {
        const { exam_id } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { count, rows } = await ExamRatingModel.findAndCountAll({
            where: { exam_id },
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: offset
        });

        return res.status(200).send({
            ratings: rows,
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            total_pages: Math.ceil(count / parseInt(limit))
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Xóa rating
export const deleteRating = async (req, res) => {
    try {
        const { exam_id } = req.params;
        const user_id = req.userId;

        const rating = await ExamRatingModel.findOne({
            where: {
                user_id,
                exam_id
            }
        });

        if (!rating) {
            return res.status(404).send({ 
                message: 'Rating not found' 
            });
        }

        await rating.destroy();

        return res.status(200).send({ 
            message: 'Rating deleted successfully' 
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

