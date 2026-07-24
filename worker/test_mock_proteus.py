import unittest

from mock_proteus import simulate


class MockProteusTests(unittest.TestCase):
    def test_balanced_recipe_meets_demo_guardrails(self) -> None:
        result = simulate({
            "maskBiasNm": 1.4,
            "fragmentLimit": 240,
            "smoothing": 0.62,
            "serifStrength": 0.72,
        })

        self.assertLessEqual(result["epeP95Nm"], 3)
        self.assertLessEqual(result["pvBandNm"], 10)
        self.assertGreaterEqual(result["processWindowScore"], 85)

    def test_out_of_range_recipe_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            simulate({"maskBiasNm": 99, "fragmentLimit": 240})


if __name__ == "__main__":
    unittest.main()