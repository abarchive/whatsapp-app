module.exports = {
  apps: [

    {
      name: "backend",
      cwd: "/root/whatsapp-app/backend",
      script: "venv/bin/python",
      args: "-m uvicorn server:socket_app --host 127.0.0.1 --port 8001 --workers 1",
      interpreter: "none"
    },

    {
      name: "whatsapp",
      cwd: "/root/whatsapp-app/whatsapp-service",
      script: "index.js",
      env: {
        BACKEND_URL: "http://127.0.0.1:8001"
      }
    }

  ]
};
