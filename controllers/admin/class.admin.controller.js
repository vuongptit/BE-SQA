import { ClassesModel, UserModel, ExamModel, ExamClassModel } from "../../models/index.model.js";
import { Op } from "sequelize";

// ==================== CLASS MANAGEMENT ====================

export const getAllClasses = async (req, res) => {
    try {
        const { page = 1, limit = 10, teacher_id, search, sortBy = 'created_at', order = 'DESC' } = req.query;
        
        const offset = (page - 1) * limit;
        
        const whereClause = {};
        
        if (teacher_id) {
            whereClause.teacher_id = teacher_id;
        }
        
        if (search) {
            whereClause.className = { [Op.like]: `%${search}%` };
        }
        
        const { count, rows } = await ClassesModel.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: UserModel,
                    as: 'teacher',
                    attributes: ['id', 'fullName', 'email']
                },
                {
                    model: UserModel,
                    as: 'students',
                    attributes: ['id'],
                    through: { attributes: [] }
                }
            ],
            order: [[sortBy, order.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        const classesWithCount = rows.map(cls => {
            const classData = cls.toJSON();
            classData.studentCount = classData.students ? classData.students.length : 0;
            delete classData.students;
            return classData;
        });
        
        return res.status(200).json({
            success: true,
            data: {
                classes: classesWithCount,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            }
        });
        
    } catch (error) {
        console.error("Error getting classes:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting classes",
            error: error.message
        });
    }
};

export const getClassById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const classData = await ClassesModel.findByPk(id, {
            include: [
                {
                    model: UserModel,
                    as: 'teacher',
                    attributes: ['id', 'fullName', 'email']
                },
                {
                    model: UserModel,
                    as: 'students',
                    attributes: ['id', 'fullName', 'email'],
                    through: { attributes: ['joined_at'] }
                },
                {
                    model: ExamModel,
                    as: 'examsManyToMany',
                    attributes: ['id', 'title', 'start_time', 'end_time', 'is_paid', 'fee']
                }
            ]
        });
        
        if (!classData) {
            return res.status(404).json({
                success: false,
                message: "Class not found"
            });
        }
        
        return res.status(200).json({
            success: true,
            data: classData
        });
        
    } catch (error) {
        console.error("Error getting class:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting class details",
            error: error.message
        });
    }
};

export const deleteClass = async (req, res) => {
    try {
        const { id } = req.params;
        
        const classData = await ClassesModel.findByPk(id);
        
        if (!classData) {
            return res.status(404).json({
                success: false,
                message: "Class not found"
            });
        }

        const examCount = await ExamClassModel.count({ where: { class_id: id } });
        
        await classData.destroy();
        
        return res.status(200).json({
            success: true,
            message: "Class deleted successfully",
            info: {
                examsAffected: examCount
            }
        });
        
    } catch (error) {
        console.error("Error deleting class:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting class",
            error: error.message
        });
    }
};

export const getClassStudents = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 10 } = req.query;
        
        const offset = (page - 1) * parseInt(limit);

        const classExists = await ClassesModel.findByPk(id);
        if (!classExists) {
            return res.status(404).json({
                success: false,
                message: "Class not found"
            });
        }

        const totalStudents = await classExists.countStudents();

        const students = await classExists.getStudents({
            attributes: ['id', 'fullName', 'email'],
            joinTableAttributes: ['joined_at'],
            limit: parseInt(limit),
            offset: offset,
            order: [['fullName', 'ASC']]
        });

        const formattedStudents = students.map(student => ({
            id: student.id,
            fullName: student.fullName,
            email: student.email,
            Class_student: {
                joined_at: student.Class_student?.joined_at || null
            }
        }));
        
        return res.status(200).json({
            success: true,
            data: {
                students: formattedStudents,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalStudents,
                    totalPages: Math.ceil(totalStudents / parseInt(limit))
                }
            }
        });
        
    } catch (error) {
        console.error("Error getting class students:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting class students",
            error: error.message
        });
    }
};

