import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { attendanceService } from "@/services/attendanceService";
import type {
  AttendanceByDate,
  AttendanceStatus,
  StaffMember,
} from "@/types/attendance";

export type { AttendanceStatus, StaffMember };

type AttendanceContextValue = {
  staff: StaffMember[];
  attendanceByDate: AttendanceByDate;
  isLoading: boolean;
  error: string;
  addStaff: (member: Omit<StaffMember, "id">) => Promise<void>;
  updateStaff: (id: string, member: Omit<StaffMember, "id">) => Promise<void>;
  removeStaff: (id: string) => Promise<void>;
  markAttendance: (
    date: string,
    staffId: string,
    status: AttendanceStatus,
  ) => Promise<void>;
  clearAttendance: (date: string, staffId: string) => Promise<void>;
  getAttendance: (date: string, staffId: string) => AttendanceStatus;
  refresh: () => Promise<void>;
};

const getTodayDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const ensureNotFutureDate = (date: string) => {
  if (date > getTodayDate()) {
    throw new Error("Attendance cannot be changed for future dates.");
  }
};

const AttendanceContext = createContext<AttendanceContextValue | undefined>(
  undefined,
);

export const AttendanceProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [attendanceByDate, setAttendanceByDate] = useState<AttendanceByDate>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setStaff([]);
      setAttendanceByDate({});
      setError("");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const [staffResponse, attendanceResponse] = await Promise.all([
        attendanceService.getStaff(),
        attendanceService.getAttendanceByDate(),
      ]);

      setStaff(staffResponse);
      setAttendanceByDate(attendanceResponse);
      setError("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to load staff and attendance data.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthLoading) {
      if (isAuthenticated) {
        void refresh();
      } else {
        setStaff([]);
        setAttendanceByDate({});
        setError("");
        setIsLoading(false);
      }
    }
  }, [isAuthenticated, isAuthLoading, refresh]);

  const addStaff = async (member: Omit<StaffMember, "id">) => {
    const created = await attendanceService.addStaff(member);
    setStaff((prev) => [...prev, created]);
  };

  const updateStaff = async (id: string, member: Omit<StaffMember, "id">) => {
    const updated = await attendanceService.updateStaff(id, member);
    setStaff((prev) =>
      prev.map((entry) => (entry.id === id ? updated : entry)),
    );
  };

  const removeStaff = async (id: string) => {
    await attendanceService.removeStaff(id);
    setStaff((prev) => prev.filter((entry) => entry.id !== id));

    setAttendanceByDate((prev) => {
      const next: AttendanceByDate = {};
      for (const date of Object.keys(prev)) {
        const { [id]: _removed, ...remaining } = prev[date];
        next[date] = remaining;
      }
      return next;
    });
  };

  const markAttendance = async (
    date: string,
    staffId: string,
    status: AttendanceStatus,
  ) => {
    ensureNotFutureDate(date);
    await attendanceService.markAttendance(date, staffId, status);

    setAttendanceByDate((prev) => ({
      ...prev,
      [date]: {
        ...(prev[date] ?? {}),
        [staffId]: status,
      },
    }));
  };

  const clearAttendance = async (date: string, staffId: string) => {
    ensureNotFutureDate(date);
    await attendanceService.clearAttendance(date, staffId);

    setAttendanceByDate((prev) => {
      const dayData = prev[date] ?? {};
      const { [staffId]: _removed, ...restOfDay } = dayData;

      return {
        ...prev,
        [date]: restOfDay,
      };
    });
  };

  const getAttendance = useCallback(
    (date: string, staffId: string): AttendanceStatus => {
      return attendanceByDate[date]?.[staffId] ?? "off";
    },
    [attendanceByDate],
  );

  const value = useMemo(
    () => ({
      staff,
      attendanceByDate,
      isLoading,
      error,
      addStaff,
      updateStaff,
      removeStaff,
      markAttendance,
      clearAttendance,
      getAttendance,
      refresh,
    }),
    [staff, attendanceByDate, isLoading, error, getAttendance],
  );

  return (
    <AttendanceContext.Provider value={value}>
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendance = () => {
  const context = useContext(AttendanceContext);

  if (!context) {
    throw new Error("useAttendance must be used within an AttendanceProvider");
  }

  return context;
};
