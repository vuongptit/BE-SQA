import UserModel from "./user.model.js";
import ClassesModel from "./classes.model.js";
import ClassStudentModel from "./class_student.model.js";
import ExamModel from "./exam.model.js";
import QuestionModel from "./question.model.js";
import QuestionAnswerModel from "./question_answer.model.js";
import ExamFavoriteModel from "./exam_favorite.model.js";
import ExamCommentModel from "./exam_comment.model.js";
import ExamSessionModel from "./exam_session.model.js";
import StudentAnswerModel from "./student_answer.model.js";
import PostClassesModel from "./post_classes.model.js";
import PostCommentsModel from "./post_comments.model.js";
import ExamResultModel from "./exam_result.model.js";
import NotificationModel from "./notification.model.js";
import RecentLoginModel from "./recent_login.model.js";
import ExamPurchaseModel from "./exam_purchase.model.js";
import ExamCheatingLogModel from "./exam_cheating_log.model.js";
import StudentExamStatusModel from "./student_exam_status.model.js";
import DepositHistoryModel from "./deposit_history.model.js";
import WithdrawHistoryModel from "./withdrawn_history.model.js";
import TransactionHistoryModel from "./transactions_history.model.js";
import ExamRatingModel from "./exam_rating.model.js";
import ExamClassModel from "./exam_class.model.js";
import SupportChatMessageModel from "./support_chat_message.model.js";
import LiveKitRoomModel from "./livekit_room.model.js";

// User(Teacher) 1-N Classes
UserModel.hasMany(ClassesModel, {
  foreignKey: 'teacher_id',
  as: 'classes'
});

ClassesModel.belongsTo(UserModel, {
  foreignKey: 'teacher_id',
  as: 'teacher'
});

// User(Student) N-N Classes through (ClassStudent)
UserModel.belongsToMany(ClassesModel, {
  through: ClassStudentModel,
  foreignKey: 'student_id',
  otherKey: 'class_id',
  as: 'joinedClasses'
});

ClassesModel.belongsToMany(UserModel, {
  through: ClassStudentModel,
  foreignKey: 'class_id',
  otherKey: 'student_id',
  as: 'students'
});

// Exam N-N Classes through Exam_Classes (Many-to-many relationship)
ExamModel.belongsToMany(ClassesModel, {
  through: ExamClassModel,
  foreignKey: 'exam_id',
  otherKey: 'class_id',
  as: 'classes'
});

ClassesModel.belongsToMany(ExamModel, {
  through: ExamClassModel,
  foreignKey: 'class_id',
  otherKey: 'exam_id',
  as: 'examsManyToMany'
});

ExamClassModel.belongsTo(ExamModel, {
  foreignKey: 'exam_id',
  as: 'exam'
});

ExamClassModel.belongsTo(ClassesModel, {
  foreignKey: 'class_id',
  as: 'class'
});

//User(1-N) PostClasses
UserModel.hasMany(PostClassesModel, {
  foreignKey: 'user_id',
})
PostClassesModel.belongsTo(UserModel, {
  foreignKey: 'user_id',
  as: 'author'
})

//Classes (1-N) Post
ClassesModel.hasMany(PostClassesModel, {
  foreignKey: 'class_id',
})
PostClassesModel.belongsTo(ClassesModel, {
  foreignKey: 'class_id'

})

//User (1-N) Post Comment
UserModel.hasMany(PostCommentsModel, {
  foreignKey: 'user_id'

})
PostCommentsModel.belongsTo(UserModel, {
  foreignKey: 'user_id',
  as: 'author'
})

//Post Class (1-N) Post Comment
PostClassesModel.hasMany(PostCommentsModel, {
  foreignKey: 'post_id',
  as: 'comments'
})
PostCommentsModel.belongsTo(PostClassesModel, {
  foreignKey: 'post_id',
})

// User(Teacher) 1-N Exams
UserModel.hasMany(ExamModel, {
  foreignKey: 'created_by',
  as: 'createdExams'
});

ExamModel.belongsTo(UserModel, {
  foreignKey: 'created_by',
  as: 'creator'
});

// Exams 1-N Questions
ExamModel.hasMany(QuestionModel, {
  foreignKey: 'exam_id',
  as: 'questions'
});

QuestionModel.belongsTo(ExamModel, {
  foreignKey: 'exam_id',
  as: 'exam'
});

// User(Teacher) 1-N Questions
UserModel.hasMany(QuestionModel, {
  foreignKey: 'teacher_id',
  as: 'questions'
});

QuestionModel.belongsTo(UserModel, {
  foreignKey: 'teacher_id',
  as: 'teacher'
});

// Questions 1-N Question_answers
QuestionModel.hasMany(QuestionAnswerModel, {
  foreignKey: 'question_id',
  as: 'answers'
});

QuestionAnswerModel.belongsTo(QuestionModel, {
  foreignKey: 'question_id',
  as: 'question'
});

// User N-N Exams through Exam_favorites (Favorite exams)
UserModel.belongsToMany(ExamModel, {
  through: ExamFavoriteModel,
  foreignKey: 'user_id',
  otherKey: 'exam_id',
  as: 'favoriteExams'
});

ExamModel.belongsToMany(UserModel, {
  through: ExamFavoriteModel,
  foreignKey: 'exam_id',
  otherKey: 'user_id',
  as: 'favoritedBy'
});

ExamFavoriteModel.belongsTo(UserModel, {
  foreignKey: 'user_id',
  as: 'user'
});

ExamFavoriteModel.belongsTo(ExamModel, {
  foreignKey: 'exam_id',
  as: 'exam'
});

// User 1-N Exam_comments
UserModel.hasMany(ExamCommentModel, {
  foreignKey: 'user_id',
  as: 'comments'
});

ExamCommentModel.belongsTo(UserModel, {
  foreignKey: 'user_id',
  as: 'user'
});

// Exam 1-N Exam_comments
ExamModel.hasMany(ExamCommentModel, {
  foreignKey: 'exam_id',
  as: 'comments'
});

ExamCommentModel.belongsTo(ExamModel, {
  foreignKey: 'exam_id',
  as: 'exam'
});

// Exam_comments self-reference (parent-child relationship)
ExamCommentModel.belongsTo(ExamCommentModel, {
  foreignKey: 'parent_id',
  as: 'parent'
});

ExamCommentModel.hasMany(ExamCommentModel, {
  foreignKey: 'parent_id',
  as: 'replies'
});

// User(Student) 1-N Exam_sessions
UserModel.hasMany(ExamSessionModel, {
  foreignKey: 'student_id',
  as: 'examSessions'
});

ExamSessionModel.belongsTo(UserModel, {
  foreignKey: 'student_id',
  as: 'student'
});

// Exams 1-N Exam_sessions
ExamModel.hasMany(ExamSessionModel, {
  foreignKey: 'exam_id',
  as: 'sessions'
});

ExamSessionModel.belongsTo(ExamModel, {
  foreignKey: 'exam_id',
  as: 'exam'
});

// Exam_sessions 1-N Student_answers
ExamSessionModel.hasMany(StudentAnswerModel, {
  foreignKey: 'session_id',
  as: 'studentAnswers'
});

StudentAnswerModel.belongsTo(ExamSessionModel, {
  foreignKey: 'session_id',
  as: 'session'
});

// Questions 1-N Student_answers
QuestionModel.hasMany(StudentAnswerModel, {
  foreignKey: 'exam_question_id',
  as: 'studentAnswers'
});

StudentAnswerModel.belongsTo(QuestionModel, {
  foreignKey: 'exam_question_id',
  as: 'question'
});

// Question_answers 1-N Student_answers
QuestionAnswerModel.hasMany(StudentAnswerModel, {
  foreignKey: 'selected_answer_id',
  as: 'studentSelections'
});

StudentAnswerModel.belongsTo(QuestionAnswerModel, {
  foreignKey: 'selected_answer_id',
  as: 'selectedAnswer'
});


// Exam_sessions 1-N Exam_results
ExamSessionModel.hasMany(ExamResultModel, {
  foreignKey: 'session_id',
  as: 'results'
});

ExamResultModel.belongsTo(ExamSessionModel, {
  foreignKey: 'session_id',
  as: 'session'
});

// User(Student) 1-N Exam_results
UserModel.hasMany(ExamResultModel, {
  foreignKey: 'student_id',
  as: 'examResults'
});

ExamResultModel.belongsTo(UserModel, {
  foreignKey: 'student_id',
  as: 'student'
});

// Exams 1-N Exam_results
ExamModel.hasMany(ExamResultModel, {
  foreignKey: 'exam_id',
  as: 'results'
});

ExamResultModel.belongsTo(ExamModel, {
  foreignKey: 'exam_id',
  as: 'exam'
});

// User 1-N Notifications
UserModel.hasMany(NotificationModel, {
  foreignKey: 'recipient_id',
  as: 'notifications'
});

NotificationModel.belongsTo(UserModel, {
  foreignKey: 'recipient_id',
  as: 'recipient'
});

//User 1-N RecentLogin
UserModel.hasMany(RecentLoginModel, {
  foreignKey: 'user_id',
  as: 'login_list'
})
RecentLoginModel.belongsTo(UserModel, {
  foreignKey: 'user_id'
})
UserModel.hasMany(ExamPurchaseModel, {
  foreignKey: 'user_id',
  as: 'purchases'
});
ExamPurchaseModel.belongsTo(UserModel, {
  foreignKey: 'user_id',
  as: 'user'
});

// Exam có nhiều bản ghi mua hàng
ExamModel.hasMany(ExamPurchaseModel, {
  foreignKey: 'exam_id',
  as: 'purchases'
});
ExamPurchaseModel.belongsTo(ExamModel, {
  foreignKey: 'exam_id',
  as: 'exam'
});

// Exam_sessions 1-N Exam_cheating_logs
ExamSessionModel.hasMany(ExamCheatingLogModel, {
  foreignKey: 'session_id',
  as: 'cheatingLogs'
});

ExamCheatingLogModel.belongsTo(ExamSessionModel, {
  foreignKey: 'session_id',
  as: 'session'
});

// User(Student) 1-N Exam_cheating_logs
UserModel.hasMany(ExamCheatingLogModel, {
  foreignKey: 'student_id',
  as: 'cheatingLogs'
});

ExamCheatingLogModel.belongsTo(UserModel, {
  foreignKey: 'student_id',
  as: 'student'
});

// Exams 1-N Exam_cheating_logs
ExamModel.hasMany(ExamCheatingLogModel, {
  foreignKey: 'exam_id',
  as: 'cheatingLogs'
});

ExamCheatingLogModel.belongsTo(ExamModel, {
  foreignKey: 'exam_id',
  as: 'exam'
});

// Student N-N Exams through Student_Exam_Status (Exam attempt tracking)
UserModel.hasMany(StudentExamStatusModel, {
  foreignKey: 'student_id',
  as: 'examStatuses'
});

StudentExamStatusModel.belongsTo(UserModel, {
  foreignKey: 'student_id',
  as: 'student'
});

ExamModel.hasMany(StudentExamStatusModel, {
  foreignKey: 'exam_id',
  as: 'studentStatuses'
});

StudentExamStatusModel.belongsTo(ExamModel, {
  foreignKey: 'exam_id',
  as: 'exam'
});

StudentExamStatusModel.belongsTo(ExamSessionModel, {
  foreignKey: 'current_session_id',
  as: 'currentSession'
});

// User 1-N Deposit_history
UserModel.hasMany(DepositHistoryModel, {
  foreignKey: 'user_id',
  as: 'depositHistory'
});

DepositHistoryModel.belongsTo(UserModel, {
  foreignKey: 'user_id',
  as: 'user'
});

// User 1-N Withdraw_history
UserModel.hasMany(WithdrawHistoryModel, {
  foreignKey: 'user_id',
  as: 'withdrawHistory'
});

WithdrawHistoryModel.belongsTo(UserModel, {
  foreignKey: 'user_id',
  as: 'user'
});

UserModel.hasMany(WithdrawHistoryModel, {
  foreignKey: 'processed_by',
  as: 'processedWithdrawals'
});

WithdrawHistoryModel.belongsTo(UserModel, {
  foreignKey: 'processed_by',
  as: 'processedBy'
});

// User 1-N Transactions_history
UserModel.hasMany(TransactionHistoryModel, {
  foreignKey: 'user_id',
  as: 'transactions'
});

TransactionHistoryModel.belongsTo(UserModel, {
  foreignKey: 'user_id',
  as: 'user'
});


// Exam 1-N Exam_ratings
ExamModel.hasMany(ExamRatingModel, {
  foreignKey: 'exam_id',
  as: 'ratings'
});

ExamRatingModel.belongsTo(ExamModel, {
  foreignKey: 'exam_id',
  as: 'exam'
});

// User 1-N Exam_ratings
UserModel.hasMany(ExamRatingModel, {
  foreignKey: 'user_id',
  as: 'examRatings'
});

ExamRatingModel.belongsTo(UserModel, {
  foreignKey: 'user_id',
  as: 'user'
});

// Exam_results 1-1 Exam_ratings (optional)
ExamResultModel.hasOne(ExamRatingModel, {
  foreignKey: 'result_id',
  as: 'rating'
});

ExamRatingModel.belongsTo(ExamResultModel, {
  foreignKey: 'result_id',
  as: 'result'
});

// User 1-N SupportChatMessages
UserModel.hasMany(SupportChatMessageModel, {
  foreignKey: 'user_id',
  as: 'supportChatMessages'
});

SupportChatMessageModel.belongsTo(UserModel, {
  foreignKey: 'user_id',
  as: 'user'
});



// User(Teacher) 1-N LiveKitRooms
UserModel.hasMany(LiveKitRoomModel, {
  foreignKey: 'teacher_id',
  as: 'livekitRooms'
});

LiveKitRoomModel.belongsTo(UserModel, {
  foreignKey: 'teacher_id',
  as: 'teacher'
});

// Classes 1-N LiveKitRooms
ClassesModel.hasMany(LiveKitRoomModel, {
  foreignKey: 'class_id',
  as: 'livekitRooms'
});

LiveKitRoomModel.belongsTo(ClassesModel, {
  foreignKey: 'class_id',
  as: 'class'
});

export { UserModel, ClassesModel, ClassStudentModel, ExamModel, QuestionModel, QuestionAnswerModel, ExamFavoriteModel, ExamCommentModel, ExamSessionModel, StudentAnswerModel, ExamResultModel, PostClassesModel, PostCommentsModel, NotificationModel, RecentLoginModel, ExamPurchaseModel, ExamCheatingLogModel, StudentExamStatusModel, DepositHistoryModel, WithdrawHistoryModel, TransactionHistoryModel, ExamRatingModel, ExamClassModel, SupportChatMessageModel, LiveKitRoomModel };
