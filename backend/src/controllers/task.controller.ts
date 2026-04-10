import { Request, Response } from "express";
import { validationResult } from "express-validator";
import Task from "../models/Task";
import Comment from "../models/Comment";
import Project from "../models/Project";
import Notification from "../models/Notification";
import mongoose from "mongoose";
import { getElapsedSeconds } from "../utils/timerUtils";

export const getTasks = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, status, assignee, priority, search, personal } =
            req.query;
        const userId = req.user?.id;
        const role = req.user?.role;
        const isAdminOrManager = role === "admin" || role === "manager";
        const filter: Record<string, unknown> = {};

        if (personal === "true") {
            // Personal tasks: always scoped to the requesting user
            filter.reporter = userId;
            filter.isPersonal = true;
        } else if (projectId) {
            // Project board view: scope to the project
            filter.project = projectId;
            // Members only see tasks they are assigned to within the project
            if (!isAdminOrManager) {
                filter.assignees = userId;
            }
        } else {
            // "Assigned to Me" view for members; "All Tasks" view for admin/manager
            if (!isAdminOrManager) {
                filter.assignees = new mongoose.Types.ObjectId(userId);
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
            .populate("project", "title")
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
            .populate("project", "title")
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
            .populate("project", "title");

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
            project,
            isPersonal,
            status,
            priority,
            assignees,
            dueDate,
            estimatedHours,
            tags,
            links,
            thumbnail,
        } = req.body;

        const lastTask = await Task.findOne({
            ...(project ? { project } : {}),
            status: status || "backlog",
        }).sort({ order: -1 });
        const order = lastTask ? lastTask.order + 1 : 0;

        const task = new Task({
            title,
            description,
            remark,
            project: project || undefined,
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
        });

        await task.save();
        await task.populate("assignees", "name email avatar");
        await task.populate("reporter", "name email avatar");

        if (assignees?.length > 0) {
            const notifications = (assignees as string[])
                .filter((a) => a !== req.user?.id)
                .map((assigneeId) => ({
                    recipient: assigneeId,
                    sender: req.user?.id,
                    type: "task_assigned" as const,
                    title: "New Task Assigned",
                    message: `You have been assigned to "${title}"`,
                    link: project ? `/projects/${project}` : "/tasks",
                }));
            if (notifications.length > 0)
                await Notification.insertMany(notifications);
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
        const task = await Task.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true },
        )
            .populate("assignees", "name email avatar")
            .populate("reporter", "name email avatar")
            .populate("project", "title");

        if (!task) {
            res.status(404).json({ message: "Task not found." });
            return;
        }

        if (task.project) {
            const taskCounts = await Task.aggregate([
                { $match: { project: task.project } },
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ]);
            const totalTasks = taskCounts.reduce((sum, t) => sum + t.count, 0);
            const doneTasks =
                taskCounts.find((t) => t._id === "done")?.count || 0;
            const progress =
                totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
            await Project.findByIdAndUpdate(task.project, { progress });
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
        await task.populate("project", "title");

        if (task.project) {
            const projectId =
                typeof task.project === "object"
                    ? (task.project as { _id: unknown })._id
                    : task.project;
            const taskCounts = await Task.aggregate([
                { $match: { project: projectId } },
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ]);
            const totalTasks = taskCounts.reduce((sum, t) => sum + t.count, 0);
            const doneTasks =
                taskCounts.find((t) => t._id === "done")?.count || 0;
            await Project.findByIdAndUpdate(projectId, {
                progress:
                    totalTasks > 0
                        ? Math.round((doneTasks / totalTasks) * 100)
                        : 0,
            });
        }

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
        const task = await Task.findByIdAndDelete(req.params.id);
        if (!task) {
            res.status(404).json({ message: "Task not found." });
            return;
        }
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
                sender: req.user?.id,
                type: "comment_mention" as const,
                title: "Mentioned in Comment",
                message: `${req.user?.name} mentioned you in a comment`,
                link: `/tasks`,
            }));
            await Notification.insertMany(notifications);
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

        task.timerEvents.push({ action: action as never, timestamp: new Date() });

        // Snapshot elapsed when a segment closes
        if (["pause", "hold", "finish"].includes(action)) {
            task.totalElapsedSeconds = getElapsedSeconds(task.timerEvents);
        }

        task.timerStatus = TIMER_STATUS_MAP[action] as never;

        // Keep task workflow status in sync
        if (action === "start" || action === "resume") task.status = "in_progress";
        if (action === "hold") task.status = "in_review";
        if (action === "finish") task.status = "done";

        await task.save();
        await task.populate("assignees", "name email avatar");
        await task.populate("reporter", "name email avatar");
        await task.populate("project", "title");

        // Update project progress when task finishes
        if (action === "finish" && task.project) {
            const projectId =
                typeof task.project === "object"
                    ? (task.project as { _id: unknown })._id
                    : task.project;
            const taskCounts = await Task.aggregate([
                { $match: { project: projectId } },
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ]);
            const total = taskCounts.reduce((s, t) => s + t.count, 0);
            const done = taskCounts.find((t) => t._id === "done")?.count ?? 0;
            await Project.findByIdAndUpdate(projectId, {
                progress: total > 0 ? Math.round((done / total) * 100) : 0,
            });
        }

        res.json(task);
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
};
