import mongoose, { Document, Schema, Model, Types } from "mongoose";

export interface IAttachment {
    name: string;
    url: string;
    type: "file" | "image" | "link";
    uploadedAt: Date;
}

export interface ITimerEvent {
    action: "start" | "pause" | "resume" | "hold" | "finish";
    timestamp: Date;
}

export interface ITask extends Document {
    title: string;
    description?: string;
    remark?: string;
    project?: Types.ObjectId;
    isPersonal: boolean;
    status: "backlog" | "todo" | "in_progress" | "in_review" | "done";
    priority: "low" | "medium" | "high" | "critical";
    assignees: Types.ObjectId[];
    reporter: Types.ObjectId;
    dueDate?: Date;
    dueTime?: string;
    estimatedHours?: number;
    tags: string[];
    dependencies: Types.ObjectId[];
    attachments: IAttachment[];
    thumbnail?: string;
    notes?: string;
    links: string[];
    order: number;
    timerStatus: "idle" | "running" | "paused" | "on_hold" | "finished";
    timerEvents: ITimerEvent[];
    totalElapsedSeconds: number;
    createdAt: Date;
    updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
    {
        title: {
            type: String,
            required: [true, "Title is required"],
            trim: true,
            maxlength: 300,
        },
        description: {
            type: String,
            default: "",
            maxlength: 5000,
        },
        remark: {
            type: String,
            default: "",
            maxlength: 2000,
        },
        project: {
            type: Schema.Types.ObjectId,
            ref: "Project",
        },
        isPersonal: {
            type: Boolean,
            default: false,
        },
        status: {
            type: String,
            enum: ["backlog", "todo", "in_progress", "in_review", "done"],
            default: "backlog",
        },
        priority: {
            type: String,
            enum: ["low", "medium", "high", "critical"],
            default: "medium",
        },
        assignees: [
            {
                type: Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        reporter: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        dueDate: {
            type: Date,
        },
        dueTime: {
            type: String,
        },
        estimatedHours: {
            type: Number,
        },
        tags: [{ type: String, trim: true }],
        dependencies: [
            {
                type: Schema.Types.ObjectId,
                ref: "Task",
            },
        ],
        attachments: [
            {
                name: String,
                url: String,
                type: {
                    type: String,
                    enum: ["file", "image", "link"],
                    default: "file",
                },
                uploadedAt: { type: Date, default: Date.now },
            },
        ],
        thumbnail: { type: String, default: "" },
        notes: { type: String, default: "" },
        links: [{ type: String }],
        order: { type: Number, default: 0 },
        timerStatus: {
            type: String,
            enum: ["idle", "running", "paused", "on_hold", "finished"],
            default: "idle",
        },
        timerEvents: [
            {
                action: {
                    type: String,
                    enum: ["start", "pause", "resume", "hold", "finish"],
                    required: true,
                },
                timestamp: { type: Date, required: true },
            },
        ],
        totalElapsedSeconds: { type: Number, default: 0 },
    },
    { timestamps: true },
);

taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ assignees: 1 });
taskSchema.index({ reporter: 1 });
taskSchema.index({ isPersonal: 1 });

const Task: Model<ITask> = mongoose.model<ITask>("Task", taskSchema);
export default Task;
