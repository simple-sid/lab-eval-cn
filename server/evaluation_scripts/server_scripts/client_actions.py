import socket
import threading
import time
from validators import validate_output

def run_tcp_clients(port, testcase, num_clients, client_delay, periodic=False):
    results = []
    threads = []
    actual_outputs = []  # Store actual server outputs

    def client_thread(idx):
        try:
            s = socket.create_connection(('127.0.0.1', port), timeout=5)  # Increased timeout
            for step in testcase.get("steps", [{"input": testcase.get("input", "")}]):
                msg = step.get("input", "")
                if periodic:
                    # Periodically send message with retransmit logic
                    for _ in range(step.get("count", 3)):
                        s.sendall(msg.encode())
                        time.sleep(step.get("interval", 1))
                else:
                    # Print the message being sent for debugging
                    print(f"Client {idx} sending: '{msg}'")
                    s.sendall(msg.encode())
                    
                # Read response
                data = s.recv(4096).decode().strip()
                print(f"Client {idx} received: '{data}'")
                
                # Save actual server output
                actual_outputs.append(data)
                
                # Validate against expected
                expected = step.get("expectedOutput", testcase.get("expectedOutput", ""))
                match_type = step.get("matchType", testcase.get("matchType", "contains"))
                valid, _ = validate_output(data, expected, match_type)
                results.append((valid, data))
            s.close()
        except Exception as e:
            error_msg = f"Error: {e}"
            print(f"Client {idx} error: {error_msg}")
            results.append((False, error_msg))
            actual_outputs.append(error_msg)

    # Spawn concurrent clients
    for i in range(num_clients):
        t = threading.Thread(target=client_thread, args=(i,))
        t.start()
        threads.append(t)
        time.sleep(client_delay)
    for t in threads:
        t.join()

    # Compile the actual outputs for better reporting
    output_summary = ", ".join(actual_outputs)
    
    if all(r[0] for r in results):
        # Return PASS with the actual server output included
        return "PASS", f"{output_summary}"
    else:
        # Return FAIL with details on what the server actually returned
        failed_outputs = [r[1] for r in results if not r[0]]
        return "FAIL", f"Server output: {output_summary}. Failed outputs: {failed_outputs}"

def run_udp_clients(port, testcase, num_clients, client_delay):
    results = []
    threads = []
    actual_outputs = []  # Store actual server outputs

    def client_thread(idx):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(5)  # Increase timeout
            msg = testcase.get("input", "")
            print(f"UDP Client {idx} sending: '{msg}'")
            s.sendto(msg.encode(), ('127.0.0.1', port))
            data, _ = s.recvfrom(4096)
            data = data.decode().strip()
            print(f"UDP Client {idx} received: '{data}'")
            actual_outputs.append(data)
            valid, _ = validate_output(data, testcase.get("expectedOutput", ""), testcase.get("matchType", "contains"))
            results.append((valid, data))
            s.close()
        except Exception as e:
            error_msg = f"Error: {e}"
            print(f"UDP Client {idx} error: {error_msg}")
            results.append((False, error_msg))
            actual_outputs.append(error_msg)

    for i in range(num_clients):
        t = threading.Thread(target=client_thread, args=(i,))
        t.start()
        threads.append(t)
        time.sleep(client_delay)
    for t in threads:
        t.join()

    # Compile the actual outputs for better reporting
    output_summary = ", ".join(actual_outputs)
    
    if all(r[0] for r in results):
        # Return PASS with the actual server output included
        return "PASS", f"{output_summary}"
    else:
        # Return FAIL with details on what the server actually returned
        failed_outputs = [r[1] for r in results if not r[0]]
        return "FAIL", f"Server output: {output_summary}. Failed outputs: {failed_outputs}"

def run_chatroom_test(port, testcase):
    # Multiple clients join, each sends a message, all others should receive it
    client_msgs = testcase.get("chatMessages", ["Hello", "World"])
    num_clients = len(client_msgs)
    received_msgs = [[] for _ in range(num_clients)]
    threads = []

    def chat_client(idx, mymsg):
        s = socket.create_connection(('127.0.0.1', port), timeout=3)
        s.sendall(mymsg.encode())
        for _ in range(num_clients - 1):
            data = s.recv(4096).decode().strip()
            received_msgs[idx].append(data)
        s.close()

    for i, msg in enumerate(client_msgs):
        t = threading.Thread(target=chat_client, args=(i, msg))
        t.start()
        threads.append(t)
    for t in threads:
        t.join()

    # Check all clients received all other messages
    expected = set(client_msgs)
    for i in range(num_clients):
        others = expected - {client_msgs[i]}
        if set(received_msgs[i]) != others:
            return "FAIL", f"Client {i} did not receive all other messages: {received_msgs[i]}"
    return "PASS", "All clients received all chat messages"

def run_stop_and_wait_test(port, testcase):
    # Simulate stop-and-wait protocol: client sends packets, waits for ack before next
    packets = testcase.get("packets", ["pkt1", "pkt2", "pkt3"])
    acks_expected = testcase.get("acksExpected", ["ACK1", "ACK2", "ACK3"])
    s = socket.create_connection(('127.0.0.1', port), timeout=3)
    for pkt, expected_ack in zip(packets, acks_expected):
        s.sendall(pkt.encode())
        ack = s.recv(4096).decode().strip()
        valid, _ = validate_output(ack, expected_ack, testcase.get("matchType", "exact"))
        if not valid:
            s.close()
            return "FAIL", f"Expected {expected_ack}, got {ack}"
    s.close()
    return "PASS", "Stop-and-wait simulation successful"

def run_multistep_test(port, testcase):
    # Multi-step protocol: sequence of input/expectedOutput
    s = socket.create_connection(('127.0.0.1', port), timeout=3)
    for step in testcase.get("steps", []):
        s.sendall(step.get("input", "").encode())
        data = s.recv(4096).decode().strip()
        valid, _ = validate_output(data, step.get("expectedOutput", ""), step.get("matchType", "contains"))
        if not valid:
            s.close()
            return "FAIL", f"Expected {step.get('expectedOutput','')}, got {data}"
    s.close()
    return "PASS", "Multi-step protocol test passed"

def run_error_handling_test(port, testcase):
    """
    Test how server handles error conditions and edge cases
    - Invalid commands
    - Malformed input
    - Boundary conditions
    """
    tests = testcase.get("errorTests", [
        {"input": "INVALID", "expectedOutput": "ERROR", "description": "Invalid command"},
        {"input": "!@#$%", "expectedOutput": "ERROR", "description": "Malformed input"}
    ])
    
    results = []
    s = socket.create_connection(('127.0.0.1', port), timeout=3)
    
    for test in tests:
        try:
            s.sendall(test["input"].encode())
            data = s.recv(4096).decode().strip()
            expected = test.get("expectedOutput", "ERROR")
            match_type = test.get("matchType", "contains")
            valid, _ = validate_output(data, expected, match_type)
            results.append((valid, test["description"], data))
        except Exception as e:
            results.append((False, test["description"], f"Error: {e}"))
    
    s.close()
    
    if all(r[0] for r in results):
        return "PASS", "Server handled all error conditions appropriately"
    else:
        failed = [f"{r[1]}: got '{r[2]}'" for r in results if not r[0]]
        return "FAIL", f"Server failed to handle some error conditions: {failed}"

def run_connection_reliability_test(port, testcase):
    """
    Test server's ability to handle connection issues:
    - Reconnection attempts
    - Connection flooding
    - Unexpected disconnects
    """
    success_count = 0
    attempts = testcase.get("connectionAttempts", 5)
    timeout = testcase.get("connectionTimeout", 1)
    delay = testcase.get("reconnectDelay", 0.5)
    
    for i in range(attempts):
        try:
            # Connect, immediately disconnect
            s = socket.create_connection(('127.0.0.1', port), timeout=timeout)
            s.close()
            success_count += 1
            
            # Short delay between reconnection attempts
            time.sleep(delay)
        except Exception as e:
            pass
    
    # Measure successful connection rate
    success_rate = (success_count / attempts) * 100
    min_success_rate = testcase.get("minSuccessRate", 80)
    
    if success_rate >= min_success_rate:
        return "PASS", f"Connection reliability test passed with {success_rate:.1f}% success rate"
    else:
        return "FAIL", f"Connection reliability test failed with only {success_rate:.1f}% success rate"

def run_performance_test(port, testcase):
    """
    Test server performance under load:
    - Response time
    - Concurrent connection handling
    - Data throughput
    """
    message_size = testcase.get("messageSize", 1024)
    num_requests = testcase.get("numRequests", 10)
    max_response_time = testcase.get("maxResponseTime", 0.5)
    concurrent_clients = testcase.get("concurrentClients", 5)
    
    results = []
    threads = []
    response_times = []
    
    def performance_client():
        try:
            # Generate a message of specified size
            message = "X" * message_size
            
            s = socket.create_connection(('127.0.0.1', port), timeout=3)
            total_time = 0
            
            for _ in range(num_requests):
                start_time = time.time()
                s.sendall(message.encode())
                data = s.recv(4096)
                end_time = time.time()
                
                response_time = end_time - start_time
                response_times.append(response_time)
                total_time += response_time
            
            s.close()
            avg_time = total_time / num_requests
            results.append((avg_time <= max_response_time, avg_time))
        except Exception as e:
            results.append((False, f"Error: {e}"))
    
    # Start concurrent clients
    for _ in range(concurrent_clients):
        t = threading.Thread(target=performance_client)
        t.start()
        threads.append(t)
    
    # Wait for all clients to finish
    for t in threads:
        t.join()
    
    # Calculate overall metrics
    success_count = sum(1 for r in results if r[0])
    if not response_times:
        return "FAIL", "No successful responses received"
    
    avg_response = sum(response_times) / len(response_times)
    max_response = max(response_times)
    min_response = min(response_times)
    
    if success_count == concurrent_clients:
        return "PASS", f"Performance test passed: avg={avg_response:.3f}s, min={min_response:.3f}s, max={max_response:.3f}s"
    else:
        return "FAIL", f"Performance test failed: {success_count}/{concurrent_clients} clients succeeded, avg={avg_response:.3f}s"