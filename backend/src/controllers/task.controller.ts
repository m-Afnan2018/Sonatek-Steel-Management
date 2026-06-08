import { Request, Response } from "express";
import { validationResult } from "express-validator";
import Task from "../models/Task";
import Comment from "../models/Comment";
import Department from "../models/Department";
import Notification from "../models/Notification";
import mongoose from "mongoose";
import { getElapsedSeconds } from "../utils/timerUtils";
import { createNotifications } from "../utils/createNotification";

export const getTasks = async (req: Request, res: Response): Promise<void> => {
    try {
        const { status, assignee, priority, search, personal } = req.query;
        const userId = req.user?.id;
        const role = req.user?.role;
        const isAdminOrManager = role === "admin" || role === "manager";
        const filter: Record<string, unknown> = {};

        if (personal === "true") {
            // Personal tasks: always scoped to the requesting user
            filter.reporter = userId;
            filter.isPersonal = true;
        } else {
            // "My Tasks" view for members: tasks assigned to them OR created by them (non-personal)
            if (!isAdminOrManager) {
                const uid = new mongoose.Types.ObjectId(userId);
                filter.$or = [{ assignees: uid }, { reporter: uid }];
                filter.isPersonal = { $ne: true };
            }
        }

        if (status) filter.status = status;
        if (assignee) filter.assignees = assignee;
        if (priority) filter.priority = priority;
        if (search) filter.title = { $regex: search, $options: "i" };

        const tasks = await Task.find(filter)
            .populate("assignees", "name email avatar")
            .populate("reporter", "name email avatar")
            .sort({ order: 1, createdAt: -1 });


        res.json(tasks);
    } catch (error) {
        console.error("GetTasks error:", error);
        res.status(500).json({ message: "Server error." });
    }
};

export const getAllUserTasks = async (
    _req: Request,
    res: Response,
): Promise<void> => {
    try {
        // Admin: get all active tasks with user info for timeline
        const tasks = await Task.find({ status: { $ne: "done" } })
            .populate("assignees", "name email avatar")
            .populate("reporter", "name email avatar")
            .populate("activeTimerUser", "name avatar")
            .sort({ updatedAt: -1 });

        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
};

export const getTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const task = await Task.findById(req.params.id)
            .populate("assignees", "name email avatar")
            .populate("reporter", "name email avatar")
            .populate("dependencies", "title status")
            .populate("contributions.user", "name email avatar");

        if (!task) {
            res.status(404).json({ message: "Task not found." });
            return;
        }

        const comments = await Comment.find({ task: task._id })
            .populate("author", "name email avatar")
            .sort({ createdAt: -1 });

        res.json({ ...task.toObject(), comments });
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
};

export const createTask = async (
    req: Request,
    res: Response,
): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }

    try {
        const {
            title,
            description,
            remark,
            isPersonal,
            status,
            priority,
            assignees,
            dueDate,
            estimatedHours,
            tags,
            links,
            thumbnail,
            isGroupTask,
        } = req.body;

        const lastTask = await Task.findOne({
            status: status || "backlog",
        }).sort({ order: -1 });
        const order = lastTask ? lastTask.order + 1 : 0;

        const task = new Task({
            title,
            description,
            remark,
            isPersonal: Boolean(isPersonal),
            status: status || "backlog",
            priority: priority || "medium",
            assignees: assignees || [],
            reporter: req.user?.id,
            dueDate,
            estimatedHours,
            tags: tags || [],
            links: links || [],
            thumbnail: thumbnail || "",
            order,
            isGroupTask: Boolean(isGroupTask),
        });

        await task.save();
        await task.populate("assignees", "name email avatar");
        await task.populate("reporter", "name email avatar");

        if (assignees?.length > 0) {
            const notifications = (assignees as string[])
                .filter((a) => a !== req.user?.id)
                .map((assigneeId) => ({
                    recipient: assigneeId,
                    sender: req.user?.id as string,
                    type: "task_assigned" as const,
                    title: "New Task Assigned",
                    message: `You have been assigned to "${title}"`,
                    link: "/tasks",
                }));
            if (notifications.length > 0)
                await createNotifications(notifications);
        }

        res.status(201).json(task);
    } catch (error) {
        console.error("CreateTask error:", error);
        res.status(500).json({ message: "Server error." });
    }
};

export const updateTask = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        // Check permission before updating
        const existing = await Task.findById(req.params.id);
        if (!existing) {
            res.status(404).json({ message: "Task not found." });
            return;
        }

        const isAdminOrManager =
            req.user?.role === "admin" || req.user?.role === "manager";
        const isReporter = String(existing.reporter) === String(req.user?.id);
        const isAssignee = existing.assignees.some(
            (a) => a.toString() === String(req.user?.id),
        );

        if (!isAdminOrManager && !isReporter && !isAssignee) {
            res.status(403).json({
                message: "You don't have permission to edit this task.",
            });
            return;
        }

        // Assignee field can only be changed by admin/manager/reporter — not by assignees
        if (!isAdminOrManager && !isReporter && req.body.assignees !== undefined) {
            delete req.body.assignees;
        }

        const task = await Task.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true },
        )
            .populate("assignees", "name email avatar")
            .populate("reporter", "name email avatar")
            .populate("contributions.user", "name email avatar");

        if (!task) {
            res.status(404).json({ message: "Task not found." });
            return;
        }

        res.json(task);
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
};

export const updateTaskStatus = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const { status, order } = req.body;

        const task = await Task.findById(req.params.id);
        if (!task) {
            res.status(404).json({ message: "Task not found." });
            return;
        }

        task.status = status;
        if (order !== undefined) task.order = order;

        // If timer is running and task is leaving in_progress, auto-stop timer
        if (task.timerStatus === "running" && status !== "in_progress") {
            const stopAction = status === "done" ? "finish" : "pause";
            task.timerEvents.push({ action: stopAction, timestamp: new Date() });
            task.totalElapsedSeconds = getElapsedSeconds(task.timerEvents);
            task.timerStatus = status === "done" ? "finished" : "paused";
        }
        if (status === "done" && task.timerStatus !== "finished") {
            task.timerStatus = "finished";
        }
        // Reopen: reset timer so it can be restarted
        if (status !== "done" && task.timerStatus === "finished") {
            task.timerStatus = "idle";
        }

        await task.save();
        await task.populate("assignees", "name email avatar");
        await task.populate("reporter", "name email avatar");

        res.json(task);
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
};

export const deleteTask = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            res.status(404).json({ message: "Task not found." });
            return;
        }

        const isAdminOrManager =
            req.user?.role === "admin" || req.user?.role === "manager";
        const isReporter = String(task.reporter) === String(req.user?.id);

        if (!isAdminOrManager && !isReporter) {
            res.status(403).json({
                message: "You can only delete tasks you created.",
            });
            return;
        }

        await task.deleteOne();
        await Comment.deleteMany({ task: task._id });
        res.json({ message: "Task deleted successfully." });
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
};

export const addComment = async (
    req: Request,
    res: Response,
): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }

    try {
        const { content, mentions } = req.body;
        const comment = new Comment({
            content,
            author: req.user?.id,
            task: req.params.id,
            mentions: mentions || [],
        });
        await comment.save();
        await comment.populate("author", "name email avatar");

        if (mentions?.length > 0) {
            const notifications = (mentions as string[]).map((userId) => ({
                recipient: userId,
                sender: req.user?.id as string,
                type: "comment_mention" as const,
                title: "Mentioned in Comment",
                message: `${req.user?.name} mentioned you in a comment`,
                link: `/tasks`,
            }));
            await createNotifications(notifications);
        }

        res.status(201).json(comment);
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
};

export const logHours = async (req: Request, res: Response): Promise<void> => {
    try {
        const { hours } = req.body;
        if (!hours || hours <= 0) {
            res.status(400).json({
                message: "Hours must be a positive number.",
            });
            return;
        }
        const task = await Task.findByIdAndUpdate(
            req.params.id,
            { $inc: { totalElapsedSeconds: Math.round(hours * 3600) } },
            { new: true },
        );
        if (!task) {
            res.status(404).json({ message: "Task not found." });
            return;
        }
        res.json(task);
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
};

// Timer controls — single PATCH endpoint drives all transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
    idle: ["start"],
    running: ["pause", "hold", "finish"],
    paused: ["resume"],
    on_hold: ["resume"],
    finished: [],
};

const TIMER_STATUS_MAP: Record<string, string> = {
    start: "running",
    pause: "paused",
    resume: "running",
    hold: "on_hold",
    finish: "finished",
};

export const patchTimer = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const { action } = req.body as { action: string };
        const task = await Task.findById(req.params.id);

        if (!task) {
            res.status(404).json({ message: "Task not found." });
            return;
        }

        const allowed = VALID_TRANSITIONS[task.timerStatus] ?? [];
        if (!allowed.includes(action)) {
            res.status(400).json({
                message: `Invalid transition: ${task.timerStatus} → ${action}`,
            });
            return;
        }

        const now = new Date();
        task.timerEvents.push({ action: action as never, timestamp: now });

        // Snapshot elapsed when a segment closes
        if (["pause", "hold", "finish"].includes(action)) {
            task.totalElapsedSeconds = getElapsedSeconds(task.timerEvents);
        }

        task.timerStatus = TIMER_STATUS_MAP[action] as never;

        // Keep task workflow status in sync
        if (action === "start" || action === "resume") task.status = "in_progress";
        if (action === "hold") task.status = "in_review";
        if (action === "finish") task.status = "done";

        // One task at a time: pause every other running task for this user
        if (action === "start" || action === "resume") {
            const otherRunning = await Task.find({
                _id: { $ne: task._id },
                timerStatus: "running",
                assignees: req.user?.id,
            });

            if (otherRunning.length > 0) {
                await Promise.all(
                    otherRunning.map((other) => {
                        other.timerEvents.push({ action: "pause" as never, timestamp: now });
                        other.totalElapsedSeconds = getElapsedSeconds(other.timerEvents);
                        other.timerStatus = "paused" as never;
                        return other.save();
                    }),
                );
            }
        }

        await task.save();
        await task.populate("assignees", "name email avatar");
        await task.populate("reporter", "name email avatar");

        res.json(task);
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
};

export const delegateTask = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const { delegateTo, note } = req.body;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const isAdminOrManager = userRole === "admin" || userRole === "manager";

        if (!delegateTo) {
            res.status(400).json({ message: "delegateTo is required." });
            return;
        }

        const task = await Task.findById(req.params.id);
        if (!task) {
            res.status(404).json({ message: "Task not found." });
            return;
        }

        const isAssignee = task.assignees.some((a) => a.toString() === userId);
        if (!isAssignee && !isAdminOrManager) {
            res.status(403).json({ message: "You must be assigned to this task to delegate it." });
            return;
        }

        if (!isAdminOrManager) {
            const myDepts = await Department.find({ heads: userId });
            if (myDepts.length === 0) {
                res.status(403).json({ message: "Only department heads can delegate tasks." });
                return;
            }
            const allMyMemberIds = myDepts.flatMap((d) =>
                [...d.members, ...d.heads].map((id) => id.toString()),
            );
            if (!allMyMemberIds.includes(delegateTo)) {
                res.status(403).json({ message: "You can only delegate to members of your department." });
                return;
            }
        }

        if (delegateTo === userId) {
            res.status(400).json({ message: "You cannot delegate a task to yourself." });
            return;
        }

        const alreadyAssigned = task.assignees.some((a) => a.toString() === delegateTo);
        if (!alreadyAssigned) {
            task.assignees.push(new mongoose.Types.ObjectId(delegateTo));
        }

        (task.delegations as any[]).push({
            delegatedBy: new mongoose.Types.ObjectId(userId),
            delegatedTo: new mongoose.Types.ObjectId(delegateTo),
            note:        note?.trim() || "",
            delegatedAt: new Date(),
        });

        await task.save();
        await task.populate("assignees", "name email avatar");
        await task.populate("reporter", "name email avatar");
        await task.populate("delegations.delegatedBy", "name email avatar");
        await task.populate("delegations.delegatedTo", "name email avatar");

        await createNotifications({
            recipient: delegateTo,
            sender:    userId as string,
            type:      "task_delegated",
            title:     "Task Delegated to You",
            message:   `${req.user?.name} delegated "${task.title}" to you`,
            link:      "/tasks",
        });

        res.json(task);
    } catch (error) {
        console.error("DelegateTask error:", error);
        res.status(500).json({ message: "Server error." });
    }
};

export const addContribution = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const { content, attachments, links, isDone } = req.body;
        const userId = req.user?.id;

        const task = await Task.findById(req.params.id);
        if (!task) {
            res.status(404).json({ message: "Task not found." });
            return;
        }

        const isAssignee = task.assignees.some((a) => a.toString() === userId);
        const isReporter = task.reporter.toString() === userId;

        if (!isAssignee && !isReporter) {
            res.status(403).json({ message: "Only assignees or the reporter can contribute to this task." });
            return;
        }

        const now = new Date();
        const existingIdx = (task.contributions as any[]).findIndex(
            (c) => c.user.toString() === userId,
        );

        if (existingIdx !== -1) {
            const prev = (task.contributions as any[])[existingIdx].toObject
                ? (task.contributions as any[])[existingIdx].toObject()
                : (task.contributions as any[])[existingIdx];
            (task.contributions as any[])[existingIdx] = {
                ...prev,
                content:     content ?? "",
                attachments: attachments ?? [],
                links:       links ?? [],
                updatedAt:   now,
                ...(isDone !== undefined ? { isDone: Boolean(isDone) } : {}),
            };
        } else {
            (task.contributions as any[]).push({
                user:        new mongoose.Types.ObjectId(userId),
                content:     content ?? "",
                attachments: attachments ?? [],
                links:       links ?? [],
                submittedAt: now,
                updatedAt:   now,
                timerStatus: "idle",
                timerEvents: [],
                totalElapsedSeconds: 0,
                isDone:      isDone !== undefined ? Boolean(isDone) : false,
            });
        }

        await task.save();
        await task.populate("assignees", "name email avatar");
        await task.populate("reporter", "name email avatar");
        await task.populate("contributions.user", "name email avatar");

        res.json(task);
    } catch (error) {
        console.error("AddContribution error:", error);
        res.status(500).json({ message: "Server error." });
    }
};

export const patchContributionTimer = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const { action } = req.body as { action: 'start' | 'pause' | 'resume' | 'finish' };
        const userId = req.user?.id;

        if (!['start', 'pause', 'resume', 'finish'].includes(action)) {
            res.status(400).json({ message: "Invalid timer action." });
            return;
        }

        const task = await Task.findById(req.params.id);
        if (!task) {
            res.status(404).json({ message: "Task not found." });
            return;
        }

        const isAssignee = task.assignees.some((a) => a.toString() === userId);
        const isReporter = task.reporter.toString() === userId;

        if (!isAssignee && !isReporter) {
            res.status(403).json({ message: "Only assignees or the reporter can manage this timer." });
            return;
        }

        const contributions = task.contributions as any[];
        let contribIdx = contributions.findIndex((c) => c.user.toString() === userId);

        // Auto-create contribution entry if it doesn't exist yet
        if (contribIdx === -1) {
            const now2 = new Date();
            contributions.push({
                user:        new mongoose.Types.ObjectId(userId),
                content:     "",
                attachments: [],
                links:       [],
                submittedAt: now2,
                updatedAt:   now2,
                timerStatus: "idle",
                timerEvents: [],
                totalElapsedSeconds: 0,
                isDone:      false,
            });
            contribIdx = contributions.length - 1;
        }

        const contrib = contributions[contribIdx];
        const now = new Date();

        // Guard invalid transitions — timer can only be started once (from idle)
        if (contrib.timerStatus === 'finished') {
            res.status(400).json({ message: "Timer is already finished and cannot be changed." });
            return;
        }
        if (action === 'start' && contrib.timerStatus !== 'idle') {
            res.status(400).json({ message: "Timer can only be started once." });
            return;
        }
        if (action === 'pause' && contrib.timerStatus !== 'running') {
            res.status(400).json({ message: "Timer is not running." });
            return;
        }
        if (action === 'resume' && contrib.timerStatus !== 'paused') {
            res.status(400).json({ message: "Timer is not paused." });
            return;
        }
        if (action === 'finish' && contrib.timerStatus === 'idle') {
            res.status(400).json({ message: "Timer has not been started yet." });
            return;
        }

        switch (action) {
            case 'start':
                contrib.timerStatus = 'running';
                contrib.timerEvents.push({ action: 'start', timestamp: now });
                break;
            case 'pause':
                contrib.totalElapsedSeconds = getElapsedSeconds(contrib.timerEvents);
                contrib.timerEvents.push({ action: 'pause', timestamp: now });
                contrib.timerStatus = 'paused';
                break;
            case 'resume':
                contrib.timerStatus = 'running';
                contrib.timerEvents.push({ action: 'resume', timestamp: now });
                break;
            case 'finish':
                contrib.totalElapsedSeconds = getElapsedSeconds(contrib.timerEvents);
                contrib.timerEvents.push({ action: 'finish', timestamp: now });
                contrib.timerStatus = 'finished';
                break;
        }

        contrib.updatedAt = now;

        await task.save();
        await task.populate("assignees", "name email avatar");
        await task.populate("reporter", "name email avatar");
        await task.populate("contributions.user", "name email avatar");

        res.json(task);
    } catch (error) {
        console.error("PatchContributionTimer error:", error);
        res.status(500).json({ message: "Server error." });
    }
};

export const toggleContributionDone = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const userId = req.user?.id;

        const task = await Task.findById(req.params.id);
        if (!task) {
            res.status(404).json({ message: "Task not found." });
            return;
        }

        const isAssignee = task.assignees.some((a) => a.toString() === userId);
        if (!isAssignee) {
            res.status(403).json({ message: "Only assignees can mark their contribution as done." });
            return;
        }

        const contributions = task.contributions as any[];
        let contribIdx = contributions.findIndex((c) => c.user.toString() === userId);

        // Auto-create contribution entry if it doesn't exist yet
        if (contribIdx === -1) {
            const now2 = new Date();
            contributions.push({
                user:        new mongoose.Types.ObjectId(userId),
                content:     "",
                attachments: [],
                links:       [],
                submittedAt: now2,
                updatedAt:   now2,
                timerStatus: "idle",
                timerEvents: [],
                totalElapsedSeconds: 0,
                isDone:      false,
            });
            contribIdx = contributions.length - 1;
        }

        const contrib = contributions[contribIdx];
        contrib.isDone = !contrib.isDone;
        contrib.updatedAt = new Date();

        await task.save();
        await task.populate("assignees", "name email avatar");
        await task.populate("reporter", "name email avatar");
        await task.populate("contributions.user", "name email avatar");

        res.json(task);
    } catch (error) {
        console.error("ToggleContributionDone error:", error);
        res.status(500).json({ message: "Server error." });
    }
};

export const getContributions = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const userId = req.user?.id;

        const task = await Task.findById(req.params.id)
            .populate("contributions.user", "name email avatar");

        if (!task) {
            res.status(404).json({ message: "Task not found." });
            return;
        }

        const isAssignee = task.assignees.some((a) => a.toString() === userId);
        const isReporter = task.reporter.toString() === userId;
        const isAdminOrManager = req.user?.role === "admin" || req.user?.role === "manager";

        if (!isAssignee && !isReporter && !isAdminOrManager) {
            res.status(403).json({ message: "Access denied." });
            return;
        }

        res.json(task.contributions);
    } catch (error) {
        console.error("GetContributions error:", error);
        res.status(500).json({ message: "Server error." });
    }
};
