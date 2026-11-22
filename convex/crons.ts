import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cleanup stale presence, sessions & pin attempts",
  { minutes: 15 },
  internal.presence.cleanupStale
);

export default crons;
