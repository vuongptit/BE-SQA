import { Op } from "sequelize";
import { ExamResultModel, ExamSessionModel, StudentAnswerModel, ExamModel, QuestionModel, QuestionAnswerModel } from "../models/index.model.js";
import { updateStatusOnSubmit } from "./student_exam_status.service.js";

const includeExamForSession = {
  model: ExamModel,
  as: "exam",
  attributes: ["id", "title", "total_score", "minutes", "start_time", "end_time"],
};

const computeSessionScore = async (session, student_id) => {
  const sessionWithExam = session.exam
    ? session
    : await ExamSessionModel.findOne({
        where: { id: session.id },
        include: [includeExamForSession],
      });

  if (!sessionWithExam || !sessionWithExam.exam) {
    throw new Error("Exam information not found for session");
  }

  const studentAnswers = await StudentAnswerModel.findAll({
    where: {
      session_id: session.id,
    },
    include: [
      {
        model: QuestionModel,
        as: "question",
        attributes: ["id", "question_text", "type"],
      },
    ],
  });

  const allQuestions = await QuestionModel.findAll({
    where: { exam_id: session.exam_id },
    attributes: ["id"],
  });

  let totalScore = 0;
  let correctCount = 0;
  let wrongCount = 0;

  for (const answer of studentAnswers) {
    if (answer.score !== null && answer.score !== undefined) {
      totalScore += parseFloat(answer.score);
    }

    if (answer.is_correct === true) {
      correctCount++;
    } else if (answer.is_correct === false) {
      wrongCount++;
    }
  }

  const answeredQuestionIds = studentAnswers.map((answer) => answer.exam_question_id);
  const unansweredCount = allQuestions.length - answeredQuestionIds.length;

  // Tính câu chưa trả lời vào wrong_count
  wrongCount += unansweredCount;

  const examTotalScore = parseFloat(sessionWithExam.exam.total_score);
  const percentage = examTotalScore > 0 ? (totalScore / examTotalScore) * 100 : 0;
  const roundedPercentage = Math.round(percentage * 100) / 100;

  const now = new Date();

  // Tạo bản ghi StudentAnswer cho các câu hỏi chưa trả lời
  const unansweredQuestionIds = allQuestions
    .map((q) => q.id)
    .filter((qId) => !answeredQuestionIds.includes(qId));

  if (unansweredQuestionIds.length > 0) {
    const unansweredAnswers = unansweredQuestionIds.map((questionId) => ({
      session_id: session.id,
      exam_question_id: questionId,
      selected_answer_id: null,
      answer_text: null,
      score: 0,
      is_correct: false,
      answered_at: now,
    }));

    await StudentAnswerModel.bulkCreate(unansweredAnswers);
  }

  await sessionWithExam.update({
    status: "submitted",
    submitted_at: now,
    total_score: totalScore,
  });

  let examResult = await ExamResultModel.findOne({
    where: { session_id: session.id },
  });

  if (examResult) {
    await examResult.update({
      total_score: totalScore,
      correct_count: correctCount,
      wrong_count: wrongCount,
      percentage: roundedPercentage,
      submitted_at: now,
      status: "graded",
    });
  } else {
    examResult = await ExamResultModel.create({
      session_id: session.id,
      student_id: student_id || sessionWithExam.student_id,
      exam_id: session.exam_id,
      total_score: totalScore,
      correct_count: correctCount,
      wrong_count: wrongCount,
      percentage: roundedPercentage,
      submitted_at: now,
      status: "graded",
      feedback: null,
    });
  }

  const resultWithDetails = await ExamResultModel.findOne({
    where: { id: examResult.id },
    include: [
      includeExamForSession,
      {
        model: ExamSessionModel,
        as: "session",
        attributes: ["id", "code", "start_time", "end_time", "submitted_at", "status"],
      },
    ],
  });

  // Cập nhật status tracking khi submit
  try {
    const studentId = student_id || sessionWithExam.student_id;
    await updateStatusOnSubmit(
      studentId,
      session.exam_id,
      session.id,
      {
        total_score: totalScore,
        percentage: roundedPercentage,
        submitted_at: now
      }
    );
  } catch (statusError) {
    console.error('Error updating exam status on submit:', statusError);
    // Không fail nếu update status lỗi
  }

  return {
    result: resultWithDetails,
    summary: {
      total_score: totalScore,
      exam_total_score: examTotalScore,
      correct_count: correctCount,
      wrong_count: wrongCount,
      unanswered_count: unansweredCount,
      percentage: roundedPercentage,
    },
  };
};

export const finalizeSessionResult = async (session, student_id) => {
  if (!session) {
    throw new Error("Session not found");
  }

  if (session.status !== "in_progress") {
    const existingResult = await ExamResultModel.findOne({
      where: { session_id: session.id },
      include: [includeExamForSession],
    });

    return {
      result: existingResult,
      summary: null,
      alreadySubmitted: true,
    };
  }

  const payload = await computeSessionScore(session, student_id);

  return {
    ...payload,
    alreadySubmitted: false,
  };
};

export const autoSubmitExpiredSessions = async () => {
  try {
    const now = new Date();

    const expiredSessions = await ExamSessionModel.findAll({
      where: {
        status: "in_progress",
        end_time: {
          [Op.lt]: now,
        },
      },
      include: [includeExamForSession],
      limit: 10  // Giới hạn số session xử lý mỗi lần để tránh timeout
    });

    for (const session of expiredSessions) {
      try {
        const payload = await computeSessionScore(session, session.student_id);
        // Status đã được cập nhật trong computeSessionScore
      } catch (error) {
        console.error(`Auto submit failed for session ${session.id}:`, error.message);
        // Không throw error để tiếp tục xử lý các session khác
      }
    }
  } catch (error) {
    // Catch toàn bộ lỗi để không crash server
    console.error("Auto submit scheduler error:", error.message);
    // Không throw để scheduler tiếp tục chạy
  }
};

let autoSubmitInterval = null;

export const startAutoSubmitScheduler = (intervalMs = 60000) => {
  if (autoSubmitInterval) {
    return;
  }

  autoSubmitInterval = setInterval(() => {
    autoSubmitExpiredSessions().catch((error) => {
      console.error("Auto submit scheduler error:", error.message);
    });
  }, intervalMs);
};


