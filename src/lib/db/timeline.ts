import type { TimelineEvent } from '../types';

export async function getTimelineEvents(): Promise<TimelineEvent[]> {
  return [];
}

export async function addTimelineEvent(event: TimelineEvent): Promise<TimelineEvent> {
  return event;
}
