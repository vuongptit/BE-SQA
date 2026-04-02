import { ExamModel, ClassesModel, ClassStudentModel, QuestionModel, QuestionAnswerModel, StudentAnswerModel, ExamRatingModel, UserModel, ExamClassModel, ExamResultModel } from "../models/index.model.js";
import { Op } from "sequelize";
import sequelize from "../config/db.config.js";
import { notifyExamAssignedToClass } from "../services/notification.service.js";

const ALLOWED_QUESTION_METHODS = ['text', 'editor'];

function normalizeQuestionMethod(value) {
    if (!value) return null;
    return ALLOWED_QUESTION_METHODS.includes(value) ? value : null;
}

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

export const createExam = async (req, res) => {
    try {
        const {
            class_ids, // Array of class_ids (có thể là empty array hoặc null để không gắn vào lớp nào)
            title,
            des,
            total_score,
            minutes,
            start_time,
            end_time,
            is_paid,
            fee,
            is_public,
            question_creation_method,
            image_url
        } = req.body;

        const created_by = req.userId; // Get from middleware

        // Validate required fields
        if (!title || !minutes) {
            return res.status(400).send({
                message: 'Missing required fields: title, minutes'
            });
        }

        // Xử lý class_ids: phải là array hoặc null/undefined
        let classIdsArray = [];
        if (class_ids !== undefined && class_ids !== null) {
            if (!Array.isArray(class_ids)) {
                return res.status(400).send({
                    message: 'class_ids must be an array or null/undefined'
                });
            }
            classIdsArray = class_ids;
        }

        // Remove duplicates và filter null values
        classIdsArray = [...new Set(classIdsArray.filter(id => id !== null && id !== undefined))];

        // Validate classes: tất cả các class phải tồn tại và thuộc về teacher
        if (classIdsArray.length > 0) {
            const classes = await ClassesModel.findAll({
                where: {
                    id: classIdsArray,
                    teacher_id: created_by
                }
            });

            if (classes.length !== classIdsArray.length) {
                return res.status(404).send({
                    message: 'One or more classes not found or you do not have permission to create exam for these classes'
                });
            }
        }

        // Validate dates nếu có (cho phép null khi không giới hạn thời gian)
        let startDate = null;
        let endDate = null;

        if (start_time && end_time) {
            startDate = new Date(start_time);
            endDate = new Date(end_time);

            if (startDate >= endDate) {
                return res.status(400).send({
                    message: 'End time must be after start time'
                });
            }
        } else if (start_time || end_time) {
            // Nếu chỉ có một trong hai, không hợp lệ
            return res.status(400).send({
                message: 'Both start_time and end_time must be provided together, or both can be null for unlimited time'
            });
        }

        // Validate fee if is_paid is true
        if (is_paid && (!fee || fee <= 0)) {
            return res.status(400).send({
                message: 'Fee is required when is_paid is true'
            });
        }

        const normalizedQuestionMethod = normalizeQuestionMethod(question_creation_method);
        if (question_creation_method && !normalizedQuestionMethod) {
            return res.status(400).send({
                message: 'Invalid question_creation_method. Allowed values: text, editor'
            });
        }

        // Create exam
        const exam = await ExamModel.create({
            title,
            des: des || null,
            total_score: total_score || 100,
            minutes,
            start_time: startDate, // Có thể null
            end_time: endDate, // Có thể null
            is_paid: is_paid || false,
            fee: is_paid ? fee : 0,
            created_by,
            is_public: is_public || false,
            count: 0,
            question_creation_method: normalizedQuestionMethod,
            image_url: image_url || null
        });

        // Tạo các bản ghi trong Exam_Classes nếu có class_ids
        if (classIdsArray.length > 0) {
            const examClassRecords = classIdsArray.map(cid => ({
                exam_id: exam.id,
                class_id: cid
            }));

            await ExamClassModel.bulkCreate(examClassRecords);

            // Gửi thông báo cho students của tất cả các lớp
            for (const cid of classIdsArray) {
                try {
                    await notifyExamAssignedToClass(exam.id, cid);
                } catch (notifError) {
                    console.error(`Error sending notification for class ${cid}:`, notifError);
                    // Không fail request nếu thông báo lỗi
                }
            }
        }

        // Lấy exam với các lớp đã gắn
        const examWithClasses = await ExamModel.findByPk(exam.id, {
            include: [
                {
                    model: ClassesModel,
                    as: 'classes',
                    attributes: ['id', 'className', 'classCode'],
                    through: { attributes: [] }
                }
            ]
        });

        return res.status(201).send(examWithClasses || exam);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Get exam by ID (merged for both teacher and student with role-based logic)
export const getExamById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const role = req.role;

        const exam = await ExamModel.findOne({
            where: { id },
            include: [
                {
                    model: ClassesModel,
                    as: 'classes',
                    attributes: ['id', 'className', 'classCode'],
                    through: { attributes: [] },
                    required: false
                },
                {
                    model: UserModel,
                    as: 'creator',
                    attributes: ['id', 'fullName', 'email'],
                    required: false
                }
            ]
        });

        if (!exam) {
            return res.status(404).send({ message: 'Exam not found' });
        }

        // Lấy số câu hỏi
        const questionCount = await QuestionModel.count({
            where: { exam_id: id }
        });

        if (role === 'teacher') {
            // Teacher can only see their own exams
            if (exam.created_by !== userId) {
                return res.status(403).send({
                    message: 'You do not have permission to view this exam'
                });
            }

            const examData = exam.toJSON();
            examData.question_count = questionCount;

            // Thêm average rating
            const ratingInfo = await getExamAverageRating(id);
            examData.average_rating = ratingInfo.average_rating;
            examData.total_ratings = ratingInfo.total_ratings;

            return res.status(200).send(examData);
        } else if (role === 'student') {
            // Student logic: check if exam is public and accessible
            const student_id = userId;

            if (!exam.is_public) {
                return res.status(403).send({
                    message: 'This exam is private and only available to the creator'
                });
            }

            // Kiểm tra quyền truy cập: student phải là thành viên của ít nhất một lớp mà exam được gắn vào
            let hasAccess = false;

            // Lấy danh sách class_ids từ Exam_Classes (many-to-many)
            const examClasses = await ExamClassModel.findAll({
                where: { exam_id: id },
                attributes: ['class_id']
            });

            const examClassIds = examClasses.map(ec => ec.class_id);

            // Nếu exam không có lớp nào gắn (examClassIds rỗng), cho phép truy cập nếu exam.is_public
            if (examClassIds.length === 0) {
                hasAccess = true; // Exam public không gắn vào lớp nào
            } else {
                // Kiểm tra student có trong ít nhất một lớp không
                if (examClassIds.length > 0) {
                    const isMember = await ClassStudentModel.findOne({
                        where: {
                            class_id: examClassIds,
                            student_id,
                            is_ban: false
                        }
                    });
                    hasAccess = !!isMember;
                }
            }

            if (!hasAccess) {
                return res.status(403).send({
                    message: 'You are not a member of any class associated with this exam. Cannot view this exam.'
                });
            }

            // Thêm thông tin về trạng thái exam
            const now = new Date();
            const examData = exam.toJSON();
            examData.question_count = questionCount;

            // Thêm average rating
            const ratingInfo = await getExamAverageRating(id);
            examData.average_rating = ratingInfo.average_rating;
            examData.total_ratings = ratingInfo.total_ratings;

            // Xử lý trường hợp không giới hạn thời gian
            if (!exam.start_time || !exam.end_time) {
                examData.status = 'unlimited'; // Không giới hạn thời gian
            } else {
                const startTime = new Date(exam.start_time);
                const endTime = new Date(exam.end_time);

                if (now < startTime) {
                    examData.status = 'upcoming';
                } else if (now >= startTime && now <= endTime) {
                    examData.status = 'ongoing';
                } else {
                    examData.status = 'ended';
                }
            }

            return res.status(200).send(examData);
        } else {
            return res.status(403).send({
                message: 'Invalid role. Only teacher and student can access exams.'
            });
        }

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Get all exams (merged for both teacher and student with role-based logic)
export const getExams = async (req, res) => {
    try {
        const userId = req.userId;
        const role = req.role;
        const {
            class_id,
            is_paid,
            page = 1,
            limit = 10,
            offset,
            search
        } = req.query;

        // Parse pagination parameters
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;
        const offsetNum = offset !== undefined ? parseInt(offset) : (pageNum - 1) * limitNum;

        if (role === 'teacher') {
            // Teacher can only see exams they created
            let whereCondition = {
                created_by: userId
            };

            // Filter by class if provided - tìm trong Exam_Classes
            if (class_id) {
                // Tìm exam có trong Exam_Classes
                const examIdsInClass = await ExamClassModel.findAll({
                    where: { class_id: class_id },
                    attributes: ['exam_id']
                });
                const examIdsArray = examIdsInClass.map(ec => ec.exam_id);

                // Filter theo exam_id trong Exam_Classes
                if (examIdsArray.length > 0) {
                    whereCondition.id = { [Op.in]: examIdsArray };
                } else {
                    // Nếu không có exam nào trong class này, trả về empty
                    whereCondition.id = { [Op.in]: [] };
                }
            }

            // Filter by is_paid if provided
            if (is_paid !== undefined) {
                whereCondition.is_paid = is_paid === 'true' || is_paid === true;
            }

            // Filter by search (title) if provided
            if (search && search.trim() !== '') {
                whereCondition.title = {
                    [Op.like]: `%${search.trim()}%`
                };
            }

            // Get total count for pagination
            const totalCount = await ExamModel.count({
                where: whereCondition
            });

            const exams = await ExamModel.findAll({
                where: whereCondition,
                include: [
                    {
                        model: ClassesModel,
                        as: 'classes',
                        attributes: ['id', 'className', 'classCode'],
                        through: { attributes: [] },
                        required: false
                    }
                ],
                order: [['created_at', 'DESC']],
                limit: limitNum,
                offset: offsetNum
            });

            // Thêm số câu hỏi, average rating và submission count cho mỗi exam
            const examsWithQuestionCount = await Promise.all(
                exams.map(async (exam) => {
                    const examData = exam.toJSON();
                    const questionCount = await QuestionModel.count({
                        where: { exam_id: exam.id }
                    });
                    examData.question_count = questionCount;

                    // Thêm average rating
                    const ratingInfo = await getExamAverageRating(exam.id);
                    examData.average_rating = ratingInfo.average_rating;
                    examData.total_ratings = ratingInfo.total_ratings;

                    // Thêm submission count (số lượt làm bài)
                    const submissionCount = await ExamResultModel.count({
                        where: { exam_id: exam.id }
                    });
                    examData.submission_count = submissionCount;

                    return examData;
                })
            );

            return res.status(200).send({
                data: examsWithQuestionCount,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    offset: offsetNum,
                    total: totalCount,
                    totalPages: Math.ceil(totalCount / limitNum)
                }
            });
        } else if (role === 'student') {
            // Student logic: public exams + exams in student's classes
            const student_id = userId;

            // Lấy danh sách class_id mà student đã join
            const studentClasses = await ClassStudentModel.findAll({
                where: { student_id: student_id },
                attributes: ['class_id']
            });

            const studentClassIds = studentClasses.map(sc => sc.class_id);

            // Xây dựng điều kiện where: Lấy tất cả public exams
            // Lấy exam_ids từ Exam_Classes mà student đã join hoặc exam không gắn vào lớp nào
            let examIdsArray = [];

            // Lấy exam_ids từ các lớp mà student đã join
            if (studentClassIds.length > 0) {
                const examIdsInStudentClasses = await ExamClassModel.findAll({
                    where: { class_id: { [Op.in]: studentClassIds } },
                    attributes: ['exam_id'],
                    group: ['exam_id']
                });
                examIdsArray = examIdsInStudentClasses.map(ec => ec.exam_id);
            }

            // Lấy tất cả exam_ids từ Exam_Classes
            const allExamIdsInClasses = await ExamClassModel.findAll({
                attributes: ['exam_id'],
                group: ['exam_id']
            });
            const allExamIdsSet = new Set(allExamIdsInClasses.map(ec => ec.exam_id));

            // Tạo điều kiện: exam public và (không gắn vào lớp nào HOẶC gắn vào lớp student đã join)
            const orConditions = [];

            // Exam public không gắn vào lớp nào
            if (examIdsArray.length > 0) {
                orConditions.push({
                    is_public: true,
                    id: { [Op.notIn]: Array.from(allExamIdsSet) }
                });
            } else {
                orConditions.push({
                    is_public: true,
                    id: { [Op.notIn]: Array.from(allExamIdsSet) }
                });
            }

            // Exam public gắn vào lớp student đã join
            if (examIdsArray.length > 0) {
                orConditions.push({
                    is_public: true,
                    id: { [Op.in]: examIdsArray }
                });
            }

            let whereCondition = {
                is_public: true,
                [Op.or]: orConditions.length > 0 ? orConditions : [{ is_public: true }]
            };

            // Filter by class_id if provided - tìm trong Exam_Classes
            if (class_id) {
                const isMember = await ClassStudentModel.findOne({
                    where: {
                        class_id,
                        student_id
                    }
                });

                if (!isMember) {
                    return res.status(403).send({
                        message: 'You are not a member of this class'
                    });
                }

                // Tìm exam có trong Exam_Classes
                const examIdsInClass = await ExamClassModel.findAll({
                    where: { class_id: class_id },
                    attributes: ['exam_id']
                });
                const examIdsArrayFiltered = examIdsInClass.map(ec => ec.exam_id);

                // Filter theo exam_id trong Exam_Classes
                if (examIdsArrayFiltered.length > 0) {
                    whereCondition = {
                        is_public: true,
                        id: { [Op.in]: examIdsArrayFiltered }
                    };
                } else {
                    // Nếu không có exam nào trong class này, trả về empty
                    whereCondition = {
                        is_public: true,
                        id: { [Op.in]: [] }
                    };
                }
            }

            // Filter by is_paid if provided
            if (is_paid !== undefined) {
                const isPaidValue = is_paid === 'true' || is_paid === true;
                whereCondition = {
                    ...whereCondition,
                    is_paid: isPaidValue
                };
            }

            // Filter by search (title) if provided
            if (search && search.trim() !== '') {
                whereCondition = {
                    ...whereCondition,
                    title: {
                        [Op.like]: `%${search.trim()}%`
                    }
                };
            }

            // Get total count for pagination
            const totalCount = await ExamModel.count({
                where: whereCondition
            });

            const exams = await ExamModel.findAll({
                where: whereCondition,
                include: [
                    {
                        model: ClassesModel,
                        as: 'classes',
                        attributes: ['id', 'className', 'classCode'],
                        through: { attributes: [] },
                        required: false
                    }
                ],
                order: [['created_at', 'DESC']],
                limit: limitNum,
                offset: offsetNum
            });

            // Thêm thông tin về trạng thái exam, số câu hỏi và average rating
            const now = new Date();
            const examsWithStatus = await Promise.all(
                exams.map(async (exam) => {
                    const examData = exam.toJSON();

                    // Thêm số câu hỏi
                    const questionCount = await QuestionModel.count({
                        where: { exam_id: exam.id }
                    });
                    examData.question_count = questionCount;

                    // Thêm average rating
                    const ratingInfo = await getExamAverageRating(exam.id);
                    examData.average_rating = ratingInfo.average_rating;
                    examData.total_ratings = ratingInfo.total_ratings;

                    // Xử lý trường hợp không giới hạn thời gian
                    if (!exam.start_time || !exam.end_time) {
                        examData.status = 'unlimited'; // Không giới hạn thời gian
                    } else {
                        const startTime = new Date(exam.start_time);
                        const endTime = new Date(exam.end_time);

                        if (now < startTime) {
                            examData.status = 'upcoming';
                        } else if (now >= startTime && now <= endTime) {
                            examData.status = 'ongoing';
                        } else {
                            examData.status = 'ended';
                        }
                    }

                    return examData;
                })
            );

            return res.status(200).send({
                data: examsWithStatus,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    offset: offsetNum,
                    total: totalCount,
                    totalPages: Math.ceil(totalCount / limitNum)
                }
            });
        } else {
            return res.status(403).send({
                message: 'Invalid role. Only teacher and student can access exams.'
            });
        }

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Update exam
export const updateExam = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const {
            class_ids, // Array of class_ids (có thể là empty array hoặc null để bỏ gắn tất cả lớp)
            title,
            des,
            total_score,
            minutes,
            start_time,
            end_time,
            is_paid,
            fee,
            is_public,
            question_creation_method,
            image_url
        } = req.body;

        // Find exam
        const exam = await ExamModel.findOne({
            where: { id }
        });

        if (!exam) {
            return res.status(404).send({ message: 'Exam not found' });
        }

        // Check if user is the creator
        if (exam.created_by !== userId) {
            return res.status(403).send({
                message: 'You do not have permission to update this exam'
            });
        }

        // Validate dates if provided
        if (start_time !== undefined || end_time !== undefined) {
            // Nếu cả hai đều null, cho phép (không giới hạn thời gian)
            if (start_time === null && end_time === null) {
                // OK - không giới hạn thời gian
            } else if (start_time && end_time) {
                // Cả hai đều có giá trị, kiểm tra hợp lệ
                const startDate = new Date(start_time);
                const endDate = new Date(end_time);

                if (startDate >= endDate) {
                    return res.status(400).send({
                        message: 'End time must be after start time'
                    });
                }
            } else if (start_time === null || end_time === null) {
                // Chỉ một trong hai null, không hợp lệ
                return res.status(400).send({
                    message: 'Both start_time and end_time must be provided together, or both can be null for unlimited time'
                });
            } else {
                // Một trong hai được cung cấp, lấy giá trị từ exam hiện tại cho giá trị còn lại
                const startDate = start_time ? new Date(start_time) : (exam.start_time ? new Date(exam.start_time) : null);
                const endDate = end_time ? new Date(end_time) : (exam.end_time ? new Date(exam.end_time) : null);

                if (startDate && endDate && startDate >= endDate) {
                    return res.status(400).send({
                        message: 'End time must be after start time'
                    });
                }
            }
        }

        // Validate fee if is_paid is true
        // Chỉ validate fee khi:
        // 1. is_paid được gửi trong request và là true, HOẶC
        // 2. is_paid không được gửi nhưng exam hiện tại có is_paid = true VÀ fee được gửi trong request
        // Nếu chỉ update các field khác (như question_creation_method) mà không gửi fee, thì không validate fee
        if (is_paid !== undefined && is_paid === true) {
            // Nếu is_paid được set thành true trong request, fee phải được gửi và hợp lệ
            if (fee === undefined || fee === null || fee <= 0) {
                return res.status(400).send({
                    message: 'Fee is required when is_paid is true'
                });
            }
        } else if (is_paid === undefined && exam.is_paid === true && fee !== undefined) {
            // Nếu exam hiện tại có is_paid = true và fee được gửi trong request, validate fee
            if (fee === null || fee <= 0) {
                return res.status(400).send({
                    message: 'Fee must be greater than 0 when is_paid is true'
                });
            }
        }
        // Nếu không gửi fee và không set is_paid = true, không validate (giữ nguyên fee hiện tại)

        // Xử lý class_ids: phải là array hoặc null/undefined
        let classIdsArray = undefined;
        if (class_ids !== undefined && class_ids !== null) {
            if (!Array.isArray(class_ids)) {
                return res.status(400).send({
                    message: 'class_ids must be an array or null/undefined'
                });
            }
            classIdsArray = class_ids;
            // Remove duplicates và filter null values
            classIdsArray = [...new Set(classIdsArray.filter(id => id !== null && id !== undefined))];
        } else if (class_ids === null) {
            // Nếu gửi null, có nghĩa là muốn bỏ gắn tất cả lớp
            classIdsArray = [];
        }

        // Validate classes nếu có classIdsArray
        if (classIdsArray !== undefined && classIdsArray.length > 0) {

            if (classIdsArray.length > 0) {
                const classes = await ClassesModel.findAll({
                    where: {
                        id: classIdsArray,
                        teacher_id: userId
                    }
                });

                if (classes.length !== classIdsArray.length) {
                    return res.status(404).send({
                        message: 'One or more classes not found or you do not have permission to assign exam to these classes'
                    });
                }
            }
        }

        // Validate question creation method updates
        let normalizedQuestionMethodValue = undefined;
        if (question_creation_method !== undefined) {
            const normalizedMethod = question_creation_method
                ? normalizeQuestionMethod(question_creation_method)
                : null;

            if (question_creation_method && !normalizedMethod) {
                return res.status(400).send({
                    message: 'Invalid question_creation_method. Allowed values: text, editor'
                });
            }

            const existingMethod = exam.question_creation_method;

            if (existingMethod && normalizedMethod && existingMethod !== normalizedMethod) {
                return res.status(400).send({
                    message: `Question creation method has already been locked to "${existingMethod}".`
                });
            }

            if (existingMethod && normalizedMethod === null) {
                return res.status(400).send({
                    message: 'Question creation method cannot be unset once selected.'
                });
            }

            if (!existingMethod || normalizedMethod === existingMethod) {
                // Only set when previously empty or same value (idempotent)
                normalizedQuestionMethodValue = normalizedMethod ?? existingMethod ?? null;
            }
        }

        // Update exam
        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (des !== undefined) updateData.des = des;
        if (total_score !== undefined) updateData.total_score = total_score;
        if (minutes !== undefined) updateData.minutes = minutes;
        if (start_time !== undefined) updateData.start_time = start_time === null ? null : new Date(start_time);
        if (end_time !== undefined) updateData.end_time = end_time === null ? null : new Date(end_time);
        if (is_paid !== undefined) updateData.is_paid = is_paid;
        if (fee !== undefined) {
            // Nếu is_paid được set, dùng giá trị đó, nếu không dùng giá trị hiện tại của exam
            const finalIsPaid = is_paid !== undefined ? is_paid : exam.is_paid;
            updateData.fee = finalIsPaid ? fee : 0;
        }
        if (is_public !== undefined) updateData.is_public = is_public;
        if (question_creation_method !== undefined && normalizedQuestionMethodValue !== undefined) {
            updateData.question_creation_method = normalizedQuestionMethodValue;
        }
        if (image_url !== undefined) updateData.image_url = image_url || null;

        await exam.update(updateData);

        // Cập nhật Exam_Classes nếu classIdsArray được cung cấp
        if (classIdsArray !== undefined) {
            // Xóa tất cả các bản ghi cũ
            await ExamClassModel.destroy({
                where: { exam_id: exam.id }
            });

            // Tạo các bản ghi mới nếu có classIdsArray
            if (classIdsArray.length > 0) {
                const examClassRecords = classIdsArray.map(cid => ({
                    exam_id: exam.id,
                    class_id: cid
                }));

                await ExamClassModel.bulkCreate(examClassRecords);

                // Gửi thông báo cho tất cả các lớp mới
                for (const cid of classIdsArray) {
                    try {
                        await notifyExamAssignedToClass(exam.id, cid);
                    } catch (notifError) {
                        console.error(`Error sending notification for class ${cid}:`, notifError);
                        // Không fail request nếu thông báo lỗi
                    }
                }
            }
        }

        // Return updated exam với classes
        const updatedExam = await ExamModel.findOne({
            where: { id },
            include: [
                {
                    model: ClassesModel,
                    as: 'classes',
                    attributes: ['id', 'className', 'classCode'],
                    through: { attributes: [] },
                    required: false
                }
            ]
        });

        return res.status(200).send(updatedExam);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

export const switchQuestionCreationMethod = async (req, res) => {
    try {
        const { id } = req.params;
        const { target_method } = req.body;
        const userId = req.userId;

        if (!target_method) {
            return res.status(400).send({
                message: 'target_method is required (text | editor)'
            });
        }

        const normalizedTarget = normalizeQuestionMethod(target_method);
        if (!normalizedTarget) {
            return res.status(400).send({
                message: 'Invalid target_method. Allowed values: text, editor'
            });
        }

        const exam = await ExamModel.findOne({
            where: { id, created_by: userId }
        });

        if (!exam) {
            return res.status(404).send({
                message: 'Exam not found or you do not have permission to update it'
            });
        }

        if (!exam.question_creation_method) {
            return res.status(400).send({
                message: 'Question creation method has not been selected yet.'
            });
        }

        if (exam.question_creation_method === normalizedTarget) {
            return res.status(400).send({
                message: 'Exam is already using the requested question creation method.'
            });
        }

        const transaction = await ExamModel.sequelize.transaction();

        try {
            const questions = await QuestionModel.findAll({
                where: { exam_id: id, teacher_id: userId },
                attributes: ['id'],
                transaction
            });

            const questionIds = questions.map(q => q.id);

            if (questionIds.length > 0) {
                await StudentAnswerModel.destroy({
                    where: { exam_question_id: questionIds },
                    transaction
                });

                await QuestionAnswerModel.destroy({
                    where: { question_id: questionIds },
                    transaction
                });

                await QuestionModel.destroy({
                    where: { id: questionIds },
                    transaction
                });
            }

            await exam.update(
                {
                    question_creation_method: normalizedTarget,
                    count: 0
                },
                { transaction }
            );

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }

        const updatedExam = await ExamModel.findOne({
            where: { id },
            include: [
                {
                    model: ClassesModel,
                    as: 'classes',
                    attributes: ['id', 'className', 'classCode'],
                    through: { attributes: [] },
                    required: false
                }
            ]
        });

        return res.status(200).send({
            message: 'Question creation method switched successfully. All previous questions have been removed.',
            exam: updatedExam
        });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Delete exam
export const deleteExam = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        // Find exam
        const exam = await ExamModel.findOne({
            where: { id }
        });

        if (!exam) {
            return res.status(404).send({ message: 'Exam not found' });
        }

        // Check if user is the creator
        if (exam.created_by !== userId) {
            return res.status(403).send({
                message: 'You do not have permission to delete this exam'
            });
        }

        // Delete exam
        await exam.destroy();

        return res.status(200).send({
            message: 'Exam deleted successfully'
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Get all exams available for student (public exams + exams in student's classes)
export const getAvailableExamsForStudent = async (req, res) => {
    try {
        const student_id = req.userId;
        const { class_id } = req.query; // Optional: filter by class

        // Lấy danh sách class_id mà student đã join
        const studentClasses = await ClassStudentModel.findAll({
            where: { student_id: student_id },
            attributes: ['class_id']
        });

        const studentClassIds = studentClasses.map(sc => sc.class_id);

        // Lấy exam_ids từ Exam_Classes mà student đã join hoặc exam không gắn vào lớp nào
        let examIdsArray = [];

        // Lấy exam_ids từ các lớp mà student đã join
        if (studentClassIds.length > 0) {
            const examIdsInStudentClasses = await ExamClassModel.findAll({
                where: { class_id: { [Op.in]: studentClassIds } },
                attributes: ['exam_id'],
                group: ['exam_id']
            });
            examIdsArray = examIdsInStudentClasses.map(ec => ec.exam_id);
        }

        // Lấy tất cả exam_ids từ Exam_Classes
        const allExamIdsInClasses = await ExamClassModel.findAll({
            attributes: ['exam_id'],
            group: ['exam_id']
        });
        const allExamIdsSet = new Set(allExamIdsInClasses.map(ec => ec.exam_id));

        // Tạo điều kiện: exam public và (không gắn vào lớp nào HOẶC gắn vào lớp student đã join)
        const orConditions = [];

        // Exam public không gắn vào lớp nào
        orConditions.push({
            is_public: true,
            id: { [Op.notIn]: Array.from(allExamIdsSet) }
        });

        // Exam public gắn vào lớp student đã join
        if (examIdsArray.length > 0) {
            orConditions.push({
                is_public: true,
                id: { [Op.in]: examIdsArray }
            });
        }

        let whereCondition = {
            is_public: true,
            [Op.or]: orConditions.length > 0 ? orConditions : [{ is_public: true }]
        };

        if (class_id) {
            const isMember = await ClassStudentModel.findOne({
                where: {
                    class_id,
                    student_id
                }
            });

            if (!isMember) {
                return res.status(403).send({
                    message: 'You are not a member of this class'
                });
            }

            // Tìm exam có trong Exam_Classes
            const examIdsInClass = await ExamClassModel.findAll({
                where: { class_id: class_id },
                attributes: ['exam_id']
            });
            const examIdsArrayFiltered = examIdsInClass.map(ec => ec.exam_id);

            // Filter theo exam_id trong Exam_Classes
            if (examIdsArrayFiltered.length > 0) {
                whereCondition = {
                    is_public: true,
                    id: { [Op.in]: examIdsArrayFiltered }
                };
            } else {
                // Nếu không có exam nào trong class này, trả về empty
                whereCondition = {
                    is_public: true,
                    id: { [Op.in]: [] }
                };
            }
        }

        const exams = await ExamModel.findAll({
            where: whereCondition,
            include: [
                {
                    model: ClassesModel,
                    as: 'classes',
                    attributes: ['id', 'className', 'classCode'],
                    through: { attributes: [] },
                    required: false
                }
            ],
            order: [['created_at', 'DESC']]
        });

        // Thêm thông tin về trạng thái exam (chưa bắt đầu, đang diễn ra, đã kết thúc)
        const now = new Date();
        const examsWithStatus = exams.map(exam => {
            const examData = exam.toJSON();

            // Xử lý trường hợp không giới hạn thời gian
            if (!exam.start_time || !exam.end_time) {
                examData.status = 'unlimited'; // Không giới hạn thời gian
            } else {
                const startTime = new Date(exam.start_time);
                const endTime = new Date(exam.end_time);

                if (now < startTime) {
                    examData.status = 'upcoming';
                } else if (now >= startTime && now <= endTime) {
                    examData.status = 'ongoing';
                } else {
                    examData.status = 'ended';
                }
            }

            return examData;
        });

        return res.status(200).send(examsWithStatus);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Get exam detail for student (không lộ đáp án)
export const getExamDetailForStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const student_id = req.userId;

        const exam = await ExamModel.findOne({
            where: { id },
            include: [
                {
                    model: ClassesModel,
                    as: 'classes',
                    attributes: ['id', 'className', 'classCode'],
                    through: { attributes: [] },
                    required: false
                }
            ]
        });

        if (!exam) {
            return res.status(404).send({ message: 'Exam not found' });
        }

        if (!exam.is_public) {
            return res.status(403).send({
                message: 'This exam is private and only available to the creator'
            });
        }

        // Kiểm tra quyền truy cập: student phải là thành viên của ít nhất một lớp mà exam được gắn vào
        const examClasses = await ExamClassModel.findAll({
            where: { exam_id: id },
            attributes: ['class_id']
        });

        const examClassIds = examClasses.map(ec => ec.class_id);

        // Nếu exam có lớp gắn, kiểm tra student có trong lớp không
        if (examClassIds.length > 0) {
            const isMember = await ClassStudentModel.findOne({
                where: {
                    class_id: examClassIds,
                    student_id
                }
            });

            if (!isMember) {
                return res.status(403).send({
                    message: 'You are not a member of any class associated with this exam. Cannot view this exam.'
                });
            }
        }

        // Thêm thông tin về trạng thái exam
        const now = new Date();
        const examData = exam.toJSON();

        // Xử lý trường hợp không giới hạn thời gian
        if (!exam.start_time || !exam.end_time) {
            examData.status = 'unlimited'; // Không giới hạn thời gian
        } else {
            const startTime = new Date(exam.start_time);
            const endTime = new Date(exam.end_time);

            if (now < startTime) {
                examData.status = 'upcoming';
            } else if (now >= startTime && now <= endTime) {
                examData.status = 'ongoing';
            } else {
                examData.status = 'ended';
            }
        }

        return res.status(200).send(examData);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Get similar exams (cùng class, cùng chủ đề, hoặc tên liên quan)
export const getSimilarExams = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const role = req.role;
        const limit = parseInt(req.query.limit) || 6;

        // Lấy thông tin exam hiện tại
        const currentExam = await ExamModel.findOne({
            where: { id },
            include: [
                {
                    model: ClassesModel,
                    as: 'classes',
                    attributes: ['id', 'className', 'classCode'],
                    through: { attributes: [] },
                    required: false
                }
            ]
        });

        if (!currentExam) {
            return res.status(404).send({ message: 'Exam not found' });
        }

        // Kiểm tra quyền truy cập
        if (role === 'teacher' && currentExam.created_by !== userId) {
            return res.status(403).send({
                message: 'You do not have permission to view this exam'
            });
        } else if (role === 'student') {
            if (!currentExam.is_public) {
                return res.status(403).send({
                    message: 'This exam is private and only available to the creator'
                });
            }

            // Kiểm tra quyền truy cập: student phải là thành viên của ít nhất một lớp mà exam được gắn vào
            const examClasses = await ExamClassModel.findAll({
                where: { exam_id: id },
                attributes: ['class_id']
            });

            const examClassIds = examClasses.map(ec => ec.class_id);

            // Nếu exam có lớp gắn, kiểm tra student có trong lớp không
            if (examClassIds.length > 0) {
                const isMember = await ClassStudentModel.findOne({
                    where: {
                        class_id: examClassIds,
                        student_id: userId
                    }
                });

                if (!isMember) {
                    return res.status(403).send({
                        message: 'You are not a member of any class associated with this exam. Cannot view this exam.'
                    });
                }
            }
        }

        // Xây dựng điều kiện tìm kiếm bài thi tương tự
        const orConditions = [];

        // 1. Cùng classes (nếu có)
        const currentExamClasses = await ExamClassModel.findAll({
            where: { exam_id: id },
            attributes: ['class_id']
        });
        const currentExamClassIds = currentExamClasses.map(ec => ec.class_id);

        if (currentExamClassIds.length > 0) {
            // Tìm exam có cùng class_ids
            const examIdsWithSameClasses = await ExamClassModel.findAll({
                where: { class_id: { [Op.in]: currentExamClassIds } },
                attributes: ['exam_id'],
                group: ['exam_id'],
                having: sequelize.literal(`COUNT(DISTINCT class_id) >= ${currentExamClassIds.length}`)
            });
            const sameClassExamIds = examIdsWithSameClasses.map(ec => ec.exam_id).filter(eid => eid !== parseInt(id));

            if (sameClassExamIds.length > 0) {
                orConditions.push({
                    id: { [Op.in]: sameClassExamIds }
                });
            }
        }

        // 2. Tên tương tự (tìm các từ khóa trong title)
        const titleWords = currentExam.title.split(/\s+/).filter(word => word.length > 2);
        if (titleWords.length > 0) {
            orConditions.push({
                title: {
                    [Op.or]: titleWords.map(word => ({
                        [Op.like]: `%${word}%`
                    }))
                },
                id: { [Op.ne]: id }
            });
        }

        // 3. Cùng created_by (các bài thi khác của cùng giáo viên)
        orConditions.push({
            created_by: currentExam.created_by,
            id: { [Op.ne]: id }
        });

        let whereCondition = {};

        // Thêm điều kiện cho student (chỉ lấy public exams)
        if (role === 'student') {
            // Lấy danh sách class_id mà student đã join
            const studentClasses = await ClassStudentModel.findAll({
                where: { student_id: userId },
                attributes: ['class_id']
            });
            const studentClassIds = studentClasses.map(sc => sc.class_id);

            // Lấy exam_ids từ Exam_Classes mà student đã join hoặc exam không gắn vào lớp nào
            let examIdsArray = [];

            // Lấy exam_ids từ các lớp mà student đã join
            if (studentClassIds.length > 0) {
                const examIdsInStudentClasses = await ExamClassModel.findAll({
                    where: { class_id: { [Op.in]: studentClassIds } },
                    attributes: ['exam_id'],
                    group: ['exam_id']
                });
                examIdsArray = examIdsInStudentClasses.map(ec => ec.exam_id);
            }

            // Lấy tất cả exam_ids từ Exam_Classes
            const allExamIdsInClasses = await ExamClassModel.findAll({
                attributes: ['exam_id'],
                group: ['exam_id']
            });
            const allExamIdsSet = new Set(allExamIdsInClasses.map(ec => ec.exam_id));

            // Tạo điều kiện: exam public và (không gắn vào lớp nào HOẶC gắn vào lớp student đã join)
            const studentOrConditions = [];

            // Exam public không gắn vào lớp nào
            studentOrConditions.push({
                is_public: true,
                id: { [Op.notIn]: Array.from(allExamIdsSet) }
            });

            // Exam public gắn vào lớp student đã join
            if (examIdsArray.length > 0) {
                studentOrConditions.push({
                    is_public: true,
                    id: { [Op.in]: examIdsArray }
                });
            }

            whereCondition = {
                [Op.and]: [
                    {
                        [Op.or]: studentOrConditions
                    },
                    {
                        [Op.or]: orConditions
                    },
                    {
                        id: { [Op.ne]: id }
                    }
                ]
            };
        } else if (role === 'teacher') {
            // Teacher chỉ thấy các exam của mình
            whereCondition = {
                [Op.and]: [
                    {
                        [Op.or]: orConditions
                    },
                    {
                        created_by: userId
                    },
                    {
                        id: { [Op.ne]: id }
                    }
                ]
            };
        } else {
            whereCondition = {
                [Op.and]: [
                    {
                        [Op.or]: orConditions
                    },
                    {
                        id: { [Op.ne]: id }
                    }
                ]
            };
        }

        const similarExams = await ExamModel.findAll({
            where: whereCondition,
            include: [
                {
                    model: ClassesModel,
                    as: 'classes',
                    attributes: ['id', 'className', 'classCode'],
                    through: { attributes: [] },
                    required: false
                },
                {
                    model: UserModel,
                    as: 'creator',
                    attributes: ['id', 'fullName', 'email'],
                    required: false
                }
            ],
            order: [
                // Ưu tiên cùng classes, sau đó cùng title, sau đó cùng creator
                ['created_at', 'DESC']
            ],
            limit: limit
        });

        // Thêm số câu hỏi, status và average rating cho mỗi exam
        const now = new Date();
        const examsWithDetails = await Promise.all(
            similarExams.map(async (exam) => {
                const examData = exam.toJSON();

                // Thêm số câu hỏi
                const questionCount = await QuestionModel.count({
                    where: { exam_id: exam.id }
                });
                examData.question_count = questionCount;

                // Thêm average rating
                const ratingInfo = await getExamAverageRating(exam.id);
                examData.average_rating = ratingInfo.average_rating;
                examData.total_ratings = ratingInfo.total_ratings;

                // Thêm status
                if (!exam.start_time || !exam.end_time) {
                    examData.status = 'unlimited';
                } else {
                    const startTime = new Date(exam.start_time);
                    const endTime = new Date(exam.end_time);

                    if (now < startTime) {
                        examData.status = 'upcoming';
                    } else if (now >= startTime && now <= endTime) {
                        examData.status = 'ongoing';
                    } else {
                        examData.status = 'ended';
                    }
                }

                return examData;
            })
        );

        // Chỉ lọc các bài thi đang diễn ra (ongoing) và không giới hạn (unlimited)
        const filteredExams = examsWithDetails.filter(exam =>
            exam.status === 'ongoing' || exam.status === 'unlimited'
        );

        return res.status(200).send(filteredExams);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};
