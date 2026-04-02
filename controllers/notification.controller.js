import NotificationModel from "../models/notification.model.js";
import { UserModel } from "../models/index.model.js";
import { Op } from "sequelize";

/**
 * Lấy danh sách thông báo của user hiện tại
 */
export const getNotifications = async (req, res) => {
    try {
        const userId = req.userId;
        const { page = 1, limit = 20, unread_only = false } = req.query;
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = parseInt(limit);

        const whereCondition = {
            recipient_id: userId
        };

        if (unread_only === 'true' || unread_only === true) {
            whereCondition.is_read = false;
        }

        const { count, rows: notifications } = await NotificationModel.findAndCountAll({
            where: whereCondition,
            order: [['created_at', 'DESC']],
            limit: limitNum,
            offset: offset
        });

        // Parse JSON data nếu có
        const formattedNotifications = notifications.map(notif => {
            const notifData = notif.toJSON();
            if (notifData.data) {
                try {
                    notifData.data = typeof notifData.data === 'string' 
                        ? JSON.parse(notifData.data) 
                        : notifData.data;
                } catch (e) {
                    notifData.data = null;
                }
            }
            return notifData;
        });

        return res.status(200).send({
            notifications: formattedNotifications,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: limitNum,
                total_pages: Math.ceil(count / limitNum)
            }
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

/**
 * Đếm số thông báo chưa đọc
 */
export const getUnreadCount = async (req, res) => {
    try {
        const userId = req.userId;

        const count = await NotificationModel.count({
            where: {
                recipient_id: userId,
                is_read: false
            }
        });

        return res.status(200).send({
            unread_count: count
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

/**
 * Đánh dấu một thông báo là đã đọc
 */
export const markAsRead = async (req, res) => {
    try {
        const { notification_id } = req.params;
        const userId = req.userId;

        const notification = await NotificationModel.findOne({
            where: {
                id: notification_id,
                recipient_id: userId
            }
        });

        if (!notification) {
            return res.status(404).send({
                message: 'Notification not found or you do not have permission'
            });
        }

        if (!notification.is_read) {
            await notification.update({
                is_read: true,
                read_at: new Date()
            });
        }

        const notifData = notification.toJSON();
        if (notifData.data) {
            try {
                notifData.data = typeof notifData.data === 'string' 
                    ? JSON.parse(notifData.data) 
                    : notifData.data;
            } catch (e) {
                notifData.data = null;
            }
        }

        return res.status(200).send({
            message: 'Notification marked as read',
            notification: notifData
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

/**
 * Đánh dấu tất cả thông báo là đã đọc
 */
export const markAllAsRead = async (req, res) => {
    try {
        const userId = req.userId;

        const updated = await NotificationModel.update(
            {
                is_read: true,
                read_at: new Date()
            },
            {
                where: {
                    recipient_id: userId,
                    is_read: false
                }
            }
        );

        return res.status(200).send({
            message: 'All notifications marked as read',
            updated_count: updated[0]
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

/**
 * Xóa một thông báo
 */
export const deleteNotification = async (req, res) => {
    try {
        const { notification_id } = req.params;
        const userId = req.userId;

        const notification = await NotificationModel.findOne({
            where: {
                id: notification_id,
                recipient_id: userId
            }
        });

        if (!notification) {
            return res.status(404).send({
                message: 'Notification not found or you do not have permission'
            });
        }

        await notification.destroy();

        return res.status(200).send({
            message: 'Notification deleted successfully'
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

