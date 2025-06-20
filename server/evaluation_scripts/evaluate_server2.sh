#!/bin/bash

# Usage: ./evaluate_arithmetic_server.sh server.c <test_case_index>

SERVER_SRC=$1
TEST_CASE_IDX=$2
PORT=9037
EXEC=server_exec
TIMEOUT=5

# Define test cases
expressions=("3 + 5" "10 - 4" "6 * 7" "100 / 4" "abc + 5")
expected_outputs=("8" "6" "42" "25" "Error")
TOTAL_CASES=${#expressions[@]}

set -x  # Enable bash debug output

gcc "$SERVER_SRC" -o "$EXEC"
if [ $? -ne 0 ]; then
  echo "RESULT:FAIL:Compilation failed"
  exit 1
fi

# 2. Validate test index
if [ -z "$TEST_CASE_IDX" ]; then
  echo "RESULT:FAIL:No test case index provided"
  exit 2
fi
if ! [[ "$TEST_CASE_IDX" =~ ^[0-9]+$ ]]; then
  echo "RESULT:FAIL:Test case index is not a number"
  exit 2
fi
if [ "$TEST_CASE_IDX" -ge "$TOTAL_CASES" ] || [ "$TEST_CASE_IDX" -lt 0 ]; then
  echo "RESULT:FAIL:Invalid test case index"
  exit 2
fi

# 3. Run server
./"$EXEC" &
SERVER_PID=$!
sleep 2 

# 4. Send expression and receive result
INPUT="${expressions[$TEST_CASE_IDX]}"
EXPECTED="${expected_outputs[$TEST_CASE_IDX]}"

echo "DEBUG: Sending '$INPUT' to server on port $PORT"

OUTPUT=$(timeout $TIMEOUT bash -c "printf '$INPUT' | nc 127.0.0.1 $PORT")
EXIT_CODE=$?

echo "DEBUG: Raw OUTPUT: '$OUTPUT'"
echo "DEBUG: EXIT_CODE: $EXIT_CODE"

# 5. Cleanup
kill $SERVER_PID 2>/dev/null

# 6. Evaluate
OUTPUT=$(echo "$OUTPUT" | tr -d '\r\n')
EXPECTED=$(echo "$EXPECTED" | tr -d '\r\n')

echo "DEBUG: Normalized OUTPUT: '$OUTPUT'"
echo "DEBUG: Normalized EXPECTED: '$EXPECTED'"

if [ $EXIT_CODE -ne 0 ]; then
  echo "RESULT:FAIL:Client connection failed or timed out"
  exit 1
fi

if [ "$OUTPUT" = "$EXPECTED" ]; then
  echo "RESULT:PASS:Expression '$INPUT' => $OUTPUT"
  exit 0
else
  echo "RESULT:FAIL:Expression '$INPUT' => '$OUTPUT' (expected '$EXPECTED')"
  exit 1
fi
