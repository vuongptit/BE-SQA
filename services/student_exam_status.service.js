import { Op } from "sequelize";
import { StudentExamStatusModel, ExamSessionModel, ExamResultModel } from "../models/index.model.js";

/**
 * Tạo hoặc cập nhật status khi student bắt đầu làm bài
 */
export const updateStatusOnStart = async (student_id, exam_id, session_id) => {
  try {
    // Tìm hoặc tạo status record
    const [status, created] = await StudentExamStatusModel.findOrCreate({
      where: {
        student_id: student_id,
        exam_id: exam_id
      },
      defaults: {
        student_id: student_id,
        exam_id: exam_id,
        attempt_count: 0,
        status: 'not_started',
        first_attempt_at: null,
        last_attempt_at: null,
        current_session_id: null
      }
    });

    const now = new Date();

    // Nếu là lần đầu làm bài
    if (created || !status.first_attempt_at) {
      await status.update({
        first_attempt_at: now,
        status: 'in_progress',
        current_session_id: session_id
      });
    } else {
      // Đã từng làm rồi, cập nhật status
      await status.update({
        status: 'in_progress',
        current_session_id: session_id
      });
    }

    return status;
  } catch (error) {
    console.error('Error updating status on start:', error);
    throw error;
  }
};

/**
 * Cập nhật status khi student submit bài
 */
export const updateStatusOnSubmit = async (student_id, exam_id, session_id, result) => {
  try {
    const status = await StudentExamStatusModel.findOne({
      where: {
        student_id: student_id,
        exam_id: exam_id
      }
    });

    if (!status) {
      // Nếu không có status, tạo mới (trường hợp bất thường)
      return await StudentExamStatusModel.create({
        student_id: student_id,
        exam_id: exam_id,
        attempt_count: 1,
        status: 'completed',
        first_attempt_at: result?.submitted_at || new Date(),
        last_attempt_at: result?.submitted_at || new Date(),
        last_score: result?.total_score || 0,
        best_score: result?.total_score || 0,
        last_percentage: result?.percentage || 0,
        best_percentage: result?.percentage || 0,
        completed_at: result?.submitted_at || new Date(),
        current_session_id: null
      });
    }

    const now = new Date();
    const attemptCount = status.attempt_count + 1;
    const lastScore = parseFloat(result?.total_score || 0);
    const lastPercentage = parseFloat(result?.percentage || 0);
    
    // So sánh với điểm cao nhất
    const bestScore = status.best_score 
      ? Math.max(parseFloat(status.best_score), lastScore)
      : lastScore;
    const bestPercentage = status.best_percentage
      ? Math.max(parseFloat(status.best_percentage), lastPercentage)
      : lastPercentage;

    await status.update({
      attempt_count: attemptCount,
      status: 'completed',
      last_attempt_at: result?.submitted_at || now,
      last_score: lastScore,
      best_score: bestScore,
      last_percentage: lastPercentage,
      best_percentage: bestPercentage,
      completed_at: result?.submitted_at || now,
      current_session_id: null // Clear current session
    });

    return status;
  } catch (error) {
    console.error('Error updating status on submit:', error);
    throw error;
  }
};

/**
 * Lấy status của student cho một exam
 */
export const getStudentExamStatus = async (student_id, exam_id) => {
  try {
    const status = await StudentExamStatusModel.findOne({
      where: {
        student_id: student_id,
        exam_id: exam_id
      },
      include: [
        {
          model: ExamSessionModel,
          as: 'currentSession',
          required: false
        }
      ]
    });

    // Nếu không có status, trả về default
    if (!status) {
      return {
        student_id,
        exam_id,
        attempt_count: 0,
        status: 'not_started',
        first_attempt_at: null,
        last_attempt_at: null,
        best_score: null,
        last_score: null,
        best_percentage: null,
        last_percentage: null,
        completed_at: null,
        current_session_id: null
      };
    }

    return status;
  } catch (error) {
    console.error('Error getting student exam status:', error);
    // Trả về default thay vì throw để tránh crash
    if (error.name === 'SequelizeConnectionAcquireTimeoutError') {
      return {
        student_id,
        exam_id,
        attempt_count: 0,
        status: 'not_started',
        first_attempt_at: null,
        last_attempt_at: null,
        best_score: null,
        last_score: null,
        best_percentage: null,
        last_percentage: null,
        completed_at: null,
        current_session_id: null
      };
    }
    throw error;
  }
};

/**
 * Lấy tất cả exams mà student đã làm hoặc chưa làm
 */
export const getStudentAllExamStatuses = async (student_id, exam_ids = null) => {
  try {
    const whereClause = { student_id };
    if (exam_ids && Array.isArray(exam_ids)) {
      whereClause.exam_id = { [Op.in]: exam_ids };
    }

    const statuses = await StudentExamStatusModel.findAll({
      where: whereClause,
      order: [['last_attempt_at', 'DESC']],
      limit: 100  // Giới hạn để tránh timeout
    });

    return statuses;
  } catch (error) {
    console.error('Error getting all exam statuses:', error);
    // Trả về mảng rỗng thay vì throw để tránh crash
    if (error.name === 'SequelizeConnectionAcquireTimeoutError') {
      return [];
    }
    throw error;
  }
};

/**
 * Reset status khi cần (ví dụ: cho phép làm lại)
 */
export const resetExamStatus = async (student_id, exam_id) => {
  try {
    const status = await StudentExamStatusModel.findOne({
      where: {
        student_id: student_id,
        exam_id: exam_id
      }
    });

    if (!status) {
      return null;
    }

    await status.update({
      status: 'not_started',
      current_session_id: null
    });

    return status;
  } catch (error) {
    console.error('Error resetting exam status:', error);
    throw error;
  }
};
