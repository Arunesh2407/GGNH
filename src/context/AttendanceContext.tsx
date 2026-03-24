import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AttendanceStatus = "present" | "absent" | "leave" | "off";

export type StaffMember = {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
};

type AttendanceRecord = Record<string, AttendanceStatus>;
type AttendanceByDate = Record<string, AttendanceRecord>;

type AttendanceContextValue = {
  staff: StaffMember[];
  attendanceByDate: AttendanceByDate;
  addStaff: (member: Omit<StaffMember, "id">) => void;
  updateStaff: (id: string, member: Omit<StaffMember, "id">) => void;
  removeStaff: (id: string) => void;
  markAttendance: (
    date: string,
    staffId: string,
    status: AttendanceStatus,
  ) => void;
  getAttendance: (date: string, staffId: string) => AttendanceStatus;
};

const STAFF_STORAGE_KEY = "ggnh_staff_members";
const ATTENDANCE_STORAGE_KEY = "ggnh_staff_attendance";

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

const loadStaff = (): StaffMember[] => {
  if (typeof window === "undefined") {
    return defaultStaff;
  }

  const raw = window.localStorage.getItem(STAFF_STORAGE_KEY);
  if (!raw) {
    return defaultStaff;
  }

  try {
    const parsed = JSON.parse(raw) as StaffMember[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultStaff;
    }
    return parsed;
  } catch {
    return defaultStaff;
  }
};

const loadAttendance = (): AttendanceByDate => {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.localStorage.getItem(ATTENDANCE_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as AttendanceByDate;
    return parsed ?? {};
  } catch {
    return {};
  }
};

export const AttendanceProvider = ({ children }: { children: ReactNode }) => {
  const [staff, setStaff] = useState<StaffMember[]>(loadStaff);
  const [attendanceByDate, setAttendanceByDate] =
    useState<AttendanceByDate>(loadAttendance);

  useEffect(() => {
    window.localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(staff));
  }, [staff]);

  useEffect(() => {
    window.localStorage.setItem(
      ATTENDANCE_STORAGE_KEY,
      JSON.stringify(attendanceByDate),
    );
  }, [attendanceByDate]);

  const addStaff = (member: Omit<StaffMember, "id">) => {
    setStaff((prev) => [
      ...prev,
      {
        id: `staff-${Date.now()}`,
        ...member,
      },
    ]);
  };

  const updateStaff = (id: string, member: Omit<StaffMember, "id">) => {
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

  const removeStaff = (id: string) => {
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

  const markAttendance = (
    date: string,
    staffId: string,
    status: AttendanceStatus,
  ) => {
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
      addStaff,
      updateStaff,
      removeStaff,
      markAttendance,
      getAttendance,
    }),
    [staff, attendanceByDate],
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
