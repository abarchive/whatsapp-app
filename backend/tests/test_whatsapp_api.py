"""
WhatsApp API Tests - Focus on Connect/Disconnect/Reconnect Flow
Tests for WhatsApp initialization, status, QR code, disconnect, and reconnect cycles
CRITICAL: Tests the main issue - QR code regeneration after disconnect
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@admin.com"
ADMIN_PASSWORD = "Admin@7501"

class TestWhatsAppAuth:
    """Test WhatsApp endpoints require authentication"""
    
    def test_whatsapp_status_requires_auth(self):
        """Test that /whatsapp/status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/status")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_whatsapp_initialize_requires_auth(self):
        """Test that /whatsapp/initialize requires authentication"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/initialize")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_whatsapp_disconnect_requires_auth(self):
        """Test that /whatsapp/disconnect requires authentication"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/disconnect")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_whatsapp_qr_requires_auth(self):
        """Test that /whatsapp/qr requires authentication"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/qr")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestWhatsAppStatus:
    """Test WhatsApp status endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get user token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed")
    
    def test_get_whatsapp_status(self):
        """Test fetching WhatsApp status"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/status", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Status should have these fields
        assert "status" in data, "Missing 'status' field"
        assert "connected" in data, "Missing 'connected' field"
        
        # Status should be one of valid values
        valid_statuses = ['disconnected', 'initializing', 'qr_ready', 'connected', 'authenticated', 'error']
        assert data["status"] in valid_statuses, f"Invalid status: {data['status']}"
        
        print(f"Current WhatsApp status: {data['status']}, connected: {data['connected']}")


class TestWhatsAppInitialize:
    """Test WhatsApp initialization"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get user token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed")
    
    def test_initialize_whatsapp(self):
        """Test initializing WhatsApp connection"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/initialize", headers=self.headers)
        
        # Should return 200 or 503 (if service unavailable)
        assert response.status_code in [200, 503], f"Expected 200/503, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "success" in data or "status" in data, "Missing success/status in response"
            print(f"Initialize response: {data}")
        else:
            print("WhatsApp service unavailable (503)")


class TestWhatsAppQRCode:
    """Test WhatsApp QR code endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get user token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed")
    
    def test_get_qr_code(self):
        """Test fetching QR code"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/qr", headers=self.headers)
        
        # QR code may or may not be available depending on state
        assert response.status_code in [200, 404, 503], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "qr" in data, "Missing 'qr' field in response"
            assert len(data["qr"]) > 0, "QR code is empty"
            print(f"QR code available, length: {len(data['qr'])}")
        elif response.status_code == 404:
            print("QR code not available (404) - expected if not initialized or already connected")
        else:
            print("WhatsApp service unavailable (503)")


class TestWhatsAppDisconnect:
    """Test WhatsApp disconnect endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get user token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed")
    
    def test_disconnect_whatsapp(self):
        """Test disconnecting WhatsApp"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/disconnect", headers=self.headers)
        
        # Should return 200 or 503
        assert response.status_code in [200, 503], f"Expected 200/503, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "success" in data or "message" in data, "Missing success/message in response"
            print(f"Disconnect response: {data}")
        else:
            print("WhatsApp service unavailable (503)")


class TestWhatsAppReconnectCycle:
    """
    CRITICAL TEST: Test the disconnect → reconnect → QR regeneration cycle
    This is the main issue that was reported - QR code not generating on reconnect
    """
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get user token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed")
    
    def test_reconnect_cycle_qr_regeneration(self):
        """
        CRITICAL: Test that QR code regenerates after disconnect
        Flow: Check status → Disconnect → Wait → Initialize → Check QR available
        """
        print("\n=== CRITICAL TEST: Reconnect Cycle QR Regeneration ===")
        
        # Step 1: Check initial status
        print("\nStep 1: Checking initial status...")
        status_response = requests.get(f"{BASE_URL}/api/whatsapp/status", headers=self.headers)
        assert status_response.status_code == 200, f"Status check failed: {status_response.status_code}"
        initial_status = status_response.json()
        print(f"Initial status: {initial_status}")
        
        # Step 2: Disconnect (if connected or has QR)
        print("\nStep 2: Disconnecting...")
        disconnect_response = requests.post(f"{BASE_URL}/api/whatsapp/disconnect", headers=self.headers)
        assert disconnect_response.status_code in [200, 503], f"Disconnect failed: {disconnect_response.status_code}"
        print(f"Disconnect response: {disconnect_response.json() if disconnect_response.status_code == 200 else 'Service unavailable'}")
        
        # Step 3: Wait for cleanup
        print("\nStep 3: Waiting for cleanup (3 seconds)...")
        time.sleep(3)
        
        # Step 4: Verify disconnected status
        print("\nStep 4: Verifying disconnected status...")
        status_after_disconnect = requests.get(f"{BASE_URL}/api/whatsapp/status", headers=self.headers)
        assert status_after_disconnect.status_code == 200
        disconnected_status = status_after_disconnect.json()
        print(f"Status after disconnect: {disconnected_status}")
        assert disconnected_status["status"] == "disconnected", f"Expected 'disconnected', got '{disconnected_status['status']}'"
        assert disconnected_status["connected"] == False, "Should not be connected after disconnect"
        
        # Step 5: Initialize (reconnect)
        print("\nStep 5: Initializing (reconnecting)...")
        init_response = requests.post(f"{BASE_URL}/api/whatsapp/initialize", headers=self.headers)
        assert init_response.status_code in [200, 503], f"Initialize failed: {init_response.status_code}"
        
        if init_response.status_code == 503:
            pytest.skip("WhatsApp service unavailable")
        
        init_data = init_response.json()
        print(f"Initialize response: {init_data}")
        
        # Step 6: Wait for QR generation
        print("\nStep 6: Waiting for QR generation (10 seconds)...")
        qr_found = False
        for i in range(10):
            time.sleep(1)
            status_check = requests.get(f"{BASE_URL}/api/whatsapp/status", headers=self.headers)
            if status_check.status_code == 200:
                current_status = status_check.json()
                print(f"  Check {i+1}: status={current_status['status']}, qrAvailable={current_status.get('qrAvailable', False)}")
                
                if current_status["status"] == "qr_ready" or current_status.get("qrAvailable"):
                    qr_found = True
                    break
                elif current_status["status"] == "connected":
                    print("  Already connected (session restored)")
                    qr_found = True  # Consider this a pass too
                    break
        
        # Step 7: Verify QR code is available
        print("\nStep 7: Verifying QR code availability...")
        qr_response = requests.get(f"{BASE_URL}/api/whatsapp/qr", headers=self.headers)
        
        if qr_response.status_code == 200:
            qr_data = qr_response.json()
            assert "qr" in qr_data, "QR code missing in response"
            assert len(qr_data["qr"]) > 0, "QR code is empty"
            print(f"SUCCESS: QR code regenerated! Length: {len(qr_data['qr'])}")
            qr_found = True
        elif qr_response.status_code == 404:
            # Check if already connected
            final_status = requests.get(f"{BASE_URL}/api/whatsapp/status", headers=self.headers).json()
            if final_status["status"] == "connected":
                print("SUCCESS: Already connected (session restored)")
                qr_found = True
            else:
                print(f"QR not available. Final status: {final_status}")
        
        assert qr_found, "CRITICAL FAILURE: QR code did not regenerate after disconnect!"
        print("\n=== RECONNECT CYCLE TEST PASSED ===")
    
    def test_multiple_disconnect_reconnect_cycles(self):
        """
        Test multiple disconnect-reconnect cycles to ensure stability
        """
        print("\n=== TEST: Multiple Disconnect-Reconnect Cycles ===")
        
        for cycle in range(2):
            print(f"\n--- Cycle {cycle + 1} ---")
            
            # Disconnect
            disconnect_response = requests.post(f"{BASE_URL}/api/whatsapp/disconnect", headers=self.headers)
            assert disconnect_response.status_code in [200, 503], f"Cycle {cycle+1} disconnect failed"
            print(f"Disconnected")
            
            time.sleep(2)
            
            # Verify disconnected
            status = requests.get(f"{BASE_URL}/api/whatsapp/status", headers=self.headers).json()
            assert status["status"] == "disconnected", f"Cycle {cycle+1}: Not disconnected"
            print(f"Status: disconnected")
            
            # Initialize
            init_response = requests.post(f"{BASE_URL}/api/whatsapp/initialize", headers=self.headers)
            if init_response.status_code == 503:
                pytest.skip("WhatsApp service unavailable")
            assert init_response.status_code == 200, f"Cycle {cycle+1} initialize failed"
            print(f"Initialized")
            
            # Wait for QR
            time.sleep(5)
            
            # Check QR available
            qr_available = False
            for _ in range(5):
                status = requests.get(f"{BASE_URL}/api/whatsapp/status", headers=self.headers).json()
                if status["status"] in ["qr_ready", "connected"]:
                    qr_available = True
                    break
                time.sleep(1)
            
            assert qr_available, f"Cycle {cycle+1}: QR not available after reconnect"
            print(f"QR available or connected")
        
        print("\n=== MULTIPLE CYCLES TEST PASSED ===")


class TestMessageSending:
    """Test message sending endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get user token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.user = response.json()["user"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed")
    
    def test_send_message_requires_connection(self):
        """Test that sending message requires WhatsApp connection"""
        # First disconnect to ensure not connected
        requests.post(f"{BASE_URL}/api/whatsapp/disconnect", headers=self.headers)
        time.sleep(2)
        
        # Try to send message
        response = requests.post(f"{BASE_URL}/api/messages/send", 
            headers=self.headers,
            json={
                "number": "9876543210",
                "message": "Test message"
            }
        )
        
        # Should fail because not connected
        # Could be 400 (not connected) or 503 (service unavailable)
        assert response.status_code in [400, 503], f"Expected 400/503, got {response.status_code}"
        print(f"Send without connection: {response.status_code} - {response.json()}")
    
    def test_api_send_endpoint(self):
        """Test the API send endpoint with API key"""
        # Get API key from user
        api_key = self.user.get("api_key")
        if not api_key:
            pytest.skip("No API key available")
        
        # First disconnect
        requests.post(f"{BASE_URL}/api/whatsapp/disconnect", headers=self.headers)
        time.sleep(2)
        
        # Try API send
        response = requests.get(
            f"{BASE_URL}/api/send",
            params={
                "api_key": api_key,
                "number": "9876543210",
                "msg": "Test API message"
            }
        )
        
        # Should fail because not connected
        assert response.status_code in [400, 503], f"Expected 400/503, got {response.status_code}"
        print(f"API send without connection: {response.status_code}")


class TestMessageLogs:
    """Test message logs endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get user token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed")
    
    def test_get_message_logs(self):
        """Test fetching message logs"""
        response = requests.get(f"{BASE_URL}/api/messages/logs", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of logs"
        print(f"Message logs count: {len(data)}")
    
    def test_get_message_logs_with_filter(self):
        """Test fetching message logs with status filter"""
        response = requests.get(f"{BASE_URL}/api/messages/logs?status=sent", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        # All returned logs should have status 'sent'
        for log in data:
            if "status" in log:
                assert log["status"] == "sent", f"Expected status 'sent', got '{log['status']}'"


class TestAPIKeyManagement:
    """Test API key management"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get user token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed")
    
    def test_regenerate_api_key(self):
        """Test regenerating API key"""
        # Get current user info
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert me_response.status_code == 200
        old_api_key = me_response.json()["api_key"]
        
        # Regenerate
        regen_response = requests.post(f"{BASE_URL}/api/keys/regenerate", headers=self.headers)
        assert regen_response.status_code == 200
        
        data = regen_response.json()
        assert "api_key" in data, "Missing api_key in response"
        new_api_key = data["api_key"]
        
        # Verify key changed
        assert new_api_key != old_api_key, "API key should have changed"
        print(f"API key regenerated successfully")
        
        # Verify new key works by checking /auth/me
        me_response2 = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert me_response2.status_code == 200
        assert me_response2.json()["api_key"] == new_api_key
