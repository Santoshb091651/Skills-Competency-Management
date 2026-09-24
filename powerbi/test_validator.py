"""
Tests for validate_model.py.

Run:  python powerbi/test_validator.py

A validator that cannot fail is worthless, so these tests build deliberately
broken models in a temporary directory and assert that each fault is reported.
The real model is never touched.

The faults exercised are the ones that motivated the validator: TMDL is
indentation-significant, and fenced DAX/M bodies must be parsed as DAX/M rather
than as TMDL - an earlier version of the validator got that wrong and produced
292 false positives on a correct model.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
VALIDATOR = HERE / "validate_model.py"
MODEL_DIRS = ["SkillsCompetency.SemanticModel", "SkillsCompetency.Report"]
MODEL_FILES = ["SkillsCompetency.pbip", "validate_model.py"]

failures: list[str] = []


def build_copy(destination: Path) -> None:
    for name in MODEL_DIRS:
        shutil.copytree(HERE / name, destination / name)
    for name in MODEL_FILES:
        shutil.copy2(HERE / name, destination / name)


def run(directory: Path) -> tuple[int, str]:
    result = subprocess.run(
        [sys.executable, str(directory / "validate_model.py")],
        capture_output=True,
        text=True,
    )
    return result.returncode, result.stdout + result.stderr


def replace_in(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise AssertionError(f"fixture text not found in {path.name}: {old!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def check(name: str, mutate, expected_fragment: str) -> None:
    """Applies one fault, expects a non-zero exit and a matching message."""
    with tempfile.TemporaryDirectory() as raw:
        directory = Path(raw)
        build_copy(directory)
        mutate(directory)
        code, output = run(directory)

        if code == 0:
            failures.append(f"{name}: validator passed a broken model")
        elif expected_fragment.lower() not in output.lower():
            failures.append(
                f"{name}: failed as expected but without a matching message "
                f"(looked for {expected_fragment!r})"
            )
        else:
            print(f"  caught   {name}")


def tables(directory: Path) -> Path:
    return directory / "SkillsCompetency.SemanticModel" / "definition" / "tables"


def definition(directory: Path) -> Path:
    return directory / "SkillsCompetency.SemanticModel" / "definition"


# ---------------------------------------------------------------------------

print("baseline")
with tempfile.TemporaryDirectory() as raw:
    clean = Path(raw)
    build_copy(clean)
    code, output = run(clean)
    if code != 0:
        failures.append(f"baseline: the real model should validate cleanly\n{output}")
        print(output)
    else:
        print("  passes   unmodified model")

print("\nfaults")

check(
    "relationship pointing at a missing column",
    lambda d: replace_in(
        definition(d) / "relationships.tmdl",
        "toColumn: Employee.EmployeeId",
        "toColumn: Employee.NopeId",
    ),
    "unknown column",
)

check(
    "DAX column reference inside a fenced measure",
    lambda d: replace_in(
        tables(d) / "Skill Assessment.tmdl",
        "'Skill Assessment'[Effective Date] <= AsOf",
        "'Skill Assessment'[Wrong Date] <= AsOf",
    ),
    "unknown column",
)

check(
    "DAX measure reference that does not exist",
    lambda d: replace_in(
        tables(d) / "Skill Assessment.tmdl",
        "    [Rating As Of]\n",
        "    [No Such Measure]\n",
    ),
    "neither a measure nor a column",
)

check(
    "structural line indented with spaces",
    lambda d: replace_in(tables(d) / "Skill.tmdl", "\tcolumn Aliases", "    column Aliases"),
    "indentation must be tabs",
)

check(
    "role referenced by model.tmdl but not defined",
    lambda d: (definition(d) / "roles" / "Manager Team.tmdl").unlink(),
    "has no definition",
)

check(
    "table defined but not referenced in model.tmdl",
    lambda d: replace_in(definition(d) / "model.tmdl", "ref table 'Rating Level'\n", ""),
    "not referenced in model.tmdl",
)

check(
    "unbalanced expression fence",
    lambda d: replace_in(
        tables(d) / "Employee Skill.tmdl",
        "\tmeasure 'Skills Tracked' = COUNTROWS ( 'Employee Skill' )",
        "\tmeasure 'Skills Tracked' = ```\n\t\t\tCOUNTROWS ( 'Employee Skill' )",
    ),
    "fence",
)

check(
    "sortByColumn that is not a column of its table",
    lambda d: replace_in(
        tables(d) / "Rating Level.tmdl",
        "sortByColumn: 'Level Value'",
        "sortByColumn: 'Not A Column'",
    ),
    "sortbycolumn",
)

check(
    "hard-coded Dataverse host instead of the parameter",
    lambda d: replace_in(
        tables(d) / "Skill.tmdl",
        "CommonDataService.Database(EnvironmentHost",
        'CommonDataService.Database("contoso.crm11.dynamics.com"',
    ),
    "environmenthost parameter",
)

check(
    "malformed report.json",
    lambda d: (d / "SkillsCompetency.Report" / "report.json").write_text("{ not json", encoding="utf-8"),
    "invalid json",
)

check(
    "duplicate column name in a table",
    lambda d: replace_in(tables(d) / "Skill.tmdl", "\tcolumn Aliases", "\tcolumn 'Skill Name'\n\t\tdataType: string\n\t\tsummarizeBy: none\n\t\tsourceColumn: skl_dupe\n\n\tcolumn Aliases"),
    "duplicate column",
)

# ---------------------------------------------------------------------------

print()
if failures:
    print(f"{len(failures)} test failure(s):")
    for message in failures:
        print(f"  - {message}")
    sys.exit(1)

print("All validator tests passed: the real model is clean, and every seeded fault was caught.")
