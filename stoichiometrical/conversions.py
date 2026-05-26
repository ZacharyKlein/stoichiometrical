"""Core chemistry helpers for Stoichiometrical.

The web layer calls into this module so the conversion math stays easy to test
and easy to read. Units are intentionally simple: grams, moles, and particles
(atoms for elements, molecules or formula units for compounds).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple


AVOGADRO_NUMBER = 6.02214076e23


# Atomic masses are standard atomic weights rounded to classroom-friendly
# precision. The set covers the common school chemistry formulas while keeping
# the source readable.
ATOMIC_MASSES: Dict[str, float] = {
    "H": 1.008,
    "He": 4.0026,
    "Li": 6.94,
    "Be": 9.0122,
    "B": 10.81,
    "C": 12.011,
    "N": 14.007,
    "O": 15.999,
    "F": 18.998,
    "Ne": 20.180,
    "Na": 22.990,
    "Mg": 24.305,
    "Al": 26.982,
    "Si": 28.085,
    "P": 30.974,
    "S": 32.06,
    "Cl": 35.45,
    "Ar": 39.948,
    "K": 39.098,
    "Ca": 40.078,
    "Sc": 44.956,
    "Ti": 47.867,
    "V": 50.942,
    "Cr": 51.996,
    "Mn": 54.938,
    "Fe": 55.845,
    "Co": 58.933,
    "Ni": 58.693,
    "Cu": 63.546,
    "Zn": 65.38,
    "Ga": 69.723,
    "Ge": 72.630,
    "As": 74.922,
    "Se": 78.971,
    "Br": 79.904,
    "Kr": 83.798,
    "Rb": 85.468,
    "Sr": 87.62,
    "Y": 88.906,
    "Zr": 91.224,
    "Nb": 92.906,
    "Mo": 95.95,
    "Tc": 98.0,
    "Ru": 101.07,
    "Rh": 102.91,
    "Pd": 106.42,
    "Ag": 107.87,
    "Cd": 112.41,
    "In": 114.82,
    "Sn": 118.71,
    "Sb": 121.76,
    "Te": 127.60,
    "I": 126.90,
    "Xe": 131.29,
    "Cs": 132.91,
    "Ba": 137.33,
    "La": 138.91,
    "Ce": 140.12,
    "Pr": 140.91,
    "Nd": 144.24,
    "Sm": 150.36,
    "Eu": 151.96,
    "Gd": 157.25,
    "Tb": 158.93,
    "Dy": 162.50,
    "Ho": 164.93,
    "Er": 167.26,
    "Tm": 168.93,
    "Yb": 173.05,
    "Lu": 174.97,
    "Hf": 178.49,
    "Ta": 180.95,
    "W": 183.84,
    "Re": 186.21,
    "Os": 190.23,
    "Ir": 192.22,
    "Pt": 195.08,
    "Au": 196.97,
    "Hg": 200.59,
    "Tl": 204.38,
    "Pb": 207.2,
    "Bi": 208.98,
    "Th": 232.04,
    "Pa": 231.04,
    "U": 238.03,
}


UNIT_LABELS = {
    "mass": "grams",
    "moles": "moles",
    "particles": "particles",
}


@dataclass(frozen=True)
class ConversionStep:
    """One visible step in a conversion path."""

    title: str
    expression: str
    result: float
    unit: str
    color: str


@dataclass(frozen=True)
class ConversionResult:
    """Complete conversion output for the API and tests."""

    formula: str
    composition: Dict[str, int]
    molar_mass: float
    input_value: float
    from_unit: str
    to_unit: str
    result: float
    result_unit: str
    steps: List[ConversionStep]
    total_atoms: float


class FormulaError(ValueError):
    """Raised when a chemical formula cannot be parsed."""


class ConversionError(ValueError):
    """Raised when a unit conversion request is invalid."""


def normalize_formula(formula: str) -> str:
    """Return a formula with whitespace and hydrate dots removed."""

    cleaned = formula.replace(" ", "").replace("\t", "")
    cleaned = cleaned.replace("·", ".")
    if not cleaned:
        raise FormulaError("Enter a chemical formula, such as H2O or Ca(OH)2.")
    return cleaned


def parse_formula(formula: str) -> Dict[str, int]:
    """Parse a chemical formula into element counts.

    Supported examples include H2O, CO2, Ca(OH)2, Al2(SO4)3, and CuSO4.5H2O.
    Hydrate dots are handled by parsing each side as a formula segment.
    """

    cleaned = normalize_formula(formula)
    total: Dict[str, int] = {}

    for segment in cleaned.split("."):
        if not segment:
            raise FormulaError("Formula hydrate dots must separate formula parts.")
        multiplier, index = _read_leading_number(segment)
        counts, end_index = _parse_group(segment, index, stop_on_close=False)
        if end_index != len(segment):
            raise FormulaError(f"Unexpected formula text near '{segment[end_index:]}'.")
        _merge_counts(total, counts, multiplier)

    return total


def molar_mass_for(formula: str) -> Tuple[float, Dict[str, int]]:
    """Return molar mass and parsed composition for a formula."""

    composition = parse_formula(formula)
    mass = 0.0
    unknown_elements = [symbol for symbol in composition if symbol not in ATOMIC_MASSES]
    if unknown_elements:
        joined = ", ".join(sorted(unknown_elements))
        raise FormulaError(f"Unknown element symbol: {joined}.")

    for symbol, count in composition.items():
        mass += ATOMIC_MASSES[symbol] * count
    return mass, composition


def convert_amount(
    formula: str,
    value: float,
    from_unit: str,
    to_unit: str,
) -> ConversionResult:
    """Convert a sample amount between grams, moles, and particles."""

    if value <= 0:
        raise ConversionError("Enter a number greater than zero.")
    if from_unit not in UNIT_LABELS or to_unit not in UNIT_LABELS:
        raise ConversionError("Choose valid starting and ending units.")

    molar_mass, composition = molar_mass_for(formula)
    steps: List[ConversionStep] = []

    moles = _to_moles(value, from_unit, molar_mass, steps)
    result = _from_moles(moles, to_unit, molar_mass, steps)

    # If no math was needed, still show the user why the answer is unchanged.
    if from_unit == to_unit:
        steps.append(
            ConversionStep(
                title="No conversion needed",
                expression=f"{format_number(value)} {UNIT_LABELS[from_unit]} already matches the target unit.",
                result=value,
                unit=UNIT_LABELS[to_unit],
                color="blue",
            )
        )

    particles = _from_moles(moles, "particles", molar_mass, [])
    total_atoms = particles * sum(composition.values())

    return ConversionResult(
        formula=normalize_formula(formula),
        composition=composition,
        molar_mass=molar_mass,
        input_value=value,
        from_unit=from_unit,
        to_unit=to_unit,
        result=result,
        result_unit=UNIT_LABELS[to_unit],
        steps=steps,
        total_atoms=total_atoms,
    )


def serialize_result(result: ConversionResult) -> Dict[str, object]:
    """Convert dataclasses into JSON-friendly dictionaries."""

    return {
        "formula": result.formula,
        "composition": result.composition,
        "molarMass": result.molar_mass,
        "inputValue": result.input_value,
        "fromUnit": result.from_unit,
        "toUnit": result.to_unit,
        "result": result.result,
        "resultUnit": result.result_unit,
        "steps": [
            {
                "title": step.title,
                "expression": step.expression,
                "result": step.result,
                "unit": step.unit,
                "color": step.color,
            }
            for step in result.steps
        ],
        "totalAtoms": result.total_atoms,
    }


def format_number(value: float) -> str:
    """Format numbers compactly without hiding scientific notation."""

    if value == 0:
        return "0"
    absolute = abs(value)
    if absolute >= 1e6 or absolute < 0.001:
        return f"{value:.4e}"
    return f"{value:.6g}"


def _read_leading_number(text: str) -> Tuple[int, int]:
    digits = []
    index = 0
    while index < len(text) and text[index].isdigit():
        digits.append(text[index])
        index += 1
    if not digits:
        return 1, 0
    return int("".join(digits)), index


def _parse_group(text: str, start_index: int, stop_on_close: bool) -> Tuple[Dict[str, int], int]:
    counts: Dict[str, int] = {}
    index = start_index

    while index < len(text):
        character = text[index]

        if character == "(":
            nested_counts, index = _parse_group(text, index + 1, stop_on_close=True)
            multiplier, index = _read_number(text, index)
            _merge_counts(counts, nested_counts, multiplier)
            continue

        if character == ")":
            if not stop_on_close:
                raise FormulaError("Closing parenthesis does not match an opening parenthesis.")
            return counts, index + 1

        if character.isupper():
            symbol, index = _read_symbol(text, index)
            multiplier, index = _read_number(text, index)
            counts[symbol] = counts.get(symbol, 0) + multiplier
            continue

        raise FormulaError(f"Unexpected character '{character}' in formula.")

    if stop_on_close:
        raise FormulaError("Opening parenthesis does not have a matching closing parenthesis.")
    return counts, index


def _read_symbol(text: str, start_index: int) -> Tuple[str, int]:
    symbol = text[start_index]
    index = start_index + 1
    if index < len(text) and text[index].islower():
        symbol += text[index]
        index += 1
    return symbol, index


def _read_number(text: str, start_index: int) -> Tuple[int, int]:
    digits = []
    index = start_index
    while index < len(text) and text[index].isdigit():
        digits.append(text[index])
        index += 1
    if not digits:
        return 1, start_index
    return int("".join(digits)), index


def _merge_counts(target: Dict[str, int], source: Dict[str, int], multiplier: int) -> None:
    for symbol, count in source.items():
        target[symbol] = target.get(symbol, 0) + count * multiplier


def _to_moles(
    value: float,
    unit: str,
    molar_mass: float,
    steps: List[ConversionStep],
) -> float:
    if unit == "moles":
        return value

    if unit == "mass":
        result = value / molar_mass
        steps.append(
            ConversionStep(
                title="Mass to moles",
                expression=(
                    f"{format_number(value)} g x "
                    f"1 mol / {format_number(molar_mass)} g"
                ),
                result=result,
                unit="moles",
                color="green",
            )
        )
        return result

    result = value / AVOGADRO_NUMBER
    steps.append(
        ConversionStep(
            title="Particles to moles",
            expression=(
                f"{format_number(value)} particles x "
                f"1 mol / {format_number(AVOGADRO_NUMBER)} particles"
            ),
            result=result,
            unit="moles",
            color="violet",
        )
    )
    return result


def _from_moles(
    moles: float,
    unit: str,
    molar_mass: float,
    steps: List[ConversionStep],
) -> float:
    if unit == "moles":
        return moles

    if unit == "mass":
        result = moles * molar_mass
        steps.append(
            ConversionStep(
                title="Moles to mass",
                expression=(
                    f"{format_number(moles)} mol x "
                    f"{format_number(molar_mass)} g / 1 mol"
                ),
                result=result,
                unit="grams",
                color="orange",
            )
        )
        return result

    result = moles * AVOGADRO_NUMBER
    steps.append(
        ConversionStep(
            title="Moles to particles",
            expression=(
                f"{format_number(moles)} mol x "
                f"{format_number(AVOGADRO_NUMBER)} particles / 1 mol"
            ),
            result=result,
            unit="particles",
            color="red",
        )
    )
    return result


def composition_summary(composition: Dict[str, int]) -> Iterable[str]:
    """Yield readable composition entries, for example 'H: 2'."""

    for symbol in sorted(composition):
        yield f"{symbol}: {composition[symbol]}"
