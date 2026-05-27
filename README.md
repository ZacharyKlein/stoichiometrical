# Stoichiometrical

Stoichiometrical is a small Python-based web app for learning stoichiometric
unit conversions. It converts between mass, moles, and particles while showing
each intermediate step and highlighting the relationship map used to get there.
It also includes an element-focus mode for percent-composition questions, such
as finding the mass percent of `Cl` in `HCl`, and for finding formula units in
a sample from grams or moles. A third mode finds empirical formulas from a set
of element compositions entered as grams, moles, or percent composition.

## Run

```bash
python3 app.py
```

Open http://127.0.0.1:8000 in your browser.

## Test

```bash
python3 -m unittest discover -s tests
```

## What it Teaches

- Mass uses molar mass: `grams / (grams per mole) = moles`.
- Particles use Avogadro's number: `particles / 6.02214076e23 = moles`.
- Every conversion passes through moles, so students can see the bridge between
  grams and particles.
- Element mass percent compares one element's mass contribution to the full
  molar mass: `(element mass / compound molar mass) x 100`.
- Formula units in a sample convert the sample amount to moles, then multiply
  by Avogadro's number.
- Empirical formula problems convert each element amount to moles, divide by
  the smallest mole amount, and scale to the simplest whole-number ratio.

The formula parser supports common classroom formulas such as `H2O`, `CO2`,
`Ca(OH)2`, `Al2(SO4)3`, and hydrate notation like `CuSO4.5H2O`.
