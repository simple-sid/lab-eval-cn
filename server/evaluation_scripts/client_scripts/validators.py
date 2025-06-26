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
        # Accept if any recognizable datetime in output
        date_patterns = [
            r'\d{1,2}:\d{2}:\d{2}',
            r'\d{1,2}/\d{1,2}/\d{4}',
            r'\d{4}-\d{1,2}-\d{1,2}',
            r'[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{1,2}:\d{2}:\d{2}'
        ]
        if any(re.search(p, actual) for p in date_patterns):
            return True, actual
        return False, actual
    elif match_type == "set":
        if isinstance(actual, str):
            actual = [actual]
        return set(actual) == set(expected), actual
    elif match_type == "in":
        return expected in actual, actual
    else:  # contains
        return expected in actual, actual