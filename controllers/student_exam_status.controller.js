import { Op } from "sequelize";
import { getStudentExamStatus, getStudentAllExamStatuses } from "../services/student_exam_status.service.js";
import { ExamModel, ClassesModel, ClassStudentModel, ExamClassModel } from "../models/index.model.js";

/**
 * Lấy trạng thái của student cho một exam cụ thể
 */
export const getExamStatus = async (req, res) => {
    try {
        const { exam_id } = req.params;
        const student_id = req.userId;

        const status = await getStudentExamStatus(student_id, exam_id);

        return res.status(200).send({
            success: true,
            data: status
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

/**
 * Lấy tất cả exams với trạng thái của student
 */
export const getAllExamsWithStatus = async (req, res) => {
    try {
        const student_id = req.userId;

        // Lấy tất cả exams mà student có thể làm
        // (public exams hoặc exams trong classes mà student tham gia)
        const student = await ClassStudentModel.findAll({
            where: { student_id },
            attributes: ['class_id']
        });
        const classIds = student.map(s => s.class_id);

        // Lấy exam_ids từ Exam_Classes cho các lớp mà student tham gia
        const examIdsInClasses = await ExamClassModel.findAll({
            where: { class_id: { [Op.in]: classIds } },
            attributes: ['exam_id'],
            raw: true
        });
        const examIdsFromClasses = [...new Set(examIdsInClasses.map(ec => ec.exam_id))];

        // Kết hợp: exam có class_id trong classIds HOẶC exam_id trong Exam_Classes
        const exams = await ExamModel.findAll({
            where: {
                [Op.or]: [
                    { is_public: true, class_id: null },
                    { is_public: true, class_id: { [Op.in]: classIds } },
                    ...(examIdsFromClasses.length > 0 ? [{ is_public: true, id: { [Op.in]: examIdsFromClasses } }] : [])
                ]
            },
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

        const examIds = exams.map(e => e.id);
        const statuses = await getStudentAllExamStatuses(student_id, examIds);

        // Tạo map để tra cứu nhanh
        const statusMap = {};
        statuses.forEach(status => {
            statusMap[status.exam_id] = status;
        });

        // Kết hợp exams với statuses
        const examsWithStatus = exams.map(exam => {
            const status = statusMap[exam.id] || {
                attempt_count: 0,
                status: 'not_started',
                best_score: null,
                last_score: null,
                best_percentage: null,
                last_percentage: null
            };

            return {
                ...exam.toJSON(),
                attempt_status: status
            };
        });

        return res.status(200).send({
            success: true,
            data: examsWithStatus
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

/**
 * Lấy danh sách exams theo trạng thái
 */
export const getExamsByStatus = async (req, res) => {
    try {
        const student_id = req.userId;
        const { status } = req.query; // 'not_started', 'in_progress', 'completed'

        if (status && !['not_started', 'in_progress', 'completed'].includes(status)) {
            return res.status(400).send({
                success: false,
                message: 'Invalid status. Must be: not_started, in_progress, or completed'
            });
        }

        // Lấy tất cả exams mà student có thể làm (public + trong classes đã tham gia)
        const student = await ClassStudentModel.findAll({
            where: { student_id },
            attributes: ['class_id']
        });
        const classIds = student.map(s => s.class_id);

        // Lấy tất cả statuses đã có
        const allStatuses = await getStudentAllExamStatuses(student_id);
        const statusMap = {};
        allStatuses.forEach(s => {
            statusMap[s.exam_id] = s;
        });

        let exams;
        let filteredExamIds = null;

        if (status === 'not_started') {
            // Lấy exam_ids từ Exam_Classes cho các lớp mà student tham gia
            const examIdsInClasses = await ExamClassModel.findAll({
                where: { class_id: { [Op.in]: classIds } },
                attributes: ['exam_id'],
                raw: true
            });
            const examIdsFromClasses = [...new Set(examIdsInClasses.map(ec => ec.exam_id))];

            // Lấy tất cả exams có thể làm
            exams = await ExamModel.findAll({
                where: {
                    [Op.or]: [
                        { is_public: true, class_id: null },
                        { is_public: true, class_id: { [Op.in]: classIds } },
                        ...(examIdsFromClasses.length > 0 ? [{ is_public: true, id: { [Op.in]: examIdsFromClasses } }] : [])
                    ]
                },
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

            // Chỉ giữ lại exams chưa có status record (chưa từng làm)
            exams = exams.filter(exam => !statusMap[exam.id]);
        } else if (status === 'in_progress' || status === 'completed') {
            // Chỉ lấy exams có status record với status tương ứng
            const filteredStatuses = allStatuses.filter(s => s.status === status);
            filteredExamIds = filteredStatuses.map(s => s.exam_id);

            if (filteredExamIds.length === 0) {
                return res.status(200).send({
                    success: true,
                    data: []
                });
            }

            exams = await ExamModel.findAll({
                where: {
                    id: { [Op.in]: filteredExamIds }
                },
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
        } else {
            // Không có filter status: trả về tất cả exams có status record
            filteredExamIds = allStatuses.map(s => s.exam_id);

            if (filteredExamIds.length === 0) {
                return res.status(200).send({
                    success: true,
                    data: []
                });
            }

            exams = await ExamModel.findAll({
                where: {
                    id: { [Op.in]: filteredExamIds }
                },
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
        }

        // Kết hợp exams với statuses
        const examsWithStatus = exams.map(exam => {
            const examStatus = statusMap[exam.id] || {
                attempt_count: 0,
                status: 'not_started',
                best_score: null,
                last_score: null,
                best_percentage: null,
                last_percentage: null
            };

            return {
                ...exam.toJSON(),
                attempt_status: examStatus
            };
        });

        return res.status(200).send({
            success: true,
            data: examsWithStatus
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

