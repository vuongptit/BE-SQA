import { ExamFavoriteModel, ExamModel, UserModel, ClassesModel, QuestionModel, ExamRatingModel } from "../models/index.model.js";
import sequelize from "../config/db.config.js";

// Add exam to favorites
export const addFavorite = async (req, res) => {
    try {
        const { exam_id } = req.body;
        const user_id = req.userId;

        // Validate required fields
        if (!exam_id) {
            return res.status(400).send({ 
                message: 'Missing required field: exam_id' 
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

        // Check if already favorited
        const existingFavorite = await ExamFavoriteModel.findOne({
            where: {
                user_id,
                exam_id
            }
        });

        if (existingFavorite) {
            return res.status(400).send({ 
                message: 'Exam already in favorites' 
            });
        }

        // Create favorite
        const favorite = await ExamFavoriteModel.create({
            user_id,
            exam_id
        });

        // Return favorite with exam info
        const favoriteWithExam = await ExamFavoriteModel.findOne({
            where: { id: favorite.id },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'des', 'total_score', 'minutes', 'is_paid', 'fee', 'is_public']
                }
            ]
        });

        return res.status(201).send(favoriteWithExam);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Remove exam from favorites
export const removeFavorite = async (req, res) => {
    try {
        const { exam_id } = req.params;
        const user_id = req.userId;

        // Find favorite
        const favorite = await ExamFavoriteModel.findOne({
            where: {
                user_id,
                exam_id
            }
        });

        if (!favorite) {
            return res.status(404).send({ 
                message: 'Favorite not found' 
            });
        }

        // Delete favorite
        await favorite.destroy();

        return res.status(200).send({ 
            message: 'Exam removed from favorites successfully' 
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Helper function để tính average rating của exam
async function getExamAverageRating(examId) {
    try {
        const result = await ExamRatingModel.findOne({
            where: { exam_id: examId },
            attributes: [
                [sequelize.fn('AVG', sequelize.col('rating')), 'average_rating'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'total_ratings']
            ],
            raw: true
        });

        const averageRating = result ? parseFloat(result.average_rating) || 0 : 0;
        const totalRatings = result ? parseInt(result.total_ratings) || 0 : 0;

        return {
            average_rating: parseFloat(averageRating.toFixed(2)),
            total_ratings: totalRatings
        };
    } catch (error) {
        console.error('Error calculating average rating:', error);
        return {
            average_rating: 0,
            total_ratings: 0
        };
    }
}

// Get all favorite exams for current user
export const getFavorites = async (req, res) => {
    try {
        const user_id = req.userId;

        const favorites = await ExamFavoriteModel.findAll({
            where: { user_id },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'des', 'total_score', 'minutes', 'start_time', 'end_time', 'is_paid', 'fee', 'is_public', 'created_at', 'count', 'image_url'],
                    include: [
                        {
                            model: ClassesModel,
                            as: 'classes',
                            attributes: ['id', 'className', 'classCode'],
                            through: { attributes: [] }
                        }
                    ]
                }
            ],
            order: [['created_at', 'DESC']]
        });

        // Thêm số câu hỏi, status, và average rating cho mỗi exam
        const now = new Date();
        const favoritesWithQuestionCount = await Promise.all(
            favorites.map(async (favorite) => {
                const favoriteData = favorite.toJSON();
                if (favoriteData.exam) {
                    // Thêm số câu hỏi
                    const questionCount = await QuestionModel.count({
                        where: { exam_id: favoriteData.exam.id }
                    });
                    favoriteData.exam.question_count = questionCount;
                    
                    // Tính toán status
                    if (!favoriteData.exam.start_time || !favoriteData.exam.end_time) {
                        favoriteData.exam.status = 'unlimited'; // Không giới hạn thời gian
                    } else {
                        const startTime = new Date(favoriteData.exam.start_time);
                        const endTime = new Date(favoriteData.exam.end_time);

                        if (now < startTime) {
                            favoriteData.exam.status = 'upcoming';
                        } else if (now >= startTime && now <= endTime) {
                            favoriteData.exam.status = 'ongoing';
                        } else {
                            favoriteData.exam.status = 'ended';
                        }
                    }
                    
                    // Thêm average rating
                    const ratingInfo = await getExamAverageRating(favoriteData.exam.id);
                    favoriteData.exam.average_rating = ratingInfo.average_rating;
                    favoriteData.exam.total_ratings = ratingInfo.total_ratings;
                }
                return favoriteData;
            })
        );

        return res.status(200).send(favoritesWithQuestionCount);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Check if exam is favorited by user
export const checkFavorite = async (req, res) => {
    try {
        const { exam_id } = req.params;
        const user_id = req.userId;

        const favorite = await ExamFavoriteModel.findOne({
            where: {
                user_id,
                exam_id
            }
        });

        return res.status(200).send({ 
            is_favorited: !!favorite 
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

