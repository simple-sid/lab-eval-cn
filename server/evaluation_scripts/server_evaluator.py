import argparse
import json
import os
import subprocess
import sys

# Add server_scripts directory to Python path so the main evaluator can find our modules
server_scripts_dir = os.path.join(os.path.dirname(__file__), "server_scripts")
if os.path.exists(server_scripts_dir):
    sys.path.append(server_scripts_dir)
    print(f"Added {server_scripts_dir} to Python path")
else:
    print(f"Warning: {server_scripts_dir} not found")

def evaluate_server(server_src, test_case, num_clients=1, client_delay=0.5):
    """Delegate to the modular evaluate_server.py script"""
    
    # First save the test case to a temporary file
    temp_test_file = f"/tmp/temp_test_case_{os.getpid()}.json"
    
    try:
        # Add client count and delay to the test case if not already present
        if "clientCount" not in test_case:
            test_case["clientCount"] = num_clients
        if "clientDelay" not in test_case:
            test_case["clientDelay"] = client_delay
            
        # Create a test case file that matches the format expected by evaluate_server.py
        with open(temp_test_file, 'w') as f:
            json.dump({"testCases": [test_case]}, f)
        
        # Determine path to modular script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        modular_script = os.path.join(script_dir, "server_scripts", "evaluate_server.py")
        
        # Check if script exists at expected path
        if not os.path.exists(modular_script):
            # Try relative to current directory as well
            alt_path = os.path.join("server_scripts", "evaluate_server.py")
            if os.path.exists(alt_path):
                modular_script = alt_path
            else:
                # For container environment where files are copied to /tmp
                modular_script = "/tmp/.eval_scripts/server_scripts/evaluate_server.py"
        
        # Set up the command to run the modular script
        cmd = [
            "python3", 
            modular_script,
            server_src,
            temp_test_file,
            "0"  # Test case index (always 0 since we're creating a single-test file)
        ]
        
        # Run the modular evaluation script
        print(f"Running modular evaluation: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
          # Extract the result
        for line in result.stdout.splitlines():
            if line.startswith("RESULT:"):
                parts = line.split(":", 2)
                if len(parts) >= 3:
                    # Extract actual output - find the real output rather than just status
                    actual_output = parts[2]
                    if "All " in actual_output and " clients passed" in actual_output:
                        # Extract the real output from the modular script
                        for client_output_line in result.stdout.splitlines():
                            if "Client output:" in client_output_line:
                                actual_output = client_output_line.split("Client output:", 1)[1].strip()
                                break
                    return parts[1], actual_output
        
        # If no result line found, use the full output
        if result.returncode == 0:
            return "PASS", result.stdout
        else:
            return "FAIL", result.stderr or "Unknown error in evaluation"
    
    except Exception as e:
        return "FAIL", f"Error running evaluation: {str(e)}"
    
    finally:
        # Clean up temporary file
        try:
            if os.path.exists(temp_test_file):
                os.remove(temp_test_file)
        except Exception:
            pass

def main():
    parser = argparse.ArgumentParser(description="Universal CN Lab Evaluator")
    parser.add_argument("server_file", help="Server source file to evaluate")
    parser.add_argument("test_file", help="JSON file containing test case details")
    parser.add_argument("test_idx", type=int, help="Test case index")
    
    args = parser.parse_args()
    
    # Load test case data
    try:
        with open(args.test_file, 'r') as f:
            test_data = json.load(f)
            
        test_case = test_data["testCases"][args.test_idx]
        num_clients = test_data.get("clientCount", 1)
        client_delay = test_data.get("clientDelay", 0.5)
        
    except (FileNotFoundError, json.JSONDecodeError, IndexError, KeyError) as e:
        print(f"RESULT:FAIL:Error loading test case: {str(e)}")
        sys.exit(1)
    
    status, message = evaluate_server(args.server_file, test_case, num_clients, client_delay)
    
    # Print result in format that can be parsed by backend
    print(f"RESULT:{status}:{message}")
    sys.exit(0 if status == "PASS" else 1)

if __name__ == "__main__":
    main()