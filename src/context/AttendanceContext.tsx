import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isAppwriteConfigured } from "@/lib/appwrite";
import {
  attendanceService,
  type AttendanceByDate,
} from "@/services/attendanceService";

export type AttendanceStatus = "present" | "absent" | "leave" | "off";

export type StaffMember = {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
};

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
  getAttendance: (date: string, staffId: string) => AttendanceStatus;
  refresh: () => Promise<void>;
};

const defaultStaff: StaffMember[] = [
  {
    id: "staff-1",
    name: "Rajesh Sharma",
    role: "Nurse",
    phone: "9876543210",
    email: "rajesh.sharma@ggnh.local",
  },
  {
    id: "staff-2",
    name: "Neha Patel",
    role: "Receptionist",
    phone: "9123456780",
    email: "neha.patel@ggnh.local",
  },
  {
    id: "staff-3",
    name: "Amit Verma",
    role: "Ward Assistant",
    phone: "9988776655",
    email: "amit.verma@ggnh.local",
  },
];

const AttendanceContext = createContext<AttendanceContextValue | undefined>(
  undefined,
);

export const AttendanceProvider = ({ children }: { children: ReactNode }) => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [attendanceByDate, setAttendanceByDate] = useState<AttendanceByDate>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    if (!isAppwriteConfigured) {
      setStaff(defaultStaff);
      setAttendanceByDate({});
      setError(
        "Appwrite is not configured. Add Appwrite env variables to enable cloud data storage.",
      );
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
    } catch {
      setError("Unable to load Appwrite data. Check collection permissions.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const addStaff = async (member: Omit<StaffMember, "id">) => {
    if (!isAppwriteConfigured) {
      setStaff((prev) => [
        ...prev,
        {
          id: `staff-${Date.now()}`,
          ...member,
        },
      ]);
      return;
    }

    const created = await attendanceService.addStaff(member);
    setStaff((prev) => [...prev, created]);
  };

  const updateStaff = async (id: string, member: Omit<StaffMember, "id">) => {
    if (isAppwriteConfigured) {
      await attendanceService.updateStaff(id, member);
    }

    setStaff((prev) =>
      prev.map((entry) => {
        if (entry.id !== id) {
          return entry;
        }
        return {
          id,
          ...member,
        };
      }),
    );
  };

  const removeStaff = async (id: string) => {
    if (isAppwriteConfigured) {
      await attendanceService.removeStaff(id);
    }

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
    if (isAppwriteConfigured) {
      await attendanceService.markAttendance(date, staffId, status);
    }

    setAttendanceByDate((prev) => ({
      ...prev,
      [date]: {
        ...(prev[date] ?? {}),
        [staffId]: status,
      },
    }));
  };

  const getAttendance = (date: string, staffId: string): AttendanceStatus => {
    return attendanceByDate[date]?.[staffId] ?? "off";
  };

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
      getAttendance,
      refresh,
    }),
    [staff, attendanceByDate, isLoading, error],
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
