import unittest

from stoichiometrical.conversions import (
    FormulaError,
    AVOGADRO_NUMBER,
    convert_amount,
    parse_formula,
    serialize_result,
)


class FormulaParsingTests(unittest.TestCase):
    def test_parses_simple_formula(self):
        self.assertEqual(parse_formula("H2O"), {"H": 2, "O": 1})

    def test_parses_parentheses(self):
        self.assertEqual(parse_formula("Ca(OH)2"), {"Ca": 1, "O": 2, "H": 2})

    def test_parses_hydrate_dot(self):
        self.assertEqual(parse_formula("CuSO4.5H2O"), {"Cu": 1, "S": 1, "O": 9, "H": 10})

    def test_rejects_unmatched_parentheses(self):
        with self.assertRaises(FormulaError):
            parse_formula("Ca(OH")

        with self.assertRaises(FormulaError):
            parse_formula("H2O)")


class ConversionTests(unittest.TestCase):
    def test_mass_to_particles_for_water(self):
        result = convert_amount("H2O", 18.015, "mass", "particles")
        self.assertAlmostEqual(result.result / AVOGADRO_NUMBER, 1.0, places=4)
        self.assertEqual([step.title for step in result.steps], ["Mass to moles", "Moles to particles"])

    def test_particles_to_mass_for_carbon_dioxide(self):
        result = convert_amount("CO2", AVOGADRO_NUMBER, "particles", "mass")
        self.assertAlmostEqual(result.result, 44.009, places=3)

    def test_moles_to_mass_for_calcium_hydroxide(self):
        result = convert_amount("Ca(OH)2", 2, "moles", "mass")
        self.assertAlmostEqual(result.result, 148.184, places=3)

    def test_bad_amount_has_friendly_error(self):
        with self.assertRaisesRegex(ValueError, "greater than zero"):
            convert_amount("H2O", 0, "mass", "moles")

    def test_serialized_shape_matches_frontend(self):
        payload = serialize_result(convert_amount("H2O", 18.015, "mass", "moles"))
        self.assertIn("molarMass", payload)
        self.assertIn("totalAtoms", payload)
        self.assertNotIn("molar_mass", payload)


if __name__ == "__main__":
    unittest.main()
