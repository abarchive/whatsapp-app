"""
Admin Panel API Tests
Tests for admin authentication, user management, analytics, system status, settings, and logs
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@admin.com"
ADMIN_PASSWORD = "Admin@7501"

class TestAdminAuth:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        
    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        
    def test_non_admin_cannot_access_admin_endpoints(self):
        """Test that non-admin users cannot access admin endpoints"""
        # First register a regular user
        test_email = f"TEST_regular_user_{os.urandom(4).hex()}@test.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "TestPass@123"
        })
        
        if reg_response.status_code == 200:
            # Login as regular user
            login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": test_email,
                "password": "TestPass@123"
            })
            
            if login_response.status_code == 200:
                token = login_response.json()["access_token"]
                headers = {"Authorization": f"Bearer {token}"}
                
                # Try to access admin endpoint
                admin_response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
                assert admin_response.status_code == 403, "Non-admin should get 403"


class TestAdminUsers:
    """Admin user management tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.admin_token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_get_all_users(self):
        """Test fetching all users"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "users" in data
        assert "total" in data
        assert isinstance(data["users"], list)
        assert data["total"] >= 1  # At least admin user exists
        
    def test_create_user(self):
        """Test creating a new user via admin"""
        test_email = f"TEST_admin_created_{os.urandom(4).hex()}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/admin/users", 
            headers=self.headers,
            json={
                "email": test_email,
                "password": "TestPass@123",
                "role": "user",
                "rate_limit": 50
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "user_id" in data
        
        # Verify user was created by fetching
        users_response = requests.get(f"{BASE_URL}/api/admin/users", headers=self.headers)
        users = users_response.json()["users"]
        created_user = next((u for u in users if u["email"] == test_email), None)
        assert created_user is not None, "Created user not found"
        
    def test_update_user(self):
        """Test updating a user"""
        # First create a user
        test_email = f"TEST_update_user_{os.urandom(4).hex()}@test.com"
        create_response = requests.post(f"{BASE_URL}/api/admin/users",
            headers=self.headers,
            json={"email": test_email, "password": "TestPass@123"}
        )
        
        if create_response.status_code == 200:
            user_id = create_response.json()["user_id"]
            
            # Update the user
            update_response = requests.put(f"{BASE_URL}/api/admin/users/{user_id}",
                headers=self.headers,
                json={"rate_limit": 100, "status": "suspended"}
            )
            assert update_response.status_code == 200
            
            # Verify update
            users_response = requests.get(f"{BASE_URL}/api/admin/users", headers=self.headers)
            users = users_response.json()["users"]
            updated_user = next((u for u in users if u["id"] == user_id), None)
            assert updated_user is not None
            assert updated_user["rate_limit"] == 100
            assert updated_user["status"] == "suspended"
            
    def test_delete_user(self):
        """Test deleting a user"""
        # First create a user
        test_email = f"TEST_delete_user_{os.urandom(4).hex()}@test.com"
        create_response = requests.post(f"{BASE_URL}/api/admin/users",
            headers=self.headers,
            json={"email": test_email, "password": "TestPass@123"}
        )
        
        if create_response.status_code == 200:
            user_id = create_response.json()["user_id"]
            
            # Delete the user
            delete_response = requests.delete(f"{BASE_URL}/api/admin/users/{user_id}",
                headers=self.headers
            )
            assert delete_response.status_code == 200
            
            # Verify deletion
            users_response = requests.get(f"{BASE_URL}/api/admin/users", headers=self.headers)
            users = users_response.json()["users"]
            deleted_user = next((u for u in users if u["id"] == user_id), None)
            assert deleted_user is None, "User should be deleted"


class TestAdminAnalytics:
    """Admin analytics tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.admin_token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_get_analytics_overview(self):
        """Test fetching analytics overview"""
        response = requests.get(f"{BASE_URL}/api/admin/analytics/overview", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "users" in data
        assert "messages" in data
        assert "total" in data["users"]
        assert "active" in data["users"]
        assert "total" in data["messages"]
        assert "success_rate" in data["messages"]
        
    def test_get_message_analytics(self):
        """Test fetching message analytics"""
        response = requests.get(f"{BASE_URL}/api/admin/analytics/messages?days=7", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
    def test_get_users_activity(self):
        """Test fetching users activity"""
        response = requests.get(f"{BASE_URL}/api/admin/analytics/users-activity?days=7", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)


class TestAdminSystem:
    """Admin system status tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.admin_token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_get_system_status(self):
        """Test fetching system status"""
        response = requests.get(f"{BASE_URL}/api/admin/system/status", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "whatsapp_service" in data
        assert "database" in data
        assert "timestamp" in data


class TestAdminWhatsApp:
    """Admin WhatsApp session tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.admin_token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_get_whatsapp_sessions(self):
        """Test fetching WhatsApp sessions"""
        response = requests.get(f"{BASE_URL}/api/admin/whatsapp/sessions", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "global_session" in data


class TestAdminSettings:
    """Admin settings tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.admin_token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_get_settings(self):
        """Test fetching settings"""
        response = requests.get(f"{BASE_URL}/api/admin/settings", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "default_rate_limit" in data
        assert "max_rate_limit" in data
        assert "enable_registration" in data
        assert "maintenance_mode" in data
        
    def test_update_settings(self):
        """Test updating settings"""
        # Get current settings
        get_response = requests.get(f"{BASE_URL}/api/admin/settings", headers=self.headers)
        original_settings = get_response.json()
        
        # Update settings
        update_response = requests.put(f"{BASE_URL}/api/admin/settings",
            headers=self.headers,
            json={"default_rate_limit": 40}
        )
        assert update_response.status_code == 200
        
        # Verify update
        verify_response = requests.get(f"{BASE_URL}/api/admin/settings", headers=self.headers)
        updated_settings = verify_response.json()
        assert updated_settings["default_rate_limit"] == 40
        
        # Restore original settings
        requests.put(f"{BASE_URL}/api/admin/settings",
            headers=self.headers,
            json={"default_rate_limit": original_settings.get("default_rate_limit", 30)}
        )


class TestAdminLogs:
    """Admin activity logs tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.admin_token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_get_activity_logs(self):
        """Test fetching activity logs"""
        response = requests.get(f"{BASE_URL}/api/admin/logs?limit=20&skip=0", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "logs" in data
        assert "total" in data
        assert isinstance(data["logs"], list)
        
    def test_logs_pagination(self):
        """Test logs pagination"""
        # Get first page
        page1_response = requests.get(f"{BASE_URL}/api/admin/logs?limit=5&skip=0", headers=self.headers)
        assert page1_response.status_code == 200
        
        # Get second page
        page2_response = requests.get(f"{BASE_URL}/api/admin/logs?limit=5&skip=5", headers=self.headers)
        assert page2_response.status_code == 200


class TestAdminRouteProtection:
    """Test admin route protection"""
    
    def test_unauthenticated_access_denied(self):
        """Test that unauthenticated requests are denied"""
        endpoints = [
            "/api/admin/users",
            "/api/admin/analytics/overview",
            "/api/admin/system/status",
            "/api/admin/whatsapp/sessions",
            "/api/admin/settings",
            "/api/admin/logs"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code in [401, 403], f"Endpoint {endpoint} should require auth"
