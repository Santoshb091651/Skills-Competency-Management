"""
Generates the employee import template (FR-IMP-02).

Run:  python powerplatform/templates/build_template.py
Out:  powerplatform/templates/employee-import-template.xlsx

Three sheets:
  Employees   the sheet the admin fills in, with a frozen header, data validation
              on employment_status, and one example row that is clearly marked
  Instructions  column-by-column rules, matching the validation in FR-IMP-07
  Reference     the allowed employment_status values, used by the dropdown
"""

from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

HEADER_FILL = PatternFill("solid", fgColor="1F4E8C")
REQUIRED_FILL = PatternFill("solid", fgColor="15335C")
EXAMPLE_FILL = PatternFill("solid", fgColor="FFF6E5")
TITLE_FONT = Font(name="Segoe UI", size=14, bold=True, color="15335C")
HEADER_FONT = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
BODY_FONT = Font(name="Segoe UI", size=11)
MUTED_FONT = Font(name="Segoe UI", size=10, color="55637A", italic=True)
THIN = Side(style="thin", color="C7D3E3")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

# (column, required, width, rule shown on the Instructions sheet)
COLUMNS = [
    ("employee_code", True, 18,
     "Unique identifier for the person. This is the match key — re-importing the "
     "same code updates that employee rather than creating a second one."),
    ("full_name", True, 26,
     "Display name, e.g. Jane Doe."),
    ("email", True, 30,
     "Work email. Must be unique and well-formed. Stored lower-cased, and used to "
     "link the person to their sign-in account."),
    ("department", False, 20,
     "Free text, e.g. Quality Engineering."),
    ("designation", False, 24,
     "Job title, e.g. Senior Test Engineer."),
    ("manager_email", False, 30,
     "The email of this person's manager. Must match an email that exists either "
     "in this file or already in the system. Resolved after all rows load, so a "
     "manager listed further down still links. Leave blank for the top of the tree."),
    ("location", False, 18,
     "Office or site, e.g. Bengaluru."),
    ("date_of_joining", False, 16,
     "Date only, formatted YYYY-MM-DD, e.g. 2023-04-17."),
    ("employment_status", False, 20,
     "Active or Inactive. Defaults to Active when left blank."),
]

EXAMPLE_ROW = [
    "E1043", "Jane Doe", "jane.doe@contoso.com", "Quality Engineering",
    "Senior Test Engineer", "raj.kumar@contoso.com", "Bengaluru",
    "2023-04-17", "Active",
]

wb = Workbook()

# ---------------------------------------------------------------------------
# Employees
# ---------------------------------------------------------------------------

ws = wb.active
ws.title = "Employees"

for index, (name, required, width, _rule) in enumerate(COLUMNS, start=1):
    cell = ws.cell(row=1, column=index, value=name)
    cell.font = HEADER_FONT
    cell.fill = REQUIRED_FILL if required else HEADER_FILL
    cell.alignment = Alignment(horizontal="left", vertical="center")
    cell.border = BORDER
    ws.column_dimensions[get_column_letter(index)].width = width

ws.row_dimensions[1].height = 22

for index, value in enumerate(EXAMPLE_ROW, start=1):
    cell = ws.cell(row=2, column=index, value=value)
    cell.font = BODY_FONT
    cell.fill = EXAMPLE_FILL
    cell.border = BORDER

note = ws.cell(row=2, column=len(COLUMNS) + 1,
               value="<- EXAMPLE ROW. Delete this row before importing.")
note.font = MUTED_FONT

# Dropdown rather than free text, so the value always matches a known choice.
status_validation = DataValidation(
    type="list",
    formula1='"Active,Inactive"',
    allow_blank=True,
    showErrorMessage=True,
)
status_validation.error = "Employment status must be Active or Inactive."
status_validation.errorTitle = "Unrecognised value"
status_validation.prompt = "Active or Inactive. Leave blank to default to Active."
status_validation.promptTitle = "Employment status"
ws.add_data_validation(status_validation)
status_validation.add(f"I2:I2000")

# Text format on the date column keeps Excel from silently reinterpreting
# YYYY-MM-DD as a local-format date, which is a common source of import errors.
for row in range(2, 2001):
    ws.cell(row=row, column=8).number_format = "@"

ws.freeze_panes = "A2"
ws.auto_filter.ref = f"A1:{get_column_letter(len(COLUMNS))}1"

# ---------------------------------------------------------------------------
# Instructions
# ---------------------------------------------------------------------------

info = wb.create_sheet("Instructions")
info.column_dimensions["A"].width = 24
info.column_dimensions["B"].width = 12
info.column_dimensions["C"].width = 96

info["A1"] = "Employee import template"
info["A1"].font = TITLE_FONT
info.merge_cells("A1:C1")

intro = [
    "Fill in the Employees sheet, one row per person, then import it from the "
    "Administration area of the Skills Management app.",
    "Rows load into a staging area first. You review what will be created, updated "
    "or rejected, and nothing reaches live data until you promote the batch.",
    "Invalid rows fail on their own — the rest of the file still imports.",
    "Employees already in the system but missing from this file are never deleted.",
]
row = 3
for line in intro:
    info.cell(row=row, column=1, value=line).font = BODY_FONT
    info.cell(row=row, column=1).alignment = Alignment(wrap_text=True, vertical="top")
    info.merge_cells(start_row=row, start_column=1, end_row=row, end_column=3)
    info.row_dimensions[row].height = 30
    row += 1

row += 1
for index, title in enumerate(["Column", "Required", "Rule"], start=1):
    cell = info.cell(row=row, column=index, value=title)
    cell.font = HEADER_FONT
    cell.fill = HEADER_FILL
    cell.border = BORDER
header_row = row
row += 1

for name, required, _width, rule in COLUMNS:
    info.cell(row=row, column=1, value=name).font = Font(name="Consolas", size=10)
    required_cell = info.cell(row=row, column=2, value="Yes" if required else "Optional")
    required_cell.font = Font(name="Segoe UI", size=10, bold=required,
                              color="B32D3F" if required else "55637A")
    rule_cell = info.cell(row=row, column=3, value=rule)
    rule_cell.font = BODY_FONT
    rule_cell.alignment = Alignment(wrap_text=True, vertical="top")
    for column in range(1, 4):
        info.cell(row=row, column=column).border = BORDER
    info.row_dimensions[row].height = 34
    row += 1

info.freeze_panes = f"A{header_row + 1}"

row += 1
info.cell(row=row, column=1, value="Column order does not matter; the header name is what is matched.").font = MUTED_FONT
info.merge_cells(start_row=row, start_column=1, end_row=row, end_column=3)

# ---------------------------------------------------------------------------
# Reference
# ---------------------------------------------------------------------------

ref = wb.create_sheet("Reference")
ref.column_dimensions["A"].width = 24
ref.column_dimensions["B"].width = 60

ref["A1"] = "employment_status"
ref["A1"].font = HEADER_FONT
ref["A1"].fill = HEADER_FILL
ref["B1"] = "Meaning"
ref["B1"].font = HEADER_FONT
ref["B1"].fill = HEADER_FILL

for offset, (value, meaning) in enumerate(
    [("Active", "Currently employed. Appears in the directory and in trends."),
     ("Inactive", "Has left or is on long-term leave. Retained with full history, hidden from active views.")],
    start=2,
):
    ref.cell(row=offset, column=1, value=value).font = BODY_FONT
    ref.cell(row=offset, column=2, value=meaning).font = BODY_FONT

out = Path(__file__).resolve().parent / "employee-import-template.xlsx"
wb.save(out)
print(f"Wrote {out}")
