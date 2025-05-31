import React from "react";
import { Clock, AlertTriangle, User } from "lucide-react";

type TimelineEvent = {
  date: string;
  description: string;
  type?: "event" | "warning" | "person";
};

const iconMap = {
  event: <Clock className="w-4 h-4 text-blue-500" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  person: <User className="w-4 h-4 text-green-500" />,
};

export default function Timeline({ events }: { events: TimelineEvent[] }) {
  if (!events || events.length === 0) return <div>No timeline events found.</div>;

  // Sort events by date
  const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="my-6">
      <h3 className="font-semibold mb-2">Timeline of Key Events</h3>
      <ol className="border-l-2 border-blue-400 pl-4">
        {sorted.map((event, idx) => (
          <li key={idx} className="mb-4 relative flex items-start gap-2">
            <div className="absolute -left-2 top-1">{iconMap[event.type || "event"]}</div>
            <div>
              <div className="text-xs text-gray-500">{new Date(event.date).toLocaleString()}</div>
              <div className="font-medium">{event.description}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
} 