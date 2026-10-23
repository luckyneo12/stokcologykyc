"use client";
import { useParams } from "next/navigation";
import RequestsBoard from "@/components/rekyc/RequestsBoard";

const QUEUES = {
  "in-progress": { status: "in_progress", title: "In Progress" },
  verify: { status: "verify", title: "Verify (eSigned & To Be Verified)" },
  completed: { status: "completed", title: "Completed" },
  rejected: { status: "rejected", title: "Rejected" },
  trash: { status: "trashed", title: "Trash" },
};

export default function RekycQueue() {
  const { queue } = useParams();
  const config = QUEUES[queue];
  if (!config) return <div className="ra-alert ra-alert-error">Unknown queue.</div>;
  // key: switching queues starts with fresh filters
  return <RequestsBoard key={queue} fixedStatus={config.status} title={config.title} />;
}
