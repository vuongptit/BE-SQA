import { ExamCommentModel, ExamModel, UserModel } from "../models/index.model.js";

// Create a comment (can be a root comment or a reply)
export const createComment = async (req, res) => {
    try {
        const { exam_id, text, parent_id } = req.body;
        const user_id = req.userId;

        // Validate required fields
        if (!exam_id || !text) {
            return res.status(400).send({ 
                message: 'Missing required fields: exam_id and text' 
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

        // If parent_id is provided, validate parent comment exists and belongs to same exam
        if (parent_id) {
            const parentComment = await ExamCommentModel.findOne({
                where: { 
                    id: parent_id,
                    exam_id: exam_id
                }
            });

            if (!parentComment) {
                return res.status(404).send({ 
                    message: 'Parent comment not found or does not belong to this exam' 
                });
            }
        }

        // Create comment
        const comment = await ExamCommentModel.create({
            user_id,
            exam_id,
            text,
            parent_id: parent_id || null
        });

        // Return comment with user info
        const commentWithUser = await ExamCommentModel.findOne({
            where: { id: comment.id },
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email', 'role']
                },
                {
                    model: ExamCommentModel,
                    as: 'parent',
                    attributes: ['id', 'text', 'user_id'],
                    include: [
                        {
                            model: UserModel,
                            as: 'user',
                            attributes: ['id', 'fullName', 'email']
                        }
                    ]
                }
            ]
        });

        return res.status(201).send(commentWithUser);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Get all comments for an exam (with replies nested)
export const getCommentsByExam = async (req, res) => {
    try {
        const { exam_id } = req.params;

        // Validate exam exists
        const exam = await ExamModel.findOne({
            where: { id: exam_id }
        });

        if (!exam) {
            return res.status(404).send({ 
                message: 'Exam not found' 
            });
        }

        // Get all root comments (parent_id is null) with their replies
        const comments = await ExamCommentModel.findAll({
            where: { 
                exam_id,
                parent_id: null
            },
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email', 'role']
                },
                {
                    model: ExamCommentModel,
                    as: 'replies',
                    include: [
                        {
                            model: UserModel,
                            as: 'user',
                            attributes: ['id', 'fullName', 'email', 'role']
                        }
                    ],
                    order: [['created_at', 'ASC']]
                }
            ],
            order: [['created_at', 'DESC']]
        });

        return res.status(200).send(comments);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Get comment by ID
export const getCommentById = async (req, res) => {
    try {
        const { comment_id } = req.params;

        const comment = await ExamCommentModel.findOne({
            where: { id: comment_id },
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email', 'role']
                },
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title']
                },
                {
                    model: ExamCommentModel,
                    as: 'parent',
                    attributes: ['id', 'text', 'user_id'],
                    include: [
                        {
                            model: UserModel,
                            as: 'user',
                            attributes: ['id', 'fullName', 'email']
                        }
                    ]
                },
                {
                    model: ExamCommentModel,
                    as: 'replies',
                    include: [
                        {
                            model: UserModel,
                            as: 'user',
                            attributes: ['id', 'fullName', 'email', 'role']
                        }
                    ],
                    order: [['created_at', 'ASC']]
                }
            ]
        });

        if (!comment) {
            return res.status(404).send({ 
                message: 'Comment not found' 
            });
        }

        return res.status(200).send(comment);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Update comment (only the user who created it can update)
export const updateComment = async (req, res) => {
    try {
        const { comment_id } = req.params;
        const { text } = req.body;
        const user_id = req.userId;

        // Validate required fields
        if (!text) {
            return res.status(400).send({ 
                message: 'Missing required field: text' 
            });
        }

        // Find comment
        const comment = await ExamCommentModel.findOne({
            where: { id: comment_id }
        });

        if (!comment) {
            return res.status(404).send({ 
                message: 'Comment not found' 
            });
        }

        // Check if user is the owner
        if (comment.user_id !== user_id) {
            return res.status(403).send({ 
                message: 'You do not have permission to update this comment' 
            });
        }

        // Update comment
        await comment.update({ text });

        // Return updated comment with user info
        const updatedComment = await ExamCommentModel.findOne({
            where: { id: comment_id },
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email', 'role']
                },
                {
                    model: ExamCommentModel,
                    as: 'parent',
                    attributes: ['id', 'text', 'user_id'],
                    include: [
                        {
                            model: UserModel,
                            as: 'user',
                            attributes: ['id', 'fullName', 'email']
                        }
                    ]
                }
            ]
        });

        return res.status(200).send(updatedComment);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Delete comment (only the user who created it can delete)
// If it's a root comment with replies, we can either:
// 1. Delete all replies (cascade)
// 2. Keep replies but mark parent as deleted
// For now, we'll delete the comment and all its replies (cascade)
export const deleteComment = async (req, res) => {
    try {
        const { comment_id } = req.params;
        const user_id = req.userId;

        // Find comment
        const comment = await ExamCommentModel.findOne({
            where: { id: comment_id }
        });

        if (!comment) {
            return res.status(404).send({ 
                message: 'Comment not found' 
            });
        }

        // Check if user is the owner
        if (comment.user_id !== user_id) {
            return res.status(403).send({ 
                message: 'You do not have permission to delete this comment' 
            });
        }

        // Delete all replies first (if any)
        await ExamCommentModel.destroy({
            where: { parent_id: comment_id }
        });

        // Delete the comment
        await comment.destroy();

        return res.status(200).send({ 
            message: 'Comment deleted successfully' 
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

