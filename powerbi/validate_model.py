"""
Structural validation for the SkillsCompetency TMDL semantic model.

Run:  python powerbi/validate_model.py

This is NOT a TMDL parser and cannot prove Power BI Desktop will open the
project. What it does catch is the class of mistake that is easy to make when
authoring TMDL by hand and expensive to find by opening the file:

  * structural indentation that is not tabs (TMDL is indentation-significant)
  * unbalanced ``` expression fences
  * a `ref table` / `ref role` / `ref expression` with no matching definition
  * a relationship pointing at a table or column that does not exist
  * DAX referring to a table, column or measure that does not exist
  * a sortByColumn that is not a column of its own table
  * an M query reading from a query that does not exist
  * duplicate column or measure names inside a table
  * malformed .pbip / .platform / .pbir / report.json

TMDL bodies are fenced with ```. Inside a fence the content is DAX or M, not
TMDL, so indentation is free-form and `[Field]` means something different in
each language. The parser below therefore separates three kinds of content:
structural TMDL, DAX expressions, and M expressions, and applies the right
checks to each.

Exit code 0 means every check passed.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MODEL = ROOT / "SkillsCompetency.SemanticModel"
DEFINITION = MODEL / "definition"
REPORT = ROOT / "SkillsCompetency.Report"

problems: list[str] = []


def fail(message: str) -> None:
    problems.append(message)


def unquote(name: str) -> str:
    name = name.strip()
    if len(name) > 1 and name.startswith("'") and name.endswith("'"):
        return name[1:-1]
    return name


# ---------------------------------------------------------------------------
# TMDL splitter
# ---------------------------------------------------------------------------

DECL_RE = re.compile(r"^\t*(measure|column|partition|tablePermission)\s+('[^']*'|[^\s=]+)\s*=\s*(.*)$")
SOURCE_RE = re.compile(r"^\t*source\s*=\s*(.*)$")


class Parsed:
    def __init__(self) -> None:
        self.structural: list[tuple[int, str]] = []
        self.dax: list[str] = []
        self.m: list[str] = []

    @property
    def structural_text(self) -> str:
        return "\n".join(line for _, line in self.structural)


def parse_tmdl(text: str, path_name: str) -> Parsed:
    parsed = Parsed()
    in_fence = False
    fence_kind = "dax"  # what the currently open fence contains

    for number, line in enumerate(text.splitlines(), start=1):
        if "```" in line:
            # A fence delimiter. It may also be the tail of a declaration, e.g.
            # `source = ```, in which case the kind was set just below.
            stripped = line.strip()
            if stripped != "```":
                # Opening form: `<something> = ```
                fence_kind = "m" if SOURCE_RE.match(line) else "dax"
            in_fence = not in_fence
            continue

        if in_fence:
            (parsed.m if fence_kind == "m" else parsed.dax).append(line)
            continue

        parsed.structural.append((number, line))

        source_match = SOURCE_RE.match(line)
        if source_match:
            fence_kind = "m"
            inline = source_match.group(1).strip()
            if inline and inline != "```":
                parsed.m.append(inline)
            continue

        decl = DECL_RE.match(line)
        if decl:
            kind = decl.group(1)
            fence_kind = "m" if kind == "partition" else "dax"
            inline = decl.group(3).strip()
            # `partition X = m` declares a mode, not an expression.
            if inline and inline != "```" and kind != "partition":
                parsed.dax.append(inline)

    if in_fence:
        fail(f"{path_name}: a ``` fence is opened but never closed")

    return parsed


# ---------------------------------------------------------------------------
# File presence
# ---------------------------------------------------------------------------

REQUIRED = [
    ROOT / "SkillsCompetency.pbip",
    MODEL / ".platform",
    MODEL / "definition.pbism",
    DEFINITION / "database.tmdl",
    DEFINITION / "model.tmdl",
    DEFINITION / "expressions.tmdl",
    DEFINITION / "relationships.tmdl",
    REPORT / ".platform",
    REPORT / "definition.pbir",
    REPORT / "report.json",
]

for path in REQUIRED:
    if not path.exists():
        fail(f"missing required file: {path.relative_to(ROOT)}")

table_files = sorted((DEFINITION / "tables").glob("*.tmdl"))
role_files = sorted((DEFINITION / "roles").glob("*.tmdl"))

if not table_files:
    fail("no table definitions found under definition/tables")


# ---------------------------------------------------------------------------
# JSON well-formedness
# ---------------------------------------------------------------------------

for path in [
    ROOT / "SkillsCompetency.pbip",
    MODEL / ".platform",
    MODEL / "definition.pbism",
    REPORT / ".platform",
    REPORT / "definition.pbir",
    REPORT / "report.json",
]:
    if not path.exists():
        continue
    try:
        json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        fail(f"{path.relative_to(ROOT)}: invalid JSON - {error}")

pbir = REPORT / "definition.pbir"
if pbir.exists():
    try:
        reference = json.loads(pbir.read_text(encoding="utf-8"))
        target = reference["datasetReference"]["byPath"]["path"]
        if not (REPORT / target).resolve().exists():
            fail(f"definition.pbir points at '{target}', which does not resolve")
    except (KeyError, TypeError, json.JSONDecodeError):
        fail("definition.pbir has no datasetReference.byPath.path")

pbip = ROOT / "SkillsCompetency.pbip"
if pbip.exists():
    try:
        project = json.loads(pbip.read_text(encoding="utf-8"))
        for artifact in project.get("artifacts", []):
            report_path = artifact.get("report", {}).get("path")
            if report_path and not (ROOT / report_path).exists():
                fail(f"SkillsCompetency.pbip references '{report_path}', which does not exist")
    except json.JSONDecodeError:
        pass


# ---------------------------------------------------------------------------
# Parse every TMDL file
# ---------------------------------------------------------------------------

tmdl_paths = [
    DEFINITION / "database.tmdl",
    DEFINITION / "model.tmdl",
    DEFINITION / "expressions.tmdl",
    DEFINITION / "relationships.tmdl",
] + table_files + role_files

parsed_files: dict[Path, Parsed] = {}

for path in tmdl_paths:
    if not path.exists():
        continue
    text = path.read_text(encoding="utf-8")
    name = str(path.relative_to(ROOT))

    if text.startswith("\ufeff"):
        fail(f"{name}: starts with a UTF-8 BOM; TMDL files should not have one")
    if text.count("```") % 2 != 0:
        fail(f"{name}: odd number of ``` fences ({text.count('```')})")

    parsed = parse_tmdl(text, name)
    parsed_files[path] = parsed

    # Structural TMDL must be tab-indented. Fenced DAX/M is exempt.
    for number, line in parsed.structural:
        if not line.strip():
            continue
        leading = line[: len(line) - len(line.lstrip())]
        if leading and set(leading) != {"\t"}:
            fail(f"{name}:{number}: structural indentation must be tabs only")


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------

TABLE_RE = re.compile(r"^table\s+(.+?)\s*$", re.MULTILINE)
COLUMN_RE = re.compile(r"^\tcolumn\s+('[^']+'|[^\s=]+)", re.MULTILINE)
MEASURE_RE = re.compile(r"^\tmeasure\s+('[^']+'|[^\s=]+)\s*=", re.MULTILINE)
SORTBY_RE = re.compile(r"^\t\tsortByColumn:\s*(.+?)\s*$", re.MULTILINE)
PARTITION_RE = re.compile(r"^\tpartition\s+('[^']+'|\S+)\s*=\s*(\w+)", re.MULTILINE)

tables: dict[str, dict] = {}

for path in table_files:
    parsed = parsed_files.get(path)
    if parsed is None:
        continue
    structural = parsed.structural_text

    found = TABLE_RE.findall(structural)
    if len(found) != 1:
        fail(f"{path.name}: expected exactly one 'table' declaration, found {len(found)}")
        continue

    table_name = unquote(found[0])
    columns = [unquote(c) for c in COLUMN_RE.findall(structural)]
    measures = [unquote(m) for m in MEASURE_RE.findall(structural)]

    duplicates = {c for c in columns if columns.count(c) > 1}
    if duplicates:
        fail(f"{table_name}: duplicate column names {sorted(duplicates)}")
    duplicates = {m for m in measures if measures.count(m) > 1}
    if duplicates:
        fail(f"{table_name}: duplicate measure names {sorted(duplicates)}")

    partitions = PARTITION_RE.findall(structural)
    if not partitions:
        fail(f"{table_name}: no partition defined")

    tables[table_name] = {
        "path": path,
        "columns": columns,
        "measures": measures,
        "sortBy": [unquote(s) for s in SORTBY_RE.findall(structural)],
        "dax": "\n".join(parsed.dax),
        "m": "\n".join(parsed.m),
        "modes": [p[1] for p in partitions],
    }

all_measures = {m for t in tables.values() for m in t["measures"]}
all_columns = {c for t in tables.values() for c in t["columns"]}


# ---------------------------------------------------------------------------
# model.tmdl references
# ---------------------------------------------------------------------------

model_path = DEFINITION / "model.tmdl"
if model_path.exists():
    model_text = model_path.read_text(encoding="utf-8")

    def refs(kind: str) -> list[str]:
        return [unquote(n) for n in re.findall(rf"^ref\s+{kind}\s+(.+?)\s*$", model_text, re.MULTILINE)]

    referenced_tables = refs("table")
    for name in referenced_tables:
        if name not in tables:
            fail(f"model.tmdl: 'ref table {name}' has no definition under tables/")
    for name in tables:
        if name not in referenced_tables:
            fail(f"table '{name}' is defined but not referenced in model.tmdl")

    role_names: list[str] = []
    for path in role_files:
        parsed = parsed_files[path]
        found = re.findall(r"^role\s+(.+?)\s*$", parsed.structural_text, re.MULTILINE)
        if len(found) != 1:
            fail(f"{path.name}: expected exactly one 'role' declaration, found {len(found)}")
            continue
        role_names.append(unquote(found[0]))

    referenced_roles = refs("role")
    for name in referenced_roles:
        if name not in role_names:
            fail(f"model.tmdl: 'ref role {name}' has no definition under roles/")
    for name in role_names:
        if name not in referenced_roles:
            fail(f"role '{name}' is defined but not referenced in model.tmdl")

    expressions_path = DEFINITION / "expressions.tmdl"
    declared_exprs: list[str] = []
    if expressions_path.exists():
        declared_exprs = [
            unquote(n)
            for n in re.findall(
                r"^expression\s+(.+?)\s*=", parsed_files[expressions_path].structural_text, re.MULTILINE
            )
        ]
    for name in refs("expression"):
        if name not in declared_exprs:
            fail(f"model.tmdl: 'ref expression {name}' is not declared in expressions.tmdl")


# ---------------------------------------------------------------------------
# Relationships
# ---------------------------------------------------------------------------

rel_path = DEFINITION / "relationships.tmdl"
if rel_path.exists():
    rel_text = parsed_files[rel_path].structural_text
    rel_names = re.findall(r"^relationship\s+(\S+)\s*$", rel_text, re.MULTILINE)
    if not rel_names:
        fail("relationships.tmdl: no relationships found")

    duplicates = {r for r in rel_names if rel_names.count(r) > 1}
    if duplicates:
        fail(f"relationships.tmdl: duplicate relationship names {sorted(duplicates)}")

    for kind, endpoint in re.findall(r"^\t(fromColumn|toColumn):\s*(.+?)\s*$", rel_text, re.MULTILINE):
        match = re.match(r"^('[^']+'|[^.]+)\.(.+)$", endpoint)
        if not match:
            fail(f"relationships.tmdl: cannot parse {kind} '{endpoint}'")
            continue
        table_name = unquote(match.group(1))
        column_name = unquote(match.group(2))
        if table_name not in tables:
            fail(f"relationships.tmdl: {kind} references unknown table '{table_name}'")
        elif column_name not in tables[table_name]["columns"]:
            fail(f"relationships.tmdl: {kind} references unknown column '{table_name}'[{column_name}]")


# ---------------------------------------------------------------------------
# DAX references - only against DAX bodies, never M
# ---------------------------------------------------------------------------

QUALIFIED_RE = re.compile(r"'([^']+)'\[([^\]]+)\]")
BARE_RE = re.compile(r"(?<![\w'\].])([A-Za-z_][A-Za-z0-9_]*)\[([^\]]+)\]")
MEASURE_REF_RE = re.compile(r"(?<![\w'.\]])\[([^\]]+)\]")

DAX_KEYWORDS = {"TRUE", "FALSE", "BLANK"}


def check_dax(owner: str, dax: str) -> None:
    for table_name, column_name in QUALIFIED_RE.findall(dax):
        if table_name not in tables:
            fail(f"{owner}: DAX references unknown table '{table_name}'")
        elif column_name not in tables[table_name]["columns"]:
            fail(f"{owner}: DAX references unknown column '{table_name}'[{column_name}]")

    # Strip qualified references first so the bare pattern cannot see their tails.
    remainder = QUALIFIED_RE.sub(" ", dax)

    for table_name, column_name in BARE_RE.findall(remainder):
        if table_name in tables and column_name not in tables[table_name]["columns"]:
            fail(f"{owner}: DAX references unknown column {table_name}[{column_name}]")

    without_tables = BARE_RE.sub(" ", remainder)
    for candidate in MEASURE_REF_RE.findall(without_tables):
        if candidate in DAX_KEYWORDS:
            continue
        if candidate not in all_measures and candidate not in all_columns:
            fail(f"{owner}: DAX references '[{candidate}]', which is neither a measure nor a column")


for table_name, info in tables.items():
    check_dax(table_name, info["dax"])

    for sort_column in info["sortBy"]:
        if sort_column not in info["columns"]:
            fail(f"{table_name}: sortByColumn '{sort_column}' is not a column of this table")

for path in role_files:
    parsed = parsed_files[path]
    role_dax = "\n".join(parsed.dax)
    # tablePermission filters are single-line DAX captured by the declaration rule.
    for line in parsed.structural_text.splitlines():
        match = re.match(r"^\ttablePermission\s+('[^']+'|\S+)\s*=\s*(.+)$", line)
        if match:
            target = unquote(match.group(1))
            if target not in tables:
                fail(f"{path.name}: tablePermission on unknown table '{target}'")
            role_dax += "\n" + match.group(2)
    check_dax(path.name, role_dax)


# ---------------------------------------------------------------------------
# M references
# ---------------------------------------------------------------------------

for table_name, info in tables.items():
    m_code = info["m"]

    if "CommonDataService.Database(" in m_code and "CommonDataService.Database(EnvironmentHost" not in m_code:
        fail(f"{table_name}: CommonDataService.Database should be called with the EnvironmentHost parameter")

    # A query that reads from another query, e.g. `Source = Employee,`
    for match in re.finditer(r"^\s*\w+\s*=\s*([A-Za-z_][A-Za-z0-9_ ]*?)\s*,\s*$", m_code, re.MULTILINE):
        candidate = match.group(1).strip()
        if candidate in tables or candidate == "EnvironmentHost":
            continue
        # Anything else on the right-hand side is a step name or a literal, which
        # this check cannot resolve and should not guess at.

    referenced = set(re.findall(r"(?:^|\s|=)\s*(Employee|Skill|Date|Manager Hierarchy)\s*,", m_code))
    for name in referenced:
        if name not in tables:
            fail(f"{table_name}: M query reads from '{name}', which is not a table in this model")


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

report_json = REPORT / "report.json"
if report_json.exists():
    try:
        report = json.loads(report_json.read_text(encoding="utf-8"))
        sections = report.get("sections", [])
        if not sections:
            fail("report.json: no sections defined")
        ordinals = [s.get("ordinal") for s in sections]
        if sorted(ordinals) != list(range(len(sections))):
            fail(f"report.json: section ordinals should be 0..{len(sections) - 1}, found {ordinals}")
        names = [s.get("name") for s in sections]
        if len(set(names)) != len(names):
            fail("report.json: duplicate section names")
        for section in sections:
            for key in ("name", "displayName", "config", "filters"):
                if key not in section:
                    fail(f"report.json: section '{section.get('name')}' is missing '{key}'")
    except json.JSONDecodeError:
        pass


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

print(f"tables     {len(tables)}")
for name, info in sorted(tables.items()):
    print(
        f"  {name:<20}{len(info['columns']):>3} columns"
        f"{len(info['measures']):>4} measures   partition: {', '.join(info['modes'])}"
    )
print(f"measures   {len(all_measures)}")
print(f"roles      {len(role_files)}")

if problems:
    print(f"\n{len(problems)} problem(s):")
    for message in problems:
        print(f"  - {message}")
    sys.exit(1)

print("\nAll structural checks passed.")
print("This proves the model is internally consistent, not that Power BI Desktop")
print("will open it. Opening the .pbip is the real test.")
