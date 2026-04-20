/**
 * CustomRangePicker — modal for picking custom date/time ranges.
 * Supports date-only, time-only, and date-time ranges.
 * Uses react-day-picker (already installed as a dependency).
 */

import { AnimatePresence, motion } from "framer-motion";
import { Calendar, Check, Clock, X } from "lucide-react";
import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { format, isAfter, isBefore, isValid, parse, parseISO } from "date-fns";
import "react-day-picker/dist/style.css";

export type RangeMode = "date" | "time" | "datetime";

export interface CustomRange {
  mode: RangeMode;
  from: Date;
  to: Date;
  label?: string;
}

interface CustomRangePickerProps {
  open: boolean;
  onClose: () => void;
  onApply: (range: CustomRange) => void;
  /** Initial values */
  initialRange?: CustomRange;
}

const MODE_LABELS: Record<RangeMode, string> = {
  date: "Date range",
  time: "Time range",
  datetime: "Date & Time range",
};

function parseTime(s: string): Date | null {
  const d = parse(s, "HH:mm", new Date());
  return isValid(d) ? d : null;
}

export default function CustomRangePicker({
  open,
  onClose,
  onApply,
  initialRange,
}: CustomRangePickerProps) {
  const [mode, setMode] = useState<RangeMode>(initialRange?.mode ?? "date");

  /* date range state */
  const [fromDate, setFromDate] = useState<Date | undefined>(
    initialRange?.mode !== "time" ? initialRange?.from : undefined
  );
  const [toDate, setToDate] = useState<Date | undefined>(
    initialRange?.mode !== "time" ? initialRange?.to : undefined
  );

  /* time range state */
  const [fromTime, setFromTime] = useState(
    initialRange?.mode === "time" || initialRange?.mode === "datetime"
      ? format(initialRange.from, "HH:mm")
      : "09:15"
  );
  const [toTime, setToTime] = useState(
    initialRange?.mode === "time" || initialRange?.mode === "datetime"
      ? format(initialRange.to, "HH:mm")
      : "15:30"
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (mode === "date" || mode === "datetime") {
      if (!fromDate) errs.fromDate = "Start date required";
      if (!toDate) errs.toDate = "End date required";
      if (fromDate && toDate && isAfter(fromDate, toDate)) {
        errs.toDate = "End date must be after start date";
      }
    }

    if (mode === "time" || mode === "datetime") {
      if (!fromTime) errs.fromTime = "Start time required";
      if (!toTime) errs.toTime = "End time required";
      const ft = parseTime(fromTime);
      const tt = parseTime(toTime);
      if (!ft) errs.fromTime = "Invalid time (HH:MM)";
      if (!tt) errs.toTime = "Invalid time (HH:MM)";
      if (ft && tt && !isBefore(ft, tt)) {
        if (mode === "time") errs.toTime = "End time must be after start time";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleApply = () => {
    if (!validate()) return;

    let from: Date;
    let to: Date;
    const today = new Date();

    if (mode === "date") {
      from = fromDate!;
      to = toDate!;
    } else if (mode === "time") {
      const ft = parseTime(fromTime)!;
      const tt = parseTime(toTime)!;
      from = new Date(today.getFullYear(), today.getMonth(), today.getDate(), ft.getHours(), ft.getMinutes());
      to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), tt.getHours(), tt.getMinutes());
    } else {
      // datetime
      const ft = parseTime(fromTime)!;
      const tt = parseTime(toTime)!;
      from = new Date(
        fromDate!.getFullYear(),
        fromDate!.getMonth(),
        fromDate!.getDate(),
        ft.getHours(),
        ft.getMinutes()
      );
      to = new Date(
        toDate!.getFullYear(),
        toDate!.getMonth(),
        toDate!.getDate(),
        tt.getHours(),
        tt.getMinutes()
      );
    }

    onApply({ mode, from, to });
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  const modes: RangeMode[] = ["date", "time", "datetime"];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 24 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed inset-x-4 top-1/2 z-[90] max-w-lg mx-auto -translate-y-1/2 rounded-2xl border border-border/50 bg-background shadow-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Custom time range picker"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Custom Time Range</h2>
              </div>
              <button
                onClick={handleClose}
                className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode selector */}
            <div className="flex gap-1.5 px-5 pt-4">
              {modes.map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setErrors({}); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all
                    ${mode === m
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/20"
                    }`}
                >
                  {m === "time" ? <Clock className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{MODE_LABELS[m]}</span>
                  <span className="sm:hidden">{m.charAt(0).toUpperCase() + m.slice(1)}</span>
                </button>
              ))}
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Date pickers */}
              {(mode === "date" || mode === "datetime") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* From date */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">
                      From date
                    </label>
                    <div className="rounded-xl border border-border/40 bg-secondary/10 overflow-hidden symbol-rdp">
                      <DayPicker
                        mode="single"
                        selected={fromDate}
                        onSelect={setFromDate}
                        toDate={toDate}
                        captionLayout="dropdown-buttons"
                        fromYear={2000}
                        toYear={new Date().getFullYear()}
                        modifiersClassNames={{
                          selected: "rdp-day_selected",
                        }}
                      />
                    </div>
                    {errors.fromDate && (
                      <p className="text-[11px] text-red-400 mt-1">{errors.fromDate}</p>
                    )}
                  </div>

                  {/* To date */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">
                      To date
                    </label>
                    <div className="rounded-xl border border-border/40 bg-secondary/10 overflow-hidden symbol-rdp">
                      <DayPicker
                        mode="single"
                        selected={toDate}
                        onSelect={setToDate}
                        fromDate={fromDate}
                        captionLayout="dropdown-buttons"
                        fromYear={2000}
                        toYear={new Date().getFullYear()}
                      />
                    </div>
                    {errors.toDate && (
                      <p className="text-[11px] text-red-400 mt-1">{errors.toDate}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Time pickers */}
              {(mode === "time" || mode === "datetime") && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block flex items-center gap-1">
                      <Clock className="w-3 h-3" /> From time
                    </label>
                    <input
                      type="time"
                      value={fromTime}
                      onChange={(e) => setFromTime(e.target.value)}
                      className={`w-full rounded-lg border px-3 py-2 text-sm bg-secondary/20 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors
                        ${errors.fromTime ? "border-red-500/50" : "border-border/40"}`}
                    />
                    {errors.fromTime && (
                      <p className="text-[11px] text-red-400 mt-1">{errors.fromTime}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block flex items-center gap-1">
                      <Clock className="w-3 h-3" /> To time
                    </label>
                    <input
                      type="time"
                      value={toTime}
                      onChange={(e) => setToTime(e.target.value)}
                      className={`w-full rounded-lg border px-3 py-2 text-sm bg-secondary/20 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors
                        ${errors.toTime ? "border-red-500/50" : "border-border/40"}`}
                    />
                    {errors.toTime && (
                      <p className="text-[11px] text-red-400 mt-1">{errors.toTime}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Summary */}
              {((mode === "date" && fromDate && toDate) ||
                (mode === "time" && fromTime && toTime) ||
                (mode === "datetime" && fromDate && toDate && fromTime && toTime)) && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary/80">
                  <span className="font-semibold">Range: </span>
                  {mode === "date" &&
                    `${format(fromDate!, "MMM d, yyyy")} — ${format(toDate!, "MMM d, yyyy")}`}
                  {mode === "time" && `${fromTime} — ${toTime}`}
                  {mode === "datetime" &&
                    `${format(fromDate!, "MMM d")} ${fromTime} — ${format(toDate!, "MMM d")} ${toTime}`}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/30">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground border border-border/40 hover:text-foreground hover:bg-secondary/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Apply range
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
