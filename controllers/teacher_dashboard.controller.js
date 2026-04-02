import { ClassesModel, ExamModel, ExamResultModel, ExamSessionModel, ClassStudentModel } from "../models/index.model.js";
import { Op } from "sequelize";

// Get teacher dashboard statistics
export const getTeacherDashboardStats = async (req, res) => {
    try {
        const teacher_id = req.userId; // Get from middleware

        // Get total classes
        const totalClasses = await ClassesModel.count({
            where: { teacher_id: teacher_id }
        });

        // Get total exams
        const totalExams = await ExamModel.count({
            where: { created_by: teacher_id }
        });

        // Get exams by status
        const now = new Date();
        const upcomingExams = await ExamModel.count({
            where: {
                created_by: teacher_id,
                start_time: { [Op.gt]: now }
            }
        });

        const ongoingExams = await ExamModel.count({
            where: {
                created_by: teacher_id,
                start_time: { [Op.lte]: now },
                end_time: { [Op.gte]: now }
            }
        });

        const endedExams = await ExamModel.count({
            where: {
                created_by: teacher_id,
                end_time: { [Op.lt]: now }
            }
        });

        // Get total students across all classes
        // First get all class IDs for this teacher
        const teacherClasses = await ClassesModel.findAll({
            where: { teacher_id: teacher_id },
            attributes: ['id']
        });
        const classIds = teacherClasses.map(c => c.id);
        
        const totalStudents = classIds.length > 0 ? await ClassStudentModel.count({
            where: {
                class_id: { [Op.in]: classIds },
                is_ban: false
            }
        }) : 0;

        // Get teacher's exam IDs
        const teacherExams = await ExamModel.findAll({
            where: { created_by: teacher_id },
            attributes: ['id']
        });
        const examIds = teacherExams.map(e => e.id);

        // Get total exam submissions
        const totalSubmissions = examIds.length > 0 ? await ExamResultModel.count({
            where: {
                exam_id: { [Op.in]: examIds }
            }
        }) : 0;

        // Get pending feedback (results without feedback)
        const pendingFeedback = examIds.length > 0 ? await ExamResultModel.count({
            where: {
                exam_id: { [Op.in]: examIds },
                feedback: { [Op.is]: null }
            }
        }) : 0;

        // Get active exam sessions (students currently taking exams)
        const activeSessions = examIds.length > 0 ? await ExamSessionModel.count({
            where: {
                exam_id: { [Op.in]: examIds },
                status: 'in_progress'
            }
        }) : 0;

        // Get recent exams (last 5)
        const recentExams = await ExamModel.findAll({
            where: { created_by: teacher_id },
            order: [['created_at', 'DESC']],
            limit: 5,
            attributes: ['id', 'title', 'created_at', 'start_time', 'end_time']
        });

        // Get recent classes (last 5)
        const recentClasses = await ClassesModel.findAll({
            where: { teacher_id: teacher_id },
            order: [['created_at', 'DESC']],
            limit: 5,
            attributes: ['id', 'className', 'classCode', 'created_at']
        });

        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalClasses,
                    totalExams,
                    totalStudents,
                    totalSubmissions,
                    pendingFeedback,
                    activeSessions,
                    examsByStatus: {
                        upcoming: upcomingExams,
                        ongoing: ongoingExams,
                        ended: endedExams
                    }
                },
                recent: {
                    exams: recentExams,
                    classes: recentClasses
                }
            }
        });

    } catch (error) {
        console.error("Error getting teacher dashboard stats:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting dashboard data",
            error: error.message
        });
    }
};

