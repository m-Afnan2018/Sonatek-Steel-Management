// Migration: shift Attendance.date from UTC midnight -> IST midnight
//
// Before: date stored as 2026-05-05T00:00:00.000Z  (UTC midnight)
// After:  date stored as 2026-05-04T18:30:00.000Z  (IST midnight = UTC - 5h30m)
//
// Run with:
//   mongosh "mongodb://localhost:27017/tracksy" migrate_attendance_to_ist.js
//   (replace connection string with your actual one from .env MONGO_URI)
//
// Safe to re-run: only touches records whose date is exactly at UTC midnight.
// checkIn / checkOut / lunchStart / lunchStop are full timestamps — no migration needed.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 19800000 ms

const preview = db.attendances.countDocuments({
  $expr: {
    $and: [
      { $eq: [{ $hour: '$date' }, 0] },
      { $eq: [{ $minute: '$date' }, 0] },
      { $eq: [{ $second: '$date' }, 0] },
      { $eq: [{ $millisecond: '$date' }, 0] }
    ]
  }
});

print('Records to migrate: ' + preview);

if (preview === 0) {
  print('Nothing to do — all records already at IST midnight.');
} else {
  const result = db.attendances.updateMany(
    {
      $expr: {
        $and: [
          { $eq: [{ $hour: '$date' }, 0] },
          { $eq: [{ $minute: '$date' }, 0] },
          { $eq: [{ $second: '$date' }, 0] },
          { $eq: [{ $millisecond: '$date' }, 0] }
        ]
      }
    },
    [
      { $set: { date: { $subtract: ['$date', IST_OFFSET_MS] } } }
    ]
  );

  print('Done. Migrated ' + result.modifiedCount + ' attendance records to IST midnight.');
}
