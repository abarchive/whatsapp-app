#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import time

class WhatsAppAPITester:
    def __init__(self, base_url="https://realtime-messaging-15.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.api_key = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def test_user_registration(self):
        """Test user registration endpoint"""
        test_email = "backend_test@example.com"
        test_password = "TestPass123!"
        
        try:
            response = requests.post(f"{self.api_url}/auth/register", json={
                "email": test_email,
                "password": test_password
            })
            
            if response.status_code == 200:
                data = response.json()
                if 'id' in data and 'email' in data and 'api_key' in data:
                    self.api_key = data['api_key']
                    self.log_test("User Registration", True)
                    return test_email, test_password
                else:
                    self.log_test("User Registration", False, "Missing required fields in response")
            elif response.status_code == 400 and "already registered" in response.text:
                # User already exists, that's fine for testing
                self.log_test("User Registration", True, "User already exists")
                return test_email, test_password
            else:
                self.log_test("User Registration", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("User Registration", False, str(e))
        
        return None, None

    def test_user_login(self, email, password):
        """Test user login endpoint"""
        try:
            response = requests.post(f"{self.api_url}/auth/login", json={
                "email": email,
                "password": password
            })
            
            if response.status_code == 200:
                data = response.json()
                if 'access_token' in data and 'user' in data:
                    self.token = data['access_token']
                    self.user_id = data['user']['id']
                    self.api_key = data['user']['api_key']
                    self.log_test("User Login", True)
                    return True
                else:
                    self.log_test("User Login", False, "Missing token or user in response")
            else:
                self.log_test("User Login", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("User Login", False, str(e))
        
        return False

    def test_get_user_profile(self):
        """Test get current user profile"""
        if not self.token:
            self.log_test("Get User Profile", False, "No token available")
            return
        
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.get(f"{self.api_url}/auth/me", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'id' in data and 'email' in data and 'api_key' in data:
                    self.log_test("Get User Profile", True)
                else:
                    self.log_test("Get User Profile", False, "Missing required fields")
            else:
                self.log_test("Get User Profile", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Get User Profile", False, str(e))

    def test_whatsapp_initialize(self):
        """Test WhatsApp initialization"""
        if not self.token:
            self.log_test("WhatsApp Initialize", False, "No token available")
            return
        
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.post(f"{self.api_url}/whatsapp/initialize", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'success' in data:
                    self.log_test("WhatsApp Initialize", True)
                else:
                    self.log_test("WhatsApp Initialize", False, "Missing success field")
            else:
                self.log_test("WhatsApp Initialize", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("WhatsApp Initialize", False, str(e))

    def test_whatsapp_status(self):
        """Test WhatsApp status check"""
        if not self.token:
            self.log_test("WhatsApp Status", False, "No token available")
            return
        
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.get(f"{self.api_url}/whatsapp/status", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'status' in data and 'connected' in data:
                    self.log_test("WhatsApp Status", True)
                else:
                    self.log_test("WhatsApp Status", False, "Missing status fields")
            else:
                self.log_test("WhatsApp Status", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("WhatsApp Status", False, str(e))

    def test_whatsapp_qr(self):
        """Test WhatsApp QR code retrieval"""
        if not self.token:
            self.log_test("WhatsApp QR", False, "No token available")
            return
        
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.get(f"{self.api_url}/whatsapp/qr", headers=headers)
            
            # QR might not be available if already connected, so 404 is acceptable
            if response.status_code == 200:
                data = response.json()
                if 'qr' in data:
                    self.log_test("WhatsApp QR", True)
                else:
                    self.log_test("WhatsApp QR", False, "Missing QR field")
            elif response.status_code == 404:
                self.log_test("WhatsApp QR", True, "QR not available (expected if connected)")
            else:
                self.log_test("WhatsApp QR", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("WhatsApp QR", False, str(e))

    def test_send_message_web(self):
        """Test sending message via web endpoint"""
        if not self.token:
            self.log_test("Send Message (Web)", False, "No token available")
            return
        
        # Check WhatsApp status first
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            status_resp = requests.get(f"{self.api_url}/whatsapp/status", headers=headers)
            if status_resp.status_code == 200:
                status_data = status_resp.json()
                if not status_data.get('connected', False):
                    self.log_test("Send Message (Web)", False, "WhatsApp not connected")
                    return
        except Exception as e:
            self.log_test("Send Message (Web)", False, f"Status check failed: {str(e)}")
            return
        
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.post(f"{self.api_url}/messages/send", 
                json={
                    "number": "9876543210",
                    "message": "Test message from backend test"
                }, 
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'status' in data and data['status'] == 'success':
                    self.log_test("Send Message (Web)", True)
                else:
                    self.log_test("Send Message (Web)", False, "Invalid response format")
            else:
                self.log_test("Send Message (Web)", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Send Message (Web)", False, str(e))

    def test_send_message_api(self):
        """Test sending message via API endpoint"""
        if not self.api_key:
            self.log_test("Send Message (API)", False, "No API key available")
            return
        
        # Check WhatsApp status first
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            status_resp = requests.get(f"{self.api_url}/whatsapp/status", headers=headers)
            if status_resp.status_code == 200:
                status_data = status_resp.json()
                if not status_data.get('connected', False):
                    self.log_test("Send Message (API)", False, "WhatsApp not connected")
                    return
        except Exception as e:
            self.log_test("Send Message (API)", False, f"Status check failed: {str(e)}")
            return
        
        try:
            headers = {'api-key': self.api_key}
            response = requests.get(f"{self.api_url}/send", 
                params={
                    "number": "9876543210",
                    "msg": "Test message from API endpoint"
                }, 
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'status' in data and data['status'] == 'success':
                    self.log_test("Send Message (API)", True)
                else:
                    self.log_test("Send Message (API)", False, "Invalid response format")
            else:
                self.log_test("Send Message (API)", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Send Message (API)", False, str(e))

    def test_message_logs(self):
        """Test message logs retrieval"""
        if not self.token:
            self.log_test("Message Logs", False, "No token available")
            return
        
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.get(f"{self.api_url}/messages/logs", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Message Logs", True)
                else:
                    self.log_test("Message Logs", False, "Response is not a list")
            else:
                self.log_test("Message Logs", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Message Logs", False, str(e))

    def test_message_logs_filtered(self):
        """Test message logs with status filter"""
        if not self.token:
            self.log_test("Message Logs (Filtered)", False, "No token available")
            return
        
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.get(f"{self.api_url}/messages/logs?status=sent", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Message Logs (Filtered)", True)
                else:
                    self.log_test("Message Logs (Filtered)", False, "Response is not a list")
            else:
                self.log_test("Message Logs (Filtered)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Message Logs (Filtered)", False, str(e))

    def test_regenerate_api_key(self):
        """Test API key regeneration"""
        if not self.token:
            self.log_test("Regenerate API Key", False, "No token available")
            return
        
        old_key = self.api_key
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.post(f"{self.api_url}/keys/regenerate", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'api_key' in data and data['api_key'] != old_key:
                    self.api_key = data['api_key']
                    self.log_test("Regenerate API Key", True)
                else:
                    self.log_test("Regenerate API Key", False, "New key not generated or same as old")
            else:
                self.log_test("Regenerate API Key", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Regenerate API Key", False, str(e))

    def test_whatsapp_disconnect(self):
        """Test WhatsApp disconnection"""
        if not self.token:
            self.log_test("WhatsApp Disconnect", False, "No token available")
            return
        
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.post(f"{self.api_url}/whatsapp/disconnect", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'success' in data:
                    self.log_test("WhatsApp Disconnect", True)
                else:
                    self.log_test("WhatsApp Disconnect", False, "Missing success field")
            else:
                self.log_test("WhatsApp Disconnect", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("WhatsApp Disconnect", False, str(e))

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting WhatsApp Automation Backend API Tests")
        print(f"📍 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Test user registration and login
        email, password = self.test_user_registration()
        if email and password:
            self.test_user_login(email, password)
        
        # Test authenticated endpoints
        self.test_get_user_profile()
        
        # Test WhatsApp service integration
        self.test_whatsapp_initialize()
        
        # Wait a bit for WhatsApp service to initialize
        print("⏳ Waiting 3 seconds for WhatsApp service to initialize...")
        time.sleep(3)
        
        self.test_whatsapp_status()
        self.test_whatsapp_qr()
        
        # Test message sending (both web and API)
        self.test_send_message_web()
        self.test_send_message_api()
        
        # Test message logs
        self.test_message_logs()
        self.test_message_logs_filtered()
        
        # Test API key management
        self.test_regenerate_api_key()
        
        # Test disconnect (last to avoid affecting other tests)
        self.test_whatsapp_disconnect()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed. Check the details above.")
            return 1

def main():
    tester = WhatsAppAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())