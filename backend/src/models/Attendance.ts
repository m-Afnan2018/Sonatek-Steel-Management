import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IAttendanceNote {
  content: string;
  documents: string[];
  links: string[];
  createdAt: Date;
}

export interface IAttendance extends Document {
  user: Types.ObjectId;
  date: Date;
  checkIn?: Date;
  checkOut?: Date;
  lunchStart?: Date;
  lunchStop?: Date;
  lunchDuration: number;
  status: 'present' | 'absent' | 'half_day' | 'remote' | 'leave' | 'late';
  workMode: 'office' | 'remote' | 'hybrid';
  notes: IAttendanceNote[];
  hoursWorked: number;
  isLateTime: number;
  isLate: boolean;
  approvedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    checkIn: { type: Date },
    checkOut: { type: Date },
    lunchStart: { type: Date },
    lunchStop: { type: Date },
    lunchDuration: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['present', 'absent', 'half_day', 'remote', 'leave', 'late'],
      default: 'present',
    },
    workMode: { type: String, enum: ['office', 'remote', 'hybrid'], default: 'office' },
    notes: [{
      content: { type: String, maxlength: 5000 },
      documents: [{ type: String }],
      links: [{ type: String }],
      createdAt: { type: Date, default: Date.now },
    }],
    hoursWorked: { type: Number, default: 0, min: 0 },
    isLate: { type: Boolean, default: false },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

attendanceSchema.index({ user: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });

const Attendance: Model<IAttendance> = mongoose.model<IAttendance>('Attendance', attendanceSchema);
export default Attendance;
