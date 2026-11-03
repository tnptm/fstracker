"use client";

import DayNoteForm from "../DayNoteForm";
import ManualEntryForm from "../ManualEntryForm";
import MonthValueCard from "../MonthValueCard";
import TimerCard from "../TimerCard";
import { PageHeader } from "../ui";
import { keys, saveCourses, type Courses } from "@/lib/tracker";

export default function TrackView() {
  return (
    <>
      <PageHeader title="Track" subtitle="Start the timer, add time afterwards or note a day off." />
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <div className="space-y-4 md:space-y-6">
          <TimerCard />
          <ManualEntryForm />
        </div>
        <div className="space-y-4 md:space-y-6">
          <MonthValueCard<Courses>
            title="Courses"
            description="Number of courses held this month."
            unit="courses"
            min={0}
            max={1000}
            listKey={keys.courses}
            read={(c) => c.course_number}
            save={saveCourses}
          />
          <DayNoteForm />
        </div>
      </div>
    </>
  );
}
