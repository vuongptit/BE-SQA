import { PostClassesModel, PostCommentsModel, UserModel, ClassesModel } from "../../models/index.model.js";
import { Op } from "sequelize";

// ==================== CONTENT MODERATION ====================
export const getAllPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10, class_id, user_id, search, sortBy = 'created_at', order = 'DESC' } = req.query;
        
        const offset = (page - 1) * limit;
        
        const whereClause = {};
        
        if (class_id) whereClause.class_id = class_id;
        if (user_id) whereClause.user_id = user_id;
        if (search) whereClause.title = { [Op.like]: `%${search}%` };
        
        const { count, rows } = await PostClassesModel.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: UserModel,
                    as: 'author',
                    attributes: ['id', 'fullName', 'email']
                },
                {
                    model: ClassesModel,
                    attributes: ['id', 'className']
                },
                {
                    model: PostCommentsModel,
                    as: 'comments',
                    attributes: ['id']
                }
            ],
            order: [[sortBy, order.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        const postsWithCount = rows.map(post => {
            const postData = post.toJSON();
            postData.commentCount = postData.comments ? postData.comments.length : 0;
            delete postData.comments;
            return postData;
        });
        
        return res.status(200).json({
            success: true,
            data: {
                posts: postsWithCount,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            }
        });
        
    } catch (error) {
        console.error("Error getting posts:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting posts",
            error: error.message
        });
    }
};

export const hidePost = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        
        const post = await PostClassesModel.findByPk(id);
        
        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found"
            });
        }

        post.title = `[HIDDEN] ${post.title}`;
        await post.save();

        return res.status(200).json({
            success: true,
            message: "Post hidden successfully",
            data: {
                postId: id,
                reason: reason || 'No reason provided'
            }
        });
        
    } catch (error) {
        console.error("Error hiding post:", error);
        return res.status(500).json({
            success: false,
            message: "Error hiding post",
            error: error.message
        });
    }
};

export const showPost = async (req, res) => {
    try {
        const { id } = req.params;
        
        const post = await PostClassesModel.findByPk(id);
        
        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found"
            });
        }

        if (post.title.startsWith('[HIDDEN] ')) {
            post.title = post.title.replace('[HIDDEN] ', '');
            await post.save();
        }
        
        return res.status(200).json({
            success: true,
            message: "Post shown successfully",
            data: {
                postId: id
            }
        });
        
    } catch (error) {
        console.error("Error showing post:", error);
        return res.status(500).json({
            success: false,
            message: "Error showing post",
            error: error.message
        });
    }
};

export const deletePost = async (req, res) => {
    try {
        const { id } = req.params;
        
        const post = await PostClassesModel.findByPk(id);
        
        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found"
            });
        }

        const commentCount = await PostCommentsModel.count({ where: { post_id: id } });
        
        await post.destroy();
        
        return res.status(200).json({
            success: true,
            message: "Post deleted successfully",
            info: {
                commentsDeleted: commentCount
            }
        });
        
    } catch (error) {
        console.error("Error deleting post:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting post",
            error: error.message
        });
    }
};

export const getAllComments = async (req, res) => {
    try {
        const { page = 1, limit = 10, post_id, user_id, search } = req.query;
        
        const offset = (page - 1) * limit;
        
        const whereClause = {};
        
        if (post_id) whereClause.post_id = post_id;
        if (user_id) whereClause.user_id = user_id;
        if (search) whereClause.content = { [Op.like]: `%${search}%` };
        
        const { count, rows } = await PostCommentsModel.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: UserModel,
                    as: 'author',
                    attributes: ['id', 'fullName', 'email']
                },
                {
                    model: PostClassesModel,
                    attributes: ['id', 'title']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        return res.status(200).json({
            success: true,
            data: {
                comments: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            }
        });
        
    } catch (error) {
        console.error("Error getting comments:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting comments",
            error: error.message
        });
    }
};

export const deleteComment = async (req, res) => {
    try {
        const { id } = req.params;
        
        const comment = await PostCommentsModel.findByPk(id);
        
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: "Comment not found"
            });
        }
        
        await comment.destroy();
        
        return res.status(200).json({
            success: true,
            message: "Comment deleted successfully"
        });
        
    } catch (error) {
        console.error("Error deleting comment:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting comment",
            error: error.message
        });
    }
};

