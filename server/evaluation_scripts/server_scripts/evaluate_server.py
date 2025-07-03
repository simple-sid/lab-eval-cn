import argparse
import json
import sys
from utils import (
    find_free_port, modify_server_port, compile_program, wait_for_server, start_server, stop_server
)
from client_actions import (
    run_tcp_clients, run_udp_clients, run_chatroom_test, run_stop_and_wait_test, run_multistep_test,
    run_error_handling_test, run_connection_reliability_test, run_performance_test
)
from validators import validate_output

def main():
    parser = argparse.ArgumentParser(description="Universal CN Lab Server Evaluator")
    parser.add_argument("server_file", help="Server source code (C)")
    parser.add_argument("test_file", help="Testcases JSON file")
    parser.add_argument("test_idx", type=int, help="Testcase index")
    args = parser.parse_args()

    # Load testcase
    with open(args.test_file, "r") as f:
        data = json.load(f)
    testcase = data["testCases"][args.test_idx]

    protocol = testcase.get("protocol", "tcp")
    client_count = testcase.get("clientCount", 1)
    client_delay = testcase.get("clientDelay", 0.2)
    chatroom = testcase.get("chatroom", False)
    stop_and_wait = testcase.get("stopAndWait", False)
    multistep = testcase.get("multiStep", False)
    periodic = testcase.get("periodicSend", False)
    error_handling = testcase.get("errorHandling", False)
    connection_reliability = testcase.get("connectionReliability", False)
    performance = testcase.get("performance", False)

    # Find free port and patch server code
    port = find_free_port()
    modify_server_port(args.server_file, port)
    success, _, stderr = compile_program(args.server_file)
    if not success:
        print(f"RESULT:FAIL:Compilation failed: {stderr.decode()}")
        sys.exit(1)

    # Start server
    server_proc = start_server(port)
    if not wait_for_server(port, protocol=protocol):
        stop_server(server_proc)
        print("RESULT:FAIL:Server failed to start or bind to port")
        sys.exit(1)

    try:
        if chatroom:
            status, msg = run_chatroom_test(port, testcase)
        elif stop_and_wait:
            status, msg = run_stop_and_wait_test(port, testcase)
        elif multistep:
            status, msg = run_multistep_test(port, testcase)
        elif error_handling:
            status, msg = run_error_handling_test(port, testcase)
        elif connection_reliability:
            status, msg = run_connection_reliability_test(port, testcase)
        elif performance:
            status, msg = run_performance_test(port, testcase)
        elif protocol == "udp":
            status, msg = run_udp_clients(port, testcase, client_count, client_delay)
        else:  # default TCP
            status, msg = run_tcp_clients(port, testcase, client_count, client_delay, periodic)
    finally:
        stop_server(server_proc)
    print(f"RESULT:{status}:{msg}")
    sys.exit(0 if status == "PASS" else 1)

if __name__ == "__main__":
    main()