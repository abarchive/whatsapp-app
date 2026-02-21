"""
Password Reset Feature Tests
Tests for admin password reset, force_password_change flow, and change-password endpoint
"""
import pytest
import requests
import os
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@admin.com"
ADMIN_PASSWORD = "Admin@7501"


class TestAdminPasswordReset:
    """Tests for admin password reset functionality"""
    
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
    
    def test_reset_password_endpoint_exists(self):
        """Test that reset-password endpoint exists and requires auth"""
        # Without auth should fail
        response = requests.post(f"{BASE_URL}/api/admin/reset-password/fake-id")
        assert response.status_code in [401, 403], "Should require authentication"
    
    def test_reset_password_for_nonexistent_user(self):
        """Test reset password for non-existent user returns 404"""
        fake_uuid = "00000000-0000-0000-0000-000000000000"
        response = requests.post(
            f"{BASE_URL}/api/admin/reset-password/{fake_uuid}",
            headers=self.headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_reset_password_success(self):
        """Test successful password reset flow"""
        # Step 1: Create a test user
        test_email = f"TEST_reset_pwd_{os.urandom(4).hex()}@test.com"
        create_response = requests.post(
            f"{BASE_URL}/api/admin/users",
            headers=self.headers,
            json={"email": test_email, "password": "OldPassword@123"}
        )
        assert create_response.status_code == 200, f"Failed to create user: {create_response.text}"
        user_id = create_response.json()["user_id"]
        
        # Step 2: Reset the password
        reset_response = requests.post(
            f"{BASE_URL}/api/admin/reset-password/{user_id}",
            headers=self.headers
        )
        assert reset_response.status_code == 200, f"Reset failed: {reset_response.text}"
        
        reset_data = reset_response.json()
        assert reset_data["success"] == True
        assert "temporary_password" in reset_data
        assert "message" in reset_data
        assert len(reset_data["temporary_password"]) >= 8, "Temporary password should be at least 8 chars"
        
        temp_password = reset_data["temporary_password"]
        
        # Step 3: Verify user can login with temporary password
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": temp_password
        })
        assert login_response.status_code == 200, f"Login with temp password failed: {login_response.text}"
        
        login_data = login_response.json()
        assert login_data["user"]["force_password_change"] == True, "force_password_change should be True"
        
        # Cleanup: Delete test user
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=self.headers)
    
    def test_reset_password_generates_strong_password(self):
        """Test that generated password meets strength requirements"""
        # Create a test user
        test_email = f"TEST_strong_pwd_{os.urandom(4).hex()}@test.com"
        create_response = requests.post(
            f"{BASE_URL}/api/admin/users",
            headers=self.headers,
            json={"email": test_email, "password": "OldPassword@123"}
        )
        user_id = create_response.json()["user_id"]
        
        # Reset password
        reset_response = requests.post(
            f"{BASE_URL}/api/admin/reset-password/{user_id}",
            headers=self.headers
        )
        temp_password = reset_response.json()["temporary_password"]
        
        # Verify password strength
        assert len(temp_password) >= 8, "Password should be at least 8 characters"
        assert any(c.isupper() for c in temp_password), "Password should have uppercase"
        assert any(c.islower() for c in temp_password), "Password should have lowercase"
        assert any(c.isdigit() for c in temp_password), "Password should have digit"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=self.headers)
    
    def test_reset_password_clears_plain_password(self):
        """Test that reset password clears the plain_password field"""
        # Create a test user
        test_email = f"TEST_clear_pwd_{os.urandom(4).hex()}@test.com"
        create_response = requests.post(
            f"{BASE_URL}/api/admin/users",
            headers=self.headers,
            json={"email": test_email, "password": "OldPassword@123"}
        )
        user_id = create_response.json()["user_id"]
        
        # Verify plain_password exists before reset
        users_response = requests.get(f"{BASE_URL}/api/admin/users", headers=self.headers)
        users = users_response.json()["users"]
        user_before = next((u for u in users if u["id"] == user_id), None)
        assert user_before is not None
        assert user_before.get("plain_password") == "OldPassword@123"
        
        # Reset password
        requests.post(f"{BASE_URL}/api/admin/reset-password/{user_id}", headers=self.headers)
        
        # Verify plain_password is cleared after reset
        users_response = requests.get(f"{BASE_URL}/api/admin/users", headers=self.headers)
        users = users_response.json()["users"]
        user_after = next((u for u in users if u["id"] == user_id), None)
        assert user_after.get("plain_password") is None, "plain_password should be cleared after reset"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=self.headers)


class TestChangePassword:
    """Tests for user change password functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token and create test user"""
        # Admin login
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if admin_response.status_code == 200:
            self.admin_token = admin_response.json()["access_token"]
            self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_change_password_endpoint_requires_auth(self):
        """Test that change-password endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/change-password", json={
            "current_password": "test",
            "new_password": "NewPass@123"
        })
        assert response.status_code in [401, 403], "Should require authentication"
    
    def test_change_password_wrong_current_password(self):
        """Test change password with wrong current password"""
        # Create test user
        test_email = f"TEST_wrong_pwd_{os.urandom(4).hex()}@test.com"
        create_response = requests.post(
            f"{BASE_URL}/api/admin/users",
            headers=self.admin_headers,
            json={"email": test_email, "password": "CorrectPass@123"}
        )
        user_id = create_response.json()["user_id"]
        
        # Login as test user
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "CorrectPass@123"
        })
        user_token = login_response.json()["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}
        
        # Try to change password with wrong current password
        change_response = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers=user_headers,
            json={
                "current_password": "WrongPassword@123",
                "new_password": "NewPassword@123"
            }
        )
        assert change_response.status_code == 400, f"Expected 400, got {change_response.status_code}"
        assert "incorrect" in change_response.json()["detail"].lower()
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=self.admin_headers)
    
    def test_change_password_weak_new_password(self):
        """Test change password with weak new password"""
        # Create test user
        test_email = f"TEST_weak_pwd_{os.urandom(4).hex()}@test.com"
        create_response = requests.post(
            f"{BASE_URL}/api/admin/users",
            headers=self.admin_headers,
            json={"email": test_email, "password": "CorrectPass@123"}
        )
        user_id = create_response.json()["user_id"]
        
        # Login as test user
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "CorrectPass@123"
        })
        user_token = login_response.json()["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}
        
        # Test various weak passwords
        weak_passwords = [
            ("short", "Password too short"),
            ("nouppercase123", "No uppercase"),
            ("NOLOWERCASE123", "No lowercase"),
            ("NoNumbersHere", "No numbers"),
        ]
        
        for weak_pwd, reason in weak_passwords:
            change_response = requests.post(
                f"{BASE_URL}/api/auth/change-password",
                headers=user_headers,
                json={
                    "current_password": "CorrectPass@123",
                    "new_password": weak_pwd
                }
            )
            assert change_response.status_code == 400, f"Should reject weak password ({reason})"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=self.admin_headers)
    
    def test_change_password_success(self):
        """Test successful password change"""
        # Create test user
        test_email = f"TEST_change_pwd_{os.urandom(4).hex()}@test.com"
        create_response = requests.post(
            f"{BASE_URL}/api/admin/users",
            headers=self.admin_headers,
            json={"email": test_email, "password": "OldPassword@123"}
        )
        user_id = create_response.json()["user_id"]
        
        # Login as test user
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "OldPassword@123"
        })
        user_token = login_response.json()["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}
        
        # Change password
        change_response = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers=user_headers,
            json={
                "current_password": "OldPassword@123",
                "new_password": "NewPassword@456"
            }
        )
        assert change_response.status_code == 200, f"Change failed: {change_response.text}"
        assert change_response.json()["success"] == True
        
        # Verify old password no longer works
        old_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "OldPassword@123"
        })
        assert old_login.status_code == 401, "Old password should not work"
        
        # Verify new password works
        new_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "NewPassword@456"
        })
        assert new_login.status_code == 200, "New password should work"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=self.admin_headers)


class TestForcePasswordChangeFlow:
    """Tests for the complete force password change flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if admin_response.status_code == 200:
            self.admin_token = admin_response.json()["access_token"]
            self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_complete_password_reset_flow(self):
        """Test the complete flow: admin reset -> user login -> force change -> access dashboard"""
        # Step 1: Create a test user
        test_email = f"TEST_full_flow_{os.urandom(4).hex()}@test.com"
        create_response = requests.post(
            f"{BASE_URL}/api/admin/users",
            headers=self.admin_headers,
            json={"email": test_email, "password": "InitialPass@123"}
        )
        assert create_response.status_code == 200
        user_id = create_response.json()["user_id"]
        
        # Step 2: Admin resets the password
        reset_response = requests.post(
            f"{BASE_URL}/api/admin/reset-password/{user_id}",
            headers=self.admin_headers
        )
        assert reset_response.status_code == 200
        temp_password = reset_response.json()["temporary_password"]
        
        # Step 3: User logs in with temporary password
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": temp_password
        })
        assert login_response.status_code == 200
        login_data = login_response.json()
        
        # Verify force_password_change is True
        assert login_data["user"]["force_password_change"] == True
        user_token = login_data["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}
        
        # Step 4: User changes password
        new_password = "MyNewSecure@Pass123"
        change_response = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers=user_headers,
            json={
                "current_password": temp_password,
                "new_password": new_password
            }
        )
        assert change_response.status_code == 200
        
        # Step 5: User logs in again with new password
        new_login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": new_password
        })
        assert new_login_response.status_code == 200
        new_login_data = new_login_response.json()
        
        # Verify force_password_change is now False
        assert new_login_data["user"]["force_password_change"] == False
        
        # Step 6: User can access protected endpoints
        new_user_token = new_login_data["access_token"]
        new_user_headers = {"Authorization": f"Bearer {new_user_token}"}
        
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=new_user_headers)
        assert me_response.status_code == 200
        assert me_response.json()["force_password_change"] == False
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=self.admin_headers)
    
    def test_force_password_change_flag_in_me_endpoint(self):
        """Test that /auth/me returns force_password_change flag"""
        # Create test user
        test_email = f"TEST_me_flag_{os.urandom(4).hex()}@test.com"
        create_response = requests.post(
            f"{BASE_URL}/api/admin/users",
            headers=self.admin_headers,
            json={"email": test_email, "password": "TestPass@123"}
        )
        user_id = create_response.json()["user_id"]
        
        # Login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "TestPass@123"
        })
        user_token = login_response.json()["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}
        
        # Check /auth/me before reset
        me_before = requests.get(f"{BASE_URL}/api/auth/me", headers=user_headers)
        assert me_before.status_code == 200
        assert "force_password_change" in me_before.json()
        assert me_before.json()["force_password_change"] == False
        
        # Admin resets password
        requests.post(f"{BASE_URL}/api/admin/reset-password/{user_id}", headers=self.admin_headers)
        
        # Check /auth/me after reset (need to re-login)
        reset_response = requests.post(
            f"{BASE_URL}/api/admin/reset-password/{user_id}",
            headers=self.admin_headers
        )
        temp_password = reset_response.json()["temporary_password"]
        
        new_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": temp_password
        })
        new_token = new_login.json()["access_token"]
        new_headers = {"Authorization": f"Bearer {new_token}"}
        
        me_after = requests.get(f"{BASE_URL}/api/auth/me", headers=new_headers)
        assert me_after.status_code == 200
        assert me_after.json()["force_password_change"] == True
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=self.admin_headers)


class TestActivityLogging:
    """Test that password reset actions are logged"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if admin_response.status_code == 200:
            self.admin_token = admin_response.json()["access_token"]
            self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_password_reset_is_logged(self):
        """Test that password reset action is logged"""
        # Create test user
        test_email = f"TEST_log_reset_{os.urandom(4).hex()}@test.com"
        create_response = requests.post(
            f"{BASE_URL}/api/admin/users",
            headers=self.admin_headers,
            json={"email": test_email, "password": "TestPass@123"}
        )
        user_id = create_response.json()["user_id"]
        
        # Reset password
        requests.post(f"{BASE_URL}/api/admin/reset-password/{user_id}", headers=self.admin_headers)
        
        # Check activity logs
        logs_response = requests.get(f"{BASE_URL}/api/admin/logs?limit=10", headers=self.admin_headers)
        assert logs_response.status_code == 200
        
        logs = logs_response.json()["logs"]
        password_reset_log = next(
            (log for log in logs if log["action"] == "PASSWORD_RESET" and test_email in log.get("details", "")),
            None
        )
        assert password_reset_log is not None, "Password reset should be logged"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=self.admin_headers)
    
    def test_password_change_is_logged(self):
        """Test that password change action is logged"""
        # Create test user
        test_email = f"TEST_log_change_{os.urandom(4).hex()}@test.com"
        create_response = requests.post(
            f"{BASE_URL}/api/admin/users",
            headers=self.admin_headers,
            json={"email": test_email, "password": "OldPass@123"}
        )
        user_id = create_response.json()["user_id"]
        
        # Login as user
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "OldPass@123"
        })
        user_token = login_response.json()["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}
        
        # Change password
        requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers=user_headers,
            json={
                "current_password": "OldPass@123",
                "new_password": "NewPass@456"
            }
        )
        
        # Check activity logs
        logs_response = requests.get(f"{BASE_URL}/api/admin/logs?limit=10", headers=self.admin_headers)
        logs = logs_response.json()["logs"]
        
        password_change_log = next(
            (log for log in logs if log["action"] == "PASSWORD_CHANGED" and log.get("user_email") == test_email),
            None
        )
        assert password_change_log is not None, "Password change should be logged"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=self.admin_headers)
