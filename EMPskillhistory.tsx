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
  Input
} from "@fluentui/react-components";
import { Dismiss16Regular, ChevronLeft16Regular, ChevronRight16Regular, ArrowClockwise16Regular } from "@fluentui/react-icons";

const langMap: Record<number, { code: string; name: string; isRtl: boolean }> = {
  1033: { code: "en-US", name: "English (United States)", isRtl: false },
};

const translations: Record<string, Record<string, string>> = {
  "en-US": {
    historyTitle: "Employee Skill Rating History",
    employee: "Employee",
    employeeid: "Employee ID",
    skillname: "Skill",
    rating: "Rating",
    change: "Change",
    lastupdated: "Last Updated",
    loading: "Loading rating history...",
    noData: "No rating history found.",
    noMatch: "No records match the current search or filters.",
    error: "Error loading rating history.",
    searchPlaceholder: "Search by employee ID, employee name or skill",
    clearFilters: "Clear filters",
    rowsPerPage: "Rows per page",
    previous: "Previous",
    next: "Next",
    refresh: "Refresh",
    newest: "Newest first",
    oldest: "Oldest first",
    from: "From",
    to: "To"
  },
};

const ratingOptions = ["0", "1", "2", "3", "4", "5"];
const pageSizeOptions = [10, 25, 50, 100, 250];
const changeOptions = ["New", "Increased", "Decreased", "Unchanged"];

const EMPLOYEE_TABLE = "cr8f7_employee";
const SKILL_TABLE = "cr8f7_employeeskill";
const SKILL_PK = "cr8f7_employeeskillid";

// The page host gives the component a fixed-height box and clips the overflow, so the
// root of the view owns its own scrolling.
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

const changeColours: Record<string, string> = {
  New: "#605e5c",
  Increased: "#107c41",
  Decreased: "#a80000",
  Unchanged: "#8a8886",
};

type HistoryRow = {
  rowKey: string;
  employeeIdentifier: string;
  employeeName: string;
  skillName: string;
  rating: string;
  previousRating: string | null;
  changeType: string;
  updatedAt: any;
  updatedTime: number;
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

  const [rows, setRows] = React.useState<HistoryRow[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const [searchText, setSearchText] = React.useState<string>("");
  const [columnFilters, setColumnFilters] = React.useState<Record<string, string>>({});
  const [dateFrom, setDateFrom] = React.useState<string>("");
  const [dateTo, setDateTo] = React.useState<string>("");
  const [sortDir, setSortDir] = React.useState<"desc" | "asc">("desc");
  const [pageSize, setPageSize] = React.useState<number>(25);
  const [pageIndex, setPageIndex] = React.useState<number>(0);

  const formatDateTime = React.useCallback((value: any): string => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString(language, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }, [language]);

  const fetchHistory = React.useCallback(async () => {
    const api = dataApi || context?.webApi;
    if (!api) {
      setLoading(false);
      setRows([]);
      return;
    }

    setLoading(true);
    try {
      let skillRecords: any[] = [];
      let employeeRecords: any[] = [];

      if (typeof api.queryTable === "function") {
        const skillResult = await api.queryTable(SKILL_TABLE, {
          select: [SKILL_PK, "cr8f7_employeeidentifier", "cr8f7_skillname", "cr8f7_skillrating", "cr8f7_lastupdateddate"],
          pageSize: 5000,
        });
        skillRecords = skillResult?.rows || skillResult?.entities || [];
      } else {
        const skillResult = await api.retrieveMultipleRecords(SKILL_TABLE, `?$select=${SKILL_PK},cr8f7_employeeidentifier,cr8f7_skillname,cr8f7_skillrating,cr8f7_lastupdateddate`);
        skillRecords = skillResult?.entities || [];
      }

      // Employee names are a convenience only; a failure here must not hide the history.
      try {
        if (typeof api.queryTable === "function") {
          const empResult = await api.queryTable(EMPLOYEE_TABLE, {
            select: ["cr8f7_employeeid1", "cr8f7_employeename"],
            pageSize: 5000,
          });
          employeeRecords = empResult?.rows || empResult?.entities || [];
        } else {
          const empResult = await api.retrieveMultipleRecords(EMPLOYEE_TABLE, "?$select=cr8f7_employeeid1,cr8f7_employeename");
          employeeRecords = empResult?.entities || [];
        }
      } catch {
        employeeRecords = [];
      }

      const nameById = new Map<string, string>();
      employeeRecords.forEach((e: any) => {
        const key = String(e.cr8f7_employeeid1 ?? "").trim().toLowerCase();
        if (key) nameById.set(key, String(e.cr8f7_employeename ?? ""));
      });

      const normalised: HistoryRow[] = skillRecords.map((r: any, i: number) => {
        const identifier = String(r.cr8f7_employeeidentifier ?? "").trim();
        const updatedAt = r.cr8f7_lastupdateddate;
        const parsed = updatedAt ? new Date(updatedAt).getTime() : 0;
        return {
          rowKey: String(r[SKILL_PK] ?? r.id ?? `row-${i}`),
          employeeIdentifier: identifier,
          employeeName: nameById.get(identifier.toLowerCase()) || "",
          skillName: String(r.cr8f7_skillname ?? "").trim(),
          rating: r.cr8f7_skillrating === null || r.cr8f7_skillrating === undefined ? "-" : String(r.cr8f7_skillrating),
          previousRating: null,
          changeType: "New",
          updatedAt,
          updatedTime: Number.isNaN(parsed) ? 0 : parsed,
        };
      });

      // Each row of cr8f7_employeeskill is one rating event, so the prior value for the
      // same employee and skill is what turns a flat list into a change log.
      const groups = new Map<string, HistoryRow[]>();
      normalised.forEach((row) => {
        const key = `${row.employeeIdentifier.toLowerCase()}|${row.skillName.toLowerCase()}`;
        const bucket = groups.get(key);
        if (bucket) bucket.push(row);
        else groups.set(key, [row]);
      });

      groups.forEach((bucket) => {
        bucket.sort((a, b) => a.updatedTime - b.updatedTime);
        bucket.forEach((row, index) => {
          if (index === 0) {
            row.previousRating = null;
            row.changeType = "New";
            return;
          }
          const prev = bucket[index - 1].rating;
          row.previousRating = prev;
          const prevNum = Number(prev);
          const currNum = Number(row.rating);
          if (Number.isNaN(prevNum) || Number.isNaN(currNum)) row.changeType = "Unchanged";
          else if (currNum > prevNum) row.changeType = "Increased";
          else if (currNum < prevNum) row.changeType = "Decreased";
          else row.changeType = "Unchanged";
        });
      });

      setRows(normalised);
      setLoading(false);
    } catch (e: any) {
      setError(`${t("error")} (${e?.message || "Query failed"})`);
      setRows([]);
      setLoading(false);
    }
  }, [dataApi, context, t]);

  React.useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const distinctSkills = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.skillName).filter(Boolean))).sort(),
    [rows]
  );

  const filteredRows = React.useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    const result = rows.filter((row) => {
      if (query) {
        const haystack = [row.employeeIdentifier, row.employeeName, row.skillName].map((v) => v.toLowerCase());
        if (!haystack.some((h) => h.includes(query))) return false;
      }

      const employeeFilter = columnFilters.employee;
      if (employeeFilter) {
        const needle = employeeFilter.toLowerCase();
        const hit = row.employeeIdentifier.toLowerCase().includes(needle) || row.employeeName.toLowerCase().includes(needle);
        if (!hit) return false;
      }

      if (columnFilters.skill && row.skillName !== columnFilters.skill) return false;
      if (columnFilters.rating && row.rating !== columnFilters.rating) return false;
      if (columnFilters.change && row.changeType !== columnFilters.change) return false;

      if (fromTime !== null && row.updatedTime < fromTime) return false;
      if (toTime !== null && row.updatedTime > toTime) return false;

      return true;
    });

    result.sort((a, b) => (sortDir === "desc" ? b.updatedTime - a.updatedTime : a.updatedTime - b.updatedTime));
    return result;
  }, [rows, searchText, columnFilters, dateFrom, dateTo, sortDir]);

  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const firstRowNumber = totalRows === 0 ? 0 : safePageIndex * pageSize + 1;
  const lastRowNumber = Math.min(totalRows, (safePageIndex + 1) * pageSize);
  const pagedRows = React.useMemo(
    () => filteredRows.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize),
    [filteredRows, safePageIndex, pageSize]
  );

  React.useEffect(() => {
    setPageIndex(0);
  }, [searchText, columnFilters, dateFrom, dateTo, pageSize, sortDir]);

  const hasActiveFilters =
    searchText.trim().length > 0 ||
    Object.values(columnFilters).some((v) => v) ||
    dateFrom.length > 0 ||
    dateTo.length > 0;

  const clearAllFilters = () => {
    setSearchText("");
    setColumnFilters({});
    setDateFrom("");
    setDateTo("");
  };

  const setColumnFilter = (columnId: string, value: string) =>
    setColumnFilters((prev) => ({ ...prev, [columnId]: value }));

  const ratingPillStyle = (val: string): React.CSSProperties => {
    const base: React.CSSProperties = { width: "48px", height: "26px", borderRadius: "13px", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontWeight: "bold", fontSize: "14px" };
    switch (val) {
      case "0": return { ...base, backgroundColor: "#a19f9d" };
      case "1": return { ...base, backgroundColor: "#e81123" };
      case "2": return { ...base, backgroundColor: "#f7630c" };
      case "3": return { ...base, backgroundColor: "#ffb900" };
      case "4": return { ...base, backgroundColor: "#bad80a" };
      case "5": return { ...base, backgroundColor: "#107c41" };
      default: return { ...base, backgroundColor: "#f3f2f1", color: "#605e5c", fontWeight: "normal" };
    }
  };

  const columns = [
    createTableColumn({
      columnId: "employee",
      minWidth: 230,
      renderHeaderCell: () => (
        <div style={headerCellStyle} onClick={(e) => e.stopPropagation()}>
          <Text weight="bold">{t("employee")}</Text>
          <Input
            size="small"
            placeholder="Filter by ID or name"
            value={columnFilters.employee || ""}
            onChange={(_, d) => setColumnFilter("employee", d.value)}
          />
        </div>
      ),
      renderCell: (item: HistoryRow) => (
        <TableCellLayout media={<Avatar name={item.employeeName || item.employeeIdentifier} size={24} aria-hidden="true" />}>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
            <Text size={300} weight="semibold" style={{ color: "#005a9e" }}>{item.employeeName || item.employeeIdentifier}</Text>
            {item.employeeName ? <Text size={200} style={{ color: "#605e5c" }}>{item.employeeIdentifier}</Text> : null}
          </div>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: "skill",
      minWidth: 180,
      renderHeaderCell: () => (
        <div style={headerCellStyle} onClick={(e) => e.stopPropagation()}>
          <Text weight="bold">{t("skillname")}</Text>
          <Select size="small" value={columnFilters.skill || ""} onChange={(_, d) => setColumnFilter("skill", d.value)}>
            <option value="">All</option>
            {distinctSkills.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      ),
      renderCell: (item: HistoryRow) => <TableCellLayout truncate title={item.skillName}>{item.skillName}</TableCellLayout>,
    }),
    createTableColumn({
      columnId: "rating",
      minWidth: 120,
      renderHeaderCell: () => (
        <div style={headerCellStyle} onClick={(e) => e.stopPropagation()}>
          <Text weight="bold">{t("rating")}</Text>
          <Select size="small" value={columnFilters.rating || ""} onChange={(_, d) => setColumnFilter("rating", d.value)}>
            <option value="">All</option>
            {ratingOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </Select>
        </div>
      ),
      renderCell: (item: HistoryRow) => <TableCellLayout><div style={ratingPillStyle(item.rating)}>{item.rating}</div></TableCellLayout>,
    }),
    createTableColumn({
      columnId: "change",
      minWidth: 140,
      renderHeaderCell: () => (
        <div style={headerCellStyle} onClick={(e) => e.stopPropagation()}>
          <Text weight="bold">{t("change")}</Text>
          <Select size="small" value={columnFilters.change || ""} onChange={(_, d) => setColumnFilter("change", d.value)}>
            <option value="">All</option>
            {changeOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
      ),
      renderCell: (item: HistoryRow) => {
        const colour = changeColours[item.changeType] || "#605e5c";
        if (item.changeType === "New") {
          return <TableCellLayout><Text size={200} weight="semibold" style={{ color: colour }}>New</Text></TableCellLayout>;
        }
        const arrow = item.changeType === "Increased" ? "▲" : item.changeType === "Decreased" ? "▼" : "=";
        return (
          <TableCellLayout>
            <Text size={200} weight="semibold" style={{ color: colour }}>
              {item.previousRating} → {item.rating} {arrow}
            </Text>
          </TableCellLayout>
        );
      },
    }),
    createTableColumn({
      columnId: "lastupdated",
      minWidth: 240,
      renderHeaderCell: () => (
        <div style={headerCellStyle} onClick={(e) => e.stopPropagation()}>
          <Text weight="bold">{t("lastupdated")}</Text>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <Input size="small" type="date" style={{ minWidth: 0, flex: 1 }} value={dateFrom} onChange={(_, d) => setDateFrom(d.value)} />
            <Text size={200} style={{ color: "#605e5c" }}>–</Text>
            <Input size="small" type="date" style={{ minWidth: 0, flex: 1 }} value={dateTo} onChange={(_, d) => setDateTo(d.value)} />
          </div>
        </div>
      ),
      renderCell: (item: HistoryRow) => <TableCellLayout>{formatDateTime(item.updatedAt)}</TableCellLayout>,
    }),
  ];

  if (loading) return <div style={{ padding: 40, display: "flex", justifyContent: "center", alignItems: "center" }}><Spinner label={t("loading")} /></div>;
  if (error) return <div style={{ padding: 24, color: "#d13438", backgroundColor: "#fde7e9", borderRadius: "4px" }}><Text>{error}</Text></div>;

  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={pageScrollStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "2px solid #f3f2f1", paddingBottom: "12px", gap: 12, flexWrap: "wrap" }}>
        <Text size={600} weight="bold" style={{ color: "#323130" }}>{t("historyTitle")}</Text>
        <Button type="button" appearance="secondary" icon={<ArrowClockwise16Regular />} onClick={fetchHistory}>{t("refresh")}</Button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Input
          style={{ flexGrow: 1, minWidth: 260, maxWidth: 440 }}
          placeholder={t("searchPlaceholder")}
          value={searchText}
          onChange={(_, d) => setSearchText(d.value)}
        />
        <Select size="small" style={{ minWidth: 140 }} value={sortDir} onChange={(_, d) => setSortDir(d.value as "desc" | "asc")}>
          <option value="desc">{t("newest")}</option>
          <option value="asc">{t("oldest")}</option>
        </Select>
        {hasActiveFilters && (
          <Button type="button" appearance="subtle" icon={<Dismiss16Regular />} onClick={clearAllFilters}>
            {t("clearFilters")}
          </Button>
        )}
        <Text size={200} style={{ color: "#605e5c", marginLeft: "auto" }}>
          {totalRows} {totalRows === 1 ? "record" : "records"}
          {hasActiveFilters ? ` (filtered from ${rows.length})` : ""}
        </Text>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", backgroundColor: "#f3f2f1", borderRadius: "4px" }}>
          <Text size={400} style={{ color: "#605e5c" }}>{t("noData")}</Text>
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto", border: "1px solid #e0e0e0", borderRadius: "8px", backgroundColor: "#ffffff" }}>
            <DataGrid items={pagedRows} columns={columns} itemsPerGridRow={1} focusMode="row" getRowId={(item: any) => item.rowKey}>
              <DataGridHeader style={{ backgroundColor: "#faf9f8" }}>
                <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell style={{ borderBottom: "1px solid #e0e0e0", alignItems: "flex-start" }}>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
              </DataGridHeader>
              <DataGridBody>
                {({ item, rowId }) => (
                  <DataGridRow key={rowId} style={{ borderBottom: "1px solid #f3f2f1" }}>
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
              <Select size="small" style={{ minWidth: 80 }} value={String(pageSize)} onChange={(_, d) => setPageSize(parseInt(d.value, 10))}>
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
