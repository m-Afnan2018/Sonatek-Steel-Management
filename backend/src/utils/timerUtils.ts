export interface TimerEvent {
    action: "start" | "pause" | "resume" | "hold" | "finish";
    timestamp: Date;
}

/**
 * Replays timer events to compute total elapsed seconds.
 * Segments are opened by 'start'/'resume' and closed by 'pause'/'hold'/'finish'.
 * If the last segment is still open (timer running), it is NOT included —
 * the caller adds live seconds on top of the snapshot.
 */
export function getElapsedSeconds(events: TimerEvent[]): number {
    let total = 0;
    let segmentStart: Date | null = null;

    for (const event of events) {
        if (event.action === "start" || event.action === "resume") {
            segmentStart = event.timestamp;
        } else if (
            ["pause", "hold", "finish"].includes(event.action) &&
            segmentStart
        ) {
            total +=
                (event.timestamp.getTime() - segmentStart.getTime()) / 1000;
            segmentStart = null;
        }
    }

    return Math.floor(total);
}

/**
 * Returns the timestamp of the most recent 'start' or 'resume' event,
 * or null if the timer is not currently running.
 */
export function getLastResumeTimestamp(events: TimerEvent[]): Date | null {
    for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].action === "start" || events[i].action === "resume") {
            return events[i].timestamp;
        }
    }
    return null;
}
