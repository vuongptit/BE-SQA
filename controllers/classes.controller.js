import { UserModel, ClassesModel, ClassStudentModel } from "../models/index.model.js";
import { notifyStudentJoinedClass } from "../services/notification.service.js";  // Import từ index.model.js

export const createClass = async (req, res) => {
    try {
        const { className } = req.body;
        const teacher_id = req.userId; // Get from middleware

        if (!className) {
            return res.status(400).send({ message: 'Missing classname !!!' });
        }

        const classCreate = await ClassesModel.create({
            className: className,
            teacher_id: teacher_id
        });

        return res.status(201).send(classCreate);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Get list class for teacher and student
export const getClasses = async (req, res) => {
    try {
        const userId = req.userId;
        const role = req.role;
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        const offset = req.query.offset ? parseInt(req.query.offset) : 0;

        const teacherInclude = {
            model: UserModel,
            as: 'teacher',
            attributes: ['fullName']
        };

        let result;

        if (role === 'teacher') {

            result = await ClassesModel.findAndCountAll({
                where: {
                    teacher_id: userId
                },
                limit: limit,
                offset: offset,
                include: teacherInclude

            });

            // Đếm số học sinh cho mỗi lớp
            const classesWithStudentCount = await Promise.all(
                result.rows.map(async (classItem) => {
                    const studentCount = await ClassStudentModel.count({
                        where: {
                            class_id: classItem.id,
                            is_ban: false
                        }
                    });
                    const classData = classItem.toJSON();
                    classData.studentCount = studentCount;
                    return classData;
                })
            );

            return res.status(200).send({
                status: true,
                data: classesWithStudentCount,
                total: result.count,
                pagination: {
                    limit,
                    offset
                }
            });
        } else {

            console.log(userId)

            result = await ClassesModel.findAndCountAll({
                limit: limit,
                offset: offset,
                include: [
                    {
                        model: UserModel,
                        as: 'students',
                        where: {
                            id: userId
                        },
                        attributes: []
                    },

                    teacherInclude,
                ],


            });
        }

        return res.status(200).send({
            status: true,
            data: result.rows,
            total: result.count,
            pagination: {
                limit,
                offset
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).send({ status: false, message: error.message });
    }
};

// join class

export const joinClassByCode = async (req, res) => {
    try {
        const role = req.role;
        const userId = req.userId;
        const code = req.query.code;




        const joinClassInfo = await ClassesModel.findOne({
            where: {
                classCode: code.toUpperCase()
            }
        });

        if (!joinClassInfo) {
            return res.status(404).send({ status: false, message: "Class not found" });
        }

        const existingEnrollment = await ClassStudentModel.findOne({
            where: {
                class_id: joinClassInfo.id,
                student_id: userId
            }
        });

        if (existingEnrollment) {
            if (existingEnrollment.is_ban) {
                return res.status(400).send({ status: false, message: "You have been removed from this class" });
            }
            return res.status(400).send({ status: false, message: "You have already joined this class" });
        }


        const classStudent = await ClassStudentModel.create({
            class_id: joinClassInfo.id,
            student_id: userId,
            joined_at: new Date(),
            is_ban: false
        });

        // Gửi thông báo cho giáo viên
        try {
            await notifyStudentJoinedClass(userId, joinClassInfo.id);
        } catch (notifError) {
            console.error('Error sending notification:', notifError);

        }

        return res.status(200).send({ status: true, class: classStudent });

    } catch (error) {

        return res.status(500).send({ status: false, message: error.message });
    }
};

//get list student from class

export const GetStudentFromClass = async (req, res) => {
    try {
        const role = req.role;
        const userId = req.userId;
        const classCode = req.query.class || req.query.classCode;
        const classId = req.query.class_id;

        let classInfor = null;

        // Ưu tiên tìm theo classCode (mã lớp)
        if (classCode) {
            classInfor = await ClassesModel.findOne({
                where: {
                    classCode: classCode.toUpperCase()
                }
            });
        }
        // Nếu không có classCode, tìm theo class_id
        else if (classId) {
            classInfor = await ClassesModel.findOne({
                where: {
                    id: classId
                }
            });
        } else {
            return res.status(400).send({
                message: "Thiếu thông tin: cần cung cấp class (classCode) hoặc class_id"
            });
        }

        if (!classInfor) {
            return res.status(404).send({
                message: "Không tìm thấy lớp học"
            });
        }

        // Nếu là student, kiểm tra xem student có thuộc lớp này không
        if (role === 'student') {
            const isMember = await ClassStudentModel.findOne({
                where: {
                    class_id: classInfor.id,
                    student_id: userId,
                    is_ban: false
                }
            });

            if (!isMember) {
                return res.status(403).send({
                    message: "Bạn không thuộc lớp học này hoặc đã bị cấm"
                });
            }
        }

        // Xác định attributes dựa trên role
        let userAttributes = [];
        let throughAttributes = [];

        if (role === 'teacher' || role === 'admin') {
            // Teacher/Admin: đầy đủ thông tin
            userAttributes = ['id', 'fullName', 'email', 'balance', 'role', 'last_login', 'created_at'];
            throughAttributes = ['joined_at', 'is_ban'];
        } else {
            // Student: chỉ thông tin cơ bản
            userAttributes = ['id', 'fullName', 'email'];
            throughAttributes = ['joined_at'];
        }

        const listStudent = await ClassesModel.findOne({
            where: {
                id: classInfor.id
            },

            include: [
                {
                    model: UserModel,
                    as: "students",
                    attributes: userAttributes,
                    through: {
                        attributes: throughAttributes
                    }
                }
            ]

        })

        return res.status(200).send(listStudent)
    } catch (error) {
        return res.status(500).send({ message: error.message })
    }
}

//Ban/Unban student

export const BanStudent = async (req, res) => {
    try {

        const { classId, class_id, student_id, is_banned } = req.body;

        // Support both classId and class_id for backward compatibility
        const classIdValue = classId || class_id;

        // Validate required fields
        if (!classIdValue || !student_id) {
            return res.status(400).send({
                status: false,
                message: 'Missing required fields: classId (or class_id) and student_id'
            });
        }

        // Validate is_banned is boolean
        if (typeof is_banned !== 'boolean') {
            return res.status(400).send({
                status: false,
                message: 'is_banned must be a boolean value'
            });
        }

        // Find the class-student relationship
        const classStudent = await ClassStudentModel.findOne({
            where: {
                class_id: classIdValue,
                student_id: student_id
            }
        })

        if (!classStudent) {
            return res.status(404).send({
                status: false,
                message: 'Student not found in this class'
            });
        }

        // Update ban status
        classStudent.is_ban = is_banned;
        await classStudent.save();

        return res.status(200).send({
            status: true,
            message: is_banned ? 'Student banned successfully' : 'Student unbanned successfully',
            data: {
                student_id: student_id,
                class_id: classIdValue,
                is_ban: is_banned
            }
        });

    } catch (error) {
        console.error('Error updating student ban status:', error);
        return res.status(500).send({
            status: false,
            message: error.message || 'Internal server error'
        });
    }
}

// Update Class
export const updateClass = async (req, res) => {
    try {
        const { id } = req.params;
        const { className } = req.body;
        const teacher_id = req.userId; // Get from middleware

        // Validate required fields
        if (!className || className.trim() === '') {
            return res.status(400).send({
                status: false,
                message: 'className is required and cannot be empty'
            });
        }

        // Find the class
        const classToUpdate = await ClassesModel.findOne({
            where: {
                id: id,
                teacher_id: teacher_id // Ensure teacher owns this class
            }
        });

        if (!classToUpdate) {
            return res.status(404).send({
                status: false,
                message: 'Class not found or you do not have permission to update this class'
            });
        }

        // Update class name
        await classToUpdate.update({
            className: className.trim()
        });

        // Return updated class
        const updatedClass = await ClassesModel.findOne({
            where: { id: id },
            include: [
                {
                    model: UserModel,
                    as: 'teacher',
                    attributes: ['id', 'fullName']
                }
            ]
        });

        return res.status(200).send({
            status: true,
            message: 'Class updated successfully',
            data: updatedClass
        });

    } catch (error) {
        console.error('Error updating class:', error);
        return res.status(500).send({
            status: false,
            message: error.message || 'Internal server error'
        });
    }
};

// Delete Class
export const DeleteClass = async (req, res) => {
    try {

        const { class_id } = req.query;

        const deletedClass = await ClassesModel.destroy({
            where: {
                id: class_id
            }
        })

        if (!deletedClass) {
            return res.status(404).send({ message: "Class not found." });
        }


        return res.status(200).send("Delete Successfully")

    } catch (error) {
        return res.status(500).send({ message: error.message })
    }
}