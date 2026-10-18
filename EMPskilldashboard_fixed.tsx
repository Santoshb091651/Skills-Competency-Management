import React from "react";
import {
  DataGrid,
  DataGridHeader,
  DataGridBody,
  DataGridRow,
  DataGridCell,
  DataGridHeaderCell,
  TableCellLayout,
  createTableColumn,
  Text,
  Button,
  Select,
  Spinner,
  Avatar,
  Field,
  Input,
  Card,
  CardHeader
} from "@fluentui/react-components";
import { Add16Regular, Delete16Regular, ArrowLeft16Regular, Save16Regular, Dismiss16Regular, ChevronLeft16Regular, ChevronRight16Regular } from "@fluentui/react-icons";

const langMap: Record<number, { code: string; name: string; isRtl: boolean }> = {
  1033: { code: "en-US", name: "English (United States)", isRtl: false },
};

const translations: Record<string, Record<string, string>> = {
  "en-US": {
    employeesTitle: "Employee Skills Matrix Dashboard",
    employeeDetailsTitle: "Employee Profile & Skills Management",
    employeename: "Employee Name",
    employeeid: "Employee ID",
    email: "Email",
    designation: "Designation",
    actions: "Actions",
    loading: "Loading matrix data definitions...",
    noData: "No employees found.",
    noMatch: "No employees match the current search or filters.",
    error: "Error loading skills layout.",
    saveSuccess: "All rating changes saved successfully!",
    saveError: "Failed to save rating changes.",
    addEmployee: "Add New Employee",
    hideForm: "Hide Panel",
    deleteSuccess: "Employee removed successfully!",
    deleteError: "Failed to delete employee record.",
    createSuccess: "Employee onboarding profile created successfully!",
    createError: "Failed to create new employee profiles.",
    back: "Back to Dashboard",
    saveProfile: "Save Matrix Ratings",
    searchPlaceholder: "Search by employee ID, name, email or designation",
    clearFilters: "Clear filters",
    rowsPerPage: "Rows per page",
    previous: "Previous",
    next: "Next"
  },
};

const ratingOptions = ["0", "1", "2", "3", "4", "5"];
const pageSizeOptions = [5, 10, 25, 50, 100];

const EMPLOYEE_TABLE = "cr8f7_employee";
const SKILL_TABLE = "cr8f7_employeeskill";
const EMPLOYEE_PK = "cr8f7_employeeid";

// Column id -> the Dataverse column its text filter reads.
const BASE_FIELD_BY_COLUMN: Record<string, string> = {
  employeename: "cr8f7_employeename",
  employeeid: "cr8f7_employeeid1",
  email: "cr8f7_emailaddress",
  designation: "cr8f7_jobtitle",
};

// Host method names probed in order. The host that runs a published page does not
// always expose the same surface the Studio preview does, so never assume one name.
const CREATE_METHODS = ["createRecord", "createRow", "create"];
const DELETE_METHODS = ["deleteRecord", "deleteRow", "delete"];

type WriteApi = {
  create: (table: string, data: Record<string, any>) => Promise<any>;
  remove: (table: string, id: string) => Promise<any>;
  createdVia: string;
};

// The page host gives the component a fixed-height box and clips the overflow, so the
// root of every view owns its own scrolling.
const pageScrollStyle: React.CSSProperties = {
  padding: 20,
  width: "100%",
  height: "100%",
  maxHeight: "100vh",
  overflowY: "auto",
  overflowX: "hidden",
  boxSizing: "border-box",
  fontFamily: "Segoe UI, sans-serif",
};

const headerCellStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "6px 4px",
  width: "100%",
};

export default function GeneratedComponent(props: any) {
  const { dataApi, context } = props;

  const language = React.useMemo(() => {
    const uiLanguageId = context?.userSettings?.languageId || (typeof Xrm !== "undefined" && Xrm.Utility?.getGlobalContext()?.userSettings?.languageId) || 1033;
    return langMap[uiLanguageId]?.code || "en-US";
  }, [context]);

  const isRTL = React.useMemo(() => {
    const uiLanguageId = context?.userSettings?.languageId || (typeof Xrm !== "undefined" && Xrm.Utility?.getGlobalContext()?.userSettings?.languageId) || 1033;
    return langMap[uiLanguageId]?.isRtl || false;
  }, [context]);

  const t = React.useCallback((key: string): string => translations[language]?.[key] || translations["en-US"]?.[key] || key, [language]);

  // Page Navigation State Manager ("list" = Dashboard Page, "details" = Employee Edit Page)
  const [viewMode, setViewMode] = React.useState<"list" | "details">("list");
  const [selectedEmployee, setSelectedEmployee] = React.useState<any | null>(null);

  const [employees, setEmployees] = React.useState<any[]>([]);
  const [uniqueSkills, setUniqueSkills] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [toastMessage, setToastMessage] = React.useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState<boolean>(false);
  const [isFormSubmitting, setIsFormSubmitting] = React.useState<boolean>(false);
  const [formFields, setFormFields] = React.useState({ empName: "", empId: "", empEmail: "", empTitle: "" });
  const [formSkillRatings, setFormSkillRatings] = React.useState<Record<string, string>>({});

  // Search, per-column filters and paging
  const [searchText, setSearchText] = React.useState<string>("");
  const [columnFilters, setColumnFilters] = React.useState<Record<string, string>>({});
  const [pageSize, setPageSize] = React.useState<number>(10);
  const [pageIndex, setPageIndex] = React.useState<number>(0);

  // Employee Edit Page states
  const [detailSkillRatings, setDetailSkillRatings] = React.useState<Record<string, string>>({});
  const [isDetailSaving, setIsDetailSaving] = React.useState<boolean>(false);

  // Lists every method the host actually handed us, including prototype methods that
  // Object.keys alone would miss on a class instance. Surfaced in the error toast so a
  // write failure names the available surface instead of failing silently.
  const describeApis = React.useCallback((): string => {
    const methodsOf = (obj: any): string[] | null => {
      if (!obj) return null;
      const names = new Set<string>();
      let cursor = obj;
      while (cursor && cursor !== Object.prototype) {
        Object.getOwnPropertyNames(cursor).forEach((n) => {
          if (n !== "constructor" && typeof obj[n] === "function") names.add(n);
        });
        cursor = Object.getPrototypeOf(cursor);
      }
      return Array.from(names).sort();
    };
    return JSON.stringify({
      dataApi: methodsOf(dataApi),
      dataApiWebApi: methodsOf(dataApi?.webApi),
      contextWebApi: methodsOf(context?.webApi),
      xrmPresent: typeof Xrm !== "undefined",
    });
  }, [dataApi, context]);

  const resolveWriteApi = React.useCallback((): WriteApi | null => {
    const candidates: { label: string; obj: any }[] = [
      { label: "dataApi", obj: dataApi },
      { label: "dataApi.webApi", obj: dataApi?.webApi },
      { label: "context.webApi", obj: context?.webApi },
      { label: "Xrm.WebApi", obj: typeof Xrm !== "undefined" ? (Xrm as any).WebApi : undefined },
    ];

    for (const { label, obj } of candidates) {
      if (!obj) continue;
      const createName = CREATE_METHODS.find((m) => typeof obj[m] === "function");
      if (!createName) continue;
      const deleteName = DELETE_METHODS.find((m) => typeof obj[m] === "function");
      return {
        createdVia: `${label}.${createName}`,
        create: (table, data) => obj[createName](table, data),
        remove: (table, id) =>
          deleteName
            ? obj[deleteName](table, id)
            : Promise.reject(new Error(`No delete method on ${label}`)),
      };
    }
    return null;
  }, [dataApi, context]);

  const fetchMatrixData = React.useCallback(async () => {
    const api = dataApi || context?.webApi;
    if (!api) {
      setLoading(false);
      setEmployees([]);
      return;
    }

    try {
      let employeeRecords: any[] = [];
      let skillRecords: any[] = [];

      // The primary key is selected explicitly; without it the delete handler has no GUID.
      if (typeof api.queryTable === "function") {
        const empResult = await api.queryTable(EMPLOYEE_TABLE, {
          select: [EMPLOYEE_PK, "cr8f7_employeename", "cr8f7_employeeid1", "cr8f7_emailaddress", "cr8f7_jobtitle"],
          pageSize: 5000,
        });
        employeeRecords = empResult?.rows || empResult?.entities || [];
      } else {
        const empResult = await api.retrieveMultipleRecords(EMPLOYEE_TABLE, `?$select=${EMPLOYEE_PK},cr8f7_employeename,cr8f7_employeeid1,cr8f7_emailaddress,cr8f7_jobtitle`);
        employeeRecords = empResult?.entities || [];
      }

      if (typeof api.queryTable === "function") {
        const skillResult = await api.queryTable(SKILL_TABLE, {
          select: ["cr8f7_employeeidentifier", "cr8f7_skillname", "cr8f7_skillrating", "cr8f7_lastupdateddate"],
          pageSize: 5000
        });
        skillRecords = skillResult?.rows || skillResult?.entities || [];
      } else {
        const skillResult = await api.retrieveMultipleRecords(SKILL_TABLE, "?$select=cr8f7_employeeidentifier,cr8f7_skillname,cr8f7_skillrating,cr8f7_lastupdateddate");
        skillRecords = skillResult?.entities || [];
      }

      const dynamicSkillsSet = new Set<string>();
      skillRecords.forEach((s: any) => {
        if (s.cr8f7_skillname) dynamicSkillsSet.add(s.cr8f7_skillname.trim());
      });
      const dynamicSkillsArray = Array.from(dynamicSkillsSet).sort();

      const pivotedEmployees = employeeRecords.map((emp: any) => {
        const empIdVal = String(emp.cr8f7_employeeid1 || "").toLowerCase();
        const matchingSkills = skillRecords.filter((s: any) => String(s.cr8f7_employeeidentifier || "").toLowerCase() === empIdVal);

        matchingSkills.sort((a, b) => {
          const dateA = a.cr8f7_lastupdateddate ? new Date(a.cr8f7_lastupdateddate).getTime() : 0;
          const dateB = b.cr8f7_lastupdateddate ? new Date(b.cr8f7_lastupdateddate).getTime() : 0;
          return dateA - dateB;
        });

        const skillMappings: Record<string, string> = {};
        dynamicSkillsArray.forEach(skill => {
          const latestSkillEntry = [...matchingSkills].reverse().find((s: any) => s.cr8f7_skillname?.trim() === skill);
          skillMappings[skill] = latestSkillEntry ? String(latestSkillEntry.cr8f7_skillrating ?? "-") : "-";
        });

        return { ...emp, ...skillMappings };
      });

      setUniqueSkills(dynamicSkillsArray);
      setEmployees(pivotedEmployees);

      setSelectedEmployee(prev => {
        if (!prev) return prev;
        return pivotedEmployees.find(e => e.cr8f7_employeeid1 === prev.cr8f7_employeeid1) || prev;
      });

      setLoading(false);
    } catch (e: any) {
      setError(`${t("error")} (${e?.message || "Layout Config"})`);
      setEmployees([]);
      setLoading(false);
    }
  }, [dataApi, context, t]);

  React.useEffect(() => {
    fetchMatrixData();
  }, [fetchMatrixData]);

  const filteredEmployees = React.useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return employees.filter((emp) => {
      if (query) {
        const haystack = [emp.cr8f7_employeeid1, emp.cr8f7_employeename, emp.cr8f7_emailaddress, emp.cr8f7_jobtitle]
          .map((v) => String(v ?? "").toLowerCase());
        if (!haystack.some((h) => h.includes(query))) return false;
      }

      for (const [columnId, value] of Object.entries(columnFilters)) {
        if (!value) continue;
        if (columnId.startsWith("skill_")) {
          const skillName = columnId.slice("skill_".length);
          if (String(emp[skillName] ?? "-") !== value) return false;
        } else {
          const field = BASE_FIELD_BY_COLUMN[columnId];
          if (!field) continue;
          if (!String(emp[field] ?? "").toLowerCase().includes(value.toLowerCase())) return false;
        }
      }
      return true;
    });
  }, [employees, searchText, columnFilters]);

  const totalRows = filteredEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const firstRowNumber = totalRows === 0 ? 0 : safePageIndex * pageSize + 1;
  const lastRowNumber = Math.min(totalRows, (safePageIndex + 1) * pageSize);
  const pagedEmployees = React.useMemo(
    () => filteredEmployees.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize),
    [filteredEmployees, safePageIndex, pageSize]
  );

  React.useEffect(() => {
    setPageIndex(0);
  }, [searchText, columnFilters, pageSize]);

  const hasActiveFilters = searchText.trim().length > 0 || Object.values(columnFilters).some((v) => v);

  const clearAllFilters = () => {
    setSearchText("");
    setColumnFilters({});
  };

  const setColumnFilter = (columnId: string, value: string) =>
    setColumnFilters((prev) => ({ ...prev, [columnId]: value }));

  // Save modified ratings from Employee Edit Page
  const handleBulkSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    const writeApi = resolveWriteApi();
    if (!writeApi) {
      setToastMessage({ text: `${t("saveError")} (no write API found - host exposes: ${describeApis()})`, type: "error" });
      return;
    }

    setIsDetailSaving(true);
    try {
      const targetEmpId = selectedEmployee.cr8f7_employeeid1;
      const pending = Object.entries(detailSkillRatings).filter(([skillName, newValue]) => {
        const currentValue = selectedEmployee[skillName] || "-";
        if (!newValue || newValue === "-") return false;
        if (newValue === currentValue) return false;
        return !Number.isNaN(parseInt(newValue, 10));
      });

      if (pending.length === 0) {
        setToastMessage({ text: "No rating changes to save.", type: "info" });
        setIsDetailSaving(false);
        return;
      }

      const results = await Promise.allSettled(
        pending.map(([skillName, newValue]) =>
          writeApi.create(SKILL_TABLE, {
            cr8f7_employeeidentifier: targetEmpId,
            cr8f7_skillname: skillName,
            cr8f7_skillrating: parseInt(newValue, 10),
            cr8f7_lastupdateddate: new Date().toISOString()
          })
        )
      );

      const failures = results.filter(r => r.status === "rejected") as PromiseRejectedResult[];
      if (failures.length > 0) {
        const reason = (failures[0].reason as any)?.message || "Dataverse Fault";
        setToastMessage({ text: `${t("saveError")} ${failures.length} of ${pending.length} failed via ${writeApi.createdVia}: ${reason}`, type: "error" });
        await fetchMatrixData();
        return;
      }

      setToastMessage({ text: t("saveSuccess"), type: "success" });
      await fetchMatrixData();
      setViewMode("list");
    } catch (err: any) {
      setToastMessage({ text: `${t("saveError")} (${err?.message || "Dataverse Fault"})`, type: "error" });
    } finally {
      setIsDetailSaving(false);
    }
  };

  const handleCreateEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const writeApi = resolveWriteApi();
    if (!writeApi) {
      setToastMessage({ text: `${t("createError")} (no write API found - host exposes: ${describeApis()})`, type: "error" });
      return;
    }

    setIsFormSubmitting(true);
    try {
      await writeApi.create(EMPLOYEE_TABLE, {
        cr8f7_employeename: formFields.empName,
        cr8f7_employeeid1: formFields.empId,
        cr8f7_emailaddress: formFields.empEmail,
        cr8f7_jobtitle: formFields.empTitle
      });

      const pending = Object.entries(formSkillRatings).filter(([, ratingValue]) =>
        ratingValue && ratingValue !== "-" && !Number.isNaN(parseInt(ratingValue, 10))
      );

      const results = await Promise.allSettled(
        pending.map(([skillName, ratingValue]) =>
          writeApi.create(SKILL_TABLE, {
            cr8f7_employeeidentifier: formFields.empId,
            cr8f7_skillname: skillName,
            cr8f7_skillrating: parseInt(ratingValue, 10),
            cr8f7_lastupdateddate: new Date().toISOString()
          })
        )
      );

      const failures = results.filter(r => r.status === "rejected") as PromiseRejectedResult[];
      if (failures.length > 0) {
        const reason = (failures[0].reason as any)?.message || "Dataverse Fault";
        setToastMessage({ text: `Employee created, but ${failures.length} of ${pending.length} ratings failed: ${reason}`, type: "error" });
        await fetchMatrixData();
        return;
      }

      setToastMessage({ text: t("createSuccess"), type: "success" });
      setShowForm(false);
      setFormFields({ empName: "", empId: "", empEmail: "", empTitle: "" });
      setFormSkillRatings({});
      await fetchMatrixData();
    } catch (err: any) {
      setToastMessage({ text: `${t("createError")} (via ${writeApi.createdVia}: ${err?.message || "Dataverse Fault"})`, type: "error" });
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (employeeRecord: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const writeApi = resolveWriteApi();
    if (!writeApi) {
      setToastMessage({ text: `${t("deleteError")} (no write API found - host exposes: ${describeApis()})`, type: "error" });
      return;
    }

    const targetGuid = employeeRecord[EMPLOYEE_PK] || employeeRecord.id || employeeRecord.rowId;
    if (!targetGuid) {
      setToastMessage({ text: `Missing unique identifier Guid. Row keys: ${Object.keys(employeeRecord).join(", ")}`, type: "error" });
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete ${employeeRecord.cr8f7_employeename}?`)) return;

    setDeletingId(employeeRecord.cr8f7_employeeid1);
    try {
      await writeApi.remove(EMPLOYEE_TABLE, targetGuid);
      setToastMessage({ text: t("deleteSuccess"), type: "success" });
      await fetchMatrixData();
    } catch (err: any) {
      setToastMessage({ text: `${t("deleteError")} (${err?.message})`, type: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  const renderTextFilterHeader = (columnId: string, label: string) => (
    <div style={headerCellStyle} onClick={(e) => e.stopPropagation()}>
      <Text weight="bold">{label}</Text>
      <Input
        size="small"
        placeholder="Filter"
        value={columnFilters[columnId] || ""}
        onChange={(_, d) => setColumnFilter(columnId, d.value)}
      />
    </div>
  );

  const baseColumns = [
    createTableColumn({
      columnId: "employeename",
      minWidth: 200,
      renderHeaderCell: () => renderTextFilterHeader("employeename", t("employeename")),
      renderCell: (item: any) => (
        <TableCellLayout media={<Avatar name={item.cr8f7_employeename} size={24} aria-hidden="true" />} style={{ color: "#005a9e", fontWeight: "600" }}>
          {item.cr8f7_employeename || ""}
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: "employeeid",
      minWidth: 150,
      renderHeaderCell: () => renderTextFilterHeader("employeeid", t("employeeid")),
      renderCell: (item: any) => <TableCellLayout>{item.cr8f7_employeeid1 || ""}</TableCellLayout>,
    }),
    createTableColumn({
      columnId: "email",
      minWidth: 230,
      renderHeaderCell: () => renderTextFilterHeader("email", t("email")),
      renderCell: (item: any) => <TableCellLayout truncate title={item.cr8f7_emailaddress || ""}>{item.cr8f7_emailaddress || ""}</TableCellLayout>,
    }),
    createTableColumn({
      columnId: "designation",
      minWidth: 190,
      renderHeaderCell: () => renderTextFilterHeader("designation", t("designation")),
      renderCell: (item: any) => <TableCellLayout truncate title={item.cr8f7_jobtitle || ""}>{item.cr8f7_jobtitle || ""}</TableCellLayout>,
    }),
  ];

  const skillColumns = uniqueSkills.map((skillName) =>
    createTableColumn({
      columnId: `skill_${skillName}`,
      minWidth: 120,
      renderHeaderCell: () => (
        <div style={headerCellStyle} onClick={(e) => e.stopPropagation()}>
          <Text weight="bold" truncate title={skillName}>{skillName}</Text>
          <Select
            size="small"
            value={columnFilters[`skill_${skillName}`] || ""}
            onChange={(_, d) => setColumnFilter(`skill_${skillName}`, d.value)}
          >
            <option value="">All</option>
            <option value="-">Not rated</option>
            {ratingOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </Select>
        </div>
      ),
      renderCell: (item: any) => {
        const currentRating = item[skillName] || "-";
        const getPillStyle = (val: string): React.CSSProperties => {
          const bs: React.CSSProperties = { width: "55px", height: "26px", borderRadius: "13px", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontWeight: "bold", fontSize: "14px" };
          switch (val) {
            case "0": return { ...bs, backgroundColor: "#a19f9d" };
            case "1": return { ...bs, backgroundColor: "#e81123" };
            case "2": return { ...bs, backgroundColor: "#f7630c" };
            case "3": return { ...bs, backgroundColor: "#ffb900" };
            case "4": return { ...bs, backgroundColor: "#bad80a" };
            case "5": return { ...bs, backgroundColor: "#107c41" };
            default: return { ...bs, backgroundColor: "#f3f2f1", color: "#605e5c", fontWeight: "normal" };
          }
        };
        return <TableCellLayout><div style={getPillStyle(currentRating)}>{currentRating}</div></TableCellLayout>;
      },
    })
  );

  const actionColumn = [
    createTableColumn({
      columnId: "actions",
      minWidth: 90,
      renderHeaderCell: () => <Text weight="bold" style={{ padding: 8 }}>{t("actions")}</Text>,
      renderCell: (item: any) => (
        <TableCellLayout>
          {deletingId === item.cr8f7_employeeid1 ? <Spinner size="tiny" /> : (
            <Button size="small" type="button" appearance="subtle" icon={<Delete16Regular />} style={{ color: "#a80000" }} onClick={(e) => handleDeleteEmployee(item, e)} />
          )}
        </TableCellLayout>
      ),
    })
  ];

  const allColumns = [...baseColumns, ...skillColumns, ...actionColumn];

  const renderToast = () => toastMessage && (
    <div style={{ marginBottom: 16, padding: "10px 16px", borderRadius: "4px", fontSize: "14px", fontWeight: "500", backgroundColor: toastMessage.type === "success" ? "#dff6dd" : toastMessage.type === "info" ? "#f3f2f1" : "#fde7e9", color: toastMessage.type === "success" ? "#107c41" : toastMessage.type === "info" ? "#323130" : "#a80000", border: "1px solid #e0e0e0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
      <Text style={{ wordBreak: "break-word" }}>{toastMessage.text}</Text>
      <Button size="small" type="button" appearance="subtle" onClick={() => setToastMessage(null)}>✕</Button>
    </div>
  );

  if (loading) return <div style={{ padding: 40, display: "flex", justifyContent: "center", alignItems: "center" }}><Spinner label={t("loading")} /></div>;
  if (error) return <div style={{ padding: 24, color: "#d13438", backgroundColor: "#fde7e9", borderRadius: "4px" }}><Text>{error}</Text></div>;

  // PAGE VIEW 2: EMPLOYEE PROFILE EDIT PAGE
  if (viewMode === "details" && selectedEmployee) {
    return (
      <div dir={isRTL ? "rtl" : "ltr"} style={pageScrollStyle}>
        {renderToast()}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, borderBottom: "2px solid #f3f2f1", paddingBottom: "12px" }}>
          <Button type="button" icon={<ArrowLeft16Regular />} onClick={() => setViewMode("list")}>{t("back")}</Button>
          <Text size={500} weight="bold" style={{ color: "#323130" }}>{t("employeeDetailsTitle")}</Text>
          <div style={{ width: "100px" }} />
        </div>

        <Card style={{ marginBottom: 24, padding: "16px", backgroundColor: "#faf9f8" }}>
          <CardHeader
            media={<Avatar name={selectedEmployee.cr8f7_employeename} size={48} />}
            header={<Text size={500} weight="bold">{selectedEmployee.cr8f7_employeename}</Text>}
            description={
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px", marginTop: "8px", color: "#605e5c" }}>
                <div><Text weight="semibold">ID: </Text>{selectedEmployee.cr8f7_employeeid1}</div>
                <div><Text weight="semibold">Email: </Text>{selectedEmployee.cr8f7_emailaddress}</div>
                <div><Text weight="semibold">Title: </Text>{selectedEmployee.cr8f7_jobtitle || "N/A"}</div>
              </div>
            }
          />
        </Card>

        <form onSubmit={handleBulkSaveDetails}>
          <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px", backgroundColor: "#ffffff" }}>
            <Text size={400} weight="semibold" style={{ display: "block", marginBottom: "16px", color: "#323130" }}>Proficiency Matrix Logs Configuration</Text>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px", marginBottom: "24px" }}>
              {uniqueSkills.map(skill => {
                const currentVal = selectedEmployee[skill] || "-";
                return (
                  <div key={skill} style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "12px", backgroundColor: "#faf9f8", borderRadius: "6px", border: "1px solid #f3f2f1" }}>
                    <Text weight="medium" size={300} truncate title={skill}>{skill}</Text>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "4px" }}>
                      <Text size={200} style={{ color: "#605e5c" }}>Current: <Text weight="bold">{currentVal}</Text></Text>
                      <Select size="small" style={{ flexGrow: 1 }} value={detailSkillRatings[skill] ?? currentVal} onChange={(_, data) => setDetailSkillRatings(prev => ({ ...prev, [skill]: data.value }))}>
                        <option value="-">-</option>
                        {ratingOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", borderTop: "1px solid #e0e0e0", paddingTop: "16px", position: "sticky", bottom: 0, backgroundColor: "#ffffff" }}>
              <Button type="button" appearance="secondary" onClick={() => setViewMode("list")} disabled={isDetailSaving}>Cancel</Button>
              <Button type="submit" appearance="primary" icon={<Save16Regular />} disabled={isDetailSaving}>
                {isDetailSaving ? <Spinner size="tiny" label="Saving Changes..." /> : t("saveProfile")}
              </Button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={pageScrollStyle}>
      {renderToast()}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "2px solid #f3f2f1", paddingBottom: "12px", gap: 12, flexWrap: "wrap" }}>
        <Text size={600} weight="bold" style={{ color: "#323130" }}>{t("employeesTitle")}</Text>
        <Button type="button" appearance={showForm ? "secondary" : "primary"} icon={<Add16Regular />} onClick={() => setShowForm(!showForm)}>
          {showForm ? t("hideForm") : t("addEmployee")}
        </Button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Input
          style={{ flexGrow: 1, minWidth: 260, maxWidth: 480 }}
          placeholder={t("searchPlaceholder")}
          value={searchText}
          onChange={(_, d) => setSearchText(d.value)}
        />
        {hasActiveFilters && (
          <Button type="button" appearance="subtle" icon={<Dismiss16Regular />} onClick={clearAllFilters}>
            {t("clearFilters")}
          </Button>
        )}
        <Text size={200} style={{ color: "#605e5c", marginLeft: "auto" }}>
          {totalRows} {totalRows === 1 ? "employee" : "employees"}
          {hasActiveFilters ? ` (filtered from ${employees.length})` : ""}
        </Text>
      </div>

      {showForm && (
        <div style={{ marginBottom: 24, padding: 20, backgroundColor: "#faf9f8", borderRadius: 8, border: "1px solid #e0e0e0", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <Text size={400} weight="bold" style={{ display: "block", marginBottom: 16 }}>{t("addEmployee")}</Text>
          <form onSubmit={handleCreateEmployeeSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 16 }}>
              <Field label="Employee Name" required><Input value={formFields.empName} onChange={(_, d) => setFormFields(p => ({ ...p, empName: d.value }))} required /></Field>
              <Field label="Employee ID" required><Input value={formFields.empId} onChange={(_, d) => setFormFields(p => ({ ...p, empId: d.value }))} required /></Field>
              <Field label="Email Address" required><Input type="email" value={formFields.empEmail} onChange={(_, d) => setFormFields(p => ({ ...p, empEmail: d.value }))} required /></Field>
              <Field label="Designation / Job Title"><Input value={formFields.empTitle} onChange={(_, d) => setFormFields(p => ({ ...p, empTitle: d.value }))} /></Field>
            </div>

            {uniqueSkills.length > 0 && (
              <div style={{ marginBottom: 20, borderTop: "1px solid #e0e0e0", paddingTop: 12 }}>
                <Text weight="semibold" size={300} style={{ display: "block", marginBottom: 12, color: "#605e5c" }}>Initial Skill Proficiency Assignments</Text>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, maxHeight: "40vh", overflowY: "auto", paddingRight: 4 }}>
                  {uniqueSkills.map(skill => (
                    <div key={skill} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", backgroundColor: "#ffffff", borderRadius: 4, border: "1px solid #f3f2f1" }}>
                      <Text size={200} truncate title={skill} style={{ maxWidth: "130px" }}>{skill}</Text>
                      <Select size="small" style={{ minWidth: "70px" }} value={formSkillRatings[skill] || "-"} onChange={(_, d) => setFormSkillRatings(p => ({ ...p, [skill]: d.value }))}>
                        <option value="-">-</option>
                        {ratingOptions.map(o => <option key={o} value={o}>{o}</option>)}
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button type="button" appearance="secondary" onClick={() => setShowForm(false)} disabled={isFormSubmitting}>Cancel</Button>
              <Button type="submit" appearance="primary" disabled={isFormSubmitting}>{isFormSubmitting ? <Spinner size="tiny" label="Saving..." /> : "Submit"}</Button>
            </div>
          </form>
        </div>
      )}

      {employees.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", backgroundColor: "#f3f2f1", borderRadius: "4px" }}><Text size={400} style={{ color: "#605e5c" }}>{t("noData")}</Text></div>
      ) : (
        <>
          <div style={{ overflowX: "auto", border: "1px solid #e0e0e0", borderRadius: "8px", backgroundColor: "#ffffff" }}>
            <DataGrid items={pagedEmployees} columns={allColumns} itemsPerGridRow={1} focusMode="row">
              <DataGridHeader style={{ backgroundColor: "#faf9f8" }}>
                <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell style={{ borderBottom: "1px solid #e0e0e0", alignItems: "flex-start" }}>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
              </DataGridHeader>
              <DataGridBody>
                {({ item, rowId }) => (
                  <DataGridRow key={rowId} style={{ borderBottom: "1px solid #f3f2f1", cursor: "pointer" }} onClick={() => { setSelectedEmployee(item); setDetailSkillRatings({}); setViewMode("details"); }}>
                    {({ renderCell }) => <DataGridCell style={{ padding: "6px 8px" }}>{renderCell(item)}</DataGridCell>}
                  </DataGridRow>
                )}
              </DataGridBody>
            </DataGrid>
          </div>

          {totalRows === 0 && (
            <div style={{ padding: 32, textAlign: "center", backgroundColor: "#f3f2f1", borderRadius: "4px", marginTop: 12 }}>
              <Text size={400} style={{ color: "#605e5c" }}>{t("noMatch")}</Text>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginTop: 16, paddingTop: 12, borderTop: "1px solid #f3f2f1" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Text size={300} style={{ color: "#605e5c" }}>{t("rowsPerPage")}</Text>
              <Select
                size="small"
                style={{ minWidth: 80 }}
                value={String(pageSize)}
                onChange={(_, d) => setPageSize(parseInt(d.value, 10))}
              >
                {pageSizeOptions.map((n) => <option key={n} value={String(n)}>{n}</option>)}
              </Select>
            </div>

            <Text size={300} style={{ color: "#605e5c" }}>
              {firstRowNumber}-{lastRowNumber} of {totalRows}
            </Text>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Button
                type="button"
                appearance="secondary"
                icon={<ChevronLeft16Regular />}
                disabled={safePageIndex === 0}
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              >
                {t("previous")}
              </Button>
              <Text size={300} style={{ color: "#605e5c", minWidth: 90, textAlign: "center" }}>
                Page {safePageIndex + 1} of {totalPages}
              </Text>
              <Button
                type="button"
                appearance="secondary"
                iconPosition="after"
                icon={<ChevronRight16Regular />}
                disabled={safePageIndex >= totalPages - 1}
                onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
              >
                {t("next")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
