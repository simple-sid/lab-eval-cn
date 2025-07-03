import socket
import os
import re
import subprocess
import threading
import time
import select  # For non-blocking I/O
from validators import validate_output

def find_free_port():
    with socket.socket() as s:
        s.bind(('localhost', 0))
        return s.getsockname()[1]

def compile_program(src_file, output_name="client_exec"):
    result = subprocess.run(
        ["gcc", src_file, "-o", output_name],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    return result.returncode == 0, result.stdout, result.stderr

def patch_client_port(client_src, port_pattern, port):
    print(f"Patching client port in {client_src} to {port}")
    with open(client_src, 'r') as f:
        code = f.read()
        
    # Default pattern if none specified
    if not port_pattern:
        port_pattern = r'#define\s+PORT\s+\d+'
        
    modified = re.sub(port_pattern, f"#define PORT {port}", code)
    
    print(f"Original line: {re.search(port_pattern, code).group(0) if re.search(port_pattern, code) else 'NOT FOUND'}")
    print(f"Modified to: #define PORT {port}")
    
    with open(client_src, 'w') as f:
        f.write(modified)

def read_nonblocking(fd, timeout=0.2):
    """Read from file descriptor without blocking for too long"""
    import select
    import os
    
    result = ""
    end_time = time.time() + timeout
    
    while time.time() < end_time:
        try:
            ready = select.select([fd], [], [], 0.1)
            if not ready[0]:
                time.sleep(0.05)  # Small sleep to avoid CPU spinning
                continue
                
            chunk = os.read(fd.fileno(), 4096)
            if not chunk:
                break
            result += chunk.decode('utf-8', errors='replace')
        except (ValueError, OSError):
            # File descriptor might be closed or invalid
            break
    
    return result

def run_single_client(port, testcase, periodic, server_state):
    """Run a client test with improved interactive support"""
    env = os.environ.copy()
    env["SERVER_PORT"] = str(port)
    env["SERVER_HOST"] = "localhost"
    
    # Determine if this is an interactive test
    is_interactive = testcase.get("interactive", False)
    
    # Configure the input data
    input_data = None
    if testcase.get("input"):
        if isinstance(testcase.get("input"), str):
            input_data = [testcase.get("input")]
        elif isinstance(testcase.get("input"), list):
            input_data = testcase.get("input")
    
    print(f"Starting client test - interactive: {is_interactive}, input: {input_data}")
    
    # Start the client process
    proc = subprocess.Popen(
        ["./client_exec"], env=env,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.PIPE,
        bufsize=0  # Unbuffered mode
    )
    
    try:
        if is_interactive and input_data:
            # Use interactive approach
            all_output = ""
            
            # Wait for initial output/prompt
            time.sleep(0.5)
            initial_output = read_nonblocking(proc.stdout, 0.5)
            all_output += initial_output
            print(f"Initial prompt: '{initial_output.strip()}'")
            
            # Process each input with proper timing
            for i, input_line in enumerate(input_data):
                # Send input
                input_str = input_line + "\n"
                print(f"Sending input: '{input_line}'")
                os.write(proc.stdin.fileno(), input_str.encode())
                
                # Give time for processing and reading response
                time.sleep(0.5)
                response = read_nonblocking(proc.stdout, 0.5)
                all_output += response
                print(f"Response after input: '{response.strip()}'")
            
            # After all inputs, read all remaining output
            time.sleep(0.5)
            final_output = read_nonblocking(proc.stdout, 1.0)
            all_output += final_output
            print(f"Final output: '{final_output.strip()}'")
            
            # Wait for process to finish
            proc.stdin.close()
            proc.wait(timeout=2)
            error_output = read_nonblocking(proc.stderr, 0.2)
            
            combined_output = all_output
            errors = error_output
            output = combined_output.strip()
        else:
            # Simple non-interactive mode - just pipe the input
            if input_data:
                if isinstance(input_data, list):
                    client_input = "\n".join(input_data).encode() + b"\n"
                else:
                    client_input = input_data[0].encode() + b"\n"
                input_str = client_input.decode().strip() 
            else:
                client_input = None
                input_str = "None"
                
            print(f"Running client with input: {input_str}")
            stdout, stderr = proc.communicate(input=client_input, timeout=testcase.get("timeout", 10))
            combined_output = stdout.decode('utf-8', errors='replace')
            errors = stderr.decode('utf-8', errors='replace').strip()
        
        # Process the output
        output = combined_output.strip()
        print(f"Client output: '{output}'")
        
        if errors:
            print(f"Client stderr: '{errors}'")
            server_state["errors"].append(errors)
        
        # Special case for arithmetic client - look for result in output
        if testcase.get("expectedFormula"):
            expected_formula = testcase.get("expectedFormula")
            print(f"Checking for expected formula result: '{expected_formula}'")
            
            # Look for result in output text
            result_found = False
            
            # Check for "Result from server: X" pattern
            if "Result from server:" in output:
                result_line = [line for line in output.splitlines() if "Result from server:" in line][0]
                result_value = result_line.split(":", 1)[1].strip()
                print(f"Found result value: '{result_value}'")
                if expected_formula in result_value:
                    print(f"✓ Formula result '{expected_formula}' matched in output")
                    result_found = True
            
            # If result is directly in output
            if expected_formula in output:
                print(f"✓ Expected formula '{expected_formula}' found in output")
                result_found = True
                
            if result_found:
                return True, output
        
        # Normal output validation
        expected = testcase.get("expectedOutput", "")
        match_type = testcase.get("matchType", "contains")
        
        print(f"Validating output: '{output}' against expected: '{expected}' using match_type: '{match_type}'")
        
        # Robust contains check: pass if expected appears anywhere in output
        if match_type == "contains" and expected:
            if expected in output:
                print(f"✓ Found expected string '{expected}' in output")
                return True, output
            else:
                print(f"✗ Expected string '{expected}' not found in output")
                return False, f"Output validation failed: '{expected}' not found in output. Full output: {output}"
        
        # Use validator for other match types
        passed, reason = validate_output(output, expected, match_type)
        if passed:
            return True, output
        else:
            return False, f"Output validation failed: {reason}"
    except subprocess.TimeoutExpired:
        proc.kill()
        server_state["errors"].append("Timeout during execution")
        return False, "Timeout during execution"
    except Exception as e:
        if proc:
            try:
                proc.kill()
            except:
                pass
        server_state["errors"].append(f"Error: {str(e)}")
        return False, f"Error during client execution: {str(e)}"

def run_clients(port, client_count, client_delay, periodic, testcase, server_state):
    threads = []
    results = []
    
    print(f"Running {client_count} client(s) with delay {client_delay}s")
    
    def target():
        res = run_single_client(port, testcase, periodic, server_state)
        results.append(res)
        
    for i in range(client_count):
        print(f"Starting client {i+1}/{client_count}")
        t = threading.Thread(target=target)
        t.start()
        threads.append(t)
        time.sleep(client_delay)
        
    for t in threads:
        t.join()
        
    print(f"Client results: {results}")
    print(f"Server errors: {server_state['errors']}")
    
    if all(r[0] for r in results) and not server_state["errors"]:
        return "PASS", f"All {client_count} clients passed"
    else:
        failed_outputs = [r[1] for i, r in enumerate(results) if not r[0]]
        error_summary = f"Some clients failed. Expected: '{testcase.get('expectedOutput', '')}'"
        if failed_outputs:
            error_summary += f" but got: '{failed_outputs[0]}...'"
        if server_state["errors"]:
            error_summary += f" Server errors: {server_state['errors']}"
        return "FAIL", error_summary