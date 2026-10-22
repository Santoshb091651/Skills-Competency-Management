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
  CardHeader,
  Checkbox,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions
} from "@fluentui/react-components";
// Only icons already proven to resolve in this host are imported. The icon set is served as
// a bundled module and does not expose every glyph at every size, so a name that exists in
// the published package can still fail to link here (ColumnTriple16Regular did).
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
    manager: "Manager",
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
    searchPlaceholder: "Search by employee ID, name, email, designation or manager",
    clearFilters: "Clear filters",
    rowsPerPage: "Rows per page",
    previous: "Previous",
    next: "Next",
    addSkill: "Add Skill",
    hideSkillForm: "Hide Skill Panel",
    skillSuccess: "Skill added to the catalogue:",
    skillError: "Failed to add the new skill.",
    skillMissing: "A skill name and a whole-number identifier are required.",
    skillDuplicate: "A skill already exists with the name",
    skillDuplicateId: "A skill already exists with the identifier",
    skillDeleteSuccess: "Skill removed from the catalogue:",
    skillDeleteError: "Failed to delete the skill.",
    deleteSkillTitle: "Delete skill",
    deleteEmployeeTitle: "Delete employee",
    cancel: "Cancel",
    confirmDelete: "Delete",
    columns: "Columns",
    hideColumnsPanel: "Hide Column Panel",
    showAllColumns: "Show all",
    hideAllSkills: "Hide all skills",
    showAllSkills: "Show all skills"
  },
};

const ratingOptions = ["0", "1", "2", "3", "4", "5"];
const pageSizeOptions = [5, 10, 25, 50, 100];

const EMPLOYEE_TABLE = "cr8f7_employee";
const SKILL_TABLE = "cr8f7_employeeskill";
const SKILL_CATALOGUE_TABLE = "cr8f7_skill";
const EMPLOYEE_PK = "cr8f7_employeeid";
const SKILL_CATALOGUE_PK = "cr8f7_skillid";

// cr8f7_skillidentifier is a Whole Number column (Edm.Int32), not text. Posting a string
// into it fails with "Cannot convert the literal ... to the expected type 'Edm.Int32'".

// Single-hue ramp so the rating reads as an intensity rather than a pass/fail judgement.
// 0 and 1 are too pale to carry white text, so the foreground flips only from 4 upwards;
// every pair below is at least 4.5:1.
const RATING_PALETTE: Record<string, { bg: string; fg: string; border: string }> = {
  "0": { bg: "#f0f7f2", fg: "#3b5a46", border: "#cfe0d5" },
  "1": { bg: "#d9ecdf", fg: "#20492f", border: "#bcdcc6" },
  "2": { bg: "#b3dcc1", fg: "#17422a", border: "#99cfab" },
  "3": { bg: "#82c79b", fg: "#103c23", border: "#6bb888" },
  "4": { bg: "#1f7a46", fg: "#ffffff", border: "#1f7a46" },
  "5": { bg: "#0f5c33", fg: "#ffffff", border: "#0f5c33" },
};

const ratingBadgeStyle = (rating: string): React.CSSProperties => {
  const tone = RATING_PALETTE[rating];
  if (!tone) {
    return { display: "inline-block", padding: "2px 6px", color: "#a19f9d", fontWeight: 400, fontSize: 13, lineHeight: "18px" };
  }
  return {
    display: "inline-block",
    minWidth: 24,
    padding: "2px 9px",
    borderRadius: 10,
    textAlign: "center",
    fontWeight: 600,
    fontSize: 13,
    lineHeight: "18px",
    backgroundColor: tone.bg,
    color: tone.fg,
    border: `1px solid ${tone.border}`,
    boxSizing: "border-box",
  };
};

// Hosts wrap Dataverse faults differently and err.message is often just "Request failed".
// The privilege name or the offending column sits further down, so dig through the shapes
// seen in practice before falling back to serialising the whole object.
const describeError = (err: any): string => {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;

  const parts: string[] = [];
  const add = (value: any) => {
    if (typeof value === "string" && value.trim() && !parts.includes(value)) parts.push(value.trim());
  };

  add(err.message);
  add(err?.error?.message);
  add(err?.response?.data?.error?.message);
  add(err?.data?.error?.message);
  add(err?.raw);
  if (err.code !== undefined && err.code !== null) add(`code=${err.code}`);
  if (err.errorCode !== undefined && err.errorCode !== null) add(`errorCode=${err.errorCode}`);
  if (err.status !== undefined && err.status !== null) add(`status=${err.status}`);

  if (parts.length === 0) {
    try {
      return JSON.stringify(err, Object.getOwnPropertyNames(err)).slice(0, 500);
    } catch {
      return String(err);
    }
  }
  return parts.join(" | ");
};

// Column id -> the Dataverse column its text filter reads.
const BASE_FIELD_BY_COLUMN: Record<string, string> = {
  employeename: "cr8f7_employeename",
  employeeid: "cr8f7_employeeid1",
  email: "cr8f7_emailaddress",
  designation: "cr8f7_jobtitle",
  manager: "cr8f7_managername",
};

// Left-to-right order of the non-skill columns. Skills sit between these and actions.
const BASE_COLUMN_ORDER = ["employeename", "employeeid", "email", "designation", "manager"];
const EMPLOYEE_SELECT = [EMPLOYEE_PK, ...BASE_COLUMN_ORDER.map((id) => BASE_FIELD_BY_COLUMN[id])];

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
  manager: { min: 150, max: 260, chrome: 28, flexible: true },
  actions: { min: 80, max: 80, chrome: 0, flexible: false },
};
// chrome leaves room for the header's delete button alongside the skill name.
const SKILL_SIZING: ColumnSizing = { min: 124, max: 210, chrome: 52, flexible: false };
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

// id is null when the catalogue had to be read without its primary key, which is the one
// case where a skill is listed but cannot be deleted.
type CatalogueSkill = { name: string; identifier: number | null; id: string | null };

// Both deletes go through one dialog, so the copy differs but the mechanism does not.
type PendingDelete =
  | { kind: "employee"; id: string; label: string; rowKey: string }
  | { kind: "skill"; id: string | null; label: string; ratedCount: number };

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
  const [skillCatalogue, setSkillCatalogue] = React.useState<CatalogueSkill[]>([]);
  const [catalogueWarning, setCatalogueWarning] = React.useState<string | null>(null);
  const [orphanSkills, setOrphanSkills] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [toastMessage, setToastMessage] = React.useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<PendingDelete | null>(null);
  const [isDeleting, setIsDeleting] = React.useState<boolean>(false);
  const [showForm, setShowForm] = React.useState<boolean>(false);
  const [isFormSubmitting, setIsFormSubmitting] = React.useState<boolean>(false);
  const [formFields, setFormFields] = React.useState({ empName: "", empId: "", empEmail: "", empTitle: "", empManager: "" });
  const [formSkillRatings, setFormSkillRatings] = React.useState<Record<string, string>>({});

  // Add-a-skill panel
  const [showSkillForm, setShowSkillForm] = React.useState<boolean>(false);
  const [isSkillSubmitting, setIsSkillSubmitting] = React.useState<boolean>(false);
  const [skillForm, setSkillForm] = React.useState({ name: "", identifier: "" });
  const [diagnostics, setDiagnostics] = React.useState<string | null>(null);
  const [isDiagnosing, setIsDiagnosing] = React.useState<boolean>(false);

  // Tracks hidden rather than visible columns so a newly added skill shows up by default
  // instead of needing to be ticked on.
  const [hiddenColumns, setHiddenColumns] = React.useState<Record<string, boolean>>({});
  const [showColumnPanel, setShowColumnPanel] = React.useState<boolean>(false);

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
        const empResult = await api.queryTable(EMPLOYEE_TABLE, { select: EMPLOYEE_SELECT, pageSize: 5000 });
        employeeRecords = empResult?.rows || empResult?.entities || [];
      } else {
        const empResult = await api.retrieveMultipleRecords(EMPLOYEE_TABLE, `?$select=${EMPLOYEE_SELECT.join(",")}`);
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
      const readCatalogue = async (withKey: boolean): Promise<any[]> => {
        const select = withKey
          ? [SKILL_CATALOGUE_PK, "cr8f7_skillname", "cr8f7_skillidentifier"]
          : ["cr8f7_skillname", "cr8f7_skillidentifier"];
        if (typeof api.queryTable === "function") {
          const result = await api.queryTable(SKILL_CATALOGUE_TABLE, { select, pageSize: 5000 });
          return result?.rows || result?.entities || [];
        }
        const result = await api.retrieveMultipleRecords(SKILL_CATALOGUE_TABLE, `?$select=${select.join(",")}`);
        return result?.entities || [];
      };

      // Deleting needs the row GUID, but a wrong primary key name fails the whole read and
      // would cost us the columns, so drop back to the name-only read rather than lose them.
      let catalogueRecords: any[] = [];
      setCatalogueWarning(null);
      try {
        catalogueRecords = await readCatalogue(true);
      } catch (keyError: any) {
        try {
          catalogueRecords = await readCatalogue(false);
          setCatalogueWarning(`The skill catalogue loaded without its primary key (${SKILL_CATALOGUE_PK}), so deleting a skill is unavailable: ${describeError(keyError)}`);
        } catch (catalogueError: any) {
          // Previously swallowed. If the catalogue cannot be read, the same table name and
          // privileges are about to fail the write too, so say so instead of hiding it.
          catalogueRecords = [];
          setCatalogueWarning(`Could not read the skill catalogue (${SKILL_CATALOGUE_TABLE}): ${describeError(catalogueError)} Columns are falling back to skills found on existing rating rows, and adding a new skill will fail for the same reason.`);
        }
      }

      setSkillCatalogue(
        catalogueRecords
          .map((r: any) => {
            const raw = r.cr8f7_skillidentifier;
            const parsed = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
            return {
              name: String(r.cr8f7_skillname ?? "").trim(),
              identifier: Number.isFinite(parsed) ? parsed : null,
              id: r[SKILL_CATALOGUE_PK] ?? r.id ?? r.rowId ?? null,
            };
          })
          .filter((s) => s.name)
      );

      // Keyed on lower case so "Java" in the catalogue and "java" on a rating row are not
      // treated as two different skills.
      const catalogueNames = new Map<string, string>();
      catalogueRecords.forEach((r: any) => {
        const name = String(r.cr8f7_skillname ?? "").trim();
        if (name) catalogueNames.set(name.toLowerCase(), name);
      });
      const ratedNames = new Map<string, string>();
      skillRecords.forEach((s: any) => {
        const name = String(s.cr8f7_skillname ?? "").trim();
        if (name) ratedNames.set(name.toLowerCase(), name);
      });

      // The catalogue is the source of truth for which columns exist. Merging in skills seen
      // only on rating rows would resurrect a column the moment a skill is deleted, so those
      // are reported separately instead and used only when the catalogue is unusable.
      let columnNames = catalogueNames;
      if (catalogueNames.size > 0) {
        const orphans: string[] = [];
        ratedNames.forEach((name, key) => { if (!catalogueNames.has(key)) orphans.push(name); });
        setOrphanSkills(orphans.sort((a, b) => a.localeCompare(b)));
      } else {
        columnNames = ratedNames;
        setOrphanSkills([]);
      }
      const dynamicSkillsArray = Array.from(columnNames.values()).sort((a, b) => a.localeCompare(b));

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
        const haystack = [emp.cr8f7_employeeid1, emp.cr8f7_employeename, emp.cr8f7_emailaddress, emp.cr8f7_jobtitle, emp.cr8f7_managername]
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

  const orderedColumnIds = React.useMemo(
    () => [...BASE_COLUMN_ORDER, ...uniqueSkills.map((s) => `skill_${s}`), "actions"],
    [uniqueSkills]
  );

  const visibleColumnIds = React.useMemo(
    () => orderedColumnIds.filter((id) => !hiddenColumns[id]),
    [orderedColumnIds, hiddenColumns]
  );

  const hiddenCount = orderedColumnIds.length - visibleColumnIds.length;

  // Hiding a column drops its filter too: leaving it active would keep filtering rows by a
  // column that is no longer on screen, with no way to see or clear it.
  const dropFilters = (columnIds: string[]) =>
    setColumnFilters((prev) => {
      const stale = columnIds.filter((id) => prev[id]);
      if (stale.length === 0) return prev;
      const next = { ...prev };
      stale.forEach((id) => delete next[id]);
      return next;
    });

  const toggleColumn = (columnId: string) => {
    const willHide = !hiddenColumns[columnId];
    setHiddenColumns((prev) => {
      const next = { ...prev };
      if (willHide) next[columnId] = true;
      else delete next[columnId];
      return next;
    });
    if (willHide) dropFilters([columnId]);
  };

  const setSkillColumnsHidden = (hidden: boolean) => {
    const skillColumnIds = uniqueSkills.map((skill) => `skill_${skill}`);
    setHiddenColumns((prev) => {
      const next = { ...prev };
      skillColumnIds.forEach((id) => {
        if (hidden) next[id] = true;
        else delete next[id];
      });
      return next;
    });
    if (hidden) dropFilters(skillColumnIds);
  };

  const catalogueByName = React.useMemo(() => {
    const map = new Map<string, CatalogueSkill>();
    skillCatalogue.forEach((s) => map.set(s.name.toLowerCase(), s));
    return map;
  }, [skillCatalogue]);

  // Identifier is a number, so the sensible default is one past the highest in use.
  const nextSkillIdentifier = React.useMemo(() => {
    const used = skillCatalogue
      .map((s) => s.identifier)
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    return used.length > 0 ? Math.max(...used) + 1 : 1;
  }, [skillCatalogue]);

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
      manager: t("manager"),
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
    // instead of leaving a dead gap down the right-hand side. Only visible columns count,
    // or hiding a column would leave its width reserved as empty space.
    const total = visibleColumnIds.reduce((sum, id) => sum + (fitted[id] ?? 0), 0);
    const slack = availableWidth - total - 2;
    if (slack > 0) {
      const flexible = visibleColumnIds.filter((id) => BASE_COLUMN_SIZING[id]?.flexible);
      if (flexible.length > 0) {
        const share = Math.floor(slack / flexible.length);
        flexible.forEach((id) => { fitted[id] += share; });
      }
    }

    return fitted;
  }, [employees, uniqueSkills, availableWidth, measureText, t, visibleColumnIds]);

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
    visibleColumnIds.forEach((columnId) => {
      const width = columnWidths[columnId];
      if (width) options[columnId] = { minWidth: width, defaultWidth: width, idealWidth: width };
    });
    return options;
  }, [columnWidths, visibleColumnIds]);

  // Forces the table wider than its wrapper once the fitted columns exceed the viewport,
  // which is what actually makes the wrapper's horizontal scrollbar appear.
  const gridMinWidth = React.useMemo(
    () => visibleColumnIds.reduce((sum, id) => sum + (columnWidths[id] ?? 0), 0),
    [columnWidths, visibleColumnIds]
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
        const reason = describeError((failures[0] as any).reason);
        setToastMessage({ text: `${t("saveError")} ${failures.length} of ${pending.length} failed via ${writeApi.createdVia}: ${reason}`, type: "error" });
        await fetchMatrixData();
        return;
      }

      setToastMessage({ text: t("saveSuccess"), type: "success" });
      await fetchMatrixData();
      setViewMode("list");
    } catch (err: any) {
      setToastMessage({ text: `${t("saveError")} (${describeError(err)})`, type: "error" });
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
        cr8f7_jobtitle: formFields.empTitle,
        cr8f7_managername: formFields.empManager
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
        const reason = describeError((failures[0] as any).reason);
        setToastMessage({ text: `Employee created, but ${failures.length} of ${pending.length} ratings failed: ${reason}`, type: "error" });
        await fetchMatrixData();
        return;
      }

      setToastMessage({ text: t("createSuccess"), type: "success" });
      setShowForm(false);
      setFormFields({ empName: "", empId: "", empEmail: "", empTitle: "", empManager: "" });
      setFormSkillRatings({});
      await fetchMatrixData();
    } catch (err: any) {
      setToastMessage({ text: `${t("createError")} (via ${writeApi.createdVia}: ${describeError(err)})`, type: "error" });
    } finally {
      setIsFormSubmitting(false);
    }
  };

  // Probes the catalogue table without naming any columns, then with the exact columns this
  // page uses. Reading with no select proves whether the table name is right and reports the
  // real column logical names; the second read isolates a wrong column name, which Dataverse
  // rejects on read as well as on write.
  const runSkillDiagnostics = async () => {
    setIsDiagnosing(true);
    const api = dataApi || context?.webApi;
    const lines: string[] = [];

    const writeApi = resolveWriteApi();
    lines.push(`Write method: ${writeApi ? writeApi.createdVia : "NONE FOUND"}`);
    lines.push(`Host API surface: ${describeApis()}`);
    lines.push("");

    if (!api) {
      lines.push("No read API available on this host.");
      setDiagnostics(lines.join("\n"));
      setIsDiagnosing(false);
      return;
    }

    try {
      let rows: any[] = [];
      if (typeof api.queryTable === "function") {
        const result = await api.queryTable(SKILL_CATALOGUE_TABLE, { pageSize: 1 });
        rows = result?.rows || result?.entities || [];
      } else {
        const result = await api.retrieveMultipleRecords(SKILL_CATALOGUE_TABLE, "?$top=1");
        rows = result?.entities || [];
      }
      lines.push(`Table "${SKILL_CATALOGUE_TABLE}" readable: YES (${rows.length} row returned)`);
      if (rows.length > 0) {
        lines.push("Actual columns present on the first row:");
        lines.push("  " + Object.keys(rows[0]).sort().join(", "));
      } else {
        lines.push("Table returned no rows, so column names cannot be read from data.");
      }
    } catch (err: any) {
      lines.push(`Table "${SKILL_CATALOGUE_TABLE}" readable: NO`);
      lines.push(`  ${describeError(err)}`);
    }

    lines.push("");
    try {
      if (typeof api.queryTable === "function") {
        await api.queryTable(SKILL_CATALOGUE_TABLE, { select: ["cr8f7_skillname", "cr8f7_skillidentifier"], pageSize: 1 });
      } else {
        await api.retrieveMultipleRecords(SKILL_CATALOGUE_TABLE, "?$select=cr8f7_skillname,cr8f7_skillidentifier&$top=1");
      }
      lines.push("Columns cr8f7_skillname + cr8f7_skillidentifier: ACCEPTED");
    } catch (err: any) {
      lines.push("Columns cr8f7_skillname + cr8f7_skillidentifier: REJECTED");
      lines.push(`  ${describeError(err)}`);
    }

    setDiagnostics(lines.join("\n"));
    setIsDiagnosing(false);
  };

  const handleCreateSkillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const writeApi = resolveWriteApi();
    if (!writeApi) {
      setToastMessage({ text: `${t("skillError")} (no write API found - host exposes: ${describeApis()})`, type: "error" });
      return;
    }

    const name = skillForm.name.trim();
    const identifier = Number.parseInt(skillForm.identifier.trim(), 10);
    if (!name || !Number.isInteger(identifier)) {
      setToastMessage({ text: t("skillMissing"), type: "error" });
      return;
    }

    // The catalogue may have no alternate key, so duplicates are caught here rather than
    // relying on the platform to reject them.
    if (skillCatalogue.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      setToastMessage({ text: `${t("skillDuplicate")} "${name}"`, type: "error" });
      return;
    }
    if (skillCatalogue.some((s) => s.identifier === identifier)) {
      setToastMessage({ text: `${t("skillDuplicateId")} ${identifier}`, type: "error" });
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
      setShowSkillForm(false);
      await fetchMatrixData();
    } catch (err: any) {
      setToastMessage({ text: `${t("skillError")} (via ${writeApi.createdVia}: ${describeError(err)})`, type: "error" });
    } finally {
      setIsSkillSubmitting(false);
    }
  };

  // window.confirm is not used: a sandboxed host iframe without allow-modals makes it
  // return false without ever showing a prompt, so the delete would silently do nothing.
  const requestDeleteEmployee = (employeeRecord: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetGuid = employeeRecord[EMPLOYEE_PK] || employeeRecord.id || employeeRecord.rowId;
    if (!targetGuid) {
      setToastMessage({ text: `Missing unique identifier Guid. Row keys: ${Object.keys(employeeRecord).join(", ")}`, type: "error" });
      return;
    }
    setPendingDelete({
      kind: "employee",
      id: targetGuid,
      label: employeeRecord.cr8f7_employeename || employeeRecord.cr8f7_employeeid1 || "this employee",
      rowKey: employeeRecord.cr8f7_employeeid1,
    });
  };

  const requestDeleteSkill = (skillName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const entry = catalogueByName.get(skillName.toLowerCase());
    setPendingDelete({
      kind: "skill",
      id: entry?.id ?? null,
      label: skillName,
      ratedCount: employees.filter((emp) => String(emp[skillName] ?? "-") !== "-").length,
    });
  };

  const confirmPendingDelete = async () => {
    if (!pendingDelete) return;
    const isEmployee = pendingDelete.kind === "employee";
    const failPrefix = isEmployee ? t("deleteError") : t("skillDeleteError");

    const writeApi = resolveWriteApi();
    if (!writeApi) {
      setToastMessage({ text: `${failPrefix} (no write API found - host exposes: ${describeApis()})`, type: "error" });
      setPendingDelete(null);
      return;
    }
    if (!pendingDelete.id) {
      setToastMessage({ text: `${failPrefix} The row GUID is missing, so there is nothing to delete against.`, type: "error" });
      setPendingDelete(null);
      return;
    }

    setIsDeleting(true);
    if (pendingDelete.kind === "employee") setDeletingId(pendingDelete.rowKey);
    try {
      await writeApi.remove(isEmployee ? EMPLOYEE_TABLE : SKILL_CATALOGUE_TABLE, pendingDelete.id);
      if (isEmployee) {
        setToastMessage({ text: t("deleteSuccess"), type: "success" });
      } else {
        // A filter left on the removed column would keep filtering rows on a skill that is
        // no longer there, so it goes with it.
        const removedColumnId = `skill_${pendingDelete.label}`;
        setColumnFilters((prev) => {
          if (!(removedColumnId in prev)) return prev;
          const next = { ...prev };
          delete next[removedColumnId];
          return next;
        });
        setToastMessage({ text: `${t("skillDeleteSuccess")} "${pendingDelete.label}"`, type: "success" });
      }
      await fetchMatrixData();
    } catch (err: any) {
      setToastMessage({ text: `${failPrefix} (via ${writeApi.createdVia}: ${describeError(err)})`, type: "error" });
    } finally {
      // Closed on failure as well: the toast renders behind the modal, so leaving the
      // dialog open would hide the reason the delete did not work.
      setIsDeleting(false);
      setDeletingId(null);
      setPendingDelete(null);
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
    createTableColumn({
      columnId: "manager",
      renderHeaderCell: () => renderTextFilterHeader("manager", t("manager")),
      renderCell: (item: any) =>
        cellShell("manager", <Text size={300} style={cellTextStyle} title={item.cr8f7_managername || ""}>{item.cr8f7_managername || ""}</Text>),
    }),
  ];

  const skillColumns = uniqueSkills.map((skillName) => {
    const columnId = `skill_${skillName}`;
    // Only a catalogue row can be deleted. A skill that exists purely on rating rows has
    // nothing to delete, so it gets no button rather than a button that always fails.
    const isDeletable = Boolean(catalogueByName.get(skillName.toLowerCase())?.id);
    return createTableColumn({
      columnId,
      renderHeaderCell: () =>
        headerShell(columnId, (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 2, width: "100%", minWidth: 0 }}>
              <Text weight="bold" size={200} style={{ ...cellTextStyle, flex: 1, minWidth: 0 }} title={skillName}>{skillName}</Text>
              {isDeletable && (
                <Button
                  size="small"
                  type="button"
                  appearance="subtle"
                  icon={<Delete16Regular />}
                  title={`${t("deleteSkillTitle")}: ${skillName}`}
                  aria-label={`${t("deleteSkillTitle")}: ${skillName}`}
                  style={{ minWidth: 22, width: 22, height: 22, padding: 0, flexShrink: 0, color: "#a80000" }}
                  onClick={(e) => requestDeleteSkill(skillName, e)}
                />
              )}
            </div>
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
        const currentRating = String(item[skillName] ?? "-") || "-";
        return cellShell(
          columnId,
          <span style={ratingBadgeStyle(currentRating)} title={`${skillName}: ${currentRating}`}>{currentRating}</span>
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
          <Button size="small" type="button" appearance="subtle" icon={<Delete16Regular />} style={{ color: "#a80000" }} onClick={(e) => requestDeleteEmployee(item, e)} />
        )),
    })
  ];

  const allColumns = [...baseColumns, ...skillColumns, ...actionColumn];

  // DataGrid cannot render with an empty column set, so the last visible column is pinned
  // on. The panel also disables its checkbox, this is the backstop.
  const keptColumns = allColumns.filter((column) => !hiddenColumns[column.columnId as string]);
  const shownColumns = keptColumns.length > 0 ? keptColumns : allColumns.slice(0, 1);

  const renderDeleteDialog = () => (
    <Dialog
      open={pendingDelete !== null}
      modalType="alert"
      onOpenChange={(_, data) => { if (!data.open && !isDeleting) setPendingDelete(null); }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>
            {pendingDelete?.kind === "skill" ? t("deleteSkillTitle") : t("deleteEmployeeTitle")}
          </DialogTitle>
          <DialogContent>
            {pendingDelete?.kind === "skill" ? (
              <>
                <Text block>
                  Delete <Text weight="semibold">{pendingDelete.label}</Text> from the skill catalogue? Its column is removed from the dashboard.
                </Text>
                <Text block size={200} style={{ marginTop: 12, color: "#605e5c" }}>
                  {pendingDelete.ratedCount > 0
                    ? `${pendingDelete.ratedCount} ${pendingDelete.ratedCount === 1 ? "employee has" : "employees have"} a rating for this skill. Those rating records are kept, so adding the skill back restores the column with its ratings intact.`
                    : "No employee has been rated on this skill, so nothing else is affected."}
                </Text>
              </>
            ) : (
              <>
                <Text block>
                  Permanently delete <Text weight="semibold">{pendingDelete?.label}</Text>?
                </Text>
                <Text block size={200} style={{ marginTop: 12, color: "#605e5c" }}>
                  This removes the employee record. It cannot be undone.
                </Text>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button type="button" appearance="secondary" disabled={isDeleting} onClick={() => setPendingDelete(null)}>
              {t("cancel")}
            </Button>
            <Button type="button" appearance="primary" disabled={isDeleting} onClick={confirmPendingDelete} style={{ backgroundColor: isDeleting ? undefined : "#a80000" }}>
              {isDeleting ? <Spinner size="tiny" label="Deleting..." /> : t("confirmDelete")}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );

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
                <div style={cellTextStyle}><Text weight="semibold">Manager: </Text>{selectedEmployee.cr8f7_managername || "N/A"}</div>
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
                      <Text size={200} style={{ color: "#605e5c" }}>Current:</Text>
                      <span style={ratingBadgeStyle(String(currentVal))}>{currentVal}</span>
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
      {renderDeleteDialog()}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "2px solid #f3f2f1", paddingBottom: "12px", gap: 12, flexWrap: "wrap" }}>
        <Text size={600} weight="bold" style={{ color: "#323130" }}>{t("employeesTitle")}</Text>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button
            type="button"
            appearance={showColumnPanel ? "primary" : "secondary"}
            onClick={() => setShowColumnPanel(!showColumnPanel)}
          >
            {showColumnPanel ? t("hideColumnsPanel") : `${t("columns")}${hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ""}`}
          </Button>
          <Button
            type="button"
            appearance={showSkillForm ? "primary" : "secondary"}
            icon={<Add16Regular />}
            onClick={() => {
              const opening = !showSkillForm;
              setShowSkillForm(opening);
              if (opening) setSkillForm({ name: "", identifier: String(nextSkillIdentifier) });
            }}
          >
            {showSkillForm ? t("hideSkillForm") : t("addSkill")}
          </Button>
          <Button type="button" appearance={showForm ? "secondary" : "primary"} icon={<Add16Regular />} onClick={() => setShowForm(!showForm)}>
            {showForm ? t("hideForm") : t("addEmployee")}
          </Button>
        </div>
      </div>

      {catalogueWarning && (
        <div style={{ marginBottom: 16, padding: "10px 16px", borderRadius: 4, backgroundColor: "#fff4ce", border: "1px solid #f2d783", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <Text size={200} style={{ color: "#6b5900", wordBreak: "break-word" }}>{catalogueWarning}</Text>
          <Button size="small" type="button" appearance="subtle" onClick={() => setCatalogueWarning(null)}>✕</Button>
        </div>
      )}

      {orphanSkills.length > 0 && (
        <div style={{ marginBottom: 16, padding: "10px 16px", borderRadius: 4, backgroundColor: "#eff6fc", border: "1px solid #c7e0f4", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <Text size={200} style={{ color: "#204d78", wordBreak: "break-word" }}>
            {orphanSkills.length} {orphanSkills.length === 1 ? "skill has" : "skills have"} ratings recorded but no row in the skill catalogue, so {orphanSkills.length === 1 ? "it has" : "they have"} no column: {orphanSkills.join(", ")}. Add {orphanSkills.length === 1 ? "it" : "them"} with Add Skill to bring the {orphanSkills.length === 1 ? "column" : "columns"} back.
          </Text>
          <Button size="small" type="button" appearance="subtle" onClick={() => setOrphanSkills([])}>✕</Button>
        </div>
      )}

      {showColumnPanel && (
        <div style={{ marginBottom: 24, padding: 20, backgroundColor: "#faf9f8", borderRadius: 8, border: "1px solid #e0e0e0", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
            <Text size={400} weight="bold">{t("columns")}</Text>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button size="small" type="button" appearance="subtle" onClick={() => setHiddenColumns({})} disabled={hiddenCount === 0}>
                {t("showAllColumns")}
              </Button>
              <Button size="small" type="button" appearance="subtle" onClick={() => setSkillColumnsHidden(true)} disabled={uniqueSkills.length === 0}>
                {t("hideAllSkills")}
              </Button>
              <Button size="small" type="button" appearance="subtle" onClick={() => setSkillColumnsHidden(false)} disabled={uniqueSkills.length === 0}>
                {t("showAllSkills")}
              </Button>
            </div>
          </div>
          <Text size={200} style={{ display: "block", marginBottom: 16, color: "#605e5c" }}>
            Unticking a column hides it from the grid and clears any filter set on it. Nothing is deleted, and the choice applies to this session only.
          </Text>

          <Text size={300} weight="semibold" style={{ display: "block", marginBottom: 8, color: "#605e5c" }}>Employee details</Text>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, marginBottom: 16 }}>
            {[...BASE_COLUMN_ORDER, "actions"].map((columnId) => {
              const isVisible = !hiddenColumns[columnId];
              return (
                <Checkbox
                  key={columnId}
                  label={t(columnId)}
                  checked={isVisible}
                  disabled={isVisible && visibleColumnIds.length === 1}
                  onChange={() => toggleColumn(columnId)}
                />
              );
            })}
          </div>

          {uniqueSkills.length > 0 && (
            <>
              <Text size={300} weight="semibold" style={{ display: "block", marginBottom: 8, color: "#605e5c" }}>
                Skills ({uniqueSkills.length})
              </Text>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, maxHeight: "32vh", overflowY: "auto", paddingRight: 4 }}>
                {uniqueSkills.map((skill) => {
                  const columnId = `skill_${skill}`;
                  const isVisible = !hiddenColumns[columnId];
                  return (
                    <Checkbox
                      key={columnId}
                      label={skill}
                      checked={isVisible}
                      disabled={isVisible && visibleColumnIds.length === 1}
                      onChange={() => toggleColumn(columnId)}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

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
                  onChange={(_, d) => setSkillForm((p) => ({ ...p, name: d.value }))}
                  required
                />
              </Field>
              <Field label="Skill Identifier" required hint="Whole number. Prefilled with the next free value in the catalogue.">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={skillForm.identifier}
                  placeholder={String(nextSkillIdentifier)}
                  onChange={(_, d) => setSkillForm((p) => ({ ...p, identifier: d.value }))}
                  required
                />
              </Field>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <Button type="button" appearance="subtle" disabled={isDiagnosing} onClick={runSkillDiagnostics} style={{ marginRight: "auto" }}>
                {isDiagnosing ? <Spinner size="tiny" label="Checking..." /> : "Diagnose skill table"}
              </Button>
              <Button
                type="button"
                appearance="secondary"
                disabled={isSkillSubmitting}
                onClick={() => { setShowSkillForm(false); setSkillForm({ name: "", identifier: "" }); }}
              >
                Cancel
              </Button>
              <Button type="submit" appearance="primary" disabled={isSkillSubmitting || !skillForm.name.trim()}>
                {isSkillSubmitting ? <Spinner size="tiny" label="Adding..." /> : t("addSkill")}
              </Button>
            </div>
          </form>

          {diagnostics && (
            <pre
              style={{
                marginTop: 16, marginBottom: 0, padding: 12, backgroundColor: "#ffffff",
                border: "1px solid #e0e0e0", borderRadius: 4, fontSize: 12,
                fontFamily: "Consolas, 'Courier New', monospace", whiteSpace: "pre-wrap",
                wordBreak: "break-word", maxHeight: "30vh", overflowY: "auto", color: "#323130",
              }}
            >
              {diagnostics}
            </pre>
          )}
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
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <Text size={200} style={{ color: "#605e5c" }}>Rating</Text>
          {ratingOptions.map((opt) => (
            <span key={opt} style={{ ...ratingBadgeStyle(opt), minWidth: 22, padding: "1px 7px", fontSize: 12 }}>{opt}</span>
          ))}
        </div>
        <Text size={200} style={{ color: "#605e5c" }}>
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
              <Field label="Manager"><Input value={formFields.empManager} onChange={(_, d) => setFormFields(p => ({ ...p, empManager: d.value }))} /></Field>
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
              columns={shownColumns}
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
