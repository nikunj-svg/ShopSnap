import http.server
import socketserver
import socket
import sys
import json
import os

PORT = 8000
DB_FILE = "shop_db.json"

def load_db():
    if not os.path.exists(DB_FILE):
        return {"shops": {}}
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"shops": {}}

def save_db(db):
    try:
        with open(DB_FILE, "w", encoding="utf-8") as f:
            json.dump(db, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving database: {e}")

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Allow cross-origin requests for testing
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        # Handle preflight CORS requests
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        if self.path.startswith("/api/"):
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                req = json.loads(post_data.decode('utf-8'))
            except Exception as e:
                self.send_json_response({"success": False, "message": f"Invalid JSON: {str(e)}"}, 400)
                return

            db = load_db()

            if self.path == "/api/register":
                self.handle_register(req, db)
            elif self.path == "/api/login":
                self.handle_login(req, db)
            elif self.path == "/api/sync":
                self.handle_sync(req, db)
            else:
                self.send_json_response({"success": False, "message": "Endpoint not found"}, 404)
        else:
            # Fallback to standard POST handling
            super().do_POST()

    def send_json_response(self, data, status_code=200):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def handle_register(self, req, db):
        shop_id = req.get("shopId", "").strip().lower()
        shop_name = req.get("shopName", "").strip()
        password = req.get("password", "")

        if not shop_id or not shop_name or not password:
            self.send_json_response({"success": False, "message": "All fields are required"}, 400)
            return

        if shop_id in db["shops"]:
            self.send_json_response({"success": False, "message": "Shop ID already exists"}, 400)
            return

        # Initialize shop data
        db["shops"][shop_id] = {
            "name": shop_name,
            "password": password,
            "inventory": req.get("inventory", []),
            "history": [],
            "last_updated": 0
        }
        save_db(db)
        print(f"[DB] Registered shop: {shop_name} ({shop_id})")
        self.send_json_response({"success": True})

    def handle_login(self, req, db):
        shop_id = req.get("shopId", "").strip().lower()
        password = req.get("password", "")

        if shop_id not in db["shops"] or db["shops"][shop_id]["password"] != password:
            self.send_json_response({"success": False, "message": "Invalid Shop ID or Password"}, 401)
            return

        shop_data = db["shops"][shop_id]
        self.send_json_response({
            "success": True,
            "shopName": shop_data["name"]
        })

    def handle_sync(self, req, db):
        shop_id = req.get("shopId", "").strip().lower()
        password = req.get("password", "")

        if shop_id not in db["shops"] or db["shops"][shop_id]["password"] != password:
            self.send_json_response({"success": False, "message": "Unauthorized"}, 401)
            return

        shop_data = db["shops"][shop_id]
        client_timestamp = req.get("timestamp", 0)
        server_timestamp = shop_data.get("last_updated", 0)

        client_inventory = req.get("inventory", None)
        client_history = req.get("history", None)
        
        has_updates = req.get("hasUpdates", False)

        # Sync logic
        if has_updates and client_timestamp > server_timestamp:
            # Client has newer local changes, update the server
            if client_inventory is not None:
                shop_data["inventory"] = client_inventory
            if client_history is not None:
                shop_data["history"] = client_history
            
            shop_data["last_updated"] = client_timestamp
            save_db(db)
            print(f"[DB] Synced UPDATES from client for {shop_id}. Timestamp: {client_timestamp}")
            self.send_json_response({
                "success": True,
                "status": "updated_server",
                "timestamp": client_timestamp
            })
        elif server_timestamp > client_timestamp:
            # Server has newer updates (from another device), send them to client
            print(f"[DB] Sending newer server data to client for {shop_id}. Timestamp: {server_timestamp}")
            self.send_json_response({
                "success": True,
                "status": "updated_client",
                "inventory": shop_data["inventory"],
                "history": shop_data["history"],
                "timestamp": server_timestamp
            })
        else:
            # Already in sync
            self.send_json_response({
                "success": True,
                "status": "in_sync",
                "timestamp": server_timestamp
            })

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
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

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server...")
            sys.exit(0)

if __name__ == "__main__":
    start_server()
