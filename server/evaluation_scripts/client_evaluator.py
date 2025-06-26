#!/usr/bin/env python3
"""
Client evaluator script for CN Lab
This script now delegates to the modular client_scripts/evaluate_client.py
"""

import argparse
import json
import os
import subprocess
import sys

# Add client_scripts directory to Python path so the main evaluator can find our modules
client_scripts_dir = os.path.join(os.path.dirname(__file__), "client_scripts")
if os.path.exists(client_scripts_dir):
    sys.path.append(client_scripts_dir)
    print(f"Added {client_scripts_dir} to Python path")
else:
    print(f"Warning: {client_scripts_dir} not found")

def evaluate_client(client_src, test_case, num_clients=1, client_delay=0.5):
    """Delegate to the modular evaluate_client.py script"""
      # First save the test case to a temporary file
    # Use platform-independent temp directory
    import tempfile
    temp_dir = tempfile.gettempdir()
    temp_test_file = os.path.join(temp_dir, f"temp_test_case_{os.getpid()}.json")
    
    try:
        # Add client count and delay to the test case if not already present
        if "clientCount" not in test_case:
            test_case["clientCount"] = num_clients
        if "clientDelay" not in test_case:
            test_case["clientDelay"] = client_delay
            
        # Create a test case file that matches the format expected by evaluate_client.py
        with open(temp_test_file, 'w') as f:
            json.dump({"testCases": [test_case]}, f)
        
        # Determine path to modular script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        modular_script = os.path.join(script_dir, "client_scripts", "evaluate_client.py")
        
        # Check if script exists at expected path
        if not os.path.exists(modular_script):
            # Try relative to current directory as well
            alt_path = os.path.join("client_scripts", "evaluate_client.py")
            if os.path.exists(alt_path):
                modular_script = alt_path
            else:                # For container environment where files are copied to a standard location
                container_scripts = [
                    "/tmp/.eval_scripts/client_scripts/evaluate_client.py",
                    os.path.expanduser("~/.eval_scripts/client_scripts/evaluate_client.py"),
                    os.path.join(tempfile.gettempdir(), ".eval_scripts", "client_scripts", "evaluate_client.py")
                ]
                
                for path in container_scripts:
                    if os.path.exists(path):
                        modular_script = path
                        break
        
        # Set up the command to run the modular script
        cmd = [
            "python3", 
            modular_script,
            client_src,
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
                    return parts[1], parts[2]
        
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
    parser = argparse.ArgumentParser(description="Universal CN Lab Client Evaluator")
    parser.add_argument("client_file", help="Client source file to evaluate")
    parser.add_argument("test_file", help="JSON file containing test case details")
    parser.add_argument("test_idx", type=int, help="Test case index")
    
    args = parser.parse_args()
      # Load test case data
    try:
        with open(args.test_file, 'r') as f:
            test_data = json.load(f)
            
        # The backend should have already extracted the appropriate test cases,
        # so we just need to access the test case at the given index
        test_case = test_data["testCases"][args.test_idx]
            
        num_clients = test_data.get("clientCount", 1)
        client_delay = test_data.get("clientDelay", 0.5)
        
    except (FileNotFoundError, json.JSONDecodeError, IndexError, KeyError) as e:
        print(f"RESULT:FAIL:Error loading test case: {str(e)}")
        sys.exit(1)
    
    status, message = evaluate_client(args.client_file, test_case, num_clients, client_delay)
    
    # Print result in format that can be parsed by backend
    print(f"RESULT:{status}:{message}")
    sys.exit(0 if status == "PASS" else 1)

if __name__ == "__main__":
    main()
