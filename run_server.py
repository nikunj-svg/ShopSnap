import http.server
import socketserver
import socket
import sys

PORT = 8000

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Allow cross-origin requests for testing if needed
        self.send_header('Access-Control-Allow-Origin', '*')
        # Add basic headers for camera permissions and caching
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't even have to be reachable
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

def start_server():
    local_ip = get_local_ip()
    print("=" * 60)
    print("           SHOPSNAP PRICE DETECTOR LOCAL SERVER           ")
    print("=" * 60)
    print(f"\nServer started on Port {PORT}.\n")
    print(f"To open on this PC:")
    print(f"  http://localhost:{PORT}")
    print(f"  http://127.0.0.1:{PORT}")
    
    if local_ip != '127.0.0.1':
        print(f"\nTo open on your Mobile Phone (must be on same Wi-Fi):")
        print(f"  --> http://{local_ip}:{PORT} <--")
    else:
        print("\nNote: Make sure your PC is connected to Wi-Fi to access from mobile.")
    
    print("\nPress Ctrl+C to stop the server.")
    print("=" * 60)

    # Allow port reuse
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server...")
            sys.exit(0)

if __name__ == "__main__":
    start_server()
