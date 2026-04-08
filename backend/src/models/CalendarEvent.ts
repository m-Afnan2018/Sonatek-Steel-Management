import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ICalendarEvent extends Document {
  title: string;
  description?: string;
  type: 'meeting' | 'reminder' | 'event' | 'deadline';
  date: Date;
  startTime?: string; // "HH:MM"
  endTime?: string;   // "HH:MM"
  allDay: boolean;
  color: string;
  owner: mongoose.Types.ObjectId;      // the user this event belongs to
  createdBy: mongoose.Types.ObjectId;  // who created it (admin can create for others)
  invitees: mongoose.Types.ObjectId[]; // other users invited
  location?: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  createdAt: Date;
  updatedAt: Date;
}

const calendarEventSchema = new Schema<ICalendarEvent>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    type: { type: String, enum: ['meeting', 'reminder', 'event', 'deadline'], default: 'event' },
    date: { type: Date, required: true },
    startTime: { type: String },
    endTime: { type: String },
    allDay: { type: Boolean, default: false },
    color: { type: String, default: '#6366f1' },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    invitees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    location: { type: String, trim: true },
    recurrence: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
  },
  { timestamps: true }
);

const CalendarEvent: Model<ICalendarEvent> = mongoose.model<ICalendarEvent>('CalendarEvent', calendarEventSchema);
export default CalendarEvent;
