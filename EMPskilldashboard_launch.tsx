import React from "react";
import {
  DataGrid,
  DataGridHeader,
  DataGridBody,
  DataGridRow,
  DataGridCell,
  DataGridHeaderCell,
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
    next: "Next",
    addSkill: "Add Skill",
    hideSkillForm: "Hide Skill Panel",
    skillSuccess: "Skill added to the catalogue:",
    skillError: "Failed to add the new skill.",
    skillMissing: "Both a skill name and an identifier are required.",
    skillDuplicate: "A skill already exists with the name",
    skillDuplicateId: "A skill already exists with the identifier"
  },
};

const ratingOptions = ["0", "1", "2", "3", "4", "5"];
const pageSizeOptions = [5, 10, 25, 50, 100];

const EMPLOYEE_TABLE = "cr8f7_employee";
const SKILL_TABLE = "cr8f7_employeeskill";
const SKILL_CATALOGUE_TABLE = "cr8f7_skill";
const EMPLOYEE_PK = "cr8f7_employeeid";

// Dataverse identifiers are upper snake case; derived from the name so the user does not
// have to invent one, but left editable because an existing coding scheme may differ.
const deriveIdentifier = (name: string): string =>
  name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50);

// Column id -> the Dataverse column its text filter reads.
const BASE_FIELD_BY_COLUMN: Record<string, string> = {
  employeename: "cr8f7_employeename",
  employeeid: "cr8f7_employeeid1",
  email: "cr8f7_emailaddress",
  designation: "cr8f7_jobtitle",
};

// Column widths are measured from the data at render time rather than hard-coded. Fluent
// ignores a minWidth passed into createTableColumn, so the measured numbers are fed both to
// columnSizingOptions and to an explicit minWidth on each cell's content; either mechanism
// alone stops the overlap, both together survive a host shipping a different Fluent build.
// Each column is clamped: below min the header's filter control stops being usable, above
// max the value wraps to a second line rather than pushing other columns off-screen.
// chrome covers cell padding plus any fixed ornament such as the avatar.
type ColumnSizing = { min: number; max: number; chrome: number; flexible: boolean };

const BASE_COLUMN_SIZING: Record<string, ColumnSizing> = {
  employeename: { min: 170, max: 300, chrome: 60, flexible: true },
  employeeid: { min: 130, max: 200, chrome: 28, flexible: false },
  email: { min: 180, max: 320, chrome: 28, flexible: true },
  designation: { min: 150, max: 260, chrome: 28, flexible: true },
  actions: { min: 80, max: 80, chrome: 0, flexible: false },
};
const SKILL_SIZING: ColumnSizing = { min: 112, max: 200, chrome: 28, flexible: false };
const CELL_PADDING_X = 24;

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
  overflowX: "auto",
  boxSizing: "border-box",
  fontFamily: "Segoe UI, sans-serif",
};

// break-word rather than anywhere: only words that cannot fit are split, so names and job
// titles wrap at spaces while a long email still breaks instead of overflowing.
const cellTextStyle: React.CSSProperties = {
  whiteSpace: "normal",
  overflowWrap: "break-word",
  wordBreak: "break-word",
  lineHeight: 1.35,
};

// overflow hidden is the backstop: if any width calculation is wrong, text is clipped at
// the column edge instead of being drawn over the neighbouring column.
const dataCellStyle: React.CSSProperties = {
  padding: "10px 12px",
  alignItems: "flex-start",
  height: "auto",
  minHeight: 52,
  borderRight: "1px solid #f3f2f1",
  boxSizing: "border-box",
  overflow: "hidden",
};

const headerCellOuterStyle: React.CSSProperties = {
  borderBottom: "1px solid #e0e0e0",
  borderRight: "1px solid #ebebeb",
  alignItems: "flex-start",
  height: "auto",
  minHeight: 82,
  padding: "8px 12px",
  boxSizing: "border-box",
  overflow: "hidden",
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
  const [skillCatalogue, setSkillCatalogue] = React.useState<{ name: string; identifier: string }[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [toastMessage, setToastMessage] = React.useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState<boolean>(false);
  const [isFormSubmitting, setIsFormSubmitting] = React.useState<boolean>(false);
  const [formFields, setFormFields] = React.useState({ empName: "", empId: "", empEmail: "", empTitle: "" });
  const [formSkillRatings, setFormSkillRatings] = React.useState<Record<string, string>>({});

  // Add-a-skill panel
  const [showSkillForm, setShowSkillForm] = React.useState<boolean>(false);
  const [isSkillSubmitting, setIsSkillSubmitting] = React.useState<boolean>(false);
  const [skillForm, setSkillForm] = React.useState({ name: "", identifier: "" });
  const [identifierTouched, setIdentifierTouched] = React.useState<boolean>(false);

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

      // The catalogue drives the columns, so a skill that nobody has been rated on yet still
      // gets a column. A failure here must not blank the dashboard, so it falls back to the
      // skills implied by the rating rows.
      let catalogueRecords: any[] = [];
      try {
        if (typeof api.queryTable === "function") {
          const catalogueResult = await api.queryTable(SKILL_CATALOGUE_TABLE, {
            select: ["cr8f7_skillname", "cr8f7_skillidentifier"],
            pageSize: 5000,
          });
          catalogueRecords = catalogueResult?.rows || catalogueResult?.entities || [];
        } else {
          const catalogueResult = await api.retrieveMultipleRecords(SKILL_CATALOGUE_TABLE, "?$select=cr8f7_skillname,cr8f7_skillidentifier");
          catalogueRecords = catalogueResult?.entities || [];
        }
      } catch {
        catalogueRecords = [];
      }

      setSkillCatalogue(
        catalogueRecords
          .map((r: any) => ({
            name: String(r.cr8f7_skillname ?? "").trim(),
            identifier: String(r.cr8f7_skillidentifier ?? "").trim(),
          }))
          .filter((s) => s.name)
      );

      // Keyed on lower case so "Java" in the catalogue and "java" on a rating row do not
      // produce two columns for the same skill.
      const skillByKey = new Map<string, string>();
      catalogueRecords.forEach((r: any) => {
        const name = String(r.cr8f7_skillname ?? "").trim();
        if (name) skillByKey.set(name.toLowerCase(), name);
      });
      skillRecords.forEach((s: any) => {
        const name = String(s.cr8f7_skillname ?? "").trim();
        if (name && !skillByKey.has(name.toLowerCase())) skillByKey.set(name.toLowerCase(), name);
      });
      const dynamicSkillsArray = Array.from(skillByKey.values()).sort((a, b) => a.localeCompare(b));

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
          const target = skill.toLowerCase();
          const latestSkillEntry = [...matchingSkills].reverse().find((s: any) => String(s.cr8f7_skillname ?? "").trim().toLowerCase() === target);
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

  // Measures real pixel width in the grid's own font, so auto-fit reflects what actually
  // renders instead of approximating from character counts.
  const measureText = React.useMemo(() => {
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = document.createElement("canvas").getContext("2d");
    } catch {
      ctx = null;
    }
    return (text: string, bold: boolean): number => {
      if (!text) return 0;
      if (!ctx) return text.length * (bold ? 7.8 : 7.2);
      ctx.font = `${bold ? 600 : 400} 14px 'Segoe UI', sans-serif`;
      return ctx.measureText(text).width;
    };
  }, []);

  const gridWrapperRef = React.useRef<HTMLDivElement | null>(null);
  const [availableWidth, setAvailableWidth] = React.useState<number>(0);

  React.useEffect(() => {
    const element = gridWrapperRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      setAvailableWidth(entries[0]?.contentRect?.width ?? 0);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [employees.length]);

  const columnWidths = React.useMemo(() => {
    const labels: Record<string, string> = {
      employeename: t("employeename"),
      employeeid: t("employeeid"),
      email: t("email"),
      designation: t("designation"),
      actions: t("actions"),
    };

    const fitted: Record<string, number> = {};

    // Widest of the header label and every value in the column, measured across the whole
    // result set rather than the current page so widths do not jump when paging.
    Object.entries(BASE_COLUMN_SIZING).forEach(([columnId, sizing]) => {
      const field = BASE_FIELD_BY_COLUMN[columnId];
      let widest = measureText(labels[columnId] ?? "", true);
      if (field) {
        employees.forEach((emp) => {
          const width = measureText(String(emp[field] ?? ""), false);
          if (width > widest) widest = width;
        });
      }
      fitted[columnId] = Math.min(sizing.max, Math.max(sizing.min, Math.ceil(widest) + sizing.chrome));
    });

    // A skill cell holds a fixed-width pill, so only the header name drives its width.
    uniqueSkills.forEach((skillName) => {
      const widest = measureText(skillName, true);
      fitted[`skill_${skillName}`] = Math.min(
        SKILL_SIZING.max,
        Math.max(SKILL_SIZING.min, Math.ceil(widest) + SKILL_SIZING.chrome)
      );
    });

    // Spread leftover room across the text columns so a narrow matrix fills the grid
    // instead of leaving a dead gap down the right-hand side.
    const total = Object.values(fitted).reduce((sum, width) => sum + width, 0);
    const slack = availableWidth - total - 2;
    if (slack > 0) {
      const flexible = Object.keys(BASE_COLUMN_SIZING).filter((id) => BASE_COLUMN_SIZING[id].flexible);
      if (flexible.length > 0) {
        const share = Math.floor(slack / flexible.length);
        flexible.forEach((id) => { fitted[id] += share; });
      }
    }

    return fitted;
  }, [employees, uniqueSkills, availableWidth, measureText, t]);

  const widthFor = React.useCallback(
    (columnId: string) => columnWidths[columnId] ?? SKILL_SIZING.min,
    [columnWidths]
  );

  // Space the column spends on padding and ornaments, so the text box can be given the
  // exact remaining width. A max-width is what forces wrapping; min-width alone lets the
  // box grow to fit its content and the text then never wraps at all.
  const contentWidthFor = React.useCallback(
    (columnId: string) => {
      const sizing = columnId.startsWith("skill_") ? SKILL_SIZING : BASE_COLUMN_SIZING[columnId];
      const chrome = sizing ? sizing.chrome : CELL_PADDING_X;
      return Math.max(24, widthFor(columnId) - Math.max(chrome, CELL_PADDING_X));
    },
    [widthFor]
  );

  const columnSizingOptions = React.useMemo(() => {
    const options: Record<string, { minWidth: number; defaultWidth: number; idealWidth: number }> = {};
    Object.entries(columnWidths).forEach(([columnId, width]) => {
      options[columnId] = { minWidth: width, defaultWidth: width, idealWidth: width };
    });
    return options;
  }, [columnWidths]);

  // Forces the table wider than its wrapper once the fitted columns exceed the viewport,
  // which is what actually makes the wrapper's horizontal scrollbar appear.
  const gridMinWidth = React.useMemo(
    () => Object.values(columnWidths).reduce((sum, width) => sum + width, 0),
    [columnWidths]
  );

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

  const handleCreateSkillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const writeApi = resolveWriteApi();
    if (!writeApi) {
      setToastMessage({ text: `${t("skillError")} (no write API found - host exposes: ${describeApis()})`, type: "error" });
      return;
    }

    const name = skillForm.name.trim();
    const identifier = (skillForm.identifier.trim() || deriveIdentifier(name));
    if (!name || !identifier) {
      setToastMessage({ text: t("skillMissing"), type: "error" });
      return;
    }

    // The catalogue may have no alternate key, so duplicates are caught here rather than
    // relying on the platform to reject them.
    if (skillCatalogue.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      setToastMessage({ text: `${t("skillDuplicate")} "${name}"`, type: "error" });
      return;
    }
    if (skillCatalogue.some((s) => s.identifier && s.identifier.toLowerCase() === identifier.toLowerCase())) {
      setToastMessage({ text: `${t("skillDuplicateId")} "${identifier}"`, type: "error" });
      return;
    }

    setIsSkillSubmitting(true);
    try {
      await writeApi.create(SKILL_CATALOGUE_TABLE, {
        cr8f7_skillname: name,
        cr8f7_skillidentifier: identifier,
      });
      setToastMessage({ text: `${t("skillSuccess")} "${name}"`, type: "success" });
      setSkillForm({ name: "", identifier: "" });
      setIdentifierTouched(false);
      setShowSkillForm(false);
      await fetchMatrixData();
    } catch (err: any) {
      setToastMessage({ text: `${t("skillError")} (via ${writeApi.createdVia}: ${err?.message || "Dataverse Fault"})`, type: "error" });
    } finally {
      setIsSkillSubmitting(false);
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

  const headerShell = (columnId: string, children: React.ReactNode) => {
    const width = widthFor(columnId) - CELL_PADDING_X;
    return (
      <div
        style={{ display: "flex", flexDirection: "column", gap: 6, width, maxWidth: width, minWidth: 0, boxSizing: "border-box" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    );
  };

  // TableCellLayout is deliberately not used: its internal slots apply their own
  // white-space and overflow rules, which is what kept the text from wrapping.
  const cellShell = (columnId: string, children: React.ReactNode, media?: React.ReactNode) => {
    const width = contentWidthFor(columnId);
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, width: "100%", minWidth: 0, boxSizing: "border-box" }}>
        {media ? <div style={{ flexShrink: 0, paddingTop: 1 }}>{media}</div> : null}
        <div style={{ width, maxWidth: width, minWidth: 0, boxSizing: "border-box", ...cellTextStyle }}>
          {children}
        </div>
      </div>
    );
  };

  const renderTextFilterHeader = (columnId: string, label: string) =>
    headerShell(columnId, (
      <>
        <Text weight="bold" style={cellTextStyle}>{label}</Text>
        <Input
          size="small"
          placeholder="Filter"
          value={columnFilters[columnId] || ""}
          onChange={(_, d) => setColumnFilter(columnId, d.value)}
        />
      </>
    ));

  const baseColumns = [
    createTableColumn({
      columnId: "employeename",
      renderHeaderCell: () => renderTextFilterHeader("employeename", t("employeename")),
      renderCell: (item: any) =>
        cellShell(
          "employeename",
          <Text size={300} style={{ ...cellTextStyle, color: "#005a9e", fontWeight: 600 }}>{item.cr8f7_employeename || ""}</Text>,
          <Avatar name={item.cr8f7_employeename} size={24} aria-hidden="true" />
        ),
    }),
    createTableColumn({
      columnId: "employeeid",
      renderHeaderCell: () => renderTextFilterHeader("employeeid", t("employeeid")),
      renderCell: (item: any) =>
        cellShell("employeeid", <Text size={300} style={cellTextStyle}>{item.cr8f7_employeeid1 || ""}</Text>),
    }),
    createTableColumn({
      columnId: "email",
      renderHeaderCell: () => renderTextFilterHeader("email", t("email")),
      renderCell: (item: any) =>
        cellShell("email", <Text size={300} style={cellTextStyle} title={item.cr8f7_emailaddress || ""}>{item.cr8f7_emailaddress || ""}</Text>),
    }),
    createTableColumn({
      columnId: "designation",
      renderHeaderCell: () => renderTextFilterHeader("designation", t("designation")),
      renderCell: (item: any) =>
        cellShell("designation", <Text size={300} style={cellTextStyle} title={item.cr8f7_jobtitle || ""}>{item.cr8f7_jobtitle || ""}</Text>),
    }),
  ];

  const skillColumns = uniqueSkills.map((skillName) => {
    const columnId = `skill_${skillName}`;
    return createTableColumn({
      columnId,
      renderHeaderCell: () =>
        headerShell(columnId, (
          <>
            <Text weight="bold" size={200} style={cellTextStyle} title={skillName}>{skillName}</Text>
            <Select
              size="small"
              value={columnFilters[columnId] || ""}
              onChange={(_, d) => setColumnFilter(columnId, d.value)}
            >
              <option value="">All</option>
              <option value="-">Not rated</option>
              {ratingOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </Select>
          </>
        )),
      renderCell: (item: any) => {
        const currentRating = item[skillName] || "-";
        const isRated = currentRating !== "-";
        return cellShell(
          columnId,
          <Text size={300} style={{ ...cellTextStyle, fontWeight: isRated ? 600 : 400, color: isRated ? "#323130" : "#a19f9d" }}>
            {currentRating}
          </Text>
        );
      },
    });
  });

  const actionColumn = [
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => headerShell("actions", <Text weight="bold" style={cellTextStyle}>{t("actions")}</Text>),
      renderCell: (item: any) =>
        cellShell("actions", deletingId === item.cr8f7_employeeid1 ? <Spinner size="tiny" /> : (
          <Button size="small" type="button" appearance="subtle" icon={<Delete16Regular />} style={{ color: "#a80000" }} onClick={(e) => handleDeleteEmployee(item, e)} />
        )),
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

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, borderBottom: "2px solid #f3f2f1", paddingBottom: "12px", gap: 12, flexWrap: "wrap" }}>
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
                <div style={cellTextStyle}><Text weight="semibold">ID: </Text>{selectedEmployee.cr8f7_employeeid1}</div>
                <div style={cellTextStyle}><Text weight="semibold">Email: </Text>{selectedEmployee.cr8f7_emailaddress}</div>
                <div style={cellTextStyle}><Text weight="semibold">Title: </Text>{selectedEmployee.cr8f7_jobtitle || "N/A"}</div>
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
                    <Text weight="medium" size={300} style={cellTextStyle} title={skill}>{skill}</Text>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "4px", flexWrap: "wrap" }}>
                      <Text size={200} style={{ color: "#605e5c" }}>Current: <Text weight="bold">{currentVal}</Text></Text>
                      <Select size="small" style={{ flexGrow: 1, minWidth: 90 }} value={detailSkillRatings[skill] ?? currentVal} onChange={(_, data) => setDetailSkillRatings(prev => ({ ...prev, [skill]: data.value }))}>
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button type="button" appearance={showSkillForm ? "primary" : "secondary"} icon={<Add16Regular />} onClick={() => setShowSkillForm(!showSkillForm)}>
            {showSkillForm ? t("hideSkillForm") : t("addSkill")}
          </Button>
          <Button type="button" appearance={showForm ? "secondary" : "primary"} icon={<Add16Regular />} onClick={() => setShowForm(!showForm)}>
            {showForm ? t("hideForm") : t("addEmployee")}
          </Button>
        </div>
      </div>

      {showSkillForm && (
        <div style={{ marginBottom: 24, padding: 20, backgroundColor: "#f6f9fc", borderRadius: 8, border: "1px solid #cfe3f5", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <Text size={400} weight="bold" style={{ display: "block", marginBottom: 4 }}>{t("addSkill")}</Text>
          <Text size={200} style={{ display: "block", marginBottom: 16, color: "#605e5c" }}>
            Added to the skill catalogue and appears as a new column straight away, unrated for every employee.
          </Text>
          <form onSubmit={handleCreateSkillSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
              <Field label="Skill Name" required>
                <Input
                  value={skillForm.name}
                  placeholder="e.g. Playwright"
                  onChange={(_, d) => setSkillForm((p) => ({
                    name: d.value,
                    identifier: identifierTouched ? p.identifier : deriveIdentifier(d.value),
                  }))}
                  required
                />
              </Field>
              <Field label="Skill Identifier" required hint="Auto-filled from the name. Edit if you use a different coding scheme.">
                <Input
                  value={skillForm.identifier}
                  placeholder="e.g. PLAYWRIGHT"
                  onChange={(_, d) => { setIdentifierTouched(true); setSkillForm((p) => ({ ...p, identifier: d.value })); }}
                  required
                />
              </Field>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button
                type="button"
                appearance="secondary"
                disabled={isSkillSubmitting}
                onClick={() => { setShowSkillForm(false); setSkillForm({ name: "", identifier: "" }); setIdentifierTouched(false); }}
              >
                Cancel
              </Button>
              <Button type="submit" appearance="primary" disabled={isSkillSubmitting || !skillForm.name.trim()}>
                {isSkillSubmitting ? <Spinner size="tiny" label="Adding..." /> : t("addSkill")}
              </Button>
            </div>
          </form>
        </div>
      )}

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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10, maxHeight: "40vh", overflowY: "auto", paddingRight: 4 }}>
                  {uniqueSkills.map(skill => (
                    <div key={skill} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px", backgroundColor: "#ffffff", borderRadius: 4, border: "1px solid #f3f2f1" }}>
                      <Text size={200} style={{ ...cellTextStyle, flex: 1 }} title={skill}>{skill}</Text>
                      <Select size="small" style={{ minWidth: "72px", flexShrink: 0 }} value={formSkillRatings[skill] || "-"} onChange={(_, d) => setFormSkillRatings(p => ({ ...p, [skill]: d.value }))}>
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
          <div ref={gridWrapperRef} style={{ overflowX: "auto", overflowY: "auto", maxHeight: "62vh", border: "1px solid #e0e0e0", borderRadius: "8px", backgroundColor: "#ffffff" }}>
            <DataGrid
              items={pagedEmployees}
              columns={allColumns}
              itemsPerGridRow={1}
              focusMode="row"
              resizableColumns
              columnSizingOptions={columnSizingOptions}
              style={{ minWidth: gridMinWidth }}
            >
              <DataGridHeader style={{ backgroundColor: "#faf9f8", position: "sticky", top: 0, zIndex: 2 }}>
                <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell style={headerCellOuterStyle}>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
              </DataGridHeader>
              <DataGridBody>
                {({ item, rowId }) => (
                  <DataGridRow key={rowId} style={{ borderBottom: "1px solid #f3f2f1", cursor: "pointer" }} onClick={() => { setSelectedEmployee(item); setDetailSkillRatings({}); setViewMode("details"); }}>
                    {({ renderCell }) => <DataGridCell style={dataCellStyle}>{renderCell(item)}</DataGridCell>}
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
