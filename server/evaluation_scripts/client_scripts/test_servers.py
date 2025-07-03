import threading
import time
import socket
from socketserver import ThreadingTCPServer, ThreadingUDPServer, BaseRequestHandler, DatagramRequestHandler
import os

def ensure_newline(msg):
    return msg if msg.endswith('\n') else msg + '\n'

def log_debug(msg):
    with open('/tmp/test_server_debug.log', 'a') as f:
        f.write(msg + '\n')

class TCPHandler(BaseRequestHandler):
    """Enhanced TCP handler for interactive scripted testing"""
    def handle(self):
        steps = self.server.script
        interactive_mode = self.server.testcase.get("interactive", False)
        log_debug(f"\n[DEBUG] New TCPHandler connection. Interactive: {interactive_mode}")
        log_debug(f"[DEBUG] Server script for this connection:")
        for idx, step in enumerate(steps):
            log_debug(f"  Step {idx+1}: {step}")
        already_sent_prompt = False
        # For interactive tests, we need to handle prompt/request cycles carefully
        if interactive_mode:
            # Send initial prompt only once
            if steps and "response" in steps[0] and not "expect" in steps[0]:
                initial_prompt = ensure_newline(steps[0]["response"])
                log_debug(f"[DEBUG] Sending initial prompt: '{initial_prompt.rstrip()}'")
                self.request.sendall(initial_prompt.encode())
                already_sent_prompt = True
                time.sleep(0.2)  # Give client time to display prompt
                steps = steps[1:]  # Move to next steps
            
            # For each step, receive input, then send only the result (not prompt)
            for i, step in enumerate(steps):
                # Wait for input from client
                if "expect" in step:
                    log_debug(f"[DEBUG] [TCP Step {i+1}] Waiting for client input...")
                    data = self.request.recv(1024).decode().strip()
                    log_debug(f"[DEBUG] [TCP Step {i+1}] Received from client: '{data}'")
                    self.server.state["received"].append(data)
                    
                    # Verify the input matches what we expect
                    expected = step["expect"]
                    if not expected or data == expected or expected in data:
                        log_debug(f"[DEBUG] [TCP Step {i+1}] ✓ Input matched expected: '{expected}'")
                    else:
                        err_msg = f"Expected '{expected}', got '{data}'"
                        log_debug(f"[DEBUG] [TCP Step {i+1}] ✗ {err_msg}")
                        self.server.state["errors"].append(err_msg)
                
                # Only send the result, not the prompt again
                if "response" in step:
                    # If this is a prompt (contains 'Enter expression'), skip sending again
                    response = ensure_newline(step["response"])
                    if already_sent_prompt and response.strip().startswith("Enter expression"):
                        log_debug(f"[DEBUG] Skipping duplicate prompt at step {i+1}")
                        continue
                    log_debug(f"[DEBUG] [TCP Step {i+1}] Sending response: '{response.rstrip()}'")
                    self.request.sendall(response.encode())
                    time.sleep(step.get("delay", 0.3))  # Give client time to process
        
        # Non-interactive mode - simpler flow
        else:
            for i, step in enumerate(steps):
                # Process each step in sequence
                if "expect" in step:
                    data = self.request.recv(1024).decode().strip()
                    self.server.state["received"].append(data)
                    if not step["expect"] or data == step["expect"] or step["expect"] in data:
                        pass  # Matched
                    else:
                        self.server.state["errors"].append(f"Expected '{step['expect']}', got '{data}'")
                
                if "response" in step:
                    self.request.sendall(ensure_newline(step["response"]).encode())
                    time.sleep(step.get("delay", 0.1))
        
        log_debug("[TCP Handler] Connection finished, closing socket")
        self.request.close()

class UDPHandler(DatagramRequestHandler):
    def handle(self):
        data = self.rfile.read().strip().decode()
        self.server.state["received"].append(data)
        for step in self.server.script:
            if "expect" in step and (step["expect"] == data or (step.get("matchType") == "regex" and step["expect"] in data)):
                self.wfile.write(step["response"].encode())
                return
        # Default response
        if self.server.script and "response" in self.server.script[0]:
            self.wfile.write(self.server.script[0]["response"].encode())

def start_tcp_server(port, testcase):
    server = ThreadingTCPServer(("localhost", port), TCPHandler)
    
    # Configure the server for the test case
    server.script = testcase.get("serverScript", [{"response": testcase.get("serverResponse", "OK\n")}])
    server.state = {"received": [], "errors": []}
    server.testcase = testcase  # Store the full test case for the handler to access
    
    # For interactive tests, we need to ensure the initial prompt is sent
    if testcase.get("interactive", False) and server.script:
        log_debug(f"Setting up interactive TCP server on port {port}")
        for i, step in enumerate(server.script):
            log_debug(f"  Step {i+1}: {step}")
    else:
        log_debug(f"Setting up standard TCP server on port {port}")
    
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    
    # Small delay to ensure server is ready
    time.sleep(0.2)
    
    return server, thread, server.state

def start_udp_server(port, testcase):
    server = ThreadingUDPServer(("localhost", port), UDPHandler)
    server.script = testcase.get("serverScript", [{"response": testcase.get("serverResponse", "OK\n")}])
    server.state = {"received": [], "errors": []}
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread, server.state

# Chatroom: All clients connect, send their message, and receive messages from others
def start_chatroom_server(port, testcase, client_count):
    messages = []
    lock = threading.Lock()
    class ChatHandler(BaseRequestHandler):
        def handle(self):
            data = self.request.recv(1024).decode().strip()
            with lock:
                messages.append(data)
            # Wait for all clients to send
            while len(messages) < client_count:
                time.sleep(0.05)
            # Send all other messages to this client
            for msg in messages:
                if msg != data:
                    self.request.sendall(msg.encode())
            self.request.close()
    server = ThreadingTCPServer(("localhost", port), ChatHandler)
    server.state = {"received": messages, "errors": []}
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread, server.state

# Stop-and-wait: Server expects client to send packets, responds with ACKs
def start_stop_and_wait_server(port, testcase):
    packets = testcase.get("packets", ["pkt1", "pkt2", "pkt3"])
    acks = testcase.get("acksExpected", ["ACK1", "ACK2", "ACK3"])
    class StopWaitHandler(BaseRequestHandler):
        def handle(self):
            for pkt, ack in zip(packets, acks):
                data = self.request.recv(1024).decode().strip()
                if data != pkt:
                    self.server.state["errors"].append(f"Expected '{pkt}', got '{data}'")
                self.request.sendall(ack.encode())
            self.request.close()
    server = ThreadingTCPServer(("localhost", port), StopWaitHandler)
    server.state = {"received": [], "errors": []}
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread, server.state

# Multi-step: Server expects sequence of inputs, responds accordingly
def start_multistep_server(port, testcase):
    steps = testcase.get("steps", [{"expect": None, "response": "OK"}])
    class MultiStepHandler(BaseRequestHandler):
        def handle(self):
            for step in steps:
                if "expect" in step and step["expect"]:
                    data = self.request.recv(1024).decode().strip()
                    if data != step["expect"]:
                        self.server.state["errors"].append(f"Expected '{step['expect']}', got '{data}'")
                if "response" in step:
                    self.request.sendall(step["response"].encode())
            self.request.close()
    server = ThreadingTCPServer(("localhost", port), MultiStepHandler)
    server.state = {"received": [], "errors": []}
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread, server.state