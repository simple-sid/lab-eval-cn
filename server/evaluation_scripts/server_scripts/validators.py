import re
import datetime

def validate_output(actual, expected, match_type="contains"):
    if match_type == "exact":
        return actual == expected, actual
    elif match_type == "regex":
        pattern = re.compile(expected)
        match = pattern.search(actual)
        return bool(match), actual
    elif match_type == "datetime":
        date_formats = [
            "%a %b %d %H:%M:%S %Y",
            "%Y-%m-%d %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
            "%m/%d/%Y %H:%M:%S",
            "%H:%M:%S %d-%m-%Y"
        ]
        for fmt in date_formats:
            try:
                datetime.datetime.strptime(actual, fmt)
                return True, actual
            except ValueError:
                continue
        date_pattern = re.compile(r'(\d+[-/: ]\d+[-/: ]\d+)')
        if date_pattern.search(actual):
            return True, actual
        if actual.strip().isdigit() and len(actual.strip()) >= 9:
            return True, actual
        return False, actual
    elif match_type == "set":
        # expected is a list, actual is a string or list
        if isinstance(actual, str):
            actual = [actual]
        return set(actual) == set(expected), actual
    elif match_type == "in":
        # expected is a substring
        return expected in actual, actual
    else:  # Default: contains
        return actual in expected, actual