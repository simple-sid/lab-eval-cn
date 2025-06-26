import argparse
import json
import sys
from utils import find_free_port, compile_program, patch_client_port
from test_servers import (
    start_tcp_server, start_udp_server, start_chatroom_server, 
    start_stop_and_wait_server, start_multistep_server
)
from validators import validate_output

def log_debug(msg):
    with open('/tmp/evaluate_client_debug.log', 'a') as f:
        f.write(msg + '\n')
    print(msg)

def evaluate_client(client_src, testcase):
    port = find_free_port()
    protocol = testcase.get("protocol", "tcp")
    client_count = testcase.get("clientCount", 1)
    client_delay = testcase.get("clientDelay", 0.2)
    chatroom = testcase.get("chatroom", False)
    stop_and_wait = testcase.get("stopAndWait", False)
    multistep = testcase.get("multiStep", False)
    periodic = testcase.get("periodicSend", False)

    # Always patch client source code to use the test port
    patch_pattern = testcase.get("portPattern", r'#define\s+PORT\s+\d+')
    try:
        patch_client_port(client_src, patch_pattern, port)
    except Exception as e:
        log_debug(f"Warning: Failed to patch client port: {e}")

    # Compile client
    success, _, stderr = compile_program(client_src, output_name="client_exec")
    if not success:
        return "FAIL", f"Compilation failed: {stderr.decode()}"
    
    # Start the reference/mock server for testing
    log_debug(f"Setting up mock server for client test: {testcase.get('description', '')}")
    if chatroom:
        server, server_thread, server_state = start_chatroom_server(port, testcase, client_count)
    elif stop_and_wait:
        server, server_thread, server_state = start_stop_and_wait_server(port, testcase)
    elif multistep:
        server, server_thread, server_state = start_multistep_server(port, testcase)
    elif protocol == "udp":
        server, server_thread, server_state = start_udp_server(port, testcase)
    else:
        # Default TCP server with scripted responses
        if "serverScript" in testcase:
            log_debug(f"Using serverScript: {testcase['serverScript']}")
        else:
            log_debug("Warning: No serverScript defined for TCP test")
        server, server_thread, server_state = start_tcp_server(port, testcase)

    # Run clients (concurrent if needed)
    from utils import run_clients
    status, msg = run_clients(port, client_count, client_delay, periodic, testcase, server_state)

    # Clean up server
    server.shutdown()
    server.server_close()
    server_thread.join(timeout=2)

    return status, msg

def main():
    parser = argparse.ArgumentParser(description="Universal CN Lab Client Evaluator")
    parser.add_argument("client_file", help="Client source code file")
    parser.add_argument("test_file", help="Test case file (JSON)")
    parser.add_argument("test_idx", type=int, help="Test case index")
    args = parser.parse_args()
    
    with open(args.test_file, "r") as f:
        data = json.load(f)
    testcase = data["testCases"]["client"][args.test_idx] if "client" in data["testCases"] else data["testCases"][args.test_idx]

    status, message = evaluate_client(args.client_file, testcase)
    log_debug(f"RESULT:{status}:{message}")
    if status != "PASS":
        log_debug(f"[DEBUG] Exiting with code 1 due to status: {status}, message: {message}")
    else:
        log_debug(f"[DEBUG] Exiting with code 0 (PASS)")
    sys.exit(0 if status == "PASS" else 1)

if __name__ == "__main__":
    main()