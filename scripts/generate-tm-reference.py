import json
from pathlib import Path

import primer3


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "test-data" / "reference" / "tm-reference.json"


def calc_tm(sequence: str, parameters: dict) -> float:
    return float(
        primer3.bindings.calc_tm(
            sequence,
            mv_conc=parameters["mv_conc_mM"],
            dv_conc=parameters["dv_conc_mM"],
            dntp_conc=parameters["dntp_conc_mM"],
            dna_conc=parameters["dna_conc_nM"],
            dmso_conc=parameters["dmso_conc_percent"],
            dmso_fact=parameters["dmso_fact_celsius_per_percent"],
            annealing_temp_c=parameters["annealing_temp_celsius"],
            max_nn_length=parameters["max_nn_length"],
            tm_method=parameters["tm_method"],
            salt_corrections_method=parameters["salt_corrections_method"],
        )
    )


def is_self_complementary(sequence: str) -> bool:
    complement = {"A": "T", "T": "A", "C": "G", "G": "C"}
    normalized = "".join(sequence.upper().split())
    return bool(normalized) and "".join(complement.get(base, "N") for base in reversed(normalized)) == normalized


default_parameters = {
    "mv_conc_mM": 50.0,
    "dv_conc_mM": 1.5,
    "dntp_conc_mM": 0.2,
    "dna_conc_nM": 500.0,
    "dmso_conc_percent": 0.0,
    "dmso_fact_celsius_per_percent": 0.6,
    "annealing_temp_celsius": -10.0,
    "max_nn_length": 60,
    "tm_method": "santalucia",
    "salt_corrections_method": "owczarzy",
}


curated_cases = [
    {
        "name": "balanced-8mer-default",
        "sequence": "ATGCATGC",
        "coverageTags": ["composition", "length"],
        "parameters": {},
        "toleranceCelsius": 1.5,
    },
    {
        "name": "at-rich-8mer-default",
        "sequence": "AATTATTA",
        "coverageTags": ["composition", "length"],
        "parameters": {},
        "toleranceCelsius": 1.5,
    },
    {
        "name": "gc-rich-8mer-default",
        "sequence": "GCGCGCGC",
        "coverageTags": ["composition", "length", "symmetry"],
        "parameters": {},
        "toleranceCelsius": 1.5,
    },
    {
        "name": "mixed-10mer-default",
        "sequence": "GATCGATCGA",
        "coverageTags": ["composition", "length"],
        "parameters": {},
        "toleranceCelsius": 1.5,
    },
    {
        "name": "balanced-12mer-default",
        "sequence": "ATGCGTACGTAG",
        "coverageTags": ["composition", "length"],
        "parameters": {},
        "toleranceCelsius": 1.25,
    },
    {
        "name": "at-rich-12mer-default",
        "sequence": "AATTAATTTAAT",
        "coverageTags": ["composition", "length"],
        "parameters": {},
        "toleranceCelsius": 1.25,
    },
    {
        "name": "gc-rich-12mer-default",
        "sequence": "GCGCGGCCGCGC",
        "coverageTags": ["composition", "length"],
        "parameters": {},
        "toleranceCelsius": 1.25,
    },
    {
        "name": "short-2mer-default",
        "sequence": "AT",
        "coverageTags": ["length"],
        "parameters": {},
        "toleranceCelsius": 3.0,
    },
    {
        "name": "short-4mer-default",
        "sequence": "ATGC",
        "coverageTags": ["length"],
        "parameters": {},
        "toleranceCelsius": 2.0,
    },
    {
        "name": "mixed-16mer-default",
        "sequence": "ATGACTGACCGTACGT",
        "coverageTags": ["composition", "length"],
        "parameters": {},
        "toleranceCelsius": 1.0,
    },
    {
        "name": "mixed-20mer-default",
        "sequence": "GATCGATCGATCGATCGATC",
        "coverageTags": ["composition", "length"],
        "parameters": {},
        "toleranceCelsius": 1.0,
    },
    {
        "name": "balanced-24mer-default",
        "sequence": "ATGGCCATTGTAATGGGCCGCTGA",
        "coverageTags": ["composition", "length"],
        "parameters": {},
        "toleranceCelsius": 1.0,
    },
    {
        "name": "at-rich-30mer-default",
        "sequence": "AATAATAATTATAATTAATAATAATTATAA",
        "coverageTags": ["composition", "length"],
        "parameters": {},
        "toleranceCelsius": 1.0,
    },
    {
        "name": "gc-rich-30mer-default",
        "sequence": "GCGCGCGGCCGCGCGGCCGCGCGGCCGCGC",
        "coverageTags": ["composition", "length"],
        "parameters": {},
        "toleranceCelsius": 1.0,
    },
    {
        "name": "default-sequence-low-monovalent-10mM",
        "sequence": "GATCGATCGATCGATCGATC",
        "coverageTags": ["monovalent-salt"],
        "parameters": {"mv_conc_mM": 10.0},
        "toleranceCelsius": 2.0,
    },
    {
        "name": "default-sequence-high-monovalent-200mM",
        "sequence": "GATCGATCGATCGATCGATC",
        "coverageTags": ["monovalent-salt"],
        "parameters": {"mv_conc_mM": 200.0},
        "toleranceCelsius": 2.0,
    },
    {
        "name": "default-sequence-very-low-monovalent-1mM",
        "sequence": "GATCGATCGATCGATCGATC",
        "coverageTags": ["monovalent-salt"],
        "parameters": {"mv_conc_mM": 1.0},
        "toleranceCelsius": 3.0,
    },
    {
        "name": "default-sequence-zero-magnesium",
        "sequence": "GATCGATCGATCGATCGATC",
        "coverageTags": ["magnesium"],
        "parameters": {"dv_conc_mM": 0.0, "dntp_conc_mM": 0.0},
        "toleranceCelsius": 2.0,
    },
    {
        "name": "default-sequence-high-magnesium",
        "sequence": "GATCGATCGATCGATCGATC",
        "coverageTags": ["magnesium"],
        "parameters": {"dv_conc_mM": 4.0},
        "toleranceCelsius": 2.5,
    },
    {
        "name": "default-sequence-high-dntp-chelation",
        "sequence": "GATCGATCGATCGATCGATC",
        "coverageTags": ["magnesium", "dntp"],
        "parameters": {"dv_conc_mM": 1.5, "dntp_conc_mM": 1.4},
        "toleranceCelsius": 2.5,
    },
    {
        "name": "default-sequence-excess-dntp",
        "sequence": "GATCGATCGATCGATCGATC",
        "coverageTags": ["magnesium", "dntp"],
        "parameters": {"dv_conc_mM": 1.5, "dntp_conc_mM": 2.0},
        "toleranceCelsius": 3.0,
    },
    {
        "name": "default-sequence-dmso-5pct",
        "sequence": "GATCGATCGATCGATCGATC",
        "coverageTags": ["dmso"],
        "parameters": {"dmso_conc_percent": 5.0},
        "toleranceCelsius": 1.0,
    },
    {
        "name": "default-sequence-dmso-10pct",
        "sequence": "GATCGATCGATCGATCGATC",
        "coverageTags": ["dmso"],
        "parameters": {"dmso_conc_percent": 10.0},
        "toleranceCelsius": 1.0,
    },
    {
        "name": "default-sequence-low-dna-conc",
        "sequence": "GATCGATCGATCGATCGATC",
        "coverageTags": ["concentration"],
        "parameters": {"dna_conc_nM": 50.0},
        "toleranceCelsius": 1.0,
    },
    {
        "name": "default-sequence-high-dna-conc",
        "sequence": "GATCGATCGATCGATCGATC",
        "coverageTags": ["concentration"],
        "parameters": {"dna_conc_nM": 2000.0},
        "toleranceCelsius": 1.0,
    },
    {
        "name": "self-complementary-6mer",
        "sequence": "ATCGAT",
        "coverageTags": ["symmetry", "length"],
        "parameters": {},
        "toleranceCelsius": 2.0,
    },
    {
        "name": "self-complementary-12mer",
        "sequence": "AGCTAGCTAGCT",
        "coverageTags": ["symmetry", "length"],
        "parameters": {},
        "toleranceCelsius": 1.5,
    },
    {
        "name": "terminal-gc-bias",
        "sequence": "GCGTATATATGC",
        "coverageTags": ["composition"],
        "parameters": {},
        "toleranceCelsius": 1.5,
    },
    {
        "name": "mixed-conditions-long-fragment",
        "sequence": "ATGGCCATTGTAATGGGCCGCTGA",
        "coverageTags": ["length", "monovalent-salt", "magnesium", "dmso", "concentration"],
        "parameters": {
            "mv_conc_mM": 75.0,
            "dv_conc_mM": 2.5,
            "dntp_conc_mM": 0.2,
            "dna_conc_nM": 250.0,
            "dmso_conc_percent": 3.0,
        },
        "toleranceCelsius": 2.0,
    },
    {
        "name": "mixed-conditions-short-fragment",
        "sequence": "ATGCGTACGTAG",
        "coverageTags": ["length", "monovalent-salt", "magnesium", "dntp", "dmso", "concentration"],
        "parameters": {
            "mv_conc_mM": 25.0,
            "dv_conc_mM": 3.0,
            "dntp_conc_mM": 0.5,
            "dna_conc_nM": 1000.0,
            "dmso_conc_percent": 2.0,
        },
        "toleranceCelsius": 2.5,
    },
    {
        "name": "ambiguous-base-rejection",
        "sequence": "NNNNNN",
        "coverageTags": ["rejection"],
        "parameters": {},
        "toleranceCelsius": 0.0,
        "expectError": True,
    },
    {
        "name": "unsupported-base-rejection",
        "sequence": "ATGB",
        "coverageTags": ["rejection"],
        "parameters": {},
        "toleranceCelsius": 0.0,
        "expectError": True,
    },
]


fixtures = {
    "fixtureFormatVersion": 1,
    "generatedBy": {
        "script": "scripts/generate-tm-reference.py",
        "referenceToolName": "primer3-py",
        "referenceToolVersion": primer3.__version__,
        "referenceFunction": "primer3.bindings.calc_tm",
    },
    "cases": [],
}

for case in curated_cases:
    parameters = {**default_parameters, **case.get("parameters", {})}
    fixture = {
        "name": case["name"],
        "sequence": case["sequence"],
        "coverageTags": case["coverageTags"],
        "referenceTool": {
            "name": "primer3-py",
            "version": primer3.__version__,
            "function": "primer3.bindings.calc_tm",
        },
        "parameters": parameters,
        "toleranceCelsius": case["toleranceCelsius"],
        "expected": {
            "selfComplementary": is_self_complementary(case["sequence"]),
        },
    }

    if case.get("expectError"):
        try:
            calc_tm(case["sequence"], parameters)
        except Exception as error:  # pragma: no cover - fixture generation script
            fixture["expected"]["errorType"] = type(error).__name__
            fixture["expected"]["errorContains"] = str(error)
        else:  # pragma: no cover - defensive
            raise RuntimeError(f"Expected primer3 rejection for fixture {case['name']}")
    else:
        fixture["expected"]["correctedTmCelsius"] = round(calc_tm(case["sequence"], parameters), 6)

    fixtures["cases"].append(fixture)

OUTPUT.write_text(json.dumps(fixtures, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {len(fixtures['cases'])} Tm fixtures to {OUTPUT}")
