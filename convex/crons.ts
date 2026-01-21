import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run daily at 3:00 UTC
crons.daily(
  "sync iptv data",
  { hourUTC: 3, minuteUTC: 0 },
  internal.sync.syncAll
);

export default crons;
