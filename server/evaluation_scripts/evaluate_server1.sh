#!/bin/bash

# Usage: ./evaluate_server1.sh server.c <test_case_index>
SERVER_SRC=$1
PORT=8080
EXEC=server_exec
TIMEOUT=15

# Regex for ctime format (e.g., Wed Jun 19 22:10:00 2025)
DT_REGEX='[A-Z][a-z][a-z] [A-Z][a-z][a-z] [ 0-9][0-9] [0-9]{2}:[0-9]{2}:[0-9]{2} [0-9]{4}'

echo "DEBUG: Compiling $SERVER_SRC..."
gcc "$SERVER_SRC" -o "$EXEC"
compile_status=$?
if [ $compile_status -ne 0 ]; then
  echo "RESULT:FAIL:Compilation Failed (exit code $compile_status)"
  exit 1
fi

echo "DEBUG: Starting server..."
./"$EXEC" &
SERVER_PID=$!
sleep 2
echo "DEBUG: Server PID is $SERVER_PID"

OUTPUT=$(timeout $TIMEOUT bash -c "echo | nc 127.0.0.1 $PORT")
OUT_EXIT=$?
echo "DEBUG: Client output: $OUTPUT"
echo "DEBUG: Client exit code: $OUT_EXIT"

kill $SERVER_PID 2>/dev/null
sleep 1

if [[ $OUTPUT =~ $DT_REGEX ]]; then
  echo "RESULT:PASS:$OUTPUT"
  exit 0
else
  echo "RESULT:FAIL:$OUTPUT"
  exit 1
fi