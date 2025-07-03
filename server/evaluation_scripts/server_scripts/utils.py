import os
import re
import socket
import subprocess
import time
import signal
import random
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('cn_evaluator')

def find_free_port(start_port=10000, max_attempts=10):
    """Find a free port to use for the server, with retries"""
    for attempt in range(max_attempts):
        if attempt == 0:
            # First try to use a random port in the ephemeral range
            port = random.randint(start_port, 65000)
        else:
            # For subsequent attempts, increment by a small random amount
            port = start_port + random.randint(1, 1000)
        
        try:
            s = socket.socket()
            s.bind(('127.0.0.1', port))
            s.close()
            logger.info(f"Found free port: {port}")
            return port
        except OSError as e:
            logger.warning(f"Port {port} is not available: {str(e)}")
            continue
    
    raise RuntimeError(f"Could not find a free port after {max_attempts} attempts")

def modify_server_port(file_path, new_port):
    """Update the server file to use the specified port"""
    try:
        with open(file_path, 'r') as file:
            content = file.read()
        
        # Try different PORT definition patterns
        patterns = [
            (r'#define\s+PORT\s+\d+', f'#define PORT {new_port}'),
            (r'int\s+port\s*=\s*\d+', f'int port = {new_port}'),
            (r'const\s+int\s+port\s*=\s*\d+', f'const int port = {new_port}')
        ]
        
        modified = content
        for pattern, replacement in patterns:
            if re.search(pattern, modified):
                modified = re.sub(pattern, replacement, modified)
                break
        
        # If no pattern matched, try to insert the port definition
        if modified == content:
            # Look for header inclusion pattern and add after that
            header_match = re.search(r'#include\s+<[^>]+>', content)
            if header_match:
                pos = header_match.end()
                modified = content[:pos] + f"\n#define PORT {new_port}\n" + content[pos:]
            else:
                # Just add at the beginning
                modified = f"#define PORT {new_port}\n" + content
        
        with open(file_path, 'w') as file:
            file.write(modified)
            
        logger.info(f"Modified {file_path} to use port {new_port}")
        return True
    except Exception as e:
        logger.error(f"Error modifying server port: {str(e)}")
        return False

def compile_program(src_file, output_name="server_exec", compiler="gcc", flags=None):
    """Compile the server program with appropriate flags"""
    if flags is None:
        flags = ["-Wall"]
    
    cmd = [compiler, src_file, "-o", output_name] + flags
    
    try:
        logger.info(f"Compiling with command: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            timeout=10  # Add timeout to prevent hanging
        )
        success = result.returncode == 0
        
        if success:
            logger.info("Compilation successful")
        else:
            logger.error(f"Compilation failed: {result.stderr.decode()}")
            
        return success, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        logger.error("Compilation timed out")
        return False, b"", b"Compilation timed out"
    except Exception as e:
        logger.error(f"Error during compilation: {str(e)}")
        return False, b"", str(e).encode()

def wait_for_server(port, timeout=5, protocol="tcp", check_interval=0.2):
    """Wait for server to start and bind to port"""
    deadline = time.time() + timeout
    attempts = 0
    
    logger.info(f"Waiting for {protocol} server to bind to port {port}")
    while time.time() < deadline:
        attempts += 1
        try:
            if protocol.lower() == "tcp":
                with socket.create_connection(('127.0.0.1', port), check_interval):
                    logger.info(f"TCP server ready on port {port} after {attempts} attempts")
                    return True
            else:
                # For UDP, just try to bind to the port (should fail if server is up)
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                try:
                    s.bind(('127.0.0.1', port))
                    s.close()
                except OSError:
                    # If binding fails, the server is likely running
                    logger.info(f"UDP server appears to be ready on port {port} after {attempts} attempts")
                    return True
        except Exception as e:
            if attempts % 5 == 0:  # Log only every 5th attempt to reduce noise
                logger.debug(f"Server not ready yet: {str(e)}")
            time.sleep(check_interval)
    
    logger.error(f"Timed out waiting for server on port {port} after {attempts} attempts")
    return False

def start_server(port, timeout=5):
    """Start the server process with improved error handling"""
    env = os.environ.copy()
    env["PORT"] = str(port)
    
    try:
        logger.info(f"Starting server on port {port}")
        proc = subprocess.Popen(
            ["./server_exec"],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            preexec_fn=os.setsid
        )
        
        # Check for immediate failure
        time.sleep(0.2)
        if proc.poll() is not None:
            stderr = proc.stderr.read().decode()
            logger.error(f"Server immediately terminated with exit code {proc.returncode}: {stderr}")
            raise RuntimeError(f"Server failed to start: {stderr}")
        
        return proc
    except Exception as e:
        logger.error(f"Error starting server: {str(e)}")
        raise

def stop_server(proc):
    """Stop the server process with robust cleanup"""
    if proc:
        try:
            # Try gentle termination first
            pgid = os.getpgid(proc.pid)
            os.killpg(pgid, signal.SIGTERM)
            
            # Wait for it to terminate
            try:
                proc.wait(timeout=2)
                logger.info("Server stopped gracefully")
                return
            except subprocess.TimeoutExpired:
                logger.warning("Server didn't stop gracefully, forcing termination")
                
            # Force kill if still running
            if proc.poll() is None:
                os.killpg(pgid, signal.SIGKILL)
                proc.wait(timeout=1)
                logger.info("Server forcibly terminated")
        except ProcessLookupError:
            logger.info("Server process already terminated")
        except Exception as e:
            logger.error(f"Error stopping server: {str(e)}")

def check_port_in_use(port):
    """Check if a port is in use"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0